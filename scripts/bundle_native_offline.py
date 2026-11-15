#!/usr/bin/env python3
"""Build-time offline asset vendor for the Capacitor iOS JOMON pix app.

Only the iOS native build uses this file. The browser site remains unchanged.
Failure to fetch, verify or package any required resource stops the build.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import re
import shutil
import time
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

# Exact installed version from package-lock.json (not loose package.json spec).
IMG_LY_VERSION = '1.7.0'
IMG_LY_DATA_URL = f'https://staticimgly.com/@imgly/background-removal-data/{IMG_LY_VERSION}/dist/'
MODEL = '/models/isnet_fp16'
GOOGLE_FONTS_COMMIT = 'cc39c4c2c304bc368c9b7c311ea2bcc6013299fe'
GOOGLE_FONTS_URL = f'https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}/'

# CSS name, Google Fonts source directory, file, CSS font weight.
FONTS = (
    ('Hachi Maru Pop', 'hachimarupop', 'HachiMaruPop-Regular.ttf', '400'),
    ('Mochiy Pop One', 'mochiypopone', 'MochiyPopOne-Regular.ttf', '400'),
    ('Kiwi Maru', 'kiwimaru', 'KiwiMaru-Regular.ttf', '400'),
    ('Zen Maru Gothic', 'zenmarugothic', 'ZenMaruGothic-Regular.ttf', '400'),
    ('Zen Maru Gothic', 'zenmarugothic', 'ZenMaruGothic-Bold.ttf', '700'),
    ('Yomogi', 'yomogi', 'Yomogi-Regular.ttf', '400'),
    ('Klee One', 'kleeone', 'KleeOne-Regular.ttf', '400'),
    ('Zen Kurenaido', 'zenkurenaido', 'ZenKurenaido-Regular.ttf', '400'),
    ('Yusei Magic', 'yuseimagic', 'YuseiMagic-Regular.ttf', '400'),
    ('Shippori Mincho', 'shipporimincho', 'ShipporiMincho-Regular.ttf', '400'),
    ('Shippori Mincho', 'shipporimincho', 'ShipporiMincho-Medium.ttf', '500'),
    ('Noto Sans JP', 'notosansjp', 'NotoSansJP[wght].ttf', '100 900'),
    ('Dela Gothic One', 'delagothicone', 'DelaGothicOne-Regular.ttf', '400'),
    ('Rampart One', 'rampartone', 'RampartOne-Regular.ttf', '400'),
    ('Reggae One', 'reggaeone', 'ReggaeOne-Regular.ttf', '400'),
    ('RocknRoll One', 'rocknrollone', 'RocknRollOne-Regular.ttf', '400'),
    ('DotGothic16', 'dotgothic16', 'DotGothic16-Regular.ttf', '400'),
)

def hash_file(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(part)
    return digest.hexdigest()

def download(url: str, dest: Path, size: int | None = None, digest: str | None = None):
    if dest.exists() and dest.stat().st_size > 0 and (
        size is None or dest.stat().st_size == size
    ) and (digest is None or hash_file(dest) == digest):
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + '.part')
    for attempt in range(3):
        try:
            req = Request(url, headers={'User-Agent': 'JOMON-pix-iOS-offline-builder/1.0'})
            with urlopen(req, timeout=90) as response, part.open('wb') as writer:
                shutil.copyfileobj(response, writer)
            if part.stat().st_size == 0 or (size is not None and part.stat().st_size != size):
                raise ValueError(f'Invalid download size: {url}')
            if digest is not None and hash_file(part) != digest:
                raise ValueError(f'Download SHA-256 mismatch: {url}')
            part.replace(dest)
            return
        except Exception:
            part.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep((attempt + 1) * 2)

def assert_version(lock: Path):
    data = json.loads(lock.read_text(encoding='utf-8'))
    found = data['packages']['node_modules/@imgly/background-removal']['version']
    if found != IMG_LY_VERSION:
        raise ValueError(f'IMG.LY version mismatch: installed {found}, assets {IMG_LY_VERSION}')

def select_resources(manifest: dict) -> dict:
    if not isinstance(manifest, dict):
        raise ValueError('Invalid model manifest')
    selected = {key: item for key, item in manifest.items()
                if key == MODEL or key.startswith('/onnxruntime-web/')}
    if MODEL not in selected or not any(k.startswith('/onnxruntime-web/') for k in selected):
        raise ValueError('Required model/CPU WASM entries missing')
    for key, item in selected.items():
        chunks = item.get('chunks')
        if not isinstance(chunks, list) or not chunks:
            raise ValueError(f'Missing model chunks for {key}')
        total = 0
        for chunk in chunks:
            name, offsets = chunk.get('name'), chunk.get('offsets')
            if not isinstance(name, str) or not re.fullmatch(r'[0-9a-f]{64}(?:\.bin)?', name):
                raise ValueError(f'Unexpected model chunk name: {name}')
            if name.endswith('.bin') and chunk.get('hash') != name[:-4]:
                raise ValueError(f'Invalid packaged iOS chunk hash: {name}')
            if not isinstance(offsets, list) or len(offsets) != 2 or (
                not all(isinstance(n, int) for n in offsets)
            ) or offsets[0] < 0 or offsets[1] <= offsets[0]:
                raise ValueError(f'Invalid model chunk range: {name}')
            total += offsets[1] - offsets[0]
        if total != item.get('size'):
            raise ValueError(f'Incomplete model entry: {key}')
    return selected

def bundle_model(dest: Path, lock: Path, url: str = IMG_LY_DATA_URL):
    assert_version(lock)
    target = dest / 'offline-background'
    source = target / '_resources-download.json'
    download(urljoin(url, 'resources.json'), source)
    selected = select_resources(json.loads(source.read_text(encoding='utf-8')))
    # Capacitor 7.6.10 Router.swift routes EVERY extensionless URL to
    # index.html. The upstream IMG.LY SHA256 filenames have no extension.
    # Rename local files to SHA256.bin and rewrite the manifest accordingly.
    # Keep the original SHA256 for verifying bytes downloaded from the CDN.
    chunks = {}
    for item in selected.values():
        for chunk in item['chunks']:
            size = chunk['offsets'][1] - chunk['offsets'][0]
            digest = chunk['name']
            if digest in chunks and chunks[digest] != size:
                raise ValueError('Duplicate chunk size mismatch')
            chunks[digest] = size
            chunk['hash'] = digest
            chunk['name'] = f'{digest}.bin'
    print(f'Bundling IMG.LY CPU model/WASM: {len(chunks)} files, '
          f'{sum(chunks.values()) // (1024*1024)} MiB', flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(download, urljoin(url, digest),
                               target / f'{digest}.bin', size, digest)
                   for digest, size in chunks.items()]
        for future in as_completed(futures):
            future.result()
    (target / 'resources.json').write_text(
        json.dumps(selected, separators=(',', ':'), ensure_ascii=False), encoding='utf-8'
    )
    source.unlink()
    license_file = lock.parent / 'node_modules/@imgly/background-removal/LICENSE.md'
    if not license_file.is_file():
        raise FileNotFoundError(f'Missing IMG.LY AGPL notice: {license_file}')
    shutil.copy2(license_file, target / 'IMG-LY-LICENSE.md')

def bundle_fonts(dest: Path, url: str = GOOGLE_FONTS_URL):
    folder = dest / 'offline-fonts'
    dirs = {f[1] for f in FONTS}
    files = {(directory, filename) for _, directory, filename, _ in FONTS}
    files.update((directory, 'OFL.txt') for directory in dirs)
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = []
        for directory, filename in sorted(files):
            rel = f'ofl/{directory}/{filename}'
            futures.append(pool.submit(download,
                         urljoin(url, quote(rel, safe='/')), folder / directory / filename))
        for future in as_completed(futures):
            future.result()
    css = ['/* JOMON pix native local fonts, no runtime font CDN requests. */']
    for family, directory, filename, weight in FONTS:
        path = folder / directory / filename
        with path.open('rb') as handle:
            header = handle.read(4)
        if path.stat().st_size < 1024 or header not in (b'\x00\x01\x00\x00', b'OTTO', b'ttcf'):
            raise ValueError(f'Invalid TTF: {filename}')
        css.append(
            '@font-face { font-family: ' + json.dumps(family) +
            '; src: url("./' + directory + '/' + filename +
            '") format("truetype"); font-weight: ' + weight +
            '; font-style: normal; font-display: swap; }'
        )
    (folder / 'native.css').write_text('\n'.join(css) + '\n', encoding='utf-8')

def rewrite_native_html(dest: Path):
    index = dest / 'index.html'
    html = index.read_text(encoding='utf-8')
    old = html
    html = re.sub(r'\s*<link[^>]+href="https://fonts\.googleapis\.com[^>]+>', '', html)
    html = re.sub(r'\s*<link[^>]+href="https://fonts\.gstatic\.com[^>]+>', '', html)
    if html == old or 'fonts.googleapis.com' in html or 'fonts.gstatic.com' in html:
        raise ValueError('Google Fonts CDN links remain in native HTML')
    if '</head>' not in html:
        raise ValueError('Missing HTML head')
    html = html.replace('</head>',
        '  <link rel="stylesheet" href="/offline-fonts/native.css">\n</head>', 1)
    index.write_text(html, encoding='utf-8')

def verify(dest: Path, lock: Path):
    assert_version(lock)
    parent = dest / 'offline-background'
    selected = select_resources(json.loads((parent / 'resources.json').read_text(encoding='utf-8')))
    for item in selected.values():
        for chunk in item['chunks']:
            # Regressions here break offline loading on iOS, even when files
            # are physically included: extensionless paths serve index.html.
            digest = chunk.get('hash')
            name = chunk['name']
            if name != f'{digest}.bin':
                raise ValueError(f'Native IMG.LY chunk not iOS-routable: {name}')
            path = parent / name
            if (not path.is_file() or
                path.stat().st_size != chunk['offsets'][1] - chunk['offsets'][0] or
                hash_file(path) != digest):
                raise ValueError(f'Native IMG.LY asset missing or damaged: {path}')
    if not (parent / 'IMG-LY-LICENSE.md').is_file():
        raise ValueError('Missing AGPL notice')
    fonts = dest / 'offline-fonts'
    css = (fonts / 'native.css').read_text(encoding='utf-8')
    for family, directory, name, weight in FONTS:
        if not (fonts / directory / name).is_file() or family not in css:
            raise ValueError(f'Offline font missing: {family}')
        if not (fonts / directory / 'OFL.txt').is_file():
            raise ValueError(f'Offline font license missing: {family}')
    html = (dest / 'index.html').read_text(encoding='utf-8')
    if ('fonts.googleapis.com' in html or 'fonts.gstatic.com' in html or
        '/offline-fonts/native.css' not in html):
        raise ValueError('Native HTML still requires Google Fonts CDN')
    print('Native offline AI model, WASM and all Japanese fonts verified.', flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='dist')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    dest = Path(args.out)
    lock = Path('package-lock.json')
    if not (dest / 'index.html').is_file():
        raise FileNotFoundError('Native build not found: run npm run build:native')
    if not args.verify_only:
        bundle_model(dest, lock)
        bundle_fonts(dest)
        rewrite_native_html(dest)
    verify(dest, lock)

if __name__ == '__main__':
    main()
