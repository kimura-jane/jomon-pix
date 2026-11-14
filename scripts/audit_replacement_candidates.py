#!/usr/bin/env python3
"""Evaluate replacement NFT dogs from gazo (READ ONLY), without modifying live stickers."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, ImageOps
from rembg import new_session

from generate_nft_dogs_v2 import make_sticker, remove_known_background_fragments

ROOT = Path(__file__).resolve().parents[1]
AUDIT_DIR = ROOT / "docs/audit"
PREVIEW_DIR = AUDIT_DIR / "replacement-candidates"
GAZO_SHA = "c49bafbb08d894c8f2957394afebd48b6c774682"
CANDIDATES = (3, 10, 14, 17, 19, 20, 24, 27)


def fetch_source(number: int) -> bytes:
    url = (
        f"https://raw.githubusercontent.com/kimura-jane/gazo/{GAZO_SHA}/"
        f"tafdog_{number:03d}.png"
    )
    req = Request(url, headers={"User-Agent": "JOMON-pix-replacement-audit/1.0"})
    with urlopen(req, timeout=90) as response:
        raw = response.read()
    if len(raw) < 10000 or not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"Not a valid source PNG: {number:03d}")
    return raw


def contact_sheet(assets: list[tuple[int, Image.Image]]) -> None:
    tile_w, tile_h, cols = 260, 282, 4
    rows = (len(assets) + cols - 1) // cols
    board = Image.new("RGB", (cols * tile_w, rows * tile_h), "white")
    draw = ImageDraw.Draw(board)
    for index, (number, image) in enumerate(assets):
        x, y = (index % cols) * tile_w, (index // cols) * tile_h
        checker = Image.new("RGB", (244, 244), (235, 236, 237))
        ck = ImageDraw.Draw(checker)
        for i in range(0, 244, 24):
            for j in range(0, 244, 24):
                if (i // 24 + j // 24) % 2 == 0:
                    ck.rectangle((i, j, i + 23, j + 23), fill=(202, 204, 208))
        thumbnail = ImageOps.contain(image, (244, 244), Image.Resampling.LANCZOS)
        checker.paste(thumbnail, ((244 - thumbnail.width) // 2, (244 - thumbnail.height) // 2), thumbnail)
        board.paste(checker, (x + 8, y + 30))
        draw.text((x + 9, y + 8), f"gazo TAF DOG #{number:03d}", fill=(15, 15, 15))
    output = AUDIT_DIR / "replacement-candidates-preview.jpg"
    board.save(output, "JPEG", quality=92, progressive=True, optimize=True)
    print("Created contact sheet:", output, flush=True)


def main() -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    session = new_session("u2net")
    assets = []
    for n in CANDIDATES:
        source = fetch_source(n)
        sticker, metrics = make_sticker(source, session)
        sticker = remove_known_background_fragments(sticker, n if n in (16, 19) else 0)
        # Candidate 19 is a different original; no per-index edits from inu should be applied.
        if n == 19:
            sticker, metrics = make_sticker(source, session)
        output = PREVIEW_DIR / f"gazo_{n:03d}.webp"
        sticker.save(output, "WEBP", quality=94, method=6)
        with Image.open(output) as verification:
            if verification.size != (512, 512) or verification.getchannel("A").getextrema()[0] != 0:
                raise RuntimeError(f"Invalid candidate {n}: {output}")
        assets.append((n, sticker))
        print(n, metrics, "bytes", output.stat().st_size, flush=True)
    if len(assets) != 8:
        raise RuntimeError("Expected exactly 8 candidates")
    contact_sheet(assets)


if __name__ == "__main__":
    main()
