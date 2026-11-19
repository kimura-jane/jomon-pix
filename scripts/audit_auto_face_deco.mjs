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
// Read actual committed work instead of relying on UI message text.
const readState = async () => page.evaluate(async () => {
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
    return typeof stored === 'string' ? JSON.parse(stored).state : null;
  } finally {
    db.close();
  }
});
const waitForState = async (condition, label) => {
  const deadline = Date.now() + 65000;
  while (Date.now() < deadline) {
    const state = await readState();
    if (state && condition(state)) return state;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timed out waiting for saved state: ${label}`);
};
const images = (s) => s.elements.filter((x) => x.type === 'image');
const stickers = (s) => s.elements.filter((x) => x.type === 'sticker');
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  const theme = await page.locator('meta[name="theme-color"]').getAttribute('content');
  const shell = await page.locator('.top').evaluate((node) =>
    getComputedStyle(node).backgroundColor);
  assert.equal(theme, '#fdf7fb');
  assert.equal(shell, 'rgb(253, 247, 251)');
  report.checks.push('Theme-color and app header use one light, status-bar-safe color');
  // No-photo guidance is visible even though automatic placement is disabled.
  await page.getByRole('button', { name: /スタンプ/ }).first().click();
  await page.getByRole('status').filter({ hasText: '先に写真を追加してください。' })
    .waitFor({ timeout: 15000 });
  assert.equal(await page.getByRole('button', { name: 'ねこ耳を自動配置' }).isDisabled(), true);
  report.checks.push('No-photo guidance is displayed before disabled face stickers');
  await page.locator('.bar button.tab').filter({ hasText: 'ホーム' }).click();
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles('/tmp/face-deco-portrait.jpg');
  await page.getByRole('button', { name: /スタンプ/ }).first().click();

  assert.equal(await page.getByRole('button', { name: /セットを自動配置/ }).count(), 0);
  await page.getByRole('status').filter({ hasText: '顔を1人認識しました' })
    .waitFor({ timeout: 65000 });
  await page.getByRole('button', { name: 'ねこ耳を自動配置' }).click({ timeout: 65000 });
  const state = await waitForState(
    (saved) => images(saved).length === 1 && stickers(saved).length === 1,
    'single-face cat-ear placement',
  );
  assert.equal(images(state).length, 1);
  assert.equal(stickers(state).length, 1);
  const first = stickers(state)[0];
  assert.equal(first.label, 'ねこ耳');
  assert.equal(first.parentImageId, images(state)[0].id);
  assert(first.size > 26 && Number.isFinite(first.x) && Number.isFinite(first.y));
  report.checks.push('One tap on a single-face photo adds precisely ONE editable cat-ear sticker');
  await page.screenshot({ path: `${output}/face-deco-${name}-single.png`, fullPage: true });

  await page.getByRole('button', { name: '戻す' }).click();
  await waitForState((saved) => stickers(saved).length === 0, 'undo');
  // Redo is intentionally hidden in the current header. Re-add one
  // sticker to continue testing adjustment without relying on deleted UI.
  await page.getByRole('button', { name: 'ねこ耳を自動配置' }).click();
  await waitForState((saved) => stickers(saved).length === 1, 're-add after undo');
  report.checks.push('Undo removes one sticker; re-adding creates only one');

  await page.getByRole('button', { name: '配置済みスタンプ1を選択' }).click();
  await page.getByRole('slider', { name: 'スタンプの大きさ' }).focus();
  await page.keyboard.press('End');
  const resized = stickers(await waitForState(
    (saved) => stickers(saved).length === 1 &&
      stickers(saved)[0].scaleX * stickers(saved)[0].size > first.scaleX * first.size,
    'sticker resize',
  ))[0];
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
  await page.getByRole('button', { name: '左から2人目', exact: true })
    .waitFor({ timeout: 65000 });
  await page.getByRole('status').filter({ hasText: '顔を2人認識しました' })
    .waitFor({ timeout: 65000 });
  const targetPhoto = images(await waitForState(
    (saved) => images(saved).length === 2, 'second photo autosave',
  )).at(-1);
  assert.equal(await page.getByRole('button', { name: '左から1人目', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '左から2人目', exact: true }).count(), 1);

  await page.getByRole('button', { name: 'いぬの鼻を自動配置' }).click();
  const firstGroup = stickers(await waitForState(
    (saved) => stickers(saved).filter((x) => x.parentImageId === targetPhoto.id).length === 1,
    'left-face nose',
  )).filter((x) => x.parentImageId === targetPhoto.id);
  assert.equal(firstGroup.length, 1, 'Two-face photo must NOT duplicate one stamp on both people');
  assert.equal(firstGroup[0].label, 'いぬの鼻');
  report.checks.push('TWO people detected, but first tap adds ONE nose on leftmost face');

  await page.getByRole('button', { name: '左から2人目', exact: true }).click();
  await page.getByRole('button', { name: 'ねこ耳を自動配置' }).click();
  const both = stickers(await waitForState(
    (saved) => stickers(saved).filter((x) => x.parentImageId === targetPhoto.id).length === 2,
    'right-face ear',
  )).filter((x) => x.parentImageId === targetPhoto.id);
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
  const manual = stickers(await waitForState(
    (saved) => stickers(saved).length === 4, 'manual placement',
  )).at(-1);
  assert.equal(manual.label, 'ねこの鼻');
  assert.equal(manual.parentImageId, targetPhoto.id);
  report.checks.push('Manual placement remains selectable for a single stamp');

  // A 3x2 group made from the same public test portrait produces multiple
  // smaller faces. The tiled detector must not stop at one large face.
  const groupData = await page.evaluate(async (base64) => {
    const source = new Image();
    source.src = 'data:image/jpeg;base64,' + base64;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth * 3;
    canvas.height = source.naturalHeight * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 3; column++) {
        ctx.drawImage(source, column * source.naturalWidth,
          row * source.naturalHeight);
      }
    }
    return canvas.toDataURL('image/jpeg', 0.94);
  }, portrait64);
  await page.locator('button.tab').first().click();
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'six-person-group.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(groupData.split(',')[1], 'base64'),
  });
  await page.getByRole('button', { name: /スタンプ/ }).first().click();
  await page.getByRole('status').filter({
    hasText: /顔を(?:[3-9]|10)人認識しました/,
  }).waitFor({ timeout: 120000 });
  const thirdFace = page.getByRole('button', { name: '左から3人目', exact: true });
  assert.equal(await thirdFace.count(), 1);
  await thirdFace.click();
  await page.getByRole('button', { name: 'ねこ耳を自動配置' }).click();
  await waitForState((saved) => stickers(saved).length === 5,
    'small faces in six-person group');
  report.checks.push('Small faces in a group photo are individually detected and editable');

  // The latest tiled photo is the selected 6-person target, not the previous
  // 2-person photo. Automatically remove the original forehead hair once.
  const hairPhoto = images(await waitForState(
    (saved) => images(saved).length === 3, 'six-person photo saved',
  )).at(-1);
  const originalSrc = hairPhoto.src;
  await page.getByRole('button', { name: '髪型', exact: true }).click();
  const switcher = page.getByRole('group', { name: '配置方法' });
  await switcher.getByRole('button', { name: '自動配置', exact: true }).click();
  await page.getByRole('status').filter({ hasText: /顔を(?:[3-9]|10)人認識しました/ })
    .waitFor({ timeout: 120000 });
  const hairResults = [];
  for (const [label, file] of [
    ['ボブ', 'bob'],
    ['ストレートロング', 'long'],
    ['角刈り', 'flattop'],
  ]) {
    await page.getByRole('button', { name: new RegExp('髪型:' + label + '.*を自動配置') })
      .click({ timeout: 120000 });
    const after = await waitForState((saved) =>
      stickers(saved).some((item) =>
        item.parentImageId === hairPhoto.id &&
        item.label.startsWith('髪型:' + label + '（') &&
        item.src.includes('/' + file + '-') && !!item.hairRetouch),
    label + ' hair with AI underlay',
    );
    const hair = stickers(after).filter((item) =>
      item.parentImageId === hairPhoto.id && item.label.startsWith('髪型:'));
    assert.equal(hair.length, 1, 'Changing a style must replace hair, not pile up overlays');
    assert(hair[0].size > 12 && Number.isFinite(hair[0].x) && Number.isFinite(hair[0].y));
    assert(hair[0].hairRetouch.src.startsWith('data:image/png;base64,'));
    assert(hair[0].hairRetouch.src.length > 500);
    assert(hair[0].hairRetouch.width > 0 && hair[0].hairRetouch.height > 0);
    assert.equal(images(after).at(-1).src, originalSrc,
      'AI hair must NOT overwrite the source photograph');
    if (hairResults.length) {
      assert.equal(hair[0].id, hairResults[0].id);
      assert.equal(hair[0].hairRetouch.src, hairResults[0].hairRetouch.src,
        'Style changes must reuse the same face restoration without another AI inference');
    }
    hairResults.push(hair[0]);
  }
  assert(hairResults[0].size > hairResults[2].size,
    'Shorter flattop should use smaller geometry than bob');
  report.checks.push('Hair AI underlay persists; source photo unchanged; switching style reuses patch');
  await page.screenshot({ path: `${output}/face-deco-${name}-hair-retouched.png`, fullPage: true });
  // Removing the hairstyle restores the unmodified photograph without
  // touching any other person's decoration or their face.
  const stateBeforeRemove = await readState();
  assert(images(stateBeforeRemove).at(-1).src === originalSrc);
  report.checks.push('Original photograph survives hair processing; reversible overlay metadata saved');
  // The most recent hairstyle remains selected after replacing it.
  await page.getByRole('button', { name: '🗑 削除', exact: true }).click();
  const cleared = await waitForState((saved) =>
    !stickers(saved).some((item) =>
      item.parentImageId === hairPhoto.id && item.label?.startsWith('髪型:')),
    'remove hairstyle',
  );
  assert.equal(images(cleared).at(-1).src, originalSrc);
  await page.getByRole('button', { name: '戻す' }).click();
  const restored = await waitForState((saved) =>
    stickers(saved).some((item) =>
      item.parentImageId === hairPhoto.id &&
      item.label.startsWith('髪型:角刈り（') && item.hairRetouch?.src),
    'undo remove hairstyle',
  );
  assert.equal(images(restored).at(-1).src, originalSrc);
  report.checks.push('Removing and undoing hair restores patch without editing original photo');

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
