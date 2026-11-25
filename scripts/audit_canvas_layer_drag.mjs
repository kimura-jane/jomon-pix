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

  // The top-level 加工 tab was removed. Canvas sizes are accessed through
  // Home -> キャンバス設定, which opens the edit panel's キャンバス section.
  await page.locator('.bar button.tab').filter({ hasText: 'ホーム' }).click();
  await page.getByRole('button', { name: 'キャンバス設定', exact: true }).click();

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
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffaacc';
    ctx.fillRect(0, 0, 800, 600);
    return canvas.toDataURL('image/png');
  });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles({
      name: 'layout-qa.png',
      mimeType: 'image/png',
      buffer: Buffer.from(photoData.split(',')[1], 'base64'),
    });
  // Keep each photo and attached sticker independently movable/fixable.
  // This test uses persistent IndexedDB state rather than UI toast messages.
  const saved = async () => page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('jomon-pix-projects-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('work', 'readonly');
        const request = tx.objectStore('work').get('jomon-pix-work');
        request.onsuccess = () => {
          resolve(request.result ? JSON.parse(request.result).state : null);
        };
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
  const waitForSaved = async (predicate, message) => {
    const until = Date.now() + 20000;
    while (Date.now() < until) {
      const state = await saved();
      if (state && predicate(state)) return state;
      await page.waitForTimeout(150);
    }
    throw new Error('Timed out waiting for ' + message);
  };
  const photoState = await waitForSaved((state) =>
    state.elements.some((el) => el.type === 'image'), 'image save');
  const photo = photoState.elements.find((el) => el.type === 'image');
  const initialPhotoPosition = { x: photo.x, y: photo.y };
  await page.getByRole('button', { name: 'レイヤー一覧を開く', exact: true }).click();
  await page.getByRole('button', { name: '画像1の位置とサイズを固定' }).click();
  await waitForSaved((state) =>
    state.elements.find((el) => el.id === photo.id)?.transformLocked === true,
  'photo transform lock');
  assert.equal(await page.getByRole('button', {
    name: '画像1の位置とサイズを解除',
  }).getAttribute('aria-pressed'), 'true');
  report.checks.push('Photo lock toggles and is saved independently of edit lock');

  // The photo is locked but may still be the parent of a newly added stamp.
  await page.locator('.bottom-tools button.tab').filter({ hasText: 'スタンプ' }).click();
  await page.getByRole('button', { name: '絵文字', exact: true }).click();
  await page.getByRole('button', { name: '🐰を追加', exact: true }).click();
  const withSticker = await waitForSaved((state) =>
    state.elements.some((el) => el.type === 'sticker' && el.parentImageId === photo.id),
  'sticker attached to transform-locked photo');
  const bunny = withSticker.elements.find((el) =>
    el.type === 'sticker' && el.parentImageId === photo.id);
  assert.equal(bunny.locked, undefined);
  assert.equal(bunny.transformLocked, undefined);
  assert.equal(withSticker.elements.find((el) => el.id === photo.id)?.transformLocked, true);
  assert.equal(await page.getByRole('listitem').count(), 2,
    'Floating layer list should show the photo and attached sticker separately');
  assert.equal(await page.getByRole('button', { name: 'スタンプ1の位置とサイズを固定' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '画像2の位置とサイズを解除' }).count(), 1);
  report.checks.push('Floating layers show separately lockable photo and attached sticker');

  const canvas = await page.locator('.konvajs-content').boundingBox();
  assert(canvas && canvas.width > 100);
  const zoomScale = canvas.width / withSticker.canvasWidth;
  const imageOrigin = { x: canvas.x + photo.x * zoomScale, y: canvas.y + photo.y * zoomScale };
  const dragCanvas = async (x, y, dx = 25, dy = 16) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  };
  // Drag on the photo but outside the centered bunny.
  const photoSpot = {
    x: imageOrigin.x + photo.width * .08 * zoomScale,
    y: imageOrigin.y + photo.height * .08 * zoomScale,
  };
  await dragCanvas(photoSpot.x, photoSpot.y);
  await page.waitForTimeout(450);
  let after = await saved();
  const fixedPhoto = after.elements.find((el) => el.id === photo.id);
  assert.equal(fixedPhoto.x, initialPhotoPosition.x);
  assert.equal(fixedPhoto.y, initialPhotoPosition.y);
  // The attached bunny must still move when the photo cannot.
  const bunnySpot = {
    x: imageOrigin.x + (bunny.x + bunny.size * .42) * zoomScale,
    y: imageOrigin.y + (bunny.y + bunny.size * .42) * zoomScale,
  };
  await dragCanvas(bunnySpot.x, bunnySpot.y);
  const movedStickerState = await waitForSaved((state) => {
    const sticker = state.elements.find((el) => el.id === bunny.id);
    return sticker && (Math.abs(sticker.x - bunny.x) > 2 || Math.abs(sticker.y - bunny.y) > 2);
  }, 'dragging sticker over locked photo');
  assert.equal(movedStickerState.elements.find((el) => el.id === photo.id).x,
    initialPhotoPosition.x);
  report.checks.push('Locked photo ignores dragging, while attached sticker moves independently');

  await page.getByRole('button', { name: 'スタンプ1の位置とサイズを固定' }).click();
  const fixedStickerState = await waitForSaved((state) =>
    state.elements.find((el) => el.id === bunny.id)?.transformLocked === true,
  'sticker transform lock');
  const fixedSticker = fixedStickerState.elements.find((el) => el.id === bunny.id);
  await page.getByRole('button', { name: 'スタンプ1の位置とサイズを解除' }).click();
  await waitForSaved((state) =>
    state.elements.find((el) => el.id === bunny.id)?.transformLocked === false,
  'sticker transform unlock');
  assert.equal(fixedSticker.parentImageId, photo.id);
  report.checks.push('Attached sticker has its own reversible position and size lock');

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
  await page.getByRole('button', { name: 'レイヤー一覧を開く', exact: true }).click();
  await grip.waitFor({ timeout: 15000 });
  const persisted = await waitForSaved((state) =>
    state.elements.find((el) => el.id === photo.id)?.transformLocked === true &&
    state.elements.some((el) => el.id === bunny.id && el.parentImageId === photo.id),
  'transform lock retained after refresh');
  assert(persisted, 'Photo transform lock and attached sticker survive reload');
  report.checks.push('Position/size lock survives page reload');
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
