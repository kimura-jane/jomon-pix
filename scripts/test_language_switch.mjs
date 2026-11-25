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

  // Routine autosave activity must remain invisible and never wrap the header.
  for (const width of [320, 375, 393]) {
    await page.setViewportSize({ width, height: 812 });
    const layout = await page.evaluate(() => {
      const brand = document.querySelector('.brand');
      const logo = document.querySelector('.logo');
      const privacy = document.querySelector('.privacy-link');
      const language = document.querySelector('.lang-switch');
      if (!brand || !logo || !privacy || !language) throw new Error('Missing header controls');
      const a = brand.getBoundingClientRect();
      const b = logo.getBoundingClientRect();
      const c = privacy.getBoundingClientRect();
      const d = language.getBoundingClientRect();
      return {
        height: a.height,
        centered: Math.max(b.top + b.height / 2, c.top + c.height / 2, d.top + d.height / 2)
          - Math.min(b.top + b.height / 2, c.top + c.height / 2, d.top + d.height / 2),
        overflow: d.right > document.documentElement.clientWidth,
      };
    });
    // At <=340px the app intentionally uses a second row to avoid overflow.
    assert.ok(layout.height < (width <= 340 ? 80 : 44), 'Header must remain compact at ' + width + 'px');
    if (width > 340) assert.ok(layout.centered < 3, 'Header controls must stay aligned at ' + width + 'px');
    for (const selector of ['.logo','.app-icon-setting','.privacy-link','.lang-switch']) {
      const r=await page.locator(selector).boundingBox();
      assert(r && r.x >= 0 && r.x+r.width <= width+1, selector+' must stay visible at '+width+'px: '+JSON.stringify(r));
    }
    assert.equal(layout.overflow, false, 'Language control must remain on screen at ' + width + 'px');
    assert.equal(await page.locator('.saved').count(), 0, 'Routine save badge must be hidden');
  }
  await page.setViewportSize({ width: 393, height: 812 });

  // No photo or project should be modified by switching the UI language.
  await page.locator('.lang-switch').click();
  await page.getByText('Privacy', { exact: true }).first().waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('.save').innerText(), 'Save Image');
  for (const label of ['Text','Draw','Stickers','Mosaic','Edit']) {
    assert.equal(await page.locator('.bottom-tools button').filter({hasText:label}).count(),1,'Translated tool '+label);
  }
  await page.locator('.bottom-tools button').filter({hasText:'Edit'}).click();
  for(const label of ['Smart Erase','Beauty','Frames','Layers']) {
    assert.equal(await page.locator('.extra-tool-grid button').filter({hasText:label}).count(),1,'Translated extra tool '+label);
  }
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
