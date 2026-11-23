#!/usr/bin/env python3
"""Configure a freshly generated Capacitor 7 Android app for JOMON PIX.

Only touches generated android/ files. Never writes passwords or private keys
to the repository; Gradle reads signing configuration from CI environment.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw
from xml.etree import ElementTree as ET

APP_ID = "com.jomonpix.app"
SOURCE_ICON = Path("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png")
GRADLE_PLUGIN = "8.10.1"
GRADLE_VERSION = "8.11.1"
ANDROID_API = 36
# Required by Google Play automatic protection; do not regress to Capacitor's 23.
ANDROID_MIN_API = 24


def substitute_once(source: str, pattern: str, replacement: str, title: str) -> str:
    updated, count = re.subn(pattern, replacement, source, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError("Unexpected Capacitor Android template: " + title)
    return updated


def create_maskable_image() -> Image.Image:
    if not SOURCE_ICON.is_file():
        raise FileNotFoundError("JOMON PIX icon missing: " + str(SOURCE_ICON))
    with Image.open(SOURCE_ICON) as input_image:
        if input_image.size != (1024, 1024):
            raise ValueError("Expected a 1024x1024 approved JOMON PIX icon")
        original = input_image.convert("RGB")

    # Match the already approved larger Android PWA artwork. Do not use
    # Android's default generated Capacitor icon or change the iOS icon.
    left = original.getpixel((96, 512))
    right = original.getpixel((928, 512))
    output = Image.new("RGB", (512, 512))
    draw = ImageDraw.Draw(output)
    for x in range(512):
        fraction = x / 511
        color = tuple(round(a + (b - a) * fraction) for a, b in zip(left, right))
        draw.line(((x, 0), (x, 511)), fill=color)

    tile_size = 410
    tile = original.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
    supersample = 4
    high_size = tile_size * supersample
    high_mask = Image.new("L", (high_size, high_size), 0)
    ImageDraw.Draw(high_mask).rounded_rectangle(
        (0, 0, high_size - 1, high_size - 1),
        radius=round(high_size * 0.24), fill=255,
    )
    mask = high_mask.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
    offset = (512 - tile_size) // 2
    output.paste(tile, (offset, offset), mask)
    return output


def write_android_icons(android_dir: Path) -> None:
    resources = android_dir / "app/src/main/res"
    image = create_maskable_image()
    drawable = resources / "drawable-nodpi"
    drawable.mkdir(parents=True, exist_ok=True)
    image.save(drawable / "jomon_launcher.png", optimize=True)

    # Legacy launchers must get the same approved image (not the Capacitor C).
    for suffix, pixels in (
        ("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
        ("xxhdpi", 144), ("xxxhdpi", 192),
    ):
        folder = resources / ("mipmap-" + suffix)
        folder.mkdir(parents=True, exist_ok=True)
        reduced = image.resize((pixels, pixels), Image.Resampling.LANCZOS)
        reduced.save(folder / "ic_launcher.png", optimize=True)
        circle_mask = Image.new("L", (pixels, pixels), 0)
        ImageDraw.Draw(circle_mask).ellipse((0, 0, pixels - 1, pixels - 1), fill=255)
        round_image = reduced.convert("RGBA")
        round_image.putalpha(circle_mask)
        round_image.save(folder / "ic_launcher_round.png", optimize=True)

    # The full-bleed, maskable image becomes the adaptive icon background.
    # Transparent foreground ensures the default Capacitor mark never appears.
    adaptive_dir = resources / "mipmap-anydpi-v26"
    adaptive_dir.mkdir(parents=True, exist_ok=True)
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@drawable/jomon_launcher" />\n'
        '    <foreground android:drawable="@android:color/transparent" />\n'
        '</adaptive-icon>\n'
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (adaptive_dir / name).write_text(xml, encoding="utf-8")



ANDROID_XML_NS = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", ANDROID_XML_NS)


def write_variant_launcher_icons(android_dir: Path) -> None:
    """Generate adaptive + legacy launchers from existing user-supplied icons.

    Adaptive icons MUST use the separate 432px background and transparent
    foreground (with Android 13+ monochrome layer); resizing a complete
    square icon onto an adaptive background introduces double padding.
    """
    resources = android_dir / "app/src/main/res"
    drawable = resources / "drawable-nodpi"
    adaptive = resources / "mipmap-anydpi-v26"
    drawable.mkdir(parents=True, exist_ok=True)
    adaptive.mkdir(parents=True, exist_ok=True)

    for number in range(1, 7):
        source_folder = Path("gazo/icon") / str(number)
        source = source_folder / "icon_512.png"
        with Image.open(source) as input_image:
            if input_image.size != (512, 512):
                raise RuntimeError(f"Variant {number} must use an existing 512x512 PNG")
            legacy_icon = input_image.convert("RGB")

        for layer in ("background", "foreground", "monochrome"):
            src = source_folder / f"{layer}_432.png"
            with Image.open(src) as img:
                if img.size != (432, 432):
                    raise RuntimeError(f"Variant {number} {layer} must be 432x432")
                if layer == "background":
                    resource = img.convert("RGB")
                else:
                    if "A" not in img.getbands():
                        raise RuntimeError(
                            f"Variant {number} {layer} must have alpha transparency"
                        )
                    resource = img.convert("RGBA")
                resource.save(
                    drawable / f"jomon_launcher_variant_{number}_{layer}.png",
                    optimize=True,
                )

        # Legacy Android launcher icons use the complete original user asset.
        # Do not artificially shrink it with a second margin.
        for density, pixels in (
            ("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
            ("xxhdpi", 144), ("xxxhdpi", 192),
        ):
            target = resources / f"mipmap-{density}"
            target.mkdir(parents=True, exist_ok=True)
            small = legacy_icon.resize((pixels, pixels), Image.Resampling.LANCZOS)
            small.save(target / f"ic_launcher_variant_{number}.png", optimize=True)
            circle_mask = Image.new("L", (pixels, pixels), 0)
            ImageDraw.Draw(circle_mask).ellipse(
                (0, 0, pixels - 1, pixels - 1), fill=255
            )
            round_icon = small.convert("RGBA")
            round_icon.putalpha(circle_mask)
            round_icon.save(
                target / f"ic_launcher_variant_{number}_round.png", optimize=True
            )

        xml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            f'    <background android:drawable="@drawable/jomon_launcher_variant_{number}_background" />\n'
            f'    <foreground android:drawable="@drawable/jomon_launcher_variant_{number}_foreground" />\n'
            f'    <monochrome android:drawable="@drawable/jomon_launcher_variant_{number}_monochrome" />\n'
            '</adaptive-icon>\n'
        )
        for name in (
            f"ic_launcher_variant_{number}.xml",
            f"ic_launcher_variant_{number}_round.xml",
        ):
            (adaptive / name).write_text(xml, encoding="utf-8")


def prepare_android_icon_aliases(android_dir: Path) -> None:
    """Replace the single launcher entry with one enabled default + six aliases.

    The real MainActivity stays enabled, keeps its original exported flag and
    existing non-launcher intent filters, and retains all Capacitor state.
    """
    manifest_path = android_dir / "app/src/main/AndroidManifest.xml"
    tree = ET.parse(manifest_path)
    root = tree.getroot()
    app = root.find("application")
    if app is None:
        raise RuntimeError("Capacitor Android manifest lacks application")
    a = "{" + ANDROID_XML_NS + "}"
    main = next((activity for activity in app.findall("activity")
                 if activity.get(a + "name", "").endswith(".MainActivity")), None)
    if main is None:
        raise RuntimeError("Capacitor Android manifest lacks MainActivity")
    target = main.get(a + "name")
    removed = 0
    for filt in list(main.findall("intent-filter")):
        actions = [el.get(a + "name") for el in filt.findall("action")]
        categories = [el.get(a + "name") for el in filt.findall("category")]
        if ("android.intent.action.MAIN" in actions and
                "android.intent.category.LAUNCHER" in categories):
            main.remove(filt)
            removed += 1
    if removed != 1:
        raise RuntimeError("Expected exactly one MainActivity launcher intent-filter")

    for number in range(7):
        suffix = "IconDefault" if number == 0 else f"IconVariant{number}"
        icon = "ic_launcher" if number == 0 else f"ic_launcher_variant_{number}"
        round_icon = icon + "_round"
        entry = ET.SubElement(app, "activity-alias", {
            a + "name": "." + suffix,
            a + "enabled": "true" if number == 0 else "false",
            a + "exported": "true",
            a + "targetActivity": target,
            a + "label": "@string/app_name",
            a + "icon": "@mipmap/" + icon,
            a + "roundIcon": "@mipmap/" + round_icon,
        })
        filt = ET.SubElement(entry, "intent-filter")
        ET.SubElement(filt, "action", {a + "name": "android.intent.action.MAIN"})
        ET.SubElement(filt, "category", {a + "name": "android.intent.category.LAUNCHER"})
    ET.indent(tree, space="    ")
    tree.write(manifest_path, encoding="unicode", xml_declaration=True)


def register_android_icon_plugin(android_dir: Path) -> None:
    """Register the local Capacitor plugin before BridgeActivity.onCreate."""
    package_dir = android_dir / "app/src/main/java/com/jomonpix/app"
    activity = package_dir / "MainActivity.java"
    original = activity.read_text(encoding="utf-8")
    if "extends BridgeActivity" not in original:
        raise RuntimeError("Unexpected Android Capacitor MainActivity template")
    activity.write_text(
        "package com.jomonpix.app;\n\n"
        "import android.os.Bundle;\n"
        "import com.getcapacitor.BridgeActivity;\n\n"
        "public class MainActivity extends BridgeActivity {\n"
        "    @Override\n"
        "    protected void onCreate(Bundle state) {\n"
        "        registerPlugin(IconSwitcherPlugin.class);\n"
        "        super.onCreate(state);\n"
        "    }\n"
        "}\n", encoding="utf-8"
    )
    plugin = Path("native/android/IconSwitcherPlugin.java")
    if not plugin.is_file():
        raise RuntimeError("Android icon switcher Java source is missing")
    (package_dir / "IconSwitcherPlugin.java").write_bytes(plugin.read_bytes())

def configure(android_dir: Path, version: str, version_code: int) -> None:
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError("Invalid Android marketing version: " + version)
    if version_code < 1 or version_code > 2100000000:
        raise ValueError("Invalid Android versionCode: " + str(version_code))
    if APP_ID not in Path("capacitor.config.ts").read_text(encoding="utf-8"):
        raise RuntimeError("Capacitor app identifier has changed")

    app_path = android_dir / "app/build.gradle"
    app = app_path.read_text(encoding="utf-8")
    app = substitute_once(app, r'(?m)^\s*applicationId\s+["\'][^"\']+["\']',
                          f'        applicationId "{APP_ID}"', "applicationId")
    app = substitute_once(app, r"(?m)^\s*versionCode\s+\d+",
                          f"        versionCode {version_code}", "versionCode")
    app = substitute_once(app, r'(?m)^\s*versionName\s+["\'][^"\']+["\']',
                          f'        versionName "{version}"', "versionName")
    # Patch the one Gradle release build type BEFORE adding signingConfigs.
    app = substitute_once(
        app, r"(?m)^(\s*)release\s*\{",
        r"\1release {\n\1    signingConfig signingConfigs.release",
        "release build type",
    )
    signing = (
        "android {\n"
        "    signingConfigs {\n"
        "        release {\n"
        "            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))\n"
        "            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')\n"
        "            keyAlias System.getenv('ANDROID_KEY_ALIAS')\n"
        "            keyPassword System.getenv('ANDROID_KEY_PASSWORD')\n"
        "        }\n"
        "    }"
    )
    app = substitute_once(app, r"(?m)^android\s*\{", signing, "android block")
    app_path.write_text(app, encoding="utf-8")

    variables = android_dir / "variables.gradle"
    text = variables.read_text(encoding="utf-8")
    for key, value in (
        ("compileSdkVersion", ANDROID_API),
        ("targetSdkVersion", ANDROID_API),
        ("minSdkVersion", ANDROID_MIN_API),
    ):
        text = substitute_once(text, rf"\b{key}\s*=\s*\d+",
                               f"{key} = {value}", key)
    if not re.search(r"\bminSdkVersion\s*=\s*24\b", text):
        raise RuntimeError("Google Play automatic protection requires minSdkVersion >=24")
    variables.write_text(text, encoding="utf-8")

    root_path = android_dir / "build.gradle"
    root = root_path.read_text(encoding="utf-8")
    root = substitute_once(root, r"com\.android\.tools\.build:gradle:[0-9.]+",
                           "com.android.tools.build:gradle:" + GRADLE_PLUGIN,
                           "Android Gradle Plugin")
    root_path.write_text(root, encoding="utf-8")

    wrapper_path = android_dir / "gradle/wrapper/gradle-wrapper.properties"
    wrapper = wrapper_path.read_text(encoding="utf-8")
    wrapper = substitute_once(
        wrapper, r"gradle-[0-9.]+-(?:bin|all)\.zip",
        f"gradle-{GRADLE_VERSION}-all.zip", "Gradle wrapper",
    )
    wrapper_path.write_text(wrapper, encoding="utf-8")

    write_android_icons(android_dir)
    write_variant_launcher_icons(android_dir)
    prepare_android_icon_aliases(android_dir)
    register_android_icon_plugin(android_dir)

    # A native build must use the bundled files, not GitHub Pages URL.
    native_web = android_dir / "app/src/main/assets/public"
    if not (native_web / "index.html").is_file():
        raise RuntimeError("Capacitor failed to copy local Android app shell")
    if not (native_web / "offline-background/resources.json").is_file():
        raise RuntimeError("Offline background removal model not bundled")
    if not (native_web / "ai/inpaint/migan_pipeline_v2.onnx").is_file():
        raise RuntimeError("Offline smart eraser model not bundled")
    if not (native_web / "offline-fonts/native.css").is_file():
        raise RuntimeError("Offline Japanese fonts not bundled")

    print(f"Android native app ready: {APP_ID} v{version} ({version_code}), "
          f"min API {ANDROID_MIN_API}, target API {ANDROID_API}; bundled editing assets verified.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--android-dir", type=Path, default=Path("android"))
    parser.add_argument("--version-code", required=True, type=int)
    args = parser.parse_args()
    version = json.loads(Path("package.json").read_text(encoding="utf-8"))["version"]
    configure(args.android_dir, version, args.version_code)


if __name__ == "__main__":
    main()
