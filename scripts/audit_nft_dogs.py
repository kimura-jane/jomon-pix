#!/usr/bin/env python3
"""Read-only source comparison for TAF DOG sticker quality audit.

Downloads from pinned public commits of inu/gazo (never writes to them).
Writes preview contact sheets only under jomon-pix/docs/audit/.
This does NOT modify the production stickers.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "audit"
STICKERS = ROOT / "public" / "stickers" / "taf-dog"
INU_SHA = "1cdcd7d35a0d2657be95b40d049bab11d4538229"
GAZO_SHA = "c49bafbb08d894c8f2957394afebd48b6c774682"
TILE_W, TILE_H = 240, 244
THUMB_W, THUMB_H = 224, 213
COLS = 5


def download(url: str) -> Image.Image:
    request = Request(url, headers={"User-Agent": "JOMON-pix-quality-audit/1.0"})
    with urlopen(request, timeout=100) as response:
        raw = response.read()
    if len(raw) < 10000:
        raise RuntimeError(f"Unexpected small download: {url}")
    return Image.open(BytesIO(raw)).convert("RGBA")


def checkerboard(width: int, height: int) -> Image.Image:
    board = Image.new("RGB", (width, height), (235, 235, 235))
    draw = ImageDraw.Draw(board)
    block = 12
    for y in range(0, height, block):
        for x in range(0, width, block):
            if (x // block + y // block) % 2:
                draw.rectangle((x, y, x + block - 1, y + block - 1), fill=(200, 200, 200))
    return board


def contact_sheet(images: list[tuple[str, Image.Image]], filename: str, transparent: bool) -> None:
    rows = (len(images) + COLS - 1) // COLS
    result = Image.new("RGB", (TILE_W * COLS, TILE_H * rows), "white")
    draw = ImageDraw.Draw(result)
    for i, (label, im) in enumerate(images):
        x, y = (i % COLS) * TILE_W, (i // COLS) * TILE_H
        board = checkerboard(THUMB_W, THUMB_H) if transparent else Image.new(
            "RGB", (THUMB_W, THUMB_H), (226, 230, 234)
        )
        small = ImageOps.contain(im, (THUMB_W, THUMB_H), method=Image.Resampling.LANCZOS)
        pos = ((THUMB_W - small.width) // 2, (THUMB_H - small.height) // 2)
        if transparent:
            board.paste(small, pos, small)
        else:
            board.paste(small, pos, small.getchannel("A"))
        result.paste(board, (x + 8, y + 24))
        draw.text((x + 10, y + 5), label, fill=(10, 10, 10))
    path = OUT / filename
    result.save(path, "JPEG", quality=87, optimize=True, progressive=True)
    print(f"Generated {path}: {path.stat().st_size:,} bytes", flush=True)


def fetch_many(repo: str, sha: str, prefix: str, ids: range, pad: int) -> list[tuple[str, Image.Image]]:
    data = [None] * len(ids)
    def one(index: int, number: int):
        name = f"{prefix}{number:0{pad}d}.png"
        url = f"https://raw.githubusercontent.com/kimura-jane/{repo}/{sha}/{name}"
        return index, name, download(url)
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(one, i, n) for i, n in enumerate(ids)]
        for f in as_completed(futures):
            i, name, im = f.result()
            data[i] = (name, im)
    return data


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source = fetch_many("inu", INU_SHA, "taf_dog_", range(1, 21), 2)
    contact_sheet(source, "inu-originals.jpg", transparent=False)
    current = []
    for number in range(1, 21):
        path = STICKERS / f"taf_dog_{number:02d}.webp"
        with Image.open(path) as img:
            current.append((f"current {number:02d}", img.convert("RGBA").copy()))
    contact_sheet(current, "current-stickers.jpg", transparent=True)
    for first in (1, 21):
        gazo = fetch_many("gazo", GAZO_SHA, "tafdog_", range(first, first + 20), 3)
        contact_sheet(gazo, f"gazo-originals-{first:03d}-{first + 19:03d}.jpg", transparent=False)


if __name__ == "__main__":
    main()
