#!/usr/bin/env python3
"""Fail before building if Codemagic selected an obsolete Apple toolchain."""
from __future__ import annotations

import re
import subprocess


def validate_toolchain(xcode_output: str, sdk_output: str) -> tuple[str, str]:
    match = re.search(r"^Xcode ([0-9]+(?:\.[0-9]+)*)\s*$", xcode_output, re.MULTILINE)
    sdk = sdk_output.strip()
    if not match or not re.fullmatch(r"[0-9]+(?:\.[0-9]+)*", sdk):
        raise ValueError(f"Unable to identify Xcode/iOS SDK: {xcode_output!r}, {sdk!r}")
    xcode = match.group(1)
    if int(xcode.split(".")[0]) < 27 or int(sdk.split(".")[0]) < 27:
        raise ValueError(
            f"Apple iOS 27 SDK requirement not met: Xcode {xcode}, iOS SDK {sdk}. "
            "Select the codemagic.yaml workflow using Xcode 27.2."
        )
    return xcode, sdk


if __name__ == "__main__":
    xcode_output = subprocess.check_output(["xcodebuild", "-version"], text=True)
    sdk_output = subprocess.check_output(
        ["xcrun", "--sdk", "iphoneos", "--show-sdk-version"], text=True
    )
    xcode, sdk = validate_toolchain(xcode_output, sdk_output)
    print(f"Verified active Apple toolchain: Xcode {xcode}, iOS SDK {sdk}")
