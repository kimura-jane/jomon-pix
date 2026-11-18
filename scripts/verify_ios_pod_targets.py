#!/usr/bin/env python3
"""Verify pod install generated only Xcode 27-compatible iOS targets."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def check_pods_project(text: str) -> int:
    raw = re.findall(r"\bIPHONEOS_DEPLOYMENT_TARGET\s*=\s*([0-9]+(?:\.[0-9]+)*)\s*;", text)
    if not raw:
        raise ValueError("No CocoaPods deployment targets found")
    invalid = sorted({version for version in raw if int(version.split(".")[0]) < 15})
    if invalid:
        raise ValueError(f"Obsolete CocoaPods deployment targets: {invalid}; require iOS 15+")
    return len(raw)


if __name__ == "__main__":
    path = Path("ios/App/Pods/Pods.xcodeproj/project.pbxproj")
    if not path.is_file():
        sys.exit(f"CocoaPods project not found after pod install: {path}")
    try:
        count = check_pods_project(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        sys.exit(str(exc))
    print(f"Verified {count} generated CocoaPods configurations use iOS 15 or later")
