#!/usr/bin/env python3
"""本地嗓子：ZipVoice 零样本克隆常驻服务。

POST /tts    {"text": "...", "voice": "<id>"} -> audio/wav
GET  /health -> {"ok": true, "voices": [...]}

模型在 .models/（`npm run models` 下载），参考音频在 assets/（`npm run refs` 生成）。
"""
import argparse
import hashlib
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import sherpa_onnx
import soundfile as sf

PKG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_VOICES = os.path.join(PKG, "assets")
DEFAULT_MODELS = os.path.join(PKG, ".models")

_lock = threading.Lock()
_cache = {}
_order = []
CACHE_MAX = 120


class Voices:
    def __init__(self, dir_path):
        self.dir = dir_path
        self.text = ""
        self.meta = {}
        self.refs = {}
        with open(os.path.join(dir_path, "voices.json"), encoding="utf-8") as fp:
            raw = json.load(fp)
        self.text = raw.get("text", "")
        for v in raw.get("voices", []):
            self.meta[v["id"]] = v

    def ensure(self, voice_id):
        if voice_id in self.refs:
            return self.refs[voice_id]
        v = self.meta.get(voice_id) or {}
        path = os.path.join(self.dir, v.get("file") or f"{voice_id}.wav")
        if not os.path.exists(path):
            raise FileNotFoundError(f"没有参考音频：{path}（先跑 npm run refs）")
        audio, sr = sf.read(path, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        self.refs[voice_id] = (audio, sr)
        return self.refs[voice_id]


def build_tts(model_dir, threads=4):
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            zipvoice=sherpa_onnx.OfflineTtsZipvoiceModelConfig(
                encoder=os.path.join(model_dir, "zipvoice", "encoder.int8.onnx"),
                decoder=os.path.join(model_dir, "zipvoice", "decoder.int8.onnx"),
                data_dir=os.path.join(model_dir, "zipvoice", "espeak-ng-data"),
                lexicon=os.path.join(model_dir, "zipvoice", "lexicon.txt"),
                tokens=os.path.join(model_dir, "zipvoice", "tokens.txt"),
                vocoder=os.path.join(model_dir, "vocos_24khz.onnx"),
                feat_scale=0.1, t_shift=0.5, target_rms=0.1, guidance_scale=1.0,
            ),
            num_threads=threads, provider="cpu",
        ),
        max_num_sentences=1,
    ))


def synth(tts, voices, text, voice_id, steps=8):
    ref, sr = voices.ensure(voice_id)
    gen = sherpa_onnx.GenerationConfig()
    gen.reference_audio = ref
    gen.reference_sample_rate = sr
    gen.reference_text = voices.text
    gen.num_steps = steps
    audio = tts.generate(text, gen)
    return np.asarray(audio.samples, dtype=np.float32), audio.sample_rate


def wav_bytes(samples, rate):
    import io
    buf = io.BytesIO()
    sf.write(buf, samples, rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4321)
    ap.add_argument("--model", default=os.environ.get("COMPANION_VOICE_MODELS", DEFAULT_MODELS))
    ap.add_argument("--voices", default=DEFAULT_VOICES)
    ap.add_argument("--steps", type=int, default=8)
    ap.add_argument("--threads", type=int, default=4)
    a = ap.parse_args()

    t0 = time.time()
    tts = build_tts(a.model, a.threads)
    voices = Voices(a.voices)
    print(f"[voice] 模型加载 {time.time() - t0:.1f}s，音色 {len(voices.meta)} 个", flush=True)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            print("[voice]", fmt % args, flush=True)

        def _json(self, code, obj):
            body = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path.startswith("/health"):
                return self._json(200, {"ok": True, "voices": list(voices.meta)})
            self._json(404, {"error": "not found"})

        def do_POST(self):
            if not self.path.startswith("/tts"):
                return self._json(404, {"error": "not found"})
            try:
                n = int(self.headers.get("content-length", 0))
                req = json.loads(self.rfile.read(n) or b"{}")
            except Exception as e:
                return self._json(400, {"error": f"请求体不是 JSON：{e}"})
            text = (req.get("text") or "").strip()
            voice = req.get("voice") or ""
            if not text:
                return self._json(400, {"error": "text 不能空"})
            if voice not in voices.meta:
                return self._json(400, {"error": f"没有这个音色：{voice}"})

            key = hashlib.sha1(f"{voice}|{text}".encode()).hexdigest()
            if key in _cache:
                data = _cache[key]
            else:
                t1 = time.time()
                with _lock:
                    samples, rate = synth(tts, voices, text, voice, a.steps)
                data = wav_bytes(samples, rate)
                print(f"[voice] {voice} {len(samples)/rate:.1f}s 音频 / {time.time()-t1:.1f}s 合成", flush=True)
                _cache[key] = data
                _order.append(key)
                if len(_order) > CACHE_MAX:
                    _cache.pop(_order.pop(0), None)

            self.send_response(200)
            self.send_header("content-type", "audio/wav")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    print(f"[voice] http://127.0.0.1:{a.port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    sys.exit(main())
