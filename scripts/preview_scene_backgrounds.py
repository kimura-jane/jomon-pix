#!/usr/bin/env python3
"""Visual audit and XML validation of JOMON pix original scene backgrounds."""
from pathlib import Path
from io import BytesIO
import xml.etree.ElementTree as ET
import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SCENES = ["fuji", "sakura", "coast", "shrine", "skyline", "dreamy"]
SRC = ROOT / "public" / "backgrounds" / "v1"
OUT = ROOT / "docs" / "audit" / "scene-backgrounds-preview.jpg"

def main() -> None:
    tile_w, tile_h = 280, 505
    cols = 3
    result = Image.new("RGB", (tile_w * cols, tile_h * 2), "#f9f7fa")
    draw = ImageDraw.Draw(result)
    for i, name in enumerate(SCENES):
        source = SRC / f"{name}.svg"
        data = source.read_bytes()
        tree = ET.fromstring(data)
        if tree.tag != "{http://www.w3.org/2000/svg}svg":
            raise RuntimeError(f"Not SVG: {name}")
        binary = cairosvg.svg2png(bytestring=data, output_width=250, output_height=450)
        with Image.open(BytesIO(binary)) as im:
            img = im.convert("RGB")
        x, y = (i % cols) * tile_w, (i // cols) * tile_h
        result.paste(img, (x+15,y+30))
        draw.text((x+17,y+9), name.upper(), fill="#2d2836")
        print(name, len(binary), "raster pixels", img.size, flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUT, "JPEG", quality=90, optimize=True)
    print("Wrote preview", OUT, "bytes", OUT.stat().st_size)

if __name__ == "__main__":
    main()
