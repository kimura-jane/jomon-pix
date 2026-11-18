import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const browserName = process.argv[2] || 'chromium';
assert(['chromium', 'webkit'].includes(browserName));
const browser = await (browserName === 'chromium' ? chromium : webkit).launch({
  headless: true,
  ...(browserName === 'chromium' ? { args: ['--no-sandbox'] } : {}),
});
const report = { browser: browserName, checks: [], errors: [], date: new Date().toISOString() };
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: browserName === 'webkit',
});
const page = await context.newPage();
page.on('pageerror', (error) => report.errors.push(error.message));
const near = (a, b, tolerance = 8) => Math.abs(a - b) <= tolerance;

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  // A new project starts in portrait 9:16 without changing existing saved art.
  const first = await page.locator('.stage-card').boundingBox();
  assert(first && near(first.width / first.height, 9 / 16, 0.02),
    'Fresh project must begin at portrait 9:16');
  report.checks.push('New project defaults to portrait 9:16');

  await page.getByRole('button', { name: /加工/ }).first().click();

  const landscape = page.getByRole('button', { name: /16:9/ });
  const portrait = page.getByRole('button', { name: /9:16/ });
  await landscape.click();
  await page.getByText('1600 × 900 px').waitFor();
  const wide = await page.locator('.stage-card').boundingBox();
  assert(wide && near(wide.width / wide.height, 16 / 9, 0.02),
    '16:9 must change the visible canvas shape, not just the label');
  assert.equal(await landscape.count(), 1);
  assert.equal(await page.getByRole('button', { name: '写真に合わせる' }).count(), 0);
  report.checks.push('16:9 is selectable, old photo-fit choice is gone');

  await portrait.click();
  await page.getByText('900 × 1600 px').waitFor();
  const tall = await page.locator('.stage-card').boundingBox();
  assert(tall && near(tall.width / tall.height, 9 / 16, 0.02),
    '9:16 must change the visible canvas shape');
  await landscape.click();
  await page.getByText('1600 × 900 px').waitFor();
  report.checks.push('16:9 and 9:16 switching updates canvas dimensions');

  await page.locator('.bar button.tab').filter({ hasText: 'ホーム' }).click();
  const photoData = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffaacc';
    ctx.fillRect(0, 0, 48, 48);
    return canvas.toDataURL('image/png');
  });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles({
      name: 'layout-qa.png',
      mimeType: 'image/png',
      buffer: Buffer.from(photoData.split(',')[1], 'base64'),
    });
  const grip = page.getByRole('button', { name: '重なり順パネルを移動' });
  await grip.waitFor({ timeout: 15000 });

  const before = await grip.boundingBox();
  assert(before, 'Drag handle must be visible');
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 80,
    before.y + before.height / 2 + 36, { steps: 8 });
  await page.mouse.up();
  const moved = await grip.boundingBox();
  assert(moved && moved.x < before.x - 45 && moved.y > before.y + 14,
    'Layer panel must follow the pointer, independently of layer selection');
  report.checks.push('Layer position changes by dragging its handle');

  // Exercise React's touch handlers in both engines without constructing
  // Touch objects (which WebKit may reject with Illegal constructor).
  // These synthetic touch-shaped DOM events are NOT proof of actual iPhone touch.
  const beforeTouch = await grip.boundingBox();
  assert(beforeTouch);
  await page.evaluate(() => {
    const handle = document.querySelector('button[aria-label="重なり順パネルを移動"]');
    if (!handle) throw new Error('Missing draggable header');
    const r = handle.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const fire = (kind, px, py, active) => {
      const touch = { identifier: 7, target: handle, clientX: px, clientY: py };
      const event = new Event(kind, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: active ? [touch] : [] },
        targetTouches: { value: active ? [touch] : [] },
        changedTouches: { value: [touch] },
      });
      handle.dispatchEvent(event);
    };
    fire('touchstart', x, y, true);
    fire('touchmove', x + 40, y + 24, true);
    fire('touchend', x + 40, y + 24, false);
  });
  await page.waitForTimeout(200);
  const afterTouch = await grip.boundingBox();
  assert(afterTouch && afterTouch.x > beforeTouch.x + 22 &&
    afterTouch.y > beforeTouch.y + 12,
    'Touch drag must move the layer panel in iPhone-style browsers');
  report.checks.push('Synthetic touch-shaped events move React layer header in both engines');
  report.manualVerificationRequired = 'Finger drag must still be checked on a physical iPhone';

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jomon-pix-floating-layers-v1') ?? 'null'));
  assert(stored && stored.x >= 0 && stored.x <= 1 && stored.y >= 0 && stored.y <= 1);
  // The autosave badge was intentionally removed to prevent header wrapping.
  assert.equal(await page.getByRole('status').filter({ hasText: '自動保存' }).count(), 0);
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await grip.waitFor({ timeout: 15000 });
  await page.waitForFunction(({ x, y }) => {
    const handle = document.querySelector('button[aria-label="重なり順パネルを移動"]');
    if (!handle) return false;
    const r = handle.getBoundingClientRect();
    return Math.abs(r.x - x) < 8 && Math.abs(r.y - y) < 8;
  }, { x: afterTouch.x, y: afterTouch.y }, { timeout: 15000 });
  const restored = await grip.boundingBox();
  assert(restored && near(restored.x, afterTouch.x) && near(restored.y, afterTouch.y),
    'Drag position should survive a reload');
  report.checks.push('Draggable layer position survives reload');

  await page.setViewportSize({ width: 720, height: 640 });
  const panel = grip.locator('xpath=..');
  const bounds = await panel.boundingBox();
  const area = await page.locator('.stage-wrap').boundingBox();
  assert(bounds && area && bounds.x >= area.x - 2 && bounds.y >= area.y - 2 &&
    bounds.x + bounds.width <= area.x + area.width + 2 &&
    bounds.y + bounds.height <= area.y + area.height + 2,
  'Layer panel must stay within editor area after viewport resize');
  report.checks.push('Layer panel stays within bounds after viewport resize');

  assert.deepEqual(report.errors, []);
  report.status = 'success';
} catch (error) {
  report.status = 'failure';
  report.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.mkdirSync('docs/audit', { recursive: true });
  fs.writeFileSync(`docs/audit/canvas-layer-drag-${browserName}.json`,
    JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
