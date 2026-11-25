import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const browserName = process.argv[2] || 'chromium';
assert(['chromium', 'webkit'].includes(browserName));
const browser = await (browserName === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(browserName === 'chromium' ? { args: ['--no-sandbox'] } : {}),
});
const origin = 'http://127.0.0.1:4173/jomon-pix/';
const key = 'jomon-pix-work';
const legacy = {
  elements: [], bgColor: '#fff6fb', savedAt: 123456,
};
const errors = [];
const closeTo = (a, b) => Math.abs(a - b) < 0.025;

async function openProject(context) {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('.stage-card').waitFor({ timeout: 30000 });
  return page;
}
async function verifyRatio(page, ratio, label) {
  const rect = await page.locator('.stage-card').boundingBox();
  assert(rect && rect.height > 0 && closeTo(rect.width / rect.height, ratio),
    label + ': unexpected canvas size ' + JSON.stringify(rect));
}
async function readSaved(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('jomon-pix-projects-v1', 1);
    const db = await new Promise((resolve, reject) => {
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
    } finally {
      db.close();
    }
  });
}
async function waitForSaved(page, check, label) {
  for (let i = 0; i < 120; i++) {
    const saved = await readSaved(page);
    if (saved && check(saved)) return saved;
    await page.waitForTimeout(150);
  }
  throw new Error('Persisted value missing: ' + label);
}

try {
  // No saved data: genuinely new projects must open in portrait 9:16.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await openProject(context);
    await verifyRatio(page, 9 / 16, 'fresh project');
    await context.close();
  }

  // Pre-November 8 localStorage save had no canvas fields. Restore square,
  // then edit and reload to prove the recovery is not just temporary UI state.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ k, state }) => {
      localStorage.setItem(k, JSON.stringify({ state, version: 0 }));
    }, { k: key, state: legacy });
    const page = await openProject(context);
    await verifyRatio(page, 1, 'pre-canvas localStorage project');
    assert.equal((await readSaved(page))?.canvasPreset, undefined,
      'Original legacy contents must be preserved before user edits');
    await page.locator('.bottom-tools button.tab').filter({ hasText: '文字' }).click();
    await page.getByRole('button', { name: '＋ 文字を入れる' }).click();
    const saved = await waitForSaved(page, (state) =>
      state.canvasPreset === 'square' && state.canvasWidth === 800 &&
      state.canvasHeight === 800 && state.elements.length === 1,
    'legacy project after editing');
    assert.equal(saved.canvasWidth, 800);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await verifyRatio(page, 1, 'legacy project after reload');
    await context.close();
  }

  // Current projects with explicit 16:9 canvas fields must remain landscape.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ k, state }) => {
      localStorage.setItem(k, JSON.stringify({ state, version: 0 }));
    }, { k: key, state: {
      ...legacy, canvasPreset: '16:9', canvasWidth: 1600, canvasHeight: 900,
    } });
    const page = await openProject(context);
    await verifyRatio(page, 16 / 9, 'existing landscape project');
    await context.close();
  }

  // IndexedDB itself may contain older JSON from an earlier migration, even
  // without a surviving localStorage copy. This is a separate restore path.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await openProject(context);
    await page.evaluate(async ({ k, state }) => {
      const request = indexedDB.open('jomon-pix-projects-v1', 1);
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('work', 'readwrite');
        tx.objectStore('work').put(JSON.stringify({ state, version: 0 }), k);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, { k: key, state: legacy });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await verifyRatio(page, 1, 'legacy IndexedDB project');
    await context.close();
  }
  assert.deepEqual(errors, [], 'No browser errors during migration');
  console.log('Legacy canvas recovery (new, localStorage, saved 16:9, IndexedDB): PASS ' + browserName);
} finally {
  await browser.close();
}
