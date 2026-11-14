#!/usr/bin/env python3
"""Regression tests for the App Store rejection: CFBundleVersion was 'YES'."""
from __future__ import annotations

import importlib.util
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location(
    "set_ios_build_number", ROOT / "scripts/set_ios_build_number.py"
)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def clone_ios_files(root: Path) -> None:
    project = "ios/App/App.xcodeproj/project.pbxproj"
    info = "ios/App/App/Info.plist"
    for name in (project, info):
        destination = root / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, destination)


def validate_ipa(root: Path, version: str, expected: str, ok: bool) -> None:
    appdir = root / "ios/App/build/ios/ipa"
    appdir.mkdir(parents=True, exist_ok=True)
    with (root / "ios/App/App/Info.plist").open("rb") as f:
        info = plistlib.load(f)
    info["CFBundleVersion"] = version
    info["CFBundleShortVersionString"] = "1.0.0"
    info["CFBundleIdentifier"] = "com.jomonpix.app"
    with zipfile.ZipFile(appdir / "App.ipa", "w") as archive:
        archive.writestr("Payload/App.app/Info.plist", plistlib.dumps(info))
    env = dict(os.environ, BUILD_NUMBER=expected, CM_BUILD_DIR=str(root))
    check = subprocess.run(
        [sys.executable, str(ROOT / "scripts/verify_ios_ipa_version.py")],
        env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    if ok:
        assert check.returncode == 0, check.stdout
    else:
        assert check.returncode != 0, check.stdout
    print(f"IPA verification: version={version!r}, expected={expected!r}, accepted={ok}")


with tempfile.TemporaryDirectory(prefix="jomon-ios-version-") as folder:
    root = Path(folder)
    clone_ios_files(root)
    project = root / "ios/App/App.xcodeproj/project.pbxproj"
    info_file = root / "ios/App/App/Info.plist"
    old_project = project.read_bytes()
    old_info = info_file.read_bytes()
    for invalid in ("YES", "", "0", "1.2.3.4", "one", "1.2", "-1"):
        try:
            module.set_build_number(root, invalid)
        except ValueError:
            pass
        else:
            raise AssertionError(f"Accepted invalid build number: {invalid!r}")
        assert project.read_bytes() == old_project
        assert info_file.read_bytes() == old_info

    module.set_build_number(root, "7")
    contents = project.read_text()
    assert contents.count("CURRENT_PROJECT_VERSION = 7;") == 2
    with info_file.open("rb") as f:
        info = plistlib.load(f)
    assert info["CFBundleVersion"] == "7"
    assert info["CFBundleShortVersionString"] == "1.0.0"
    validate_ipa(root, version="YES", expected="7", ok=False)
    validate_ipa(root, version="7", expected="7", ok=True)

print("All iOS CFBundleVersion regression checks passed.")
