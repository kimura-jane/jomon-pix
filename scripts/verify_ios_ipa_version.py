#!/usr/bin/env python3
"""Fail the Codemagic build before publishing if the generated IPA is invalid."""
from __future__ import annotations

import os
import plistlib
import re
import sys
import zipfile
from pathlib import Path

build = os.environ.get("BUILD_NUMBER", "").strip()
if not re.fullmatch(r"[1-9][0-9]{0,8}", build):
    sys.exit(f"Invalid Codemagic BUILD_NUMBER: {build!r}")

base = Path(os.environ.get("CM_BUILD_DIR", ".")).resolve()
paths = sorted((base / "ios/App/build/ios/ipa").glob("*.ipa"))
if not paths:
    paths = sorted((base / "build/ios/ipa").glob("*.ipa"))
if len(paths) != 1:
    sys.exit(f"Expected exactly one IPA, found {len(paths)}: {paths}")

ipa = paths[0]
with zipfile.ZipFile(ipa, "r") as archive:
    plist_paths = [
        name for name in archive.namelist()
        if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", name)
    ]
    if len(plist_paths) != 1:
        sys.exit(f"Expected one app Info.plist in IPA: {plist_paths!r}")
    info = plistlib.loads(archive.read(plist_paths[0]))

version = str(info.get("CFBundleVersion", ""))
marketing = str(info.get("CFBundleShortVersionString", ""))
identifier = str(info.get("CFBundleIdentifier", ""))
if version != build or not re.fullmatch(r"\d+(?:\.\d+){0,2}", version):
    sys.exit(
        f"IPA rejected before upload: CFBundleVersion={version!r}, "
        f"expected numeric BUILD_NUMBER={build!r}"
    )
if marketing != "1.0.0" or identifier != "com.jomonpix.app":
    sys.exit(
        f"IPA mismatch: CFBundleShortVersionString={marketing!r}, "
        f"CFBundleIdentifier={identifier!r}"
    )
print(
    f"Verified signed IPA: {ipa.name}, "
    f"CFBundleIdentifier={identifier}, version={marketing} ({version})"
)
