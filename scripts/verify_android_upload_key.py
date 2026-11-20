#!/usr/bin/env python3
"""Restore and validate the *upload* keystore privately in GitHub Actions.

Never print, commit, upload, or persist the key or passwords as an artifact.
The Google Play app-signing SHA-256 is different from this upload-key SHA-256.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import os
from pathlib import Path
import re
import subprocess

# Fingerprint of the original PWABuilder upload key supplied by the owner.
EXPECTED_UPLOAD_SHA256 = (
    "54:CF:3E:35:C5:51:3D:64:0D:E3:54:9C:F1:5B:CD:07:"
    "1C:C4:06:51:F5:BE:20:8D:F7:1A:C6:C8:E1:D1:B2:E4"
)
SECRET_NAMES = (
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
)


def restore_and_check(dest: Path) -> None:
    absent = [name for name in SECRET_NAMES if not os.environ.get(name)]
    if absent:
        raise RuntimeError("GitHub Actions secrets missing: " + ", ".join(absent))
    try:
        raw = base64.b64decode(
            "".join(os.environ["ANDROID_KEYSTORE_BASE64"].split()), validate=True
        )
    except (ValueError, binascii.Error) as exc:
        raise RuntimeError("ANDROID_KEYSTORE_BASE64 is not valid Base64") from exc
    if len(raw) < 128:
        raise RuntimeError("Keystore is unexpectedly small")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)
    dest.chmod(0o600)
    result = subprocess.run(
        [
            "keytool", "-list", "-v",
            "-keystore", str(dest),
            "-alias", os.environ["ANDROID_KEY_ALIAS"],
            "-storepass", os.environ["ANDROID_KEYSTORE_PASSWORD"],
        ],
        capture_output=True, text=True, check=False,
    )
    if result.returncode:
        dest.unlink(missing_ok=True)
        raise RuntimeError(
            "Upload keystore cannot be opened. Verify alias and store password."
        )
    match = re.search(r"SHA256:\s*([A-Fa-f0-9:]{95})", result.stdout)
    if match is None or match.group(1).upper() != EXPECTED_UPLOAD_SHA256:
        dest.unlink(missing_ok=True)
        raise RuntimeError(
            "Wrong upload certificate: this would break Google Play updates."
        )
    print("Existing JOMON PIX Android upload signing certificate verified.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    restore_and_check(args.output)
