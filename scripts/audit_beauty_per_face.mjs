import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function readState() {
  return await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('jomon-pix-projects-v1', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('work', 'readonly');
        const req = tx.objectStore('work').get('jomon-pix-work');
        req.onsuccess = () => resolve(req.result ? JSON.parse(req.result).state : null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  });
}

async function waitState(predicate, name) {
  for (let i = 0; i < 200; i++) {
    const state = await readState();
    if (state && predicate(state)) return state;
    await page.waitForTimeout(200);
  }
  throw new Error('Timed out waiting for saved state: ' + name);
}
const stickersFor = (state, photoId) =>
  state.elements.filter((el) => el.type === 'sticker' &&
    el.parentImageId === photoId && Number.isInteger(el.beautyGlassesFace));

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  const input = page.locator('input[type="file"][accept="image/*"]').first();
  const bytes = fs.readFileSync('/tmp/beauty-portrait.jpg').toString('base64');
  const photo = await page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = 'data:image/jpeg;base64,' + encoded;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    ctx.drawImage(image, image.naturalWidth, 0);
    return canvas.toDataURL('image/png');
  }, bytes);
  await input.setInputFiles({
    name: 'two-people.png', mimeType: 'image/png',
    buffer: Buffer.from(photo.split(',')[1], 'base64'),
  });
  await page.getByRole('button', { name: 'ビューティー' }).click();
  await page.getByRole('group', { name: 'ビューティーの加工対象' }).waitFor();
  await page.getByRole('status').filter({ hasText: '顔を2人認識しました' }).waitFor({ timeout: 45000 });
  assert.equal(await page.getByRole('button', { name: '全員', exact: true }).count(), 1);
  const face2 = page.getByRole('button', { name: '左から2人目', exact: true });
  assert.equal(await face2.count(), 1);

  // Everyone's baseline setting persists; individual adjustment only adds an override.
  await page.getByRole('slider', { name: '美肌' }).focus();
  await page.keyboard.press('End');
  const before = await waitState((state) =>
    state.elements.some((el) => el.type === 'image' && el.beauty?.smooth === 100), 'everyone 100');
  const imageId = before.elements.find((el) => el.type === 'image').id;
  await face2.click();
  await page.getByRole('slider', { name: '明るさ' }).focus();
  await page.keyboard.press('End');
  const individual = await waitState((state) => state.elements.some((el) =>
    el.id === imageId && el.beautyFaceOverrides?.['1']?.bright === 100), 'person 2 bright');
  const image = individual.elements.find((el) => el.id === imageId);
  assert.equal(image.beauty.smooth, 100);
  assert.equal(image.beautyFaceOverrides['1'].bright, 100);
  assert.equal(image.beautyFaceOverrides['0'], undefined);

  // Sunglasses belong only to the dedicated category, not the Beauty panel.
  assert.equal(await page.getByText('サングラス装備', { exact: true }).count(), 0);
  await page.locator('.bar button.tab').filter({ hasText: 'スタンプ' }).click();
  await page.getByRole('button', { name: 'サングラス', exact: true }).click();
  await page.getByRole('group', { name: 'サングラスをつける顔を選ぶ' })
    .waitFor({ timeout: 45000 });
  await page.getByRole('button', { name: '全員', exact: true }).click();
  // Automatic sunglasses are attached to both photo-local faces and Undo is atomic.
  await page.getByRole('button', { name: '定番ブラックを自動配置' }).click();
  const all = await waitState((state) => stickersFor(state, imageId).length === 2, 'two glasses');
  const glasses = stickersFor(all, imageId);
  assert.deepEqual(glasses.map((sticker) => sticker.beautyGlassesFace).sort(), [0, 1]);
  assert.ok(Math.abs(glasses[0].x - glasses[1].x) > 20);
  await face2.click();
  await page.getByRole('button', { name: '丸型ゴールドを自動配置' }).click();
  const changed = await waitState((state) => {
    const entries = stickersFor(state, imageId);
    return entries.length === 2 && entries.some((s) =>
      s.beautyGlassesFace === 1 && s.label === '丸型ゴールド');
  }, 'replace only second pair');
  assert.equal(stickersFor(changed, imageId).find((s) =>
    s.beautyGlassesFace === 0).label, '定番ブラック');

  await page.locator('.bar [aria-label="戻す"]').click();
  const undone = await waitState((state) => stickersFor(state, imageId).length === 2 &&
    stickersFor(state, imageId).every((s) => s.label === '定番ブラック'), 'Undo glasses replacement');
  assert.equal(stickersFor(undone, imageId).length, 2);

  await page.getByRole('button', { name: 'サングラスを外す' }).click();
  const removed = await waitState((state) => stickersFor(state, imageId).length === 1,
    'Remove glasses for face 2');
  assert.equal(stickersFor(removed, imageId)[0].beautyGlassesFace, 0);
  await page.locator('.bar button.tab').filter({ hasText: 'ビューティー' }).click();
  await page.getByRole('button', { name: '左から2人目', exact: true }).click();
  await page.getByRole('button', { name: 'この顔の個別設定を解除' }).click();
  const reset = await waitState((state) => state.elements.some((el) =>
    el.id === imageId && !el.beautyFaceOverrides?.['1']), 'Reset one face');
  assert.equal(reset.elements.find((el) => el.id === imageId).beauty.smooth, 100);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'ビューティー' }).click();
  await page.getByRole('button', { name: '左から2人目' }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '画像保存', exact: true }).click();
  await page.getByRole('heading', { name: 'できあがり！' }).waitFor({ timeout: 45000 });
  assert.deepEqual(errors, []);
  console.log('Beauty per-face and sunglasses: PASS');
} finally {
  await browser.close();
}
