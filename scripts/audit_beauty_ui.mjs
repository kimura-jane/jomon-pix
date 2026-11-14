import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const report = {
  test: 'JOMON pix face-aware beauty',
  ts: new Date().toISOString(),
  checks: [],
  errors: [],
  outboundPostUrls: [],
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (err) => report.errors.push('pageerror: ' + err.message));
page.on('request', (req) => {
  if (req.method() === 'POST' && !req.url().startsWith('http://127.0.0.1:4173')) {
    report.outboundPostUrls.push(req.url());
  }
});

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles('/tmp/beauty-portrait.jpg');
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'ビューティー' }).click();
  await page.getByText('美肌・毛穴ぼかし').first().waitFor();
  report.checks.push('Beauty panel available with photo');
  await page.waitForTimeout(400);
  // Capture the actual Konva pixels before moving any slider, not merely
  // whether the slider's state or its status label changes.
  await page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw Error('Konva canvas missing');
    window.__beautyBaseline = {
      width: canvas.width,
      height: canvas.height,
      pixels: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
    };
  });

  const smooth = page.getByRole('slider', { name: '美肌・毛穴ぼかし' });
  await smooth.focus();
  await page.keyboard.press('End');
  assert.equal(await smooth.inputValue(), '100');
  await page.getByText('顔の加工を表示しています。').waitFor({ timeout: 60000 });
  report.checks.push('Local face landmarker recognized real portrait');
  await page.waitForTimeout(250);
  const visualDelta = await page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas');
    const prev = window.__beautyBaseline;
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width !== prev.width || canvas.height !== prev.height) {
      throw Error('Canvas dimensions changed during comparison');
    }
    const now = canvas.getContext('2d').getImageData(0, 0, prev.width, prev.height).data;
    let changedPixels = 0;
    let totalDifference = 0;
    for (let i = 0; i < now.length; i += 4) {
      const d = Math.abs(now[i] - prev.pixels[i]) +
        Math.abs(now[i + 1] - prev.pixels[i + 1]) +
        Math.abs(now[i + 2] - prev.pixels[i + 2]);
      if (d > 24) changedPixels++;
      totalDifference += d;
    }
    return { changedPixels, totalDifference, width: canvas.width, height: canvas.height };
  });
  report.visualDelta = visualDelta;
  assert(visualDelta.changedPixels > 200, 'Beauty did not visibly change the canvas pixels');
  report.checks.push('Verified canvas pixels changed, not just the slider state');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('jomon-pix-work')).state);
  assert.equal(state.elements.find((e) => e.type === 'image').beauty.smooth, 100);
  report.checks.push('Settings persist without replacing source image');

  await page.getByRole('slider', { name: '小顔' }).focus();
  await page.keyboard.press('End');
  await page.getByText('顔の加工を表示しています。').waitFor({ timeout: 45000 });
  const state2 = await page.evaluate(() => JSON.parse(localStorage.getItem('jomon-pix-work')).state);
  assert.equal(state2.elements.find((e) => e.type === 'image').beauty.slim, 100);
  report.checks.push('Jaw narrowing preview and persisted value');

  await page.getByRole('slider', { name: '目の大きさ' }).focus();
  await page.keyboard.press('End');
  await page.getByText('顔の加工を表示しています。').waitFor({ timeout: 45000 });
  report.checks.push('Eye enlargement preview');

  await page.getByRole('slider', { name: 'ナチュラルリップ' }).focus();
  await page.keyboard.press('End');
  await page.getByText('顔の加工を表示しています。').waitFor({ timeout: 45000 });
  report.checks.push('Makeup preview');

  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('heading', { name: 'できあがり！' })
    .waitFor({ timeout: 40000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('img[alt="完成画像"]');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  }, { timeout: 20000 });
  const dimensions = await page.locator('img[alt="完成画像"]').evaluate((img) =>
    ({ width: img.naturalWidth, height: img.naturalHeight }));
  assert(dimensions.width >= 600 && dimensions.height >= 600);
  report.checks.push('PNG export with face effects');

  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: 'ビューティーをすべて解除' }).click();
  const state3 = await page.evaluate(() => JSON.parse(localStorage.getItem('jomon-pix-work')).state);
  assert(!state3.elements.find((e) => e.type === 'image').beauty);
  report.checks.push('Non-destructive beauty reset');

  // Emulate a two-person photo with the public test portrait mirrored side
  // by side; no private photo is checked into the repository.
  const portrait64 = fs.readFileSync('/tmp/beauty-portrait.jpg').toString('base64');
  const twoFaceDataUrl = await page.evaluate(async (base64) => {
    const portrait = new Image();
    portrait.src = 'data:image/jpeg;base64,' + base64;
    await portrait.decode();
    const canvas = document.createElement('canvas');
    canvas.width = portrait.naturalWidth * 2;
    canvas.height = portrait.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(portrait, 0, 0);
    ctx.drawImage(portrait, portrait.naturalWidth, 0);
    return canvas.toDataURL('image/png');
  }, portrait64);
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'two-person-portrait.png',
    mimeType: 'image/png',
    buffer: Buffer.from(twoFaceDataUrl.split(',')[1], 'base64'),
  });
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'ビューティー' }).click();
  await page.getByRole('slider', { name: '小顔' }).focus();
  await page.keyboard.press('End');
  await page.getByText('2人の顔を検出').waitFor({ timeout: 60000 });
  report.checks.push('Two visible people both detected and processed');
  assert.equal(report.outboundPostUrls.length, 0, 'Image pixels must never be sent to a network service');
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  report.status = 'success';
} catch (error) {
  report.status = 'failure';
  report.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.mkdirSync('docs/audit', { recursive: true });
  fs.writeFileSync('docs/audit/beauty-smoke-results.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
