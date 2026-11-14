#!/usr/bin/env python3
"""Set a strictly numeric App Store build number before creating the IPA.

Codemagic supplies BUILD_NUMBER (not CM_BUILD_NUMBER). A value such as "YES"
must never be allowed into either CFBundleVersion or CURRENT_PROJECT_VERSION.
"""
from __future__ import annotations

import plistlib
import re
import sys
from pathlib import Path


def set_build_number(root: Path, number: str) -> None:
    if not re.fullmatch(r"[1-9][0-9]{0,8}", number):
        raise ValueError(
            f"Invalid iOS build number {number!r}; expected 1–9 digits, "
            "starting with 1–9 (Codemagic BUILD_NUMBER)."
        )

    project = root / "ios/App/App.xcodeproj/project.pbxproj"
    info_path = root / "ios/App/App/Info.plist"
    original = project.read_text(encoding="utf-8")
    updated, count = re.subn(
        r"\bCURRENT_PROJECT_VERSION\s*=\s*[^;]+;",
        f"CURRENT_PROJECT_VERSION = {number};",
        original,
    )
    if count != 2:
        raise RuntimeError(
            f"Expected 2 CURRENT_PROJECT_VERSION entries, found {count}; "
            "Xcode project may have changed."
        )

    with info_path.open("rb") as handle:
        info = plistlib.load(handle)
    # An explicit string, not an Xcode variable expansion, guarantees
    # CFBundleVersion in the archived IPA is numeric.
    info["CFBundleVersion"] = number
    info["CFBundleShortVersionString"] = "1.0.0"

    # Verify before touching any files.
    assert re.search(rf"\bCURRENT_PROJECT_VERSION = {re.escape(number)};", updated)
    assert info["CFBundleVersion"] == number
    project.write_text(updated, encoding="utf-8")
    with info_path.open("wb") as handle:
        plistlib.dump(info, handle)

    # Read the files back exactly as the next build will.
    with info_path.open("rb") as handle:
        stored = plistlib.load(handle)
    assert stored["CFBundleVersion"] == number
    assert len(re.findall(
        rf"\bCURRENT_PROJECT_VERSION = {re.escape(number)};",
        project.read_text(encoding="utf-8")
    )) == 2
    print(
        f"iOS version check OK: "
        f"CFBundleShortVersionString={stored['CFBundleShortVersionString']}, "
        f"CFBundleVersion={stored['CFBundleVersion']}"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 scripts/set_ios_build_number.py <numeric_BUILD_NUMBER>")
    set_build_number(Path(__file__).resolve().parent.parent, sys.argv[1])
