#!/usr/bin/env python3
"""No-macOS regression tests for Apple's iOS 27 SDK build gate."""
from verify_ios_sdk import validate_toolchain

for xc, sdk in [
    ("Xcode 27.0\nBuild version 27A111", "27.0"),
    ("Xcode 27.2\nBuild version 27B52", "27.2"),
    ("Xcode 28.0\nBuild version 28A1", "28.0"),
]:
    assert validate_toolchain(xc, sdk) == (xc.splitlines()[0].split()[1], sdk)

for xc, sdk in [
    ("Xcode 26.6\nBuild version 26Z", "26.5"),
    ("Xcode 26.6", "27.2"),
    ("Xcode 27.2", "26.5"),
    ("Xcode unknown", "27.2"),
    ("Xcode 27.2", ""),
]:
    try:
        validate_toolchain(xc, sdk)
    except ValueError:
        continue
    raise AssertionError(f"Accepted obsolete/invalid toolchain: {xc!r}, {sdk!r}")

print("Xcode and iOS 27 SDK compatibility gate: PASS")
