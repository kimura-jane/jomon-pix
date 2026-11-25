import fs from 'node:fs';
import assert from 'node:assert/strict';
import { webkit } from 'playwright';

const results = {
  target: 'WebKit iPhone-like browser (NOT physical iPhone)',
  date: new Date().toISOString(),
  steps: [],
  errors: [],
  networkFailures: [],
  badResponses: [],
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
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().startsWith('INFO: Created TensorFlow Lite')) {
    results.errors.push('console: ' + message.text());
  }
});
page.on('requestfailed', (request) => {
  results.networkFailures.push({ url: request.url(), failure: request.failure() });
});
page.on('response', (response) => {
  if (response.status() >= 400 && response.url().includes('mediapipe')) {
    results.badResponses.push({ status: response.status(), url: response.url() });
  }
});
page.on('request', (request) => {
  if (request.method() === 'POST' && !request.url().startsWith('http://127.0.0.1:4173')) {
    results.transmittedPhotos = true;
  }
});
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles('/tmp/beauty-portrait.jpg');
  await page.locator('.bottom-tools button').filter({hasText:'加工'}).click();
  await page.locator('.extra-tool-grid button').filter({hasText:'ビューティー'}).click();
  const skin = page.getByRole('slider', { name: '美肌' });
  await skin.focus();
  await page.keyboard.press('End');
  assert.equal(await skin.inputValue(), '100');
  results.steps.push('slider input');
  const start = Date.now();
  await page.waitForFunction(() => {
    const state = document.querySelector('[data-beauty-state]')?.getAttribute('data-beauty-state');
    return state === 'ready' || state === 'error' || state === 'no-face';
  }, { timeout: 60000 });
  const faceResult = await page.locator('[data-beauty-state]').getAttribute('data-beauty-state');
  results.faceResult = faceResult;
  assert.equal(faceResult, 'ready', 'Face processing failed on WebKit: ' +
    JSON.stringify(await page.locator('[role="status"]').allTextContents()));
  assert.equal(await page.getByText(/顔の加工を表示しています。/).count(), 0,
    'Successful rendering must not show redundant status text');
  results.firstPreviewMs = Date.now() - start;
  results.steps.push('local FaceLandmarker initialized on WebKit');
  await page.getByRole('button', { name: '画像保存', exact: true }).click();
  await page.getByRole('heading', { name: 'できあがり！' }).waitFor({ timeout: 45000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('img[alt="完成画像"]');
    return img instanceof HTMLImageElement && img.naturalWidth >= 600;
  }, { timeout: 15000 });
  results.steps.push('PNG export');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '全員の補正をリセット' }).click();
  results.steps.push('reset');
  assert.equal(results.transmittedPhotos, false);
  assert.equal(results.errors.length, 0, results.errors.join('\n'));
  results.status = 'success';
} catch (error) {
  results.status = 'failure';
  results.visibleStatus = await page.locator('[role="status"]').allTextContents().catch(() => []);
  results.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.mkdirSync('docs/audit', { recursive: true });
  fs.writeFileSync('docs/audit/beauty-webkit-smoke.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
