import fs from 'node:fs';
import assert from 'node:assert/strict';
import { webkit } from 'playwright';

const results = {
  target: 'WebKit iPhone-like browser (NOT physical iPhone)',
  date: new Date().toISOString(),
  steps: [],
  errors: [],
  transmittedPhotos: false,
};
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on('pageerror', (error) => results.errors.push(error.message));
page.on('request', (request) => {
  if (request.method() === 'POST' && !request.url().startsWith('http://127.0.0.1:4173')) {
    results.transmittedPhotos = true;
  }
});
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles('/tmp/beauty-portrait.jpg');
  await page.getByRole('button', { name: 'ビューティー' }).click();
  const skin = page.getByRole('slider', { name: '美肌・毛穴ぼかし' });
  await skin.focus();
  await page.keyboard.press('End');
  assert.equal(await skin.inputValue(), '100');
  results.steps.push('slider input');
  const start = Date.now();
  await page.getByText('顔の加工を表示しています。').waitFor({ timeout: 60000 });
  results.firstPreviewMs = Date.now() - start;
  results.steps.push('local FaceLandmarker initialized on WebKit');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('heading', { name: 'できあがり！' }).waitFor({ timeout: 45000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('img[alt="完成画像"]');
    return img instanceof HTMLImageElement && img.naturalWidth >= 600;
  }, { timeout: 15000 });
  results.steps.push('PNG export');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: 'ビューティーをすべて解除' }).click();
  results.steps.push('reset');
  assert.equal(results.transmittedPhotos, false);
  assert.equal(results.errors.length, 0, results.errors.join('\n'));
  results.status = 'success';
} catch (error) {
  results.status = 'failure';
  results.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.mkdirSync('docs/audit', { recursive: true });
  fs.writeFileSync('docs/audit/beauty-webkit-smoke.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
