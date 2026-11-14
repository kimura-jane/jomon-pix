import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const name = process.argv[2] || 'chromium';
assert(['chromium', 'webkit'].includes(name));
const output = 'docs/audit';
fs.mkdirSync(output, { recursive: true });
const report = {
  browser: name,
  mode: 'Automated browser, not a physical iPhone',
  checks: [],
  errors: [],
  unexpectedPosts: [],
  date: new Date().toISOString(),
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
page.on('request', (req) => {
  if (req.method() === 'POST' && !req.url().startsWith('http://127.0.0.1:4173')) {
    report.unexpectedPosts.push(req.url());
  }
});
// The editor migrated to IndexedDB to support large photos. Wait for a
// COMMITTED autosave and then read the project's persisted state, not the
// obsolete localStorage path (which is now a recovery-only legacy copy).
const readState = async () => {
  await page.getByText('自動保存済み', { exact: false })
    .waitFor({ timeout: 15000 });
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('jomon-pix-projects-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const stored = await new Promise((resolve, reject) => {
        const transaction = db.transaction('work', 'readonly');
        let value;
        const request = transaction.objectStore('work').get('jomon-pix-work');
        request.onsuccess = () => { value = request.result; };
        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error);
      });
      if (typeof stored !== 'string') {
        throw new Error('No committed IndexedDB project was found');
      }
      return JSON.parse(stored).state;
    } finally {
      db.close();
    }
  });
};
const images = (s) => s.elements.filter((x) => x.type === 'image');
const stickers = (s) => s.elements.filter((x) => x.type === 'sticker');
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles('/tmp/face-deco-portrait.jpg');
  await page.getByRole('button', { name: /スタンプ/ }).first().click();

  await page.getByText('顔を1人認識しました').waitFor({ timeout: 65000 });
  assert.equal(await page.getByRole('button', { name: /セットを自動配置/ }).count(), 0);
  await page.getByRole('button', { name: 'ねこ耳を自動配置' }).click();
  await page.getByText(/左から1人目に「ねこ耳」を1個配置しました/).waitFor({ timeout: 65000 });
  const state = await readState();
  assert.equal(images(state).length, 1);
  assert.equal(stickers(state).length, 1);
  const first = stickers(state)[0];
  assert.equal(first.label, 'ねこ耳');
  assert.equal(first.parentImageId, images(state)[0].id);
  assert(first.size > 26 && Number.isFinite(first.x) && Number.isFinite(first.y));
  report.checks.push('One tap on a single-face photo adds precisely ONE editable cat-ear sticker');
  await page.screenshot({ path: `${output}/face-deco-${name}-single.png`, fullPage: true });

  await page.getByRole('button', { name: '戻す' }).click();
  assert.equal(stickers(await readState()).length, 0);
  await page.getByRole('button', { name: 'やり直す' }).click();
  assert.equal(stickers(await readState()).length, 1);
  report.checks.push('Undo and redo affect exactly one sticker');

  await page.getByRole('button', { name: '配置済みスタンプ1を選択' }).click();
  await page.getByRole('slider', { name: 'スタンプの大きさ' }).focus();
  await page.keyboard.press('End');
  const resized = stickers(await readState())[0];
  assert(resized.scaleX * resized.size > first.scaleX * first.size);
  report.checks.push('Sticker remains independently resizable');

  // Build a temporary group photograph: the same official portrait twice,
  // positioned side-by-side. Do not store the source image in the repository.
  const portrait64 = fs.readFileSync('/tmp/face-deco-portrait.jpg').toString('base64');
  const data = await page.evaluate(async (base64) => {
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
    name: 'two-people.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data.split(',')[1], 'base64'),
  });
  await page.getByRole('button', { name: /スタンプ/ }).first().click();
  await page.getByText(/2人の顔を認識しました/).waitFor({ timeout: 65000 });
  const targetPhoto = images(await readState()).at(-1);
  assert.equal(await page.getByRole('button', { name: '左から1人目', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '左から2人目', exact: true }).count(), 1);

  await page.getByRole('button', { name: 'いぬの鼻を自動配置' }).click();
  await page.getByText(/左から1人目に「いぬの鼻」を1個配置しました/).waitFor({ timeout: 65000 });
  const firstGroup = stickers(await readState()).filter((x) => x.parentImageId === targetPhoto.id);
  assert.equal(firstGroup.length, 1, 'Two-face photo must NOT duplicate one stamp on both people');
  assert.equal(firstGroup[0].label, 'いぬの鼻');
  report.checks.push('TWO people detected, but first tap adds ONE nose on leftmost face');

  await page.getByRole('button', { name: '左から2人目', exact: true }).click();
  await page.getByRole('button', { name: 'ねこ耳を自動配置' }).click();
  await page.getByText(/左から2人目に「ねこ耳」を1個配置しました/).waitFor({ timeout: 65000 });
  const both = stickers(await readState()).filter((x) => x.parentImageId === targetPhoto.id);
  assert.equal(both.length, 2);
  assert.equal(both[1].label, 'ねこ耳');
  const horizontalDelta = Math.abs(
    (both[1].x + both[1].size / 2) - (both[0].x + both[0].size / 2),
  );
  assert(horizontalDelta > targetPhoto.width * 0.16,
    'Face selector must distinguish left and right person');
  report.checks.push('Choosing rightmost face places ONE ear on the right, without duplicating');
  await page.screenshot({ path: `${output}/face-deco-${name}-two-faces.png`, fullPage: true });

  await page.getByRole('button', { name: '手動配置', exact: true }).click();
  await page.getByRole('button', { name: 'ねこの鼻を追加' }).click();
  const manual = stickers(await readState()).at(-1);
  assert.equal(manual.label, 'ねこの鼻');
  assert.equal(manual.parentImageId, targetPhoto.id);
  report.checks.push('Manual placement remains selectable for a single stamp');

  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.unexpectedPosts, []);
  report.status = 'success';
} catch (error) {
  report.status = 'failure';
  report.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.writeFileSync(`${output}/face-deco-${name}-smoke.json`,
    JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
