// Real Chromium test: install Service Worker, go fully offline, relaunch.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4173/jomon-pix/';
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({
  viewport: {width: 390, height: 844}, isMobile: true,
  hasTouch: true, deviceScaleFactor: 2,
  serviceWorkers: 'allow',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(URL, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '＋ 写真を追加'}).waitFor({timeout: 30000});
  // Test the actual build's complete Service Worker install and control.
  await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    if (!ready.active) throw Error('PWA SW never activated');
  });
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const isCached = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys()).find((x) => x.startsWith('jomon-pix-shell-')));
    return !!(await cache.match('/jomon-pix/stickers/archaeology/v1/dogu/d01.webp'));
  });
  assert.equal(isCached, true, 'Static dogu stickers must be available offline');
  await context.setOffline(true);
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '＋ 写真を追加'}).waitFor({timeout: 30000});
  const media = await page.evaluate(async () => {
    const paths = [
      '/jomon-pix/stickers/archaeology/v1/dogu/d01.webp',
      '/jomon-pix/frame-previews/border-polaroid.png',
      '/jomon-pix/backgrounds/v1/sakura.svg',
      '/jomon-pix/manifest.webmanifest'
    ];
    const fetched = await Promise.all(paths.map(async p => {
      const r = await fetch(p);
      return {path: p, status: r.status, ok: r.ok, bytes: (await r.arrayBuffer()).byteLength};
    }));
    return fetched;
  });
  assert(media.every(x=>x.ok&&x.bytes>0),JSON.stringify(media));
  assert.equal(errors.length, 0, 'Browser JS errors: '+errors.join(' | '));
  console.log(JSON.stringify({offlineLaunch:true, assetFetch:media, errors},null,2));
} finally {
  await browser.close();
}
