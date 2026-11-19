import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
const posts = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (req) => {
  if (req.method() === 'POST' && !req.url().startsWith('http://127.0.0.1:4173')) {
    posts.push(req.url());
  }
});

const readSavedState = async () => page.evaluate(async () => {
  const request = indexedDB.open('jomon-pix-projects-v1', 1);
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction('work', 'readonly');
    const get = tx.objectStore('work').get('jomon-pix-work');
    let result;
    get.onsuccess = () => { result = get.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return typeof value === 'string' ? JSON.parse(value).state : null;
});

const waitSaved = async (predicate) => {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    const s = await readSavedState();
    if (s && predicate(s)) return s;
    await page.waitForTimeout(150);
  }
  throw new Error('Updated project not saved before timeout');
};

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'domcontentloaded' });
  await page.locator('.bar button.tab').filter({ hasText: 'ホーム' }).click();

  // Synthetic test photo: a red object over a uniform green background.
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#58a960';
    ctx.fillRect(0, 0, 240, 180);
    ctx.fillStyle = '#ef364b';
    ctx.fillRect(100, 64, 40, 42);
    return canvas.toDataURL('image/png');
  });
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'smart-erase-synthetic.png',
    mimeType: 'image/png',
    buffer: Buffer.from(source.split(',')[1], 'base64'),
  });
  const original = (await waitSaved((state) =>
    state.elements.some((item) => item.type === 'image'))).elements
    .find((item) => item.type === 'image').src;

  // 9 styles + 8 colors; choosing a new style REPLACES the same sticker.
  await page.locator('.bar button.tab').filter({ hasText: 'スタンプ' }).click();
  await page.getByRole('button', { name: '髪型', exact: true }).click();
  const controlLabels = (await page.locator('.panel .label').allTextContents())
    .map((label) => label.trim());
  const positions = ['配置', '髪色', '髪型'].map((label) =>
    controlLabels.indexOf(label));
  assert.ok(positions.every((index) => index >= 0),
    'The placement, hair color and hairstyle labels must all be visible');
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2],
    'Control order must be placement → hair color → hairstyle');
  const firstSelected = page.getByRole('group', { name: '髪色を選択' })
    .getByRole('button', { name: 'ダークブラウン' });
  assert.equal(await firstSelected.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '手動配置', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /髪型:.*を追加/ }).count(), 9);
  assert.equal(await page.getByRole('group', { name: '髪色を選択' }).locator('button').count(), 8);
  await page.getByRole('button', { name: /髪型:ボブ.*を追加/ }).click();
  const withHair = await waitSaved((state) =>
    state.elements.filter((item) => item.type === 'sticker').length === 1);
  const firstHair = withHair.elements.find((item) => item.type === 'sticker');
  assert.equal(firstHair.parentImageId, withHair.elements.find((item) => item.type === 'image').id);
  assert.ok(firstHair.src.endsWith('/stickers/hair/v2/bob-dark-brown.webp'), 'Realistic transparent WebP is bundled');

  await page.getByRole('button', { name: 'ピンク', exact: true }).click();
  const pinkButton = page.getByRole('group', { name: '髪色を選択' })
    .getByRole('button', { name: 'ピンク' });
  assert.equal(await pinkButton.getAttribute('aria-pressed'), 'true');
  assert.equal(await firstSelected.getAttribute('aria-pressed'), 'false');
  const ring = await pinkButton.evaluate((button) => {
    const css = getComputedStyle(button);
    return { width: css.borderTopWidth, style: css.borderTopStyle, color: css.borderTopColor };
  });
  assert.equal(ring.width, '2px', 'Active hair color must have a visible border');
  assert.equal(ring.style, 'solid');
  assert.equal(ring.color, 'rgb(212, 46, 132)', 'Selected color ring must be pink');
  const pink = await waitSaved((state) =>
    state.elements.some((item) => item.type === 'sticker' &&
      item.label.includes('ピンク')));
  const pinkHair = pink.elements.find((item) => item.type === 'sticker');
  assert.notEqual(pinkHair.src, firstHair.src, 'Hair color changes the rendered asset');
  assert.equal(pinkHair.parentImageId, firstHair.parentImageId);

  for (const [label, file] of [
    ['角刈り', 'flattop'],
    ['アフロ', 'afro'],
    ['リーゼント', 'pompadour'],
  ]) {
    await page.getByRole('button', { name: new RegExp('髪型:' + label + '.*を追加') }).click();
    const updated = await waitSaved((state) => state.elements.some((item) =>
      item.type === 'sticker' &&
      item.label.startsWith('髪型:' + label + '（') &&
      item.src.includes('/' + file + '-pink.webp'),
    ));
    const allHair = updated.elements.filter((item) => item.type === 'sticker' &&
      item.label.startsWith('髪型:'));
    assert.equal(allHair.length, 1, 'Trying a new cut must not stack another hair layer');
    assert.equal(allHair[0].id, firstHair.id, 'Replacement keeps the editable sticker ID');
    assert.equal(allHair[0].parentImageId, firstHair.parentImageId,
      'Replacement keeps the original photo attachment');
  }
  await page.locator('.bar [aria-label="戻す"]').click();
  await waitSaved((state) => state.elements.some((item) =>
    item.type === 'sticker' && item.label.startsWith('髪型:アフロ（')));
  // Switch to another new style to ensure Undo/redo history is not corrupted.
  await page.getByRole('button', { name: /髪型:リーゼント.*を追加/ }).click();
  await waitSaved((state) => state.elements.some((item) =>
    item.type === 'sticker' && item.label.startsWith('髪型:リーゼント（')));

  // Actual photo-fill, with brush and rectangle selection in touch UI.
  await page.locator('.bar button.tab').filter({ hasText: 'スマート消去' }).click();
  await page.getByRole('button', { name: '不要なものを消す' }).click();
  const dialog = page.getByRole('dialog', { name: 'スマート消去' });
  await dialog.waitFor();
  // The real neural model must be selected by default, not a silent
  // fallback to the old pixel-copy algorithm.
  assert.equal(await dialog.getByRole('button', { name: 'AI補完' }).getAttribute('aria-pressed'), 'true');
  await dialog.getByRole('button', { name: '囲む', exact: true }).click();
  const picture = dialog.locator('img[alt="消去する写真"]');
  const box = await picture.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0);
  const toClient = (x, y) => ({
    x: box.x + box.width * x / 240,
    y: box.y + box.height * y / 180,
  });
  await page.mouse.move(toClient(96, 60).x, toClient(96, 60).y);
  await page.mouse.down();
  await page.mouse.move(toClient(144, 110).x, toClient(144, 110).y, { steps: 6 });
  await page.mouse.up();
  await dialog.getByRole('button', { name: 'AIで消す' }).click();
  await dialog.getByRole('button', { name: 'この結果を適用' }).waitFor({ timeout: 120000 });
  const compare = dialog.getByRole('button', { name: '長押しで比較' });
  const previewSrc = await picture.getAttribute('src');
  assert.ok(previewSrc && previewSrc !== original, 'AI preview must differ from source');
  const noSelect = await compare.evaluate((button) =>
    getComputedStyle(button).userSelect);
  assert.equal(noSelect, 'none', 'iPhone comparison button must not select its text');
  await compare.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 });
  await page.waitForFunction((before) =>
    document.querySelector('img[alt="消去する写真"]')?.getAttribute('src') === before, original);
  await compare.dispatchEvent('pointerup', { pointerType: 'touch', button: 0 });
  await page.waitForFunction((after) =>
    document.querySelector('img[alt="消去する写真"]')?.getAttribute('src') === after, previewSrc);
  await dialog.getByRole('button', { name: 'この結果を適用' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 30000 });

  const changed = await waitSaved((state) => state.elements.some(
    (item) => item.type === 'image' && item.src !== original,
  ));
  const processed = changed.elements.find((item) => item.type === 'image').src;
  const colors = await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return {
      center: Array.from(ctx.getImageData(120, 86, 1, 1).data),
      outside: Array.from(ctx.getImageData(40, 30, 1, 1).data),
    };
  }, processed);

  assert.ok(colors.center[1] > colors.center[0],
    'Object center must be replaced with surrounding green pixels');
  assert.ok(colors.outside[1] > colors.outside[0],
    'Unselected background remains green');

  await page.locator('.bar [aria-label="戻す"]').click();
  await waitSaved((state) => state.elements.some(
    (item) => item.type === 'image' && item.src === original,
  ));
  assert.deepEqual(errors, [], 'No uncaught page errors');
  assert.deepEqual(posts, [], 'No unexpected external image uploads');
  console.log('Hair styles/color + smart erase/undo: PASS');
} finally {
  await browser.close();
}
