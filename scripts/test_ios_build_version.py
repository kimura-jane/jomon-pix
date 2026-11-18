#!/usr/bin/env python3
"""Regression tests for the App Store rejection: CFBundleVersion was 'YES'."""
from __future__ import annotations

import importlib.util
import json
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
    for name in (project, info, "package.json"):
        destination = root / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, destination)


def validate_ipa(
    root: Path, version: str, expected: str, ok: bool,
    marketing: str | None = None,
    sdk_name: str | None = "iphoneos27.2",
    xcode_name: str | None = "2720",
) -> None:
    appdir = root / "ios/App/build/ios/ipa"
    appdir.mkdir(parents=True, exist_ok=True)
    with (root / "ios/App/App/Info.plist").open("rb") as f:
        info = plistlib.load(f)
    info["CFBundleVersion"] = version
    package_version = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
    info["CFBundleShortVersionString"] = marketing or package_version
    info["CFBundleIdentifier"] = "com.jomonpix.app"
    if sdk_name is None:
        info.pop("DTSDKName", None)
    else:
        info["DTSDKName"] = sdk_name
    if xcode_name is None:
        info.pop("DTXcode", None)
    else:
        info["DTXcode"] = xcode_name
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

    try:
        module.set_build_number(root, "10")
    except ValueError:
        pass
    else:
        raise AssertionError("Reused 1.0.3 Build 10 was accepted")
    assert project.read_bytes() == old_project
    assert info_file.read_bytes() == old_info

    module.set_build_number(root, "11")
    contents = project.read_text()
    assert contents.count("CURRENT_PROJECT_VERSION = 11;") == 2
    with info_file.open("rb") as f:
        info = plistlib.load(f)
    assert info["CFBundleVersion"] == "11"
    assert info["CFBundleShortVersionString"] == json.loads(
        (root / "package.json").read_text(encoding="utf-8")
    )["version"]
    validate_ipa(root, version="YES", expected="11", ok=False)
    validate_ipa(root, version="11", expected="11", ok=True)
    validate_ipa(root, version="10", expected="10", ok=False)
    validate_ipa(root, version="11", expected="11", ok=False, marketing="9.9.9")
    validate_ipa(root, version="11", expected="11", ok=False, sdk_name="iphoneos26.5")
    validate_ipa(root, version="11", expected="11", ok=False, sdk_name=None)
    validate_ipa(root, version="11", expected="11", ok=False, xcode_name="2650")
    validate_ipa(root, version="11", expected="11", ok=False, xcode_name=None)
    validate_ipa(root, version="11", expected="11", ok=False, sdk_name="unknown")

    # Changing package.json to a new App Store version must update both the
    # unsigned project's Info.plist and the signed IPA verification rule.
    package_path = root / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))
    old_version = package["version"]
    major, minor, patch = (int(part) for part in old_version.split("."))
    next_version = f"{major}.{minor}.{patch + 1}"
    package["version"] = next_version
    package_path.write_text(json.dumps(package), encoding="utf-8")
    module.set_build_number(root, "8")
    with info_file.open("rb") as handle:
        updated = plistlib.load(handle)
    assert updated["CFBundleShortVersionString"] == next_version
    validate_ipa(root, version="8", expected="8", ok=True)
    validate_ipa(root, version="8", expected="8", ok=False, marketing=old_version)

print("All iOS CFBundleVersion regression checks passed.")
