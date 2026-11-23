#!/usr/bin/env python3
"""Build six iOS alternate icon sets from unchanged gazo/icon/<n>/masters.

Xcode's ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES is set in
ios/App/App.xcodeproj/project.pbxproj for Debug and Release configurations.
No source PNG is renamed or modified. Fails closed on missing/invalid icons.
"""
from __future__ import annotations
import json
from pathlib import Path
import shutil
import struct

ASSETS = Path("ios/App/App/Assets.xcassets")
SOURCE = Path("gazo/icon")
SIGNATURE = b"\x89PNG\r\n\x1a\n"


def generate() -> None:
    project = Path("ios/App/App.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
    expected = "Icon1 Icon2 Icon3 Icon4 Icon5 Icon6"
    if project.count("ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES") != 2 or expected not in project:
        raise RuntimeError("Alternate icon build setting is missing from the iOS Xcode project")
    for number in range(1, 7):
        origin = SOURCE / str(number) / "master_1024.png"
        header = origin.read_bytes()[:26]
        if header[:8] != SIGNATURE:
            raise RuntimeError(f"Icon {number} is not a PNG")
        width, height, depth, kind = struct.unpack(">IIBB", header[16:26])
        if (width, height, depth, kind) != (1024, 1024, 8, 2):
            raise RuntimeError(f"Icon {number} must be opaque RGB 1024x1024; found {width}x{height}, depth {depth}, kind {kind}")
        dest = ASSETS / f"Icon{number}.appiconset"
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(origin, dest / "icon.png")
        contents = {
            "images": [{
                "filename": "icon.png",
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
            }],
            "info": {"author": "xcode", "version": 1},
        }
        (dest / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n", encoding="utf-8")
    print("Prepared six iOS alternate icon assets; original pink AppIcon preserved.")


if __name__ == "__main__":
    generate()
