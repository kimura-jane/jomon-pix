#!/usr/bin/env python3
"""No-network regression tests for offline native asset preparation."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from bundle_native_offline import (
    FONTS, bundle_model, bundle_fonts, rewrite_native_html, verify, select_resources
)

class OfflineBundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.dist = self.root / 'dist'
        self.dist.mkdir()
        (self.dist / 'index.html').write_text(
            '<html><head><link rel="preconnect" href="https://fonts.googleapis.com">'
            '<link rel="preconnect" href="https://fonts.gstatic.com">'
            '<link href="https://fonts.googleapis.com/css2?family=Yomogi" rel="stylesheet">'
            '</head><body></body></html>')
        self.lock = self.root / 'package-lock.json'
        self.lock.write_text(json.dumps({'packages': {
            'node_modules/@imgly/background-removal': {'version': '1.7.0'}}}))
        notice = self.root / 'node_modules/@imgly/background-removal/LICENSE.md'
        notice.parent.mkdir(parents=True)
        notice.write_text('AGPL fixture')
        remote = self.root / 'remote-model'
        remote.mkdir()
        def model_entry(data):
            digest = hashlib.sha256(data).hexdigest()
            (remote / digest).write_bytes(data)
            return {'chunks': [{'name': digest, 'offsets': [0, len(data)]}],
                    'size': len(data)}
        (remote / 'resources.json').write_text(json.dumps({
            '/models/isnet_fp16': model_entry(b'model' * 30),
            '/onnxruntime-web/ort-wasm.wasm': model_entry(b'wasm' * 40),
            '/models/isnet_quint8': model_entry(b'not-selected' * 12)}))
        self.model_url = remote.as_uri() + '/'
        gf = self.root / 'fonts'
        for _, directory, filename, _ in FONTS:
            folder = gf / 'ofl' / directory
            folder.mkdir(parents=True, exist_ok=True)
            (folder / 'OFL.txt').write_text('OFL fixture')
            (folder / filename).write_bytes(b'\x00\x01\x00\x00' + b'font-content' * 100)
        self.font_url = gf.as_uri() + '/'

    def prepare(self):
        bundle_model(self.dist, self.lock, self.model_url)
        bundle_fonts(self.dist, self.font_url)
        rewrite_native_html(self.dist)
        verify(self.dist, self.lock)

    def test_all_offline_assets_and_no_remote_fonts(self):
        self.prepare()
        self.assertEqual(
            set(json.loads((self.dist / 'offline-background/resources.json').read_text())),
            {'/models/isnet_fp16', '/onnxruntime-web/ort-wasm.wasm'})
        self.assertNotIn('fonts.googleapis.com', (self.dist / 'index.html').read_text())
        self.assertEqual((self.dist / 'offline-fonts/native.css').read_text().count('@font-face'), len(FONTS))

    def test_corrupted_model_rejected(self):
        self.prepare()
        manifest = json.loads((self.dist / 'offline-background/resources.json').read_text())
        name = manifest['/models/isnet_fp16']['chunks'][0]['name']
        (self.dist / 'offline-background' / name).write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'damaged'):
            verify(self.dist, self.lock)

    def test_wrong_package_version_rejected(self):
        self.lock.write_text(json.dumps({'packages': {
            'node_modules/@imgly/background-removal': {'version': '1.6.0'}}}))
        with self.assertRaisesRegex(ValueError, 'version mismatch'):
            bundle_model(self.dist, self.lock, self.model_url)

    def test_missing_model_rejected(self):
        with self.assertRaisesRegex(ValueError, 'model/CPU WASM'):
            select_resources({'/onnxruntime-web/ort-wasm.wasm': {'size': 0, 'chunks': []}})

    def test_missing_font_license_rejected(self):
        self.prepare()
        (self.dist / 'offline-fonts/yomogi/OFL.txt').unlink()
        with self.assertRaisesRegex(ValueError, 'license missing'):
            verify(self.dist, self.lock)

if __name__ == '__main__':
    unittest.main(verbosity=2)
