#!/usr/bin/env python3
"""Build transparent, reusable hairstyle stickers from an original studio asset sheet.

The source is an original image generated specifically for JOMON PIX.
The generated WebP files are committed to the repository: no runtime CDN.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageOps

STYLES = ["bob", "long", "pixie", "wave", "layered", "bangs", "flattop", "afro", "pompadour"]
COLORS = {
    "black": ("#0e0d0f", "#282527", "#888284"),
    "dark-brown": ("#1d1513", "#49352f", "#ae8d7a"),
    "brown": ("#26150e", "#82543e", "#e3b18f"),
    "blonde": ("#62492f", "#c3a16a", "#f6e8bf"),
    "ash": ("#2c2b2a", "#87827d", "#d2c9bf"),
    "copper": ("#471c15", "#a55135", "#e8a278"),
    "pink": ("#442d38", "#b97f97", "#efd3d9"),
    "silver": ("#3c3b42", "#b6b6c0", "#f7f5f2"),
}
SOURCE = Path("assets/hair-source-3x3.png")
OUTPUT = Path("public/stickers/hair/v2")
assert SOURCE.is_file(), "Studio source image must be available before asset generation"
with Image.open(SOURCE) as input_image:
    image = input_image.convert("RGBA")
assert image.size == (1254, 1254), f"Unexpected image size {image.size}"
OUTPUT.mkdir(parents=True, exist_ok=True)
cell = 418
for index, style in enumerate(STYLES):
    row, col = divmod(index, 3)
    crop = image.crop((col * cell, row * cell, (col + 1) * cell, (row + 1) * cell))
    crop = crop.resize((320, 320), Image.Resampling.LANCZOS)
    alpha = crop.getchannel("A")
    gray = ImageOps.grayscale(crop)
    # Original hair has natural microtexture; stretch only midtones, keep alpha intact.
    gray = gray.point([max(0, min(255, round((i - 9) * 255 / 161))) for i in range(256)])
    for name, (shadow, mid, highlight) in COLORS.items():
        recolored = ImageOps.colorize(gray, black=shadow, mid=mid, white=highlight, midpoint=142).convert("RGBA")
        recolored.putalpha(alpha)
        target = OUTPUT / f"{style}-{name}.webp"
        recolored.save(target, "WEBP", quality=70, method=5, exact=True)
        assert target.stat().st_size > 600, f"Missing detail in {target}"
        print(f"{target}: {target.stat().st_size} bytes")
print(f"Created {len(STYLES)*len(COLORS)} offline transparent wig images")
