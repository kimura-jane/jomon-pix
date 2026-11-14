#!/usr/bin/env python3
"""Validate the committed icon; never overwrite the selected JOMON artwork.

The icon is installed from the user-uploaded GitHub PNG by
scripts/apply-uploaded-icon.py. Codemagic and native preflight call this
validation to prevent returning to the old generated camera icon.
"""
from __future__ import annotations
import json
from pathlib import Path
import struct

SIZE = 1024
DEST = Path("ios/App/App/Assets.xcassets/AppIcon.appiconset")
ICON = DEST / "AppIcon-1024.png"
SOURCE = Path("E6AB4520-0966-4EC1-9AF3-1E4A8BFD5F2E.png")

def main() -> None:
    if not SOURCE.is_file():
        raise RuntimeError("The user-selected source icon is missing: " + str(SOURCE))
    if not ICON.is_file():
        raise RuntimeError("The 1024px iOS icon is missing: " + str(ICON))
    contents = json.loads((DEST / "Contents.json").read_text(encoding="utf-8"))
    if not any(image.get("filename") == ICON.name for image in contents["images"]):
        raise RuntimeError("Xcode's AppIcon asset does not point to the installed image")
    header = ICON.read_bytes()[:33]
    if header[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError("iOS icon is not a PNG")
    width, height, depth, color = struct.unpack(">IIBB", header[16:26])
    if (width, height) != (SIZE, SIZE) or depth != 8 or color != 2:
        raise RuntimeError(
            f"Invalid App Store icon: size={width}x{height}, depth={depth}, PNG color={color}. "
            "Expected an opaque 1024x1024 RGB PNG."
        )
    print(f"Validated user-selected JOMON pix AppIcon ({ICON.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
