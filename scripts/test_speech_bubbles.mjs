import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));

async function savedWork() {
  return await page.evaluate(async () => {
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
    } finally { db.close(); }
  });
}

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const state = await savedWork();
    if (state && predicate(state)) return state;
    await page.waitForTimeout(150);
  }
  throw new Error('Could not persist: ' + label);
}

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /スタンプ/ }).first().click();
  assert.equal(await page.getByRole('button', { name: 'マイスタンプ' }).count(), 0);
  await page.locator('.bar button.tab').filter({ hasText: '文字' }).click();
  await page.getByRole('button', { name: '吹き出し', exact: true }).click();
  assert.equal(await page.getByRole('group', { name: '吹き出しの形' }).getByRole('button').count(), 4);
  await page.getByRole('button', { name: '丸の吹き出し' }).click();

  const textbox = page.getByRole('textbox', { name: 'セリフを編集' });
  await textbox.waitFor();
  await textbox.fill('こんにちは！\nJOMON PIX');
  const textState = await waitFor((s) => s.elements.some((e) => e.type === 'text' &&
    e.bubble?.style === 'round' && e.text === 'こんにちは！\nJOMON PIX'), 'first bubble');
  const id = textState.elements.find((e) => e.type === 'text' && e.bubble)?.id;
  assert.ok(id);

  await page.getByRole('button', { name: 'ギザギザの吹き出し' }).click();
  await page.getByRole('button', { name: '右向き' }).click();
  const edited = await waitFor((s) => s.elements.some((e) => e.id === id &&
    e.bubble?.style === 'jagged' && e.bubble?.tail === 'right'), 'bubble controls');
  assert.ok(edited.elements.find(e => e.id === id));

  await page.locator('.bar [aria-label="戻す"]').click();
  await waitFor((s) => s.elements.some((e) => e.id === id &&
    e.bubble?.tail === 'left'), 'Undo bubble setting before reload');
  await page.getByRole('button', { name: '画像保存', exact: true }).click();
  await page.getByRole('heading', { name: 'できあがり！' }).waitFor({ timeout: 30000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.bar button.tab').filter({ hasText: '文字' }).click();
  await waitFor((state) => state.elements.some((item) =>
    item.id === id && item.bubble?.tail === 'left'), 'reload persistence');
  // A selected layer is intentionally not persisted across reload.
  await page.getByRole('button', { name: '吹き出し', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '丸の吹き出し' }).count(), 1);

  // Create another bubble and test delete from the current selection.
  await page.getByRole('button', { name: 'もくもくの吹き出し' }).click();
  const added = await waitFor((s) => s.elements.some((e) =>
    e.type === 'text' && e.bubble?.style === 'cloud' && e.id !== id), 'second bubble');
  const nextId = added.elements.find((e) => e.type === 'text' &&
    e.bubble?.style === 'cloud' && e.id !== id).id;
  await page.getByRole('button', { name: '吹き出しを削除' }).click();
  await waitFor((s) => !s.elements.some((e) => e.id === nextId) &&
    s.elements.some((e) => e.id === id), 'remove only selected bubble');
  assert.deepEqual(runtimeErrors, [], 'No browser exceptions');
  console.log('Bubble style/edit/save/undo and removed My Stickers: PASS');
} finally {
  await browser.close();
}
