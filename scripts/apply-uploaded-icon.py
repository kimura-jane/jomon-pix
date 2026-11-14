#!/usr/bin/env python3
"""Make the iOS AppIcon from the exact user-uploaded image in this repository.

This conversion is lossless at 1024px when source is already 1024px RGB. If
resizing is necessary, use Lanczos. It never adds text, icons or decorations.
Run on GitHub Actions; only jomon-pix gets written.
"""
from __future__ import annotations

from pathlib import Path
import json
from PIL import Image, ImageOps

SOURCE = Path("E6AB4520-0966-4EC1-9AF3-1E4A8BFD5F2E.png")
DEST = Path("ios/App/App/Assets.xcassets/AppIcon.appiconset")
SIZE = 1024

def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Uploaded icon not found: {SOURCE}")
    with Image.open(SOURCE) as image:
        image.verify()
    with Image.open(SOURCE) as image:
        image = ImageOps.exif_transpose(image)
        print("Uploaded icon:", image.size, image.mode)
        if min(image.size) <= 0:
            raise RuntimeError("Source icon has invalid dimensions")
        image = ImageOps.contain(image, (SIZE, SIZE), Image.Resampling.LANCZOS)
        # iOS icons must be opaque. Preserve all visible pixels;
        # fill only transparent corners/borders, if any.
        rgb = Image.new("RGB", (SIZE, SIZE), "#f5d4f1")
        x = (SIZE - image.width) // 2
        y = (SIZE - image.height) // 2
        if "A" in image.getbands() or "transparency" in image.info:
            overlay = image.convert("RGBA")
            rgb.paste(overlay, (x, y), overlay.getchannel("A"))
        else:
            rgb.paste(image.convert("RGB"), (x, y))

    DEST.mkdir(parents=True, exist_ok=True)
    target = DEST / "AppIcon-1024.png"
    rgb.save(target, format="PNG", optimize=True)
    (DEST / "Contents.json").write_text(json.dumps({
        "images": [{
            "filename": target.name,
            "idiom": "universal",
            "platform": "ios",
            "size": "1024x1024",
        }],
        "info": {"author": "xcode", "version": 1},
    }, indent=2) + "\n", encoding="utf-8")

    # This existing second icon file is not referenced in Contents.json.
    # Remove it to avoid someone later mistaking it for the selected icon.
    unused_icon = DEST / "AppIcon-512@2x.png"
    if unused_icon.exists():
        unused_icon.unlink()

    print("Installed user icon:", target, target.stat().st_size, "bytes")
    with Image.open(target) as verified:
        assert verified.size == (SIZE, SIZE) and verified.mode == "RGB"

if __name__ == "__main__":
    main()
