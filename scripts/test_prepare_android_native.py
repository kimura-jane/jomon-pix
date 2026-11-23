#!/usr/bin/env python3
"""Offline regression tests of the generated Android native Gradle configuration."""
from __future__ import annotations

import tempfile
from pathlib import Path
import unittest

from PIL import Image, ImageDraw
import prepare_android_native as android


class AndroidNativeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.project = self.root / "android"
        app = self.project / "app"
        app.mkdir(parents=True)
        (app / "build.gradle").write_text(
            "plugins { id 'com.android.application' }\n"
            "android {\n"
            '    namespace "com.jomonpix.app"\n'
            "    defaultConfig {\n"
            '        applicationId "com.jomonpix.app"\n'
            "        versionCode 1\n"
            '        versionName "1.0"\n'
            "    }\n"
            "    buildTypes {\n"
            "        release {\n"
            "            minifyEnabled false\n"
            "        }\n"
            "    }\n"
            "}\n", encoding="utf-8",
        )
        (self.project / "variables.gradle").write_text(
            "ext {\n    compileSdkVersion = 35\n"
            "    targetSdkVersion = 35\n    minSdkVersion = 23\n}\n", encoding="utf-8"
        )
        (self.project / "build.gradle").write_text(
            "classpath 'com.android.tools.build:gradle:8.7.2'\n",
            encoding="utf-8",
        )
        wrapper = self.project / "gradle/wrapper/gradle-wrapper.properties"
        wrapper.parent.mkdir(parents=True)
        wrapper.write_text(
            "distributionUrl=https\\://services.gradle.org/distributions/"
            "gradle-8.9-all.zip\n", encoding="utf-8",
        )
        native_web = app / "src/main/assets/public"
        for name in (
            "index.html",
            "offline-background/resources.json",
            "ai/inpaint/migan_pipeline_v2.onnx",
            "offline-fonts/native.css",
        ):
            p = native_web / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"fixture")
        # The generated Capacitor Android app is always present in production.
        # Provide its main class and manifest so the icon aliases are tested.
        native = app / "src/main"
        package_dir = native / "java/com/jomonpix/app"
        package_dir.mkdir(parents=True, exist_ok=True)
        (package_dir / "MainActivity.java").write_text(
            "package com.jomonpix.app;\n"
            "import com.getcapacitor.BridgeActivity;\n"
            "public class MainActivity extends BridgeActivity {}\n",
            encoding="utf-8",
        )
        (native / "AndroidManifest.xml").write_text(
            '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '  <application>\n'
            '    <activity android:name=".MainActivity" android:exported="true">\n'
            '      <intent-filter>\n'
            '        <action android:name="android.intent.action.MAIN"/>\n'
            '        <category android:name="android.intent.category.LAUNCHER"/>\n'
            '      </intent-filter>\n'
            '    </activity>\n'
            '  </application>\n'
            '</manifest>\n',
            encoding="utf-8",
        )
        self.icon = self.root / "approved.png"
        source = Image.new("RGB", (1024, 1024), "#ef2390")
        ImageDraw.Draw(source).rectangle((120, 470, 200, 550), fill=(17, 34, 51))
        source.save(self.icon)
        self.orig_icon = android.SOURCE_ICON
        android.SOURCE_ICON = self.icon
        self.addCleanup(lambda: setattr(android, "SOURCE_ICON", self.orig_icon))

    def test_configures_native_play_package_and_offline_app(self):
        before = self.icon.read_bytes()
        android.configure(self.project, "1.1.0", 17)
        self.assertEqual(before, self.icon.read_bytes())
        text = (self.project / "app/build.gradle").read_text()
        self.assertIn('applicationId "com.jomonpix.app"', text)
        self.assertIn('versionName "1.1.0"', text)
        self.assertIn('versionCode 17', text)
        self.assertIn('signingConfig signingConfigs.release', text)
        self.assertIn("System.getenv('ANDROID_KEYSTORE_PATH')", text)
        self.assertIn("System.getenv('ANDROID_KEY_ALIAS')", text)
        self.assertIn("System.getenv('ANDROID_KEY_PASSWORD')", text)
        variables = (self.project / "variables.gradle").read_text()
        self.assertIn("compileSdkVersion = 36", variables)
        self.assertIn("targetSdkVersion = 36", variables)
        # Play Console's automatic protection rejects an AAB with minSdk 23.
        self.assertIn("minSdkVersion = 24", variables)
        self.assertNotIn("minSdkVersion = 23", variables)
        self.assertIn("gradle:8.10.1", (self.project / "build.gradle").read_text())
        self.assertIn("gradle-8.11.1-all.zip",
                      (self.project / "gradle/wrapper/gradle-wrapper.properties").read_text())

    def test_missing_min_sdk_fails_closed(self):
        variables = self.project / "variables.gradle"
        variables.write_text(variables.read_text().replace(
            "    minSdkVersion = 23\n", ""
        ))
        with self.assertRaisesRegex(RuntimeError, "minSdkVersion"):
            android.configure(self.project, "1.1.0", 17)

    def test_app_icon_is_not_the_default_or_old_small_tile(self):
        android.configure(self.project, "1.1.0", 17)
        res = self.project / "app/src/main/res"
        with Image.open(res / "drawable-nodpi/jomon_launcher.png") as pic:
            self.assertEqual(pic.size, (512, 512))
            self.assertEqual(pic.getpixel((110, 256)), (17, 34, 51))
            self.assertEqual(pic.getpixel((0, 0)), (239, 35, 144))
        with Image.open(res / "mipmap-xxxhdpi/ic_launcher.png") as pic:
            self.assertEqual(pic.size, (192, 192))
        xml = (res / "mipmap-anydpi-v26/ic_launcher.xml").read_text()
        self.assertIn("@drawable/jomon_launcher_default_background", xml)
        self.assertIn("@drawable/jomon_launcher_default_foreground", xml)
        self.assertIn("@drawable/jomon_launcher_default_monochrome", xml)
        self.assertNotIn("@android:color/transparent", xml)
        for layer in ("background", "foreground", "monochrome"):
            target = res / f"drawable-nodpi/jomon_launcher_default_{layer}.png"
            with Image.open(target) as img:
                self.assertEqual(img.size, (432, 432))

    def test_seven_launcher_choices_preserve_main_activity(self):
        android.configure(self.project, "1.1.0", 17)
        manifest = self.project / "app/src/main/AndroidManifest.xml"
        tree = android.ET.parse(manifest)
        app = tree.getroot().find("application")
        self.assertIsNotNone(app)
        aliases = app.findall("activity-alias")
        self.assertEqual(len(aliases), 7)
        ns = "{" + android.ANDROID_XML_NS + "}"
        self.assertEqual(aliases[0].get(ns + "name"), ".IconDefault")
        self.assertEqual(aliases[0].get(ns + "enabled"), "true")
        self.assertTrue(all(a.get(ns + "enabled") == "false" for a in aliases[1:]))
        activity = app.find("activity")
        self.assertEqual(activity.get(ns + "name"), ".MainActivity")
        self.assertEqual(activity.get(ns + "exported"), "true")
        self.assertEqual(activity.findall("intent-filter"), [])
        for number in range(1, 7):
            path = self.project / ("app/src/main/res/mipmap-anydpi-v26/"
                                   f"ic_launcher_variant_{number}.xml")
            self.assertTrue(path.exists())
            res = self.project / "app/src/main/res"
            for layer in ("background", "foreground", "monochrome"):
                drawable = res / ("drawable-nodpi/"
                                  f"jomon_launcher_variant_{number}_{layer}.png")
                with Image.open(drawable) as png:
                    self.assertEqual(png.size, (432, 432))
                    self.assertEqual(png.mode, "RGB" if layer == "background" else "RGBA")
            xml = path.read_text()
            self.assertIn(f"jomon_launcher_variant_{number}_background", xml)
            self.assertIn(f"jomon_launcher_variant_{number}_foreground", xml)
            self.assertIn(f"jomon_launcher_variant_{number}_monochrome", xml)
            self.assertNotIn("@android:color/transparent", xml)
            with Image.open(res / f"mipmap-xxxhdpi/ic_launcher_variant_{number}.png") as png:
                self.assertEqual(png.size, (192, 192))
        java = (self.project / "app/src/main/java/com/jomonpix/app/MainActivity.java").read_text()
        self.assertIn("registerPlugin(IconSwitcherPlugin.class)", java)
        self.assertTrue((self.project / "app/src/main/java/com/jomonpix/app/IconSwitcherPlugin.java").exists())

    def test_invalid_play_version_is_rejected(self):
        with self.assertRaises(ValueError):
            android.configure(self.project, "1.1.0", 0)

    def test_missing_offline_ai_is_rejected(self):
        (self.project / "app/src/main/assets/public/offline-background/resources.json").unlink()
        with self.assertRaisesRegex(RuntimeError, "Offline background"):
            android.configure(self.project, "1.1.0", 17)

    def test_changed_gradle_template_fails_closed(self):
        path = self.project / "app/build.gradle"
        path.write_text(path.read_text().replace("release {", "shipping {"))
        with self.assertRaisesRegex(RuntimeError, "release build type"):
            android.configure(self.project, "1.1.0", 17)


if __name__ == "__main__":
    unittest.main(verbosity=2)
