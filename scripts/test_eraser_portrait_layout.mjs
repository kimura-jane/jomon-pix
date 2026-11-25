import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), args: ['--no-sandbox'] });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const errors = [];
const settle = () => page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
page.on('pageerror', (e) => errors.push(e.message));

async function checkBounds(viewport) {
  if (page.viewportSize().width !== viewport.width || page.viewportSize().height !== viewport.height) await page.setViewportSize(viewport);
  await settle();
  const dialog = page.getByRole('dialog', { name: 'スマート消去' });
  const frame = dialog.locator('[data-testid="eraser-preview-frame"]');
  const photo = dialog.getByRole('img', { name: '消去する写真' });
  const geom = await frame.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    const imageEl = element.querySelector('img');
    const img = imageEl?.getBoundingClientRect();
    const picture = imageEl?.parentElement?.getBoundingClientRect();
    const scale = imageEl && img
      ? Math.min(img.width / imageEl.naturalWidth, img.height / imageEl.naturalHeight)
      : 0;
    const content = imageEl && img && scale
      ? {
          x: img.x + (img.width - imageEl.naturalWidth * scale) / 2,
          y: img.y + (img.height - imageEl.naturalHeight * scale) / 2,
          width: imageEl.naturalWidth * scale,
          height: imageEl.naturalHeight * scale,
        }
      : null;
    const seg = element.previousElementSibling?.getBoundingClientRect();
    const modal = element.closest('.modal')?.getBoundingClientRect();
    return {
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      img: img && { x: img.x, y: img.y, width: img.width, height: img.height },
      picture: picture && { x: picture.x, y: picture.y, width: picture.width, height: picture.height },
      content,
      fit: imageEl && getComputedStyle(imageEl).objectFit,
      svgAspect: element.querySelector('svg')?.getAttribute('preserveAspectRatio'),
      segBottom: seg?.bottom,
      modalTop: modal?.top,
      frameFlex: getComputedStyle(element).flexShrink,
    };
  });
  assert.ok(geom.img && geom.picture && geom.content, 'The image must be visible in the preview');
  assert.equal(geom.fit, 'contain');
  assert.equal(geom.svgAspect, 'xMidYMid meet');
  assert.equal(geom.frameFlex, '0', 'Preview frame must not shrink independently of picture');
  const epsilon = 1.5;
  assert.ok(geom.img.x + epsilon >= geom.frame.x,
    'Portrait preview must not escape its frame on the left');
  assert.ok(geom.img.y + epsilon >= geom.frame.y,
    'Portrait preview must not cover mode buttons above');
  assert.ok(geom.img.x + geom.img.width <= geom.frame.x + geom.frame.width + epsilon,
    'Portrait preview must not escape right edge');
  assert.ok(geom.img.y + geom.img.height <= geom.frame.y + geom.frame.height + epsilon,
    'Portrait preview must not overlap the bottom buttons');
  assert.ok(geom.segBottom <= geom.frame.y + epsilon, 'Mode buttons should precede image');
  assert.ok(geom.img.height <= geom.frame.height + epsilon);
  const nativeW = await photo.evaluate((im) => im.naturalWidth);
  const nativeH = await photo.evaluate((im) => im.naturalHeight);
  assert.ok(Math.abs((geom.content.width / geom.content.height) - nativeW / nativeH) < .01,
    'Visible preview must preserve the original photo aspect ratio');
  assert.ok(geom.content.x >= geom.frame.x - epsilon &&
    geom.content.y >= geom.frame.y - epsilon &&
    geom.content.x + geom.content.width <= geom.frame.x + geom.frame.width + epsilon &&
    geom.content.y + geom.content.height <= geom.frame.y + geom.frame.height + epsilon,
  'Visible picture must remain inside its preview frame');
  const descriptions = await dialog.locator('.hint-s').allTextContents();
  assert.ok(descriptions.every((value) => !value.includes('約28MB') &&
    !value.includes('端末内AI') && !value.includes('比較してから適用')),
  'Remove long explanatory instructions from the compact tool');
  return geom;
}

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'domcontentloaded' });
  await page.locator('.bar button.tab').filter({ hasText: 'ホーム' }).click();

  const vertical = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 840;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eed6ad';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#853f34';
    ctx.fillRect(60, 250, 120, 270);
    return canvas.toDataURL('image/png');
  });
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'portrait-smart-erase.png',
    mimeType: 'image/png',
    buffer: Buffer.from(vertical.split(',')[1], 'base64'),
  });
  await page.locator('.bottom-tools button').filter({hasText:'加工'}).click();
  await page.locator('.extra-tool-grid button').filter({hasText:'スマート消去'}).click();
  await page.getByRole('button', { name: '不要なものを消す' }).click();
  const dialog = page.getByRole('dialog', { name: 'スマート消去' });
  await dialog.getByRole('img', { name: '消去する写真' }).waitFor();
  await page.waitForFunction(() => {
    const img = document.querySelector('img[alt="消去する写真"]');
    return img && img.complete && img.naturalWidth === 360;
  });
  await settle();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    await checkBounds(viewport);
  }

  // A drawn rectangle must use picture-local rather than modal-local coords.
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole('button', { name: '囲む', exact: true }).click();
  const frame = dialog.locator('[data-testid="eraser-preview-frame"]');
  await frame.scrollIntoViewIfNeeded();
  await settle();
  const portrait = await checkBounds({ width: 390, height: 844 });
  const rect = portrait.content;
  const stableFrame = await frame.boundingBox();
  assert.ok(rect && stableFrame);
  const start = { x: rect.x + rect.width * .2, y: rect.y + rect.height * .3 };
  const end = { x: rect.x + rect.width * .6, y: rect.y + rect.height * .55 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const assertStable = async (phase) => {
    const current = await frame.boundingBox();
    assert.ok(current && ['x','y','width','height'].every(key => Math.abs(current[key]-stableFrame[key]) < 1),
      phase + ': preview moved during painting ' + JSON.stringify({before:stableFrame,after:current}));
  };
  try {
    await settle(); await assertStable('pointer down');
    for (let step=1; step<=6; step++) {
      await page.mouse.move(start.x+(end.x-start.x)*step/6,start.y+(end.y-start.y)*step/6);
      await settle(); await assertStable('stroke '+step);
    }
  } finally { await page.mouse.up(); }
  await settle(); await assertStable('pointer up');
  const mask = dialog.locator('svg rect').first();
  assert.ok(await mask.count(), 'Selection overlay must appear');
  const xy = await mask.evaluate((el) => ({
    x: Number(el.getAttribute('x')),
    y: Number(el.getAttribute('y')),
    w: Number(el.getAttribute('width')),
    h: Number(el.getAttribute('height')),
  }));
  assert.ok(Math.abs(xy.x - 72) < 3 && Math.abs(xy.y - 252) < 5,
    'Selection coordinates must map correctly to portrait image: ' + JSON.stringify(xy));
  assert.ok(Math.abs(xy.w - 144) < 3 && Math.abs(xy.h - 210) < 5,
    'Selection dimensions must map correctly to portrait image: ' + JSON.stringify(xy));
  assert.equal(await dialog.getByRole('button', { name: '選択をクリア' }).count(), 1);
  await dialog.getByRole('button', { name: '選択をクリア' }).click();
  assert.equal(await dialog.locator('svg rect').count(), 0);
  assert.equal(await dialog.getByRole('button', { name: '選択をクリア' }).isDisabled(), true);
  await dialog.getByRole('button', {name:'拡大',exact:true}).click();
  await settle();
  const enlarged = await dialog.getByRole('img', { name: '消去する写真' }).boundingBox();
  assert(enlarged && enlarged.width > portrait.img.width*1.4, 'Eraser zoom must increase displayed size');
  const frameBox=await dialog.locator('[data-testid="eraser-preview-frame"]').boundingBox();
  assert(frameBox);
  await page.mouse.move(frameBox.x+frameBox.width/2-12,frameBox.y+frameBox.height/2-12);
  await page.mouse.down();
  await page.mouse.move(frameBox.x+frameBox.width/2+12,frameBox.y+frameBox.height/2+12,{steps:5});
  await page.mouse.up();
  await dialog.locator('svg rect').waitFor();
  await dialog.getByRole('button',{name:'戻す',exact:true}).click();
  assert.equal(await dialog.locator('svg rect').count(),0,'Undo removes zoomed eraser mask');
  assert.deepEqual(errors, [], 'No uncaught errors during portrait resizing and tool use');
  console.log('Portrait Magic Eraser image fit, compact labels and mask coordinates: PASS');
} finally {
  await browser.close();
}
