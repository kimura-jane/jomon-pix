import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.JOMON_TEST_URL ?? 'http://127.0.0.1:4173/jomon-pix/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.lang-switch').waitFor({ state: 'visible', timeout: 30_000 });
  assert.match(await page.locator('.logo').innerText(), /JOMON PIX/);
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja');

  // No photo or project should be modified by switching the UI language.
  await page.locator('.lang-switch').click();
  await page.getByText('Privacy', { exact: true }).first().waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('.save').innerText(), 'Save Image');
  assert.equal(await page.evaluate(() => localStorage.getItem('jomon-pix-ui-language')), 'en');

  // The in-app privacy policy follows the language choice.
  await page.locator('.privacy-link').click();
  const frame = page.frameLocator('.modal iframe');
  await frame.getByRole('heading', { name: 'Privacy Policy' }).waitFor();
  assert.equal(await frame.locator('html').getAttribute('lang'), 'en');
  assert.match(await frame.locator('#policy-en').innerText(), /Facial landmarks/);
  await page.locator('.modal button').last().click();

  // Persistence must survive a full page reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.lang-switch').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.save').innerText(), 'Save Image');

  // Japanese can be restored with the same control.
  await page.locator('.lang-switch').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
  await page.getByText('プライバシー', { exact: true }).first().waitFor();
  assert.equal(await page.locator('.save').innerText(), '画像保存');

  // Independently opened privacy policies also have both languages.
  const standalone = new URL('privacy-policy.html?lang=en', base).href;
  await page.goto(standalone, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('#policy-ja').isVisible(), false);
  await page.locator('[data-lang="ja"]').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
  assert.equal(await page.locator('#policy-en').isVisible(), false);
  assert.match(await page.locator('#policy-ja').innerText(), /写真・編集データの取扱い/);

  assert.deepEqual(errors, [], 'No uncaught browser errors expected');
  console.log('JOMON PIX language switch: PASS');
} finally {
  await browser.close();
}
