import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function savedImage() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('jomon-pix-projects-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const data = await new Promise((resolve, reject) => {
        const tx = db.transaction('work', 'readonly');
        const r = tx.objectStore('work').get('jomon-pix-work');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      if (!data) return null;
      return JSON.parse(data).state.elements.find((el) => el.type === 'image') ?? null;
    } finally {
      db.close();
    }
  });
}

async function waitSetting(field) {
  for (let n = 0; n < 200; n++) {
    const image = await savedImage();
    if (image?.beauty?.[field] === 100) return image;
    await page.waitForTimeout(250);
  }
  throw new Error('Timed out saving leg field: ' + field);
}

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  const photo = fs.readFileSync('/tmp/jomon-pix-pose-model.png');
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'pose-model.png', mimeType: 'image/png', buffer: photo,
  });
  await page.getByRole('button', { name: 'ビューティー' }).click();
  const before = await savedImage();
  assert.ok(before?.src?.startsWith('data:image/'), 'Original photo must be persisted');

  const slim = page.getByRole('slider', { name: '脚を細く' });
  const length = page.getByRole('slider', { name: '脚を長く' });
  assert.equal(await slim.count(), 1);
  assert.equal(await length.count(), 1);
  await slim.focus();
  await page.keyboard.press('End');
  const first = await waitSetting('legSlim');
  assert.equal(first.src, before.src, 'Original photo must never be overwritten');
  await page.getByRole('status')
    .filter({ hasText: 'ビューティーの加工を表示しています。' })
    .waitFor({ timeout: 120000 });

  await length.focus();
  await page.keyboard.press('End');
  const second = await waitSetting('legLength');
  assert.equal(second.src, before.src);
  await page.getByRole('status')
    .filter({ hasText: 'ビューティーの加工を表示しています。' })
    .waitFor({ timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log('Leg slimming, length and non-destructive save: PASS');
} finally {
  await browser.close();
}
