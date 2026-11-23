#!/usr/bin/env python3
"""Static preflight of JOMON PIX native icon-switching integration."""
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parent.parent
IOS = ROOT / "ios/App/App"
PROJECT = ROOT / "ios/App/App.xcodeproj/project.pbxproj"


class IconSwitchingTests(unittest.TestCase):
    def test_six_original_sources_exist_without_renaming(self):
        for number in range(1, 7):
            folder = ROOT / "gazo/icon" / str(number)
            for name in ("master_1024.png", "icon_512.png",
                         "foreground_432.png", "background_432.png",
                         "monochrome_432.png", "icon_192.png"):
                path = folder / name
                self.assertTrue(path.is_file(), str(path))
                data = path.open("rb").read(26)
                self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
                width, height = struct.unpack(">II", data[16:24])
                target = 1024 if name == "master_1024.png" else (
                    512 if name == "icon_512.png" else (
                        432 if name.endswith("_432.png") else 192
                    )
                )
                self.assertEqual((width, height), (target, target), str(path))

    def test_ios_bridge_and_asset_configuration(self):
        project = PROJECT.read_text()
        self.assertEqual(project.count("ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES"), 2)
        for name in ("IconSwitcherPlugin.swift", "JomonBridgeViewController.swift"):
            self.assertIn(f"/* {name} in Sources */", project)
            self.assertTrue((IOS / name).is_file())
        controller = (IOS / "JomonBridgeViewController.swift").read_text()
        self.assertIn("registerPluginInstance(IconSwitcherPlugin())", controller)
        storyboard = (IOS / "Base.lproj/Main.storyboard").read_text()
        self.assertIn('customClass="JomonBridgeViewController" customModule="App"', storyboard)
        self.assertIn("python3 scripts/prepare_ios_icon_variants.py",
                      (ROOT / "scripts/prepare-ios.sh").read_text())
        self.assertIn("setAlternateIconName", (IOS / "IconSwitcherPlugin.swift").read_text())

    def test_android_registers_seven_alias_choices(self):
        plugin = (ROOT / "native/android/IconSwitcherPlugin.java").read_text()
        self.assertIn('@CapacitorPlugin(name = "IconSwitcher")', plugin)
        self.assertIn('PackageManager.DONT_KILL_APP', plugin)
        script = (ROOT / "scripts/prepare_android_native.py").read_text()
        self.assertIn("prepare_android_icon_aliases(android_dir)", script)
        self.assertIn("register_android_icon_plugin(android_dir)", script)
        self.assertIn("write_variant_launcher_icons(android_dir)", script)
        self.assertIn("for number in range(7)", script)
        self.assertIn('android.intent.category.LAUNCHER', script)

    def test_ui_is_native_only(self):
        picker = (ROOT / "src/components/AppIconPicker.tsx").read_text()
        self.assertIn("const supported = canChangeAppIcon()", picker)
        self.assertIn("current === '6'", picker)
        icon_source = (ROOT / "src/lib/appIcon.ts").read_text()
        visible = icon_source.split("export const iconChoices:")[1].split("];")[0]
        self.assertEqual(visible.count("{ id:"), 6)
        self.assertNotIn("{ id: '6'", visible)
        self.assertIn('disabled={!supported || loading || busy}', picker)
        native = (ROOT / "src/lib/appIcon.ts").read_text()
        self.assertIn("Capacitor.isNativePlatform()", native)
        self.assertIn("registerPlugin<IconSwitcherPlugin>('IconSwitcher')", native)
        topbar = (ROOT / "src/components/TopBar.tsx").read_text()
        self.assertIn("AppIconPicker", topbar)
        self.assertIn("アイコン設定", topbar)


if __name__ == "__main__":
    unittest.main(verbosity=2)
