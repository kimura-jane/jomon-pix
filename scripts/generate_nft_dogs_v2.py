#!/usr/bin/env python3
"""Generate high-quality transparent TAF DOG stickers without altering saved-art URLs.

READ ONLY: pinned NFT artwork in kimura-jane/inu.
WRITE ONLY: jomon-pix/public/stickers/taf-dog/v2/ and audit preview.
Old public/stickers/taf-dog/taf_dog_XX.webp remain untouched to keep saved
projects that refer to them working.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
import json

import numpy as np
from scipy.ndimage import label as label_components
from PIL import Image, ImageFilter, ImageDraw, ImageOps
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "stickers" / "taf-dog" / "v2"
AUDIT = ROOT / "docs" / "audit"
SOURCE_COMMIT = "1cdcd7d35a0d2657be95b40d049bab11d4538229"
MODEL = "u2net"
SIZE, PADDING = 512, 22
THRESHOLD = 70
COUNT = 20


def download(number: int) -> bytes:
    url = (
        "https://raw.githubusercontent.com/kimura-jane/inu/"
        f"{SOURCE_COMMIT}/taf_dog_{number:02d}.png"
    )
    req = Request(url, headers={"User-Agent": "JOMON-pix-TAFDOG-v2/1.0"})
    with urlopen(req, timeout=90) as response:
        raw = response.read()
    if len(raw) < 10000 or not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"Invalid read-only source artwork: {number:02d}")
    return raw


def extract_main_silhouette(mask: Image.Image) -> Image.Image:
    binary = mask.convert("L").point(lambda x: 255 if x >= THRESHOLD else 0)
    binary = binary.filter(ImageFilter.MedianFilter(size=3))
    active = np.asarray(binary) > 0
    components, count = label_components(
        active, structure=np.ones((3, 3), dtype=np.uint8)
    )
    if count < 1:
        raise RuntimeError("Segmentation yielded no foreground components")
    sizes = np.bincount(components.ravel())
    sizes[0] = 0  # label 0 is background
    largest = int(sizes.argmax())
    if sizes[largest] < active.size * 0.04:
        raise RuntimeError("Foreground component implausibly small")
    # Keep the dog's connected silhouette, discard detached street lights,
    # ceiling lights, leaves, and other background fragments.
    only_dog = Image.fromarray(
        np.where(components == largest, 255, 0).astype("uint8"), mode="L"
    )
    return only_dog.filter(ImageFilter.GaussianBlur(0.6))


def make_sticker(original: bytes, session) -> tuple[Image.Image, dict]:
    artwork = Image.open(BytesIO(original)).convert("RGBA")
    mask_bytes = remove(
        original, session=session, only_mask=True,
        alpha_matting=False, post_process_mask=False,
    )
    model_mask = Image.open(BytesIO(mask_bytes)).convert("L")
    alpha = extract_main_silhouette(model_mask)
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("Empty foreground mask")
    cropped = artwork.copy()
    cropped.putalpha(alpha)
    cropped = cropped.crop(bbox)
    ratio = min(
        (SIZE - 2 * PADDING) / cropped.width,
        (SIZE - 2 * PADDING) / cropped.height,
    )
    shape = (max(1, round(cropped.width * ratio)), max(1, round(cropped.height * ratio)))
    cropped = cropped.resize(shape, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(
        cropped, ((SIZE - shape[0]) // 2, (SIZE - shape[1]) // 2)
    )
    final_alpha = canvas.getchannel("A")
    histogram = final_alpha.histogram()
    opaque_rate = sum(histogram[245:]) / (SIZE * SIZE)
    if not 0.05 <= opaque_rate <= 0.8:
        raise RuntimeError(f"Suspicious foreground opacity: {opaque_rate:.3f}")
    for position in [(0, 0), (SIZE - 1, 0), (0, SIZE - 1), (SIZE - 1, SIZE - 1)]:
        if final_alpha.getpixel(position) != 0:
            raise RuntimeError("Non-transparent sticker corner")
    return canvas, {
        "fully_opaque_fraction": round(opaque_rate, 4),
        "size": list(canvas.size),
        "source_sha": SOURCE_COMMIT,
        "model": MODEL,
        "threshold": THRESHOLD,
    }


def preview(stickers: list[tuple[str, Image.Image]]) -> None:
    cols, tw, th = 5, 240, 244
    sheet = Image.new(
        "RGB", (cols * tw, th * ((len(stickers) + cols - 1) // cols)), "white"
    )
    draw = ImageDraw.Draw(sheet)
    for i, (name, sticker) in enumerate(stickers):
        x, y = (i % cols) * tw, (i // cols) * th
        board = Image.new("RGB", (224, 213), (231, 232, 234))
        squares = ImageDraw.Draw(board)
        for xx in range(0, 224, 24):
            for yy in range(0, 213, 24):
                if (xx // 24 + yy // 24) % 2 == 0:
                    squares.rectangle((xx, yy, xx + 23, yy + 23), fill=(200, 203, 207))
        small = ImageOps.contain(sticker, (224, 213), Image.Resampling.LANCZOS)
        board.paste(
            small, ((224 - small.width) // 2, (213 - small.height) // 2), small
        )
        sheet.paste(board, (x + 8, y + 25))
        draw.text((x + 8, y + 6), name, fill=(0, 0, 0))
    AUDIT.mkdir(parents=True, exist_ok=True)
    sheet.save(
        AUDIT / "preview-final-v2.jpg",
        "JPEG", quality=92, progressive=True, optimize=True,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    session = new_session(MODEL)
    stickers = []
    report = {}
    for number in range(1, COUNT + 1):
        original = download(number)
        rendered, metrics = make_sticker(original, session)
        name = f"taf_dog_{number:02d}.webp"
        outpath = OUT / name
        rendered.save(outpath, format="WEBP", quality=94, method=6)
        with Image.open(outpath) as checked:
            if checked.size != (SIZE, SIZE) or checked.getchannel("A").getextrema()[0] > 0:
                raise RuntimeError(f"Final WebP validation failed: {name}")
        metrics["bytes"] = outpath.stat().st_size
        report[name] = metrics
        stickers.append((f"TAF DOG {number:02d}", rendered))
        print(name, metrics, flush=True)
    if len(stickers) != COUNT:
        raise RuntimeError("Expected exactly 20 dog stickers")
    preview(stickers)
    (AUDIT / "final-v2-metrics.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print("Validated 20 versioned NFT dog assets; legacy paths untouched", flush=True)


if __name__ == "__main__":
    main()
