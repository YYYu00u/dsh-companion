// Minimal WAV header reader. Enough to validate what the capture helper produced
// and to report duration without decoding the audio.
export function parseWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) throw new Error('not a wav file: too short')
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a wav file: missing RIFF/WAVE')
  let offset = 12
  let fmt
  let data
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > buffer.length) throw new Error('wav: bad fmt chunk')
      fmt = {
        format: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        byteRate: buffer.readUInt32LE(body + 8),
        blockAlign: buffer.readUInt16LE(body + 12),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      data = { offset: body, size: Math.min(size, buffer.length - body) }
    }
    offset = body + size + (size % 2)
  }
  if (!fmt) throw new Error('wav: no fmt chunk')
  if (!data) throw new Error('wav: no data chunk')
  const bytesPerSample = Math.max(1, fmt.bitsPerSample / 8)
  const seconds = data.size / (fmt.sampleRate * fmt.channels * bytesPerSample)
  return { ...fmt, dataOffset: data.offset, dataSize: data.size, seconds }
}

/** Build a tiny PCM16 WAV for tests. */
export function makeWav({ seconds = 1, sampleRate = 16000, channels = 1, value = 0 } = {}) {
  const samples = Math.max(1, Math.round(seconds * sampleRate))
  const dataSize = samples * channels * 2
  const b = Buffer.alloc(44 + dataSize)
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataSize, 4); b.write('WAVE', 8)
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22)
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * channels * 2, 28)
  b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < channels; c++) b.writeInt16LE(value, 44 + (i * channels + c) * 2)
  }
  return b
}

/** Whisper tends to emit these for silence/music; do not feed them to her as speech. */
export function cleanTranscript(text) {
  return String(text ?? '')
    .replace(/\[(BLANK_AUDIO|MUSIC|SOUND|APPLAUSE|LAUGHTER)\]/gi, '')
    .replace(/\((music|音乐|笑声|掌声)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Decode a 16-bit PCM or 32-bit float WAV into mono float32 samples at its own rate. */
export function wavSamples(buffer) {
  const wav = parseWav(buffer)
  const bytes = wav.bitsPerSample / 8
  if (![1, 3].includes(wav.format)) throw new Error(`wav: unsupported format ${wav.format}`)
  if (![16, 32].includes(wav.bitsPerSample)) throw new Error(`wav: unsupported bits ${wav.bitsPerSample}`)
  const frames = Math.floor(wav.dataSize / (bytes * wav.channels))
  const out = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    const at = wav.dataOffset + i * bytes * wav.channels
    if (wav.format === 3) out[i] = buffer.readFloatLE(at)
    else out[i] = buffer.readInt16LE(at) / 32768
  }
  return { samples: out, sampleRate: wav.sampleRate, channels: wav.channels }
}
