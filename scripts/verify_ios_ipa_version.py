#!/usr/bin/env python3
"""Fail the Codemagic build before publishing if the generated IPA is invalid."""
from __future__ import annotations

import json
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
expected_marketing = json.loads((base / "package.json").read_text(encoding="utf-8")).get("version")
if not isinstance(expected_marketing, str) or not re.fullmatch(
    r"[0-9]+\.[0-9]+\.[0-9]+", expected_marketing
):
    sys.exit(f"Invalid package.json marketing version: {expected_marketing!r}")
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

# Validate the actual signed bundle, not just the tracked source plist.
localizations = info.get("CFBundleLocalizations")
if info.get("CFBundleDevelopmentRegion") != "ja" or not isinstance(localizations, list) or not all(lang in localizations for lang in ("ja", "en")):
    sys.exit(f"IPA rejected before upload: expected Japanese default and Japanese/English localizations, got {info.get('CFBundleDevelopmentRegion')!r}, {localizations!r}")

version = str(info.get("CFBundleVersion", ""))
marketing = str(info.get("CFBundleShortVersionString", ""))
identifier = str(info.get("CFBundleIdentifier", ""))
# Inspect metadata inside the ACTUAL signed IPA. A correct codemagic.yaml
# cannot prove which SDK built an uploaded binary (ITMS-90725, Build 10).
sdk_name = str(info.get("DTSDKName", ""))
xcode_name = str(info.get("DTXcode", ""))
sdk_match = re.fullmatch(r"iphoneos([0-9]+)(?:\.[0-9]+)*", sdk_name)
if not sdk_match or int(sdk_match.group(1)) < 27:
    sys.exit(f"IPA rejected before upload: iOS 27 SDK required, DTSDKName={sdk_name!r}")
if not re.fullmatch(r"[0-9]{4,}", xcode_name) or int(xcode_name[:2]) < 27:
    sys.exit(f"IPA rejected before upload: Xcode 27 required, DTXcode={xcode_name!r}")
if expected_marketing == "1.0.3" and int(build) <= 10:
    sys.exit("IPA rejected before upload: 1.0.3 Build 10 already delivered; use Build 11 or later")
if version != build or not re.fullmatch(r"\d+(?:\.\d+){0,2}", version):
    sys.exit(
        f"IPA rejected before upload: CFBundleVersion={version!r}, "
        f"expected numeric BUILD_NUMBER={build!r}"
    )
if marketing != expected_marketing or identifier != "com.jomonpix.app":
    sys.exit(
        f"IPA mismatch: CFBundleShortVersionString={marketing!r}, "
        f"expected version={expected_marketing!r}, CFBundleIdentifier={identifier!r}"
    )
print(
    f"Verified signed IPA: {ipa.name}, "
    f"CFBundleIdentifier={identifier}, version={marketing} ({version}), "
    f"SDK={sdk_name}, Xcode={xcode_name}"
)
