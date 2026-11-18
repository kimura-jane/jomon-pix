#!/usr/bin/env python3
"""Fetch Google's pinned MediaPipe Pose Landmarker Lite model for web/iOS builds.

The browser and native app load this model from their own app assets, not a
runtime CDN. This script is deliberately not called by the running app.
"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
import shutil
from urllib.request import urlopen, Request
import zipfile

MODEL_URL = (
    'https://storage.googleapis.com/mediapipe-models/'
    'pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
)
MIN_BYTES = 4_000_000
MAX_BYTES = 9_000_000


def validate(path: Path) -> None:
    if not path.is_file() or not MIN_BYTES <= path.stat().st_size <= MAX_BYTES:
        raise ValueError(f'Pose model has invalid size: {path}')
    if not zipfile.is_zipfile(path):
        raise ValueError(f'Pose model is not a MediaPipe .task archive: {path}')
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None or not any(
            name.lower().endswith('.tflite') for name in archive.namelist()
        ):
            raise ValueError(f'Incomplete Pose Landmarker archive: {path}')
    print(f'Pose model SHA256: {hashlib.sha256(path.read_bytes()).hexdigest()}', flush=True)


def fetch(path: Path) -> None:
    if path.is_file():
        validate(path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix('.task.part')
    try:
        request = Request(MODEL_URL, headers={'User-Agent': 'JOMON-PIX-pose-builder/1.0'})
        with urlopen(request, timeout=90) as response, part.open('wb') as writer:
            shutil.copyfileobj(response, writer)
        validate(part)
        part.replace(path)
    finally:
        part.unlink(missing_ok=True)
    print(f'Verified local Pose Landmarker Lite model: {path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=Path('public/mediapipe/pose_landmarker_lite.task'))
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if args.verify_only:
        validate(args.out)
    else:
        fetch(args.out)
