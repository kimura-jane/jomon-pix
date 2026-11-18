#!/usr/bin/env python3
"""Bundle the pinned MI-GAN mobile inpainting model and WASM runtime.

One-time asset import in a temporary feature branch, never at user runtime.
Model from original authors, MIT; checksum guards untrusted mutable downloads.
"""
from __future__ import annotations
from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen
import shutil

ROOT = Path(__file__).resolve().parent.parent
ASSET = ROOT / "public" / "ai" / "inpaint"
RUNTIME = ROOT / "node_modules" / "onnxruntime-web" / "dist"
MODEL = "migan_pipeline_v2.onnx"
SIZE = 28079181
SHA256 = "6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b"
URL = ("https://huggingface.co/andraniksargsyan/migan/resolve/"
       "1538c135034b8cfe7a8472f34d09c8a5a45b17a7/migan_pipeline_v2.onnx")

ASSET.mkdir(parents=True, exist_ok=True)
model = ASSET / MODEL
if not model.is_file() or model.stat().st_size != SIZE or sha256(model.read_bytes()).hexdigest() != SHA256:
    temporary = model.with_suffix(".part")
    req = Request(URL, headers={"User-Agent": "JOMON-PIX-model-import/1.0"})
    with urlopen(req, timeout=180) as response, temporary.open("wb") as output:
        shutil.copyfileobj(response, output)
    actual = sha256(temporary.read_bytes()).hexdigest()
    if temporary.stat().st_size != SIZE or actual != SHA256:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"MI-GAN model changed or truncated: {actual}")
    temporary.replace(model)

for suffix in (".mjs", ".wasm"):
    name = "ort-wasm-simd-threaded" + suffix
    source = RUNTIME / name
    if not source.is_file() or source.stat().st_size < 10000:
        raise RuntimeError(f"Pinned ONNX Runtime Web asset unavailable: {source}")
    shutil.copyfile(source, ASSET / name)

print("MI-GAN ONNX + ONNX Runtime WASM bundled locally, SHA-256 verified")
