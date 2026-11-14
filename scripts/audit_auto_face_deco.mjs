import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const name = process.argv[2] || 'chromium';
assert(['chromium', 'webkit'].includes(name), 'Browser must be chromium or webkit');
const out = 'docs/audit';
fs.mkdirSync(out, { recursive: true });
const report = {
  browser: name,
  mode: 'automated browser, not physical iPhone',
  checks: [],
  errors: [],
  unexpectedPosts: [],
  createdAt: new Date().toISOString(),
};
const browser = await (name === 'chromium' ? chromium : webkit).launch({
  headless: true,
  ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}),
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: name === 'webkit' ? 3 : 1,
  isMobile: name === 'webkit',
  hasTouch: true,
});
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('request', (request) => {
  if (request.method() === 'POST' &&
      !request.url().startsWith('http://127.0.0.1:4173')) {
    report.unexpectedPosts.push(request.url());
  }
});
const readState = () => page.evaluate(
  () => JSON.parse(localStorage.getItem('jomon-pix-work')).state,
);
const pictureElements = (s) => s.elements.filter((x) => x.type === 'image');
const stickerElements = (s) => s.elements.filter((x) => x.type === 'sticker');
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles('/tmp/face-deco-portrait.jpg');
  await page.waitForTimeout(350);

  await page.getByRole('button', { name: /スタンプ/ }).first().click();
  await page.getByRole('button', { name: 'ねこセットを自動配置' }).click();
  await page.getByText(/1人の顔を認識して、3個を自動配置しました/).waitFor({ timeout: 65000 });
  const state = await readState();
  const photos = pictureElements(state);
  const stamps = stickerElements(state);
  assert.equal(photos.length, 1);
  assert.equal(stamps.length, 3);
  assert(stamps.every((item) => item.parentImageId === photos[0].id));
  assert(stamps.every((item) => item.src?.startsWith('data:image/svg+xml')));
  assert(stamps.every((item) =>
    Number.isFinite(item.x) && Number.isFinite(item.y) &&
    Number.isFinite(item.rotation) && item.size >= 26));
  report.checks.push('Cat ears, whiskers and blush all placed using face landmarks');
  report.catStickers = stamps.map((item) => ({
    label: item.label, x: item.x, y: item.y,
    rotation: item.rotation, size: item.size,
    parentImageId: item.parentImageId,
  }));
  await page.screenshot({ path: `${out}/face-deco-${name}-cat.png`, fullPage: true });

  await page.getByRole('button', { name: '戻す' }).click();
  const afterUndo = await readState();
  assert.equal(stickerElements(afterUndo).length, 0,
    'Auto-insert must be one undo step');
  await page.getByRole('button', { name: 'やり直す' }).click();
  assert.equal(stickerElements(await readState()).length, 3);
  report.checks.push('One undo removes the complete set; redo restores all');

  const lastSticker = stickerElements(await readState()).at(-1);
  // Undo/redo intentionally clears selection, so reselect an existing
  // sticker before testing its manual resizing controls.
  await page.getByRole('button', { name: '配置済みスタンプ1を選択' }).click();
  await page.getByRole('slider', { name: 'スタンプの大きさ' }).focus();
  await page.keyboard.press('End');
  const changed = stickerElements(await readState()).find(
    (x) => x.id === lastSticker.id,
  );
  assert(changed.size * changed.scaleX > lastSticker.size * lastSticker.scaleX,
    'Sticker size slider failed to resize after automatic placement');
  assert.equal(changed.parentImageId, photos[0].id);
  report.checks.push('Automatically placed sticker can be resized manually');

  // The second test photo has TWO real faces, generated in CI from the
  // official sample portrait without uploading any private/user photo.
  const portrait64 = fs.readFileSync('/tmp/face-deco-portrait.jpg').toString('base64');
  const doubleData = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = 'data:image/jpeg;base64,' + base64;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    ctx.drawImage(image, image.naturalWidth, 0);
    return canvas.toDataURL('image/png');
  }, portrait64);

  await page.locator('button.tab').first().click();
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'two-portraits.png',
    mimeType: 'image/png',
    buffer: Buffer.from(doubleData.split(',')[1], 'base64'),
  });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /スタンプ/ }).first().click();
  await page.getByRole('button', { name: 'いぬセットを自動配置' }).click();
  await page.getByText(/2人の顔を認識して、6個を自動配置しました/).waitFor({ timeout: 65000 });
  const grouped = await readState();
  const lastPhoto = pictureElements(grouped).at(-1);
  const dogStamps = stickerElements(grouped).filter(
    (item) => item.parentImageId === lastPhoto.id,
  );
  assert.equal(dogStamps.length, 6);
  const xCenters = dogStamps.filter((item) => item.label === 'たれ犬耳')
    .map((item) => item.x + item.size / 2);
  assert.equal(xCenters.length, 2);
  assert(Math.abs(xCenters[0] - xCenters[1]) > lastPhoto.width * 0.15,
    'Two faces must not receive their ears at the same coordinates');
  report.checks.push('Both people receive independently positioned editable dog ears/nose/blush');
  await page.screenshot({ path: `${out}/face-deco-${name}-two-faces.png`, fullPage: true });

  await page.getByRole('button', { name: '手動配置', exact: true }).click();
  await page.getByRole('button', { name: 'ねこの鼻を追加' }).click();
  const manual = stickerElements(await readState()).at(-1);
  assert.equal(manual.label, 'ねこの鼻');
  assert.equal(manual.parentImageId, lastPhoto.id);
  report.checks.push('Manual placement remains available after automatic placement');

  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.unexpectedPosts, []);
  report.status = 'success';
} catch (error) {
  report.status = 'failure';
  report.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.writeFileSync(`${out}/face-deco-${name}-smoke.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
