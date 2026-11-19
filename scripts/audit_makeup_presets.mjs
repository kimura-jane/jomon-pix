import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const readWork = async () => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('jomon-pix-projects-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('work', 'readonly');
      const req = tx.objectStore('work').get('jomon-pix-work');
      req.onsuccess = () => resolve(req.result ? JSON.parse(req.result).state : null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
});
async function waitWork(predicate, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const state = await readWork();
    if (state && predicate(state)) return state;
    await page.waitForTimeout(200);
  }
  throw new Error('Timed out waiting for ' + label);
}
const image = (state) => state.elements.filter((e) => e.type === 'image').at(-1);
const menu = page.getByRole('group', { name: 'メイクの種類' });
const names = ['ナチュラル', 'アイドル風', 'ギャル風', 'ぴえん系', '韓国風', 'Y2K'];

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles('/tmp/beauty-portrait.jpg');
  const source = image(await waitWork((s) => !!image(s), 'portrait uploaded')).src;
  await page.getByRole('button', { name: 'ビューティー' }).first().click();
  await page.getByRole('status').filter({ hasText: '顔を1人認識しました' })
    .waitFor({ timeout: 60000 });
  assert.equal(await menu.locator('button').count(), 6);
  for (const label of names) assert.equal(await menu.getByRole('button', { name: label }).count(), 1);

  await menu.getByRole('button', { name: 'ナチュラル' }).click();
  const natural = await waitWork((s) => image(s)?.beauty?.smooth === 18, 'natural preset');
  assert.equal(image(natural).beauty.lip, 10);
  assert.equal(image(natural).makeupStyle, 'natural',
    'Applied style must persist separately from numeric Beauty settings');
  assert.equal(image(natural).beauty.legSlim, 0);
  assert.equal(image(natural).src, source, 'Original photo must not be modified');
  assert.equal(await menu.getByRole('button', { name: 'ナチュラル' }).getAttribute('aria-pressed'), 'true');

  // Regression: the PNG exporter must accept processed HTMLCanvasElement
  // images even when cosmetics are the *only* active effect. Previously,
  // stageRef's readiness check ignored makeupStyle and timed out after 15s.
  async function saveEditedPng(label) {
    await page.getByRole('button', { name: '画像保存', exact: true }).click();
    await page.getByRole('heading', { name: 'できあがり！' })
      .waitFor({ timeout: 30000 });
    const preview = page.locator('img[alt="完成画像"]');
    await preview.waitFor();
    const result = await preview.evaluate(async (img) => {
      if (!(img instanceof HTMLImageElement)) throw new Error('PNG preview is not an image');
      await img.decode();
      const response = await fetch(img.src);
      if (!response.ok) throw new Error('Unable to retrieve exported PNG');
      const buffer = await response.arrayBuffer();
      const header = Array.from(new Uint8Array(buffer.slice(0, 8)));
      const checksum = Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', buffer),
      )).map((b) => b.toString(16).padStart(2, '0')).join('');
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        bytes: buffer.byteLength,
        header,
        checksum,
      };
    });
    assert.deepEqual(result.header, [137, 80, 78, 71, 13, 10, 26, 10],
      label + ': exporter must return a real PNG');
    assert(result.width > 0 && result.height > 0 && result.bytes > 10000,
      label + ': empty or invalid PNG');
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    return result;
  }

  await page.locator('[data-beauty-state="ready"]').waitFor({ timeout: 60000 });
  const naturalPng = await saveEditedPng('normal makeup preset');
  const fields = [
    ['美肌', 'smooth'], ['明るさ', 'bright'], ['血色', 'warmth'],
    ['小顔', 'slim'], ['あごシャープ', 'chin'], ['目の大きさ', 'eyes'],
    ['リップ', 'lip'], ['チーク', 'blush'],
  ];
  for (const [label] of fields) {
    await page.getByRole('slider', { name: label, exact: true }).focus();
    await page.keyboard.press('Home');
  }
  const makeupOnly = await waitWork((s) =>
    image(s)?.makeupStyle === 'natural' &&
    fields.every(([, key]) => image(s)?.beauty?.[key] === 0),
  'makeup style with all numerical sliders set to zero');
  assert.equal(makeupOnly.elements.filter((el) => el.type === 'image').length, 1);
  await page.locator('[data-beauty-state="ready"]').waitFor({ timeout: 60000 });
  const cosmeticsOnlyPng = await saveEditedPng('cosmetics-only photo');
  assert.notEqual(cosmeticsOnlyPng.checksum, naturalPng.checksum,
    'Cosmetics-only rendering must visibly differ from the numeric preset rendering');
  // Restore the preset so the existing Undo, per-face and two-person tests
  // continue with their original expectations.
  await menu.getByRole('button', { name: 'ナチュラル' }).click();
  await waitWork((s) => image(s)?.beauty?.smooth === 18 &&
    image(s)?.makeupStyle === 'natural', 'restored natural makeup');

  await menu.getByRole('button', { name: 'ギャル風' }).click();
  const gyaru = await waitWork((s) => image(s)?.beauty?.slim === 20, 'gyaru preset');
  assert.equal(image(gyaru).beauty.eyes, 22);
  assert.equal(image(gyaru).makeupStyle, 'gyaru');
  assert.equal(await menu.getByRole('button', { name: 'ギャル風' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '戻す' }).click();
  await waitWork((s) => image(s)?.beauty?.smooth === 18 && image(s)?.beauty?.slim === 6, 'one-step undo');
  assert.equal(await menu.getByRole('button', { name: 'ナチュラル' }).getAttribute('aria-pressed'), 'true');

  await page.getByRole('slider', { name: '美肌' }).focus();
  await page.keyboard.press('End');
  await waitWork((s) => image(s)?.beauty?.smooth === 100, 'manual fine tuning');
  assert.equal(await menu.getByRole('button', { name: 'ナチュラル' }).getAttribute('aria-pressed'), 'true',
    'Fine tuning must retain the chosen actual makeup rendering');
  assert.equal(image(await readWork()).makeupStyle, 'natural');

  // A group photo must allow one person to use a different preset without
  // modifying the other person. Applying to everyone overrides per-face looks.
  const portrait64 = fs.readFileSync('/tmp/beauty-portrait.jpg').toString('base64');
  const two = await page.evaluate(async (base64) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + base64;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * 2;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.drawImage(img, img.naturalWidth, 0);
    return canvas.toDataURL('image/png');
  }, portrait64);
  await page.locator('.bar button.tab').first().click();
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'two-face.png', mimeType: 'image/png',
    buffer: Buffer.from(two.split(',')[1], 'base64'),
  });
  await waitWork((s) => s.elements.filter((e) => e.type === 'image').length === 2, 'second photo saved');
  await page.getByRole('button', { name: 'ビューティー' }).first().click();
  await page.getByRole('status').filter({ hasText: '顔を2人認識しました' })
    .waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '左から2人目' }).click();
  await menu.getByRole('button', { name: 'アイドル風' }).click();
  const personalized = await waitWork((s) => image(s)?.beautyFaceOverrides?.['1']?.eyes === 18,
    'one-face idol preset');
  assert.equal(image(personalized).beautyFaceOverrides['1'].blush, 20);
  assert.equal(image(personalized).makeupFaceStyles['1'], 'idol');
  assert.equal(image(personalized).beautyFaceOverrides['0'], undefined);
  assert.equal(image(personalized).beauty?.smooth ?? 0, 0);
  await page.getByRole('button', { name: '全員', exact: true }).click();
  await menu.getByRole('button', { name: 'ぴえん系' }).click();
  const everyone = await waitWork((s) => image(s)?.beauty?.blush === 24 &&
    !image(s)?.beautyFaceOverrides?.['1'], 'everyone preset override');
  assert.equal(image(everyone).beauty.eyes, 20);
  assert.equal(image(everyone).makeupStyle, 'pien');
  assert.equal(image(everyone).makeupFaceStyles, undefined);
  assert.equal(await menu.getByRole('button', { name: 'ぴえん系' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '戻す' }).click();
  const undo = await waitWork((s) =>
    image(s)?.beautyFaceOverrides?.['1']?.eyes === 18 &&
    (image(s)?.beauty?.smooth ?? 0) === 0, 'undo everyone restores individual makeup');
  assert.equal(image(undo).beautyFaceOverrides['1'].lip, 18);
  assert.equal(image(undo).makeupFaceStyles['1'], 'idol');
  // Editor Undo clears the selected element. With multiple photos the Beauty
  // panel cannot infer a target until the user selects one again.
  await page.getByRole('button', { name: '写真2', exact: true }).first().click();
  await page.getByRole('status').filter({ hasText: '顔を2人認識しました' })
    .waitFor({ timeout: 60000 });
  await menu.getByRole('button', { name: 'ギャル風' }).click();
  const alternative = await waitWork((s) =>
    image(s)?.makeupStyle === 'gyaru' &&
    image(s)?.beautyFaceOverrides?.['1'] === undefined, 'apply another style globally');
  assert.equal(image(alternative).makeupStyle, 'gyaru');
  await page.getByRole('button', { name: 'メイクを外す' }).click();
  const cleared = await waitWork((s) =>
    !image(s)?.makeupStyle && !image(s)?.makeupFaceStyles &&
    image(s)?.beauty?.lip === 0, 'remove all makeup');
  assert.equal(image(cleared).beauty.legSlim, 0);
  await page.getByRole('button', { name: '戻す' }).click();
  const back = await waitWork((s) => image(s)?.makeupStyle === 'gyaru', 'undo makeup removal');
  assert.equal(image(back).makeupStyle, 'gyaru');
  assert.deepEqual(errors, []);
  console.log('Makeup presets: offline values, per-face, everyone, manual adjustment, Undo: PASS');
} finally {
  await browser.close();
}
