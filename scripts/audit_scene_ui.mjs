import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const out = 'docs/audit';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push('console: ' + message.text());
});
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'networkidle' });
  await page.locator('canvas').first().waitFor();
  await page.waitForTimeout(300);
  const dummyImage = await page.screenshot({ type: 'png' });
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'sample-photo.png', mimeType: 'image/png', buffer: dummyImage,
  });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /フレーム/ }).first().click();
  await page.getByRole('button', { name: /富士山/ }).click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: out + '/scene-ui-fuji.png', fullPage: true });

  await page.getByRole('button', { name: '配信・SNS' }).click();
  await page.getByRole('button', { name: /ライブ配信風/ }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: out + '/scene-ui-live.png', fullPage: true });

  await page.getByRole('button', { name: /キャンバスを縦9:16にする/ }).click();
  await page.getByRole('button', { name: /縦動画風/ }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: out + '/scene-ui-shorts.png', fullPage: true });

  await page.getByRole('button', { name: /YouTube風/ }).click();
  await page.getByRole('button', { name: '背景' }).click();
  await page.getByRole('button', { name: /ゆめかわ/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/scene-ui-video.png', fullPage: true });

  await page.getByRole('button', { name: '配信・SNS' }).click();
  await page.getByRole('button', { name: /SNS投稿風/ }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/scene-ui-social.png', fullPage: true });

  // Confirm canvas presentation choices survive autosave and are included
  // in PNG export (the transformer/handles must not appear in export).
  const persisted = await page.evaluate(() => {
    const json = localStorage.getItem('jomon-pix-work');
    return json ? JSON.parse(json).state : null;
  });
  assert.equal(persisted?.sceneBackground, 'dreamy');
  assert.equal(persisted?.socialTemplate, 'social');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('heading', { name: 'できあがり！' })
    .waitFor({ timeout: 20000 });
  await page.locator('img[alt="完成画像"]').waitFor();
  await page.waitForFunction(() => {
    const preview = document.querySelector('img[alt="完成画像"]');
    return preview instanceof HTMLImageElement && preview.naturalWidth > 0;
  }, { timeout: 10000 });
  await page.screenshot({ path: out + '/scene-ui-export.png', fullPage: true });

  const screenshots = ['fuji', 'live', 'shorts', 'video', 'social', 'export'];
  for (const key of screenshots) {
    const file = out + '/scene-ui-' + key + '.png';
    assert(fs.statSync(file).size > 5000, 'screenshot is too small: ' + file);
  }
  assert.equal(errors.length, 0, 'Unexpected browser errors:\n' + errors.join('\n'));
  fs.writeFileSync(out + '/scene-ui-smoke.json', JSON.stringify({
    status: 'success',
    screenshots,
    errors,
    completedAt: new Date().toISOString(),
  }, null, 2) + '\n');
  console.log('Visual scene UI smoke checks succeeded; screenshots captured.');
} finally {
  await browser.close();
}
