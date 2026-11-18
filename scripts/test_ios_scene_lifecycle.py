#!/usr/bin/env python3
"""Regression guard for iOS 27 UIWindowScene adoption in the native app.

The TestFlight 1.0.3 (12) launch crash occurred in
UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption, prior to the
Capacitor web editor loading. This script checks configuration only:
it cannot replace a real-device or iOS simulator launch test.
"""
from __future__ import annotations

from pathlib import Path
import plistlib
import re

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "ios" / "App" / "App"
PROJECT = ROOT / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"

with (APP / "Info.plist").open("rb") as stream:
    info = plistlib.load(stream)

manifest = info.get("UIApplicationSceneManifest")
assert isinstance(manifest, dict), "Missing iOS 27 required UIApplicationSceneManifest"
assert manifest.get("UIApplicationSupportsMultipleScenes") is False, (
    "JOMON PIX supports one main editing window; do not launch multiple bridges"
)
roles = manifest.get("UISceneConfigurations")
assert isinstance(roles, dict), "Missing scene configuration roles"
scenes = roles.get("UIWindowSceneSessionRoleApplication")
assert isinstance(scenes, list) and len(scenes) == 1, "Expected one application scene"
scene = scenes[0]
assert scene.get("UISceneConfigurationName") == "Default Configuration"
assert scene.get("UISceneDelegateClassName") == "$(PRODUCT_MODULE_NAME).SceneDelegate"
assert scene.get("UISceneStoryboardFile") == "Main", (
    "The existing storyboard must host CAPBridgeViewController"
)
assert "UIMainStoryboardFile" not in info, "Remove legacy UIApplication storyboard entry"

scene_swift = (APP / "SceneDelegate.swift").read_text(encoding="utf-8")
app_swift = (APP / "AppDelegate.swift").read_text(encoding="utf-8")
storyboard = (APP / "Base.lproj" / "Main.storyboard").read_text(encoding="utf-8")
project = PROJECT.read_text(encoding="utf-8")
prepare = (ROOT / "scripts" / "prepare-ios.sh").read_text(encoding="utf-8")

assert "class SceneDelegate: UIResponder, UIWindowSceneDelegate" in scene_swift
assert "var window: UIWindow?" in scene_swift, (
    "UIKit needs a window property to attach the storyboard scene"
)
assert "CAPBridgeViewController" in storyboard
assert 'initialViewController="BYZ-38-t0r"' in storyboard
assert "configurationForConnecting connectingSceneSession: UISceneSession" in app_swift
assert 'name: "Default Configuration"' in app_swift
assert "ApplicationDelegateProxy.shared.application" in scene_swift, (
    "Keep Capacitor 7 deep-link delivery after adopting scenes"
)
assert "UIApplicationSceneManifest" in prepare, (
    "The Codemagic native preparation may not drop the iOS 27 scene configuration"
)
assert "info.pop('UIMainStoryboardFile', None)" in prepare

# A source file merely existing in the Git checkout is not enough: it must
# have PBXBuildFile, PBXFileReference and be assigned to the app's Sources phase.
assert len(re.findall(r"/\* SceneDelegate.swift in Sources \*/", project)) == 2, (
    "SceneDelegate missing from PBXBuildFile or Sources build phase"
)
assert len(re.findall(r"/\* SceneDelegate.swift \*/", project)) >= 2, (
    "SceneDelegate missing from Xcode file references and app group"
)
assert re.search(r"SceneDelegate.swift in Sources \*/,", project), (
    "SceneDelegate not compiled into target"
)
assert "SWIFT_VERSION = 5.0;" in project
assert "IPHONEOS_DEPLOYMENT_TARGET = 15.0;" in project

print("iOS 27 UIScene configuration, Xcode source membership, Capacitor storyboard: PASS")
