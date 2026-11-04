#!/usr/bin/env node
// 下载 ZipVoice 蒸馏版（int8）+ 声码器到 .models/，校验 sha256。
// 模型不进仓库：约 197 MB。
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(PKG, '.models')
const ZIP = join(OUT, 'zipvoice')

const TAR = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-zipvoice-distill-int8-zh-en-emilia.tar.bz2'
const VOC = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/vocoder-models/vocos_24khz.onnx'

const SHA = {
  'zipvoice/encoder.int8.onnx': 'f2de9a761a85e5ddd125dee6e05bad1c7ee92c11b83b4d775dab216a6aa41379',
  'zipvoice/decoder.int8.onnx': '3cc2e08a96610d7ea1b227398e97cdbbe0414499741d3aec0b8113db2a2ab251',
  'vocos_24khz.onnx': 'bcb3b970e384161c4d634f0bb9e999ff1c471b34c9bc0b1049a5014065ed3cc0',
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

async function download(url, dest) {
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) throw new Error(`下载失败 ${r.status}：${url}`)
  const total = Number(r.headers.get('content-length') || 0)
  let got = 0
  const stream = createWriteStream(dest)
  for await (const chunk of Readable.fromWeb(r.body)) {
    got += chunk.length
    if (total) process.stdout.write(`\r  ${(got / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`)
    if (!stream.write(chunk)) await new Promise((r) => stream.once('drain', r))
  }
  await new Promise((r) => stream.end(r))
  if (total) process.stdout.write('\n')
}

mkdirSync(OUT, { recursive: true })

if (!existsSync(join(ZIP, 'decoder.int8.onnx'))) {
  const tar = join(OUT, 'zipvoice.tar.bz2')
  console.log('下载 ZipVoice（109 MB）…')
  await download(TAR, tar)
  console.log('解压…')
  execFileSync('tar', ['xjf', tar, '-C', OUT], { stdio: 'inherit' })
  rmSync(tar)
  const unpacked = join(OUT, 'sherpa-onnx-zipvoice-distill-int8-zh-en-emilia')
  if (existsSync(unpacked)) renameSync(unpacked, ZIP)
}

if (!existsSync(join(OUT, 'vocos_24khz.onnx'))) {
  console.log('下载声码器…')
  await download(VOC, join(OUT, 'vocos_24khz.onnx'))
}

let bad = 0
for (const [rel, want] of Object.entries(SHA)) {
  const file = join(OUT, rel)
  if (!existsSync(file)) { console.error(`缺少 ${rel}`); bad++; continue }
  const got = sha256(file)
  if (got !== want) { console.error(`校验失败 ${rel}\n  期望 ${want}\n  实际 ${got}`); bad++ }
  else console.log(`✓ ${rel}  ${(statSync(file).size / 1e6).toFixed(1)} MB`)
}
process.exit(bad ? 1 : 0)
