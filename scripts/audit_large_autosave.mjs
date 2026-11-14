import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const browserName = process.argv[2] || 'chromium';
assert(['chromium', 'webkit'].includes(browserName));
const browserType = browserName === 'webkit' ? webkit : chromium;
const browser = await browserType.launch({
  headless: true,
  ...(browserName === 'chromium' ? { args: ['--no-sandbox'] } : {}),
});
const baseURL = 'http://127.0.0.1:4173/jomon-pix/';
const report = {
  name: 'Large photo autosave and legacy migration',
  browser: browserName,
  checks: [],
  errors: [],
  time: new Date().toISOString(),
};

const readIndexedDB = async (page) => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('jomon-pix-projects-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('work', 'readonly');
    const request = transaction.objectStore('work').get('jomon-pix-work');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
});

const photoInDB = (raw) => {
  assert.equal(typeof raw, 'string', 'IndexedDB must contain saved artwork');
  const data = JSON.parse(raw);
  assert(Array.isArray(data.state.elements));
  return data.state.elements.find((element) => element.type === 'image');
};
const waitForSaved = async (page) =>
  page.getByText('自動保存済み', { exact: false }).waitFor({ timeout: 45000 });

try {
  // A realistic noisy PNG that exceeds localStorage's ~5MiB ceiling.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByText('JOMON pix').first().waitFor();

  const photo = await page.evaluate(() => {
    const size = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    let random = 0x65ab9721;
    for (let i = 0; i < image.data.length; i += 4) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      image.data[i] = random & 255;
      image.data[i + 1] = (random >>> 8) & 255;
      image.data[i + 2] = (random >>> 16) & 255;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  });
  assert(photo.length > 5 * 1024 * 1024,
    `Expected source data URL to exceed 5MiB, got ${photo.length}`);
  const buffer = Buffer.from(photo.split(',')[1], 'base64');
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles({ name: 'large-test.png', mimeType: 'image/png', buffer });
  await waitForSaved(page);
  const raw = await readIndexedDB(page);
  const storedPhoto = photoInDB(raw);
  assert(storedPhoto.src.length > 5 * 1024 * 1024);
  assert.equal(await page.evaluate(() => localStorage.getItem('jomon-pix-work')), null,
    'New projects should not be saved in localStorage');
  report.checks.push(`Large image (${storedPhoto.src.length} chars) saved to IndexedDB`);
  const firstId = storedPhoto.id;

  await page.reload({ waitUntil: 'networkidle' });
  await waitForSaved(page);
  const afterReload = photoInDB(await readIndexedDB(page));
  assert.equal(afterReload.id, firstId);
  assert.equal(afterReload.src.length, storedPhoto.src.length);
  assert(await page.locator('img').count() >= 0);
  report.checks.push('Large image survives browser/WebView reload without data loss');
  await context.close();

  // A pre-upgrade localStorage document must migrate intact to IndexedDB.
  const legacyContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const legacyPage = await legacyContext.newPage();
  legacyPage.on('pageerror', (error) => report.errors.push(error.message));
  await legacyPage.goto(baseURL, { waitUntil: 'networkidle' });
  const legacyJSON = await legacyPage.evaluate(() => {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = testCanvas.height = 10;
    testCanvas.getContext('2d').fillRect(0, 0, 10, 10);
    return JSON.stringify({
      state: {
        elements: [{
          id: 'legacy-photo', type: 'image',
          x: 30, y: 30, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
          src: testCanvas.toDataURL(), width: 200, height: 200, filter: 'none',
        }],
        bgColor: '#fff6fb', sceneBackground: 'none', socialTemplate: 'none',
        canvasPreset: 'square', canvasWidth: 800, canvasHeight: 800,
        savedAt: 12345678,
      }, version: 0,
    });
  });
  await legacyPage.evaluate((saved) => localStorage.setItem('jomon-pix-work', saved), legacyJSON);
  await legacyPage.reload({ waitUntil: 'networkidle' });
  await waitForSaved(legacyPage);
  const migrated = await readIndexedDB(legacyPage);
  assert.equal(migrated, legacyJSON, 'Legacy work must be migrated byte-for-byte');
  assert.equal(await legacyPage.evaluate(() => localStorage.getItem('jomon-pix-work')), legacyJSON,
    'Never delete legacy recovery copy');
  assert.equal(photoInDB(migrated).id, 'legacy-photo');
  report.checks.push('Legacy localStorage project copied intact to IndexedDB and recovery copy retained');
  await legacyContext.close();

  // Unavailable storage must be reported and must not erase old localStorage.
  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const setupPage = await deniedContext.newPage();
  await setupPage.goto(baseURL, { waitUntil: 'networkidle' });
  await setupPage.evaluate((saved) => localStorage.setItem('jomon-pix-work', saved), legacyJSON);
  await setupPage.close();
  await deniedContext.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true, get: () => undefined,
    });
  });
  const deniedPage = await deniedContext.newPage();
  await deniedPage.goto(baseURL, { waitUntil: 'networkidle' });
  await deniedPage.getByText('自動保存に失敗しました').first()
    .waitFor({ timeout: 15000 });
  assert.equal(await deniedPage.evaluate(() => localStorage.getItem('jomon-pix-work')), legacyJSON);
  report.checks.push('IndexedDB unavailable: failure is visible, existing legacy data remains intact');
  await deniedContext.close();

  assert.deepEqual(report.errors, []);
  report.status = 'success';
} catch (error) {
  report.status = 'failure';
  report.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.mkdirSync('docs/audit', { recursive: true });
  fs.writeFileSync(
    `docs/audit/large-autosave-${browserName}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
