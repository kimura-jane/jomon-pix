import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.JOMON_TEST_URL ?? 'http://127.0.0.1:4173/jomon-pix/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const uncaught = [];
  page.on('pageerror', (error) => uncaught.push(error.message));

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.lang-switch').waitFor({ state: 'visible', timeout: 30000 });
  const imageTab = page.locator('.bar button.tab').filter({ hasText: 'ホーム' });
  await imageTab.click();
  assert.equal(await imageTab.count(), 1, 'Image tab should be named Home');
  assert.equal(await page.locator('.bar [aria-label="戻す"]').count(), 1, 'Undo remains available');
  assert.equal(await page.locator('.bar [aria-label="やり直す"]').count(), 0, 'Redo control removed');

  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 220, 180);
    gradient.addColorStop(0, '#db306a');
    gradient.addColorStop(.5, '#50be86');
    gradient.addColorStop(1, '#2631c7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 220, 180);
    ctx.fillStyle = '#f5c220';
    ctx.fillRect(25, 28, 80, 75);
    ctx.fillStyle = '#1a1757';
    ctx.fillRect(130, 80, 64, 80);
    return canvas.toDataURL('image/png');
  });
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'mosaic-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photo.split(',')[1], 'base64'),
  });

  await page.locator('.tabs .tab').filter({ hasText: 'モザイク' }).click();
  const modes = page.locator('.panel .seg button');
  for (const label of ['範囲指定', 'ブラシ', '写真全体', '背景だけ']) {
    assert.equal(await modes.filter({ hasText: label }).count(), 1, label + ' range mode remains');
  }

  await modes.filter({ hasText: '写真全体' }).click();
  await page.getByRole('button', { name: '▦ 全体にモザイク' }).click();
  const dialog = page.getByRole('dialog', { name: 'モザイク加工' });
  await dialog.waitFor();
  const styles = dialog.locator('.mosaic-style');
  assert.equal(await styles.count(), 8, 'Eight styles available');

  const expected = ['標準モザイク', 'ぼかし', 'ドット', '六角形',
    '三角形', '黒塗り', 'ハート', 'ブラシ風'];
  const distinct = new Set();
  const image = dialog.locator('img[alt="モザイク対象の写真"]');
  await dialog.getByRole('button', { name: '範囲指定' }).click();
  const storedOriginal = await image.getAttribute('src');
  await dialog.getByRole('button', { name: '写真全体' }).click();
  let oldPreview = null;

  for (let i = 0; i < expected.length; i++) {
    await styles.nth(i).click();
    await page.waitForFunction((previous) => {
      const img = document.querySelector('img[alt="モザイク対象の写真"]');
      const current = img?.getAttribute('src');
      return current?.startsWith('data:image/jpeg') && current !== previous;
    }, oldPreview, { timeout: 15000 });
    const preview = await image.getAttribute('src');
    assert.ok(preview?.startsWith('data:image/jpeg'), 'Effect preview must be rendered');
    distinct.add(preview);
    oldPreview = preview;
    assert.equal(await styles.nth(i).getAttribute('aria-pressed'), 'true');
  }
  // Every effect needs to look different on a real photo.
  assert.ok(distinct.size >= 6, 'At least six visually distinct rendered preview variants');

  // Solid black is fully opaque, and Undo must recover the original source.
  await styles.nth(5).click();
  await dialog.getByRole('button', { name: 'モザイクを適用' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '▦ 全体にモザイク' }).click();
  const result = await page.locator('img[alt="モザイク対象の写真"]').getAttribute('src');
  const pixel = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const sample = document.createElement('canvas');
    sample.width = 1;
    sample.height = 1;
    const ctx = sample.getContext('2d');
    ctx.drawImage(img, 0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  }, result);
  assert.deepEqual(pixel, [0, 0, 0, 255], 'Black mosaic must actually replace photo pixels');
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await page.locator('.bar [aria-label="戻す"]').click();
  await page.getByRole('button', { name: '▦ 全体にモザイク' }).click();
  await page.getByRole('dialog', { name: 'モザイク加工' }).getByRole('button', { name: '範囲指定' }).click();
  const reverted = await page.locator('img[alt="モザイク対象の写真"]').getAttribute('src');
  assert.equal(reverted, storedOriginal, 'Undo must restore the stored original photo');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // English labels for the Home and mosaic styles.
  await page.locator('.lang-switch').click();
  await page.getByText('Home', { exact: true }).first().waitFor();
  await page.locator('.panel .seg button').filter({ hasText: 'Entire Photo' }).click();
  await page.getByRole('button', { name: '▦ Mosaic Entire Photo' }).click();
  const labels = await page.locator('.mosaic-style span:last-child').allTextContents();
  assert.ok(labels.includes('Standard') && labels.includes('Solid Black') && labels.includes('Hexagon'));
  await page.getByRole('button', { name: 'Cancel' }).click();

  assert.deepEqual(uncaught, [], 'No uncaught browser errors');
  console.log('JOMON PIX mosaic styles and Home header: PASS');
} finally {
  await browser.close();
}
