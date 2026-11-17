#!/usr/bin/env python3
"""Isolated build-time regression tests for JOMON PIX's Android PWA files."""
from __future__ import annotations
import json
from pathlib import Path
import re
import tempfile
import unittest
from PIL import Image
import build_pwa

class PWATests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.out = self.root / 'dist'
        self.out.mkdir()
        (self.out / 'index.html').write_text('<html>JOMON PIX</html>')
        (self.out / 'manifest.webmanifest').write_text(json.dumps({
            'id': '/jomon-pix/', 'name': 'JOMON PIX',
            'start_url': '/jomon-pix/', 'scope': '/jomon-pix/',
            'display': 'standalone', 'icons': []
        }))
        for dirname, name in (
            ('assets', 'index-abc.js'), ('assets', 'app-abc.css'),
            ('stickers', 'demo.webp'), ('frame-previews', 'frame.png'),
            ('backgrounds', 'scene.svg'), ('mediapipe', 'face_landmarker.task'),
            ('mediapipe', 'vision_wasm_internal.wasm'),
            ('mediapipe', 'vision_wasm_module_internal.wasm')
        ):
            path = self.out / dirname / name
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(b'for local browser rendering')
        self.icon = self.root / 'approved.png'
        Image.new('RGB', (1024, 1024), '#ef2390').save(self.icon)
        self.previous_icon = build_pwa.SOURCE_ICON
        build_pwa.SOURCE_ICON = self.icon
        self.addCleanup(lambda: setattr(build_pwa, 'SOURCE_ICON', self.previous_icon))

    def precache(self):
        sw = (self.out / 'sw.js').read_text()
        match = re.search(r'const PRECACHE = (\[.*?\]);', sw)
        self.assertIsNotNone(match)
        return json.loads(match.group(1))

    def test_preserves_approved_icon_and_includes_maskable(self):
        before = self.icon.read_bytes()
        build_pwa.build(self.out)
        self.assertEqual(before, self.icon.read_bytes())
        for name, size in [('icon-192.png',192), ('icon-512.png',512),
                           ('icon-maskable-512.png',512)]:
            with Image.open(self.out / 'pwa-icons' / name) as image:
                self.assertEqual(image.size,(size,size))
        with Image.open(self.out / 'pwa-icons/icon-maskable-512.png') as image:
            self.assertEqual(image.getpixel((0,0)), (255,246,251))
            self.assertEqual(image.getpixel((256,256)), (239,35,144))

    def test_offline_shell_includes_stickers_frames_and_js(self):
        build_pwa.build(self.out)
        paths = self.precache()
        self.assertIn('/jomon-pix/', paths)
        self.assertIn('/jomon-pix/assets/index-abc.js', paths)
        self.assertIn('/jomon-pix/frame-previews/frame.png', paths)
        self.assertIn('/jomon-pix/stickers/demo.webp', paths)
        self.assertIn('/jomon-pix/backgrounds/scene.svg', paths)
        self.assertIn('/jomon-pix/pwa-icons/icon-maskable-512.png', paths)

    def test_modified_equal_size_assets_force_new_cache(self):
        build_pwa.build(self.out)
        first = (self.out / 'sw.js').read_text()
        (self.out / 'assets/index-abc.js').write_bytes(b'for LOCAL browser rendering')
        build_pwa.build(self.out)
        self.assertNotEqual(first, (self.out / 'sw.js').read_text())

    def test_missing_stickers_fails_closed(self):
        (self.out / 'stickers/demo.webp').unlink()
        with self.assertRaisesRegex(ValueError,'No photo stickers'):
            build_pwa.build(self.out)

    def test_wrong_scope_fails_closed(self):
        p = self.out / 'manifest.webmanifest'
        m = json.loads(p.read_text())
        m['scope'] = '/'
        p.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError,'base URL'):
            build_pwa.build(self.out)

if __name__ == '__main__':
    unittest.main(verbosity=2)
