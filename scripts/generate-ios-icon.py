#!/usr/bin/env python3
"""Generate a 1024px opaque JOMON pix icon using only the Python stdlib.

No third-party fonts or image assets are embedded. Writes only to this
repository's Capacitor iOS app icon asset catalog.
"""
from __future__ import annotations
import json
import math
from pathlib import Path
import struct
import zlib

SIZE = 1024
DEST = Path("ios/App/App/Assets.xcassets/AppIcon.appiconset")

def chunk(tag: bytes, payload: bytes) -> bytes:
    block = tag + payload
    return struct.pack(">I", len(payload)) + block + struct.pack(">I", zlib.crc32(block) & 0xFFFFFFFF)

def rounded_rect(x: int, y: int, l: int, t: int, r: int, b: int, radius: int) -> bool:
    if l + radius <= x <= r - radius and t <= y <= b: return True
    if l <= x <= r and t + radius <= y <= b - radius: return True
    cx = l + radius if x < l + radius else r - radius
    cy = t + radius if y < t + radius else b - radius
    return (x - cx)**2 + (y - cy)**2 <= radius**2

def icon_color(x: int, y: int) -> tuple[int, int, int]:
    mix = (0.57*x + 0.43*y) / (SIZE - 1)
    r = int(248 * (1 - mix) + 149 * mix)
    g = int(91 * (1 - mix) + 116 * mix)
    b = int(174 * (1 - mix) + 252 * mix)
    # Subtle glow keeps the pink/purple JOMON pix identity.
    glow = max(0.0, 1 - math.hypot(x - 245, y - 205) / 750)
    r = min(255, int(r + glow * 15))
    g = min(255, int(g + glow * 12))
    b = min(255, int(b + glow * 8))
    # Rounded square camera silhouette.
    outside = rounded_rect(x, y, 225, 285, 803, 759, 100)
    inside = rounded_rect(x, y, 279, 348, 749, 705, 57)
    if outside and not inside:
        return (255, 253, 255)
    # Photo lens and a small flash.
    lens = math.hypot(x - 512, y - 531)
    if 126 < lens < 170:
        return (255, 253, 255)
    if lens < 98:
        return (255, 234, 247)
    if math.hypot(x - 714, y - 359) < 21:
        return (255, 253, 255)
    # One sparkle in the top right corner.
    if abs(x - 795) < 12 + max(0, 46 - abs(y - 234))*0.32 and abs(y-234)<48:
        return (255, 245, 250)
    if abs(y - 234) < 12 + max(0, 46 - abs(x - 795))*0.32 and abs(x-795)<48:
        return (255, 245, 250)
    return (r, g, b)

def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    name = "AppIcon-1024.png"
    compressor = zlib.compressobj(9)
    pixels = bytearray()
    for y in range(SIZE):
        row = bytearray(b"\\x00")  # PNG filter type 0
        for x in range(SIZE):
            row.extend(icon_color(x, y))
        pixels.extend(compressor.compress(row))
    pixels.extend(compressor.flush())
    png = (
        b"\\x89PNG\\r\\n\\x1a\\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", bytes(pixels))
        + chunk(b"IEND", b"")
    )
    (DEST / name).write_bytes(png)
    (DEST / "Contents.json").write_text(
        json.dumps({
            "images": [{
                "filename": name,
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
            }],
            "info": {"author": "xcode", "version": 1},
        }, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Generated AppIcon: {DEST / name} ({len(png)} bytes)")

if __name__ == "__main__":
    main()
