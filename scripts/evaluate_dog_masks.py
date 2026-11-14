#!/usr/bin/env python3
"""Compare alternative segmentation models without touching published stickers."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageFilter, ImageOps, ImageDraw
from rembg import new_session, remove
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "audit"
SOURCE_COMMIT = "1cdcd7d35a0d2657be95b40d049bab11d4538229"
MODELS = ["u2net", "isnet-general-use"]
SIZE = 512
PADDING = 22
THRESHOLD = 70


def original(number: int) -> bytes:
    url = (
        "https://raw.githubusercontent.com/kimura-jane/inu/"
        f"{SOURCE_COMMIT}/taf_dog_{number:02d}.png"
    )
    req = Request(url, headers={"User-Agent": "JOMON-pix-mask-test/1.0"})
    with urlopen(req, timeout=90) as res:
        data = res.read()
    if len(data) < 10000:
        raise RuntimeError(f"Bad source {number}")
    return data


def make_cutout(source: bytes, session) -> tuple[Image.Image, dict]:
    base = Image.open(BytesIO(source)).convert("RGBA")
    mask_data = remove(
        source, session=session, only_mask=True, alpha_matting=False,
        post_process_mask=False,
    )
    mask = Image.open(BytesIO(mask_data)).convert("L")
    # Preserve original artwork RGB completely; make the foreground opaque,
    # with only a 1px transition at the outer silhouette.
    binary = mask.point(lambda x: 255 if x >= THRESHOLD else 0)
    binary = binary.filter(ImageFilter.MedianFilter(size=3))
    binary = binary.filter(ImageFilter.GaussianBlur(radius=0.6))
    base.putalpha(binary)
    bbox = binary.getbbox()
    if bbox is None:
        bbox = (0, 0, base.width, base.height)
    cropped = base.crop(bbox)
    ratio = min((SIZE - 2 * PADDING) / cropped.width, (SIZE - 2 * PADDING) / cropped.height)
    size = (max(1, round(cropped.width * ratio)), max(1, round(cropped.height * ratio)))
    cropped = cropped.resize(size, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    result.alpha_composite(cropped, ((SIZE - size[0]) // 2, (SIZE - size[1]) // 2))
    histogram = binary.histogram()
    all_pixels = base.width * base.height
    metrics = {
        "opaque_fraction": round(sum(histogram[245:]) / all_pixels, 3),
        "transparent_fraction": round(sum(histogram[:10]) / all_pixels, 3),
        "bbox_fraction": round((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) / all_pixels, 3),
        "bbox": list(bbox),
    }
    return result, metrics


def board(items: list[tuple[str, Image.Image]], name: str) -> None:
    tw, th, cols = 240, 244, 5
    height = th * ((len(items) + cols - 1) // cols)
    sheet = Image.new("RGB", (tw * cols, height), "white")
    draw = ImageDraw.Draw(sheet)
    for idx, (caption, im) in enumerate(items):
        x, y = (idx % cols) * tw, (idx // cols) * th
        bg = Image.new("RGB", (224, 227, 232), (235, 236, 237))
        tx = ImageDraw.Draw(bg)
        for xx in range(0, 224, 24):
            for yy in range(0, 213, 24):
                if (xx // 24 + yy // 24) % 2 == 0:
                    tx.rectangle((xx, yy, xx + 23, yy + 23), fill=(202, 205, 210))
        thumb = ImageOps.contain(im, (224, 213), Image.Resampling.LANCZOS)
        bg.paste(thumb, ((224 - thumb.width) // 2, (213 - thumb.height) // 2), thumb)
        sheet.paste(bg, (x + 8, y + 25))
        draw.text((x + 8, y + 5), caption, fill=(0, 0, 0))
    path = OUT / name
    sheet.save(path, "JPEG", quality=89, progressive=True, optimize=True)
    print("Written", path.name, path.stat().st_size, flush=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = [original(i) for i in range(1, 21)]
    reports = {}
    for model in MODELS:
        print("Loading", model, flush=True)
        session = new_session(model)
        items = []
        metrics = {}
        for number, raw in enumerate(src, 1):
            im, stat = make_cutout(raw, session)
            items.append((f"{model} {number:02d}", im))
            metrics[f"{number:02d}"] = stat
            print(model, number, stat, flush=True)
        board(items, f"preview-{model}.jpg")
        reports[model] = metrics
        del session
    (OUT / "segmentation-metrics.json").write_text(
        json.dumps(reports, indent=2, ensure_ascii=False) + "\n"
    )


if __name__ == "__main__":
    main()
