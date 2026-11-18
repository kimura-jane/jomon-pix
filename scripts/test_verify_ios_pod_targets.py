#!/usr/bin/env python3
"""Regression tests for the generated Pods Xcode deployment target guard."""
from verify_ios_pod_targets import check_pods_project


def project(*values: str) -> str:
    return "\n".join(f"IPHONEOS_DEPLOYMENT_TARGET = {value};" for value in values)


assert check_pods_project(project("15.0", "16.0", "27.2")) == 3
for bad in (project("14.0", "15.0"), project("14.9"), "no deployment target"):
    try:
        check_pods_project(bad)
    except ValueError:
        continue
    raise AssertionError(f"Accepted invalid Pods project: {bad!r}")

print("CocoaPods generated deployment target guard: PASS")
