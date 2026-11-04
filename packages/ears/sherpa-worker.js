// One-shot SenseVoice worker. The plugin spawns this only while it needs to
// transcribe, so the model is not resident when nobody is listening.
//
//   node sherpa-worker.js --model model.int8.onnx --tokens tokens.txt \
//     --file 16k.wav --language zh --threads 2
//
// Prints exactly one JSON line on stdout: {ok, text} or {ok:false, error}.
import { readFileSync } from 'node:fs'
import { wavSamples } from './wav.js'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}

function out(value) {
  process.stdout.write(JSON.stringify(value) + '\n')
}

function clean(text) {
  return String(text ?? '')
    .replace(/<\|[^|]+\|>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

try {
  const model = arg('model')
  const tokens = arg('tokens')
  const file = arg('file')
  const language = arg('language', 'zh')
  const threads = Number(arg('threads', '2')) || 2
  if (!model || !tokens || !file) throw new Error('sherpa-worker: --model, --tokens and --file are required')
  let sherpa
  try { sherpa = await import('sherpa-onnx-node') } catch (error) {
    throw new Error(`找不到 sherpa-onnx-node：${error.message}；在 packages/ears 里 npm install sherpa-onnx-node`)
  }
  const wav = wavSamples(readFileSync(file))
  if (wav.sampleRate !== 16000) throw new Error(`sherpa: expected 16 kHz mono, got ${wav.sampleRate} Hz`)
  const recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      senseVoice: { model, language, useInverseTextNormalization: 1 },
      tokens,
      numThreads: threads,
      provider: 'cpu',
      debug: 0,
    },
  })
  const stream = recognizer.createStream()
  stream.acceptWaveform({ sampleRate: 16000, samples: wav.samples })
  recognizer.decode(stream)
  const result = recognizer.getResult(stream)
  out({ ok: true, text: clean(result.text ?? result), rawText: result.text ?? '' })
} catch (error) {
  out({ ok: false, error: String(error?.message ?? error) })
  process.exitCode = 1
}
