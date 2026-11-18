import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transform } from 'esbuild';
import { chromium } from 'playwright';

// Real production transform functions, compiled without mocking their pixels.
// AI pose inference is tested separately by audit_leg_beauty.mjs.
const source = fs.readFileSync('src/lib/legProcessor.ts', 'utf8');
const built = await transform(source, { loader: 'ts', format: 'esm' });
const moduleUrl = 'data:text/javascript;base64,' +
  Buffer.from(built.code, 'utf8').toString('base64');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
try {
  const result = await page.evaluate(async (url) => {
    const { lengthenLegs, narrowLegs } = await import(url);
    const w = 480, h = 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(0, 0, w, h);
    // A clearly striped body plus static background grid proves that the
    // image changed, while distant background and face region stay identical.
    for (let y = 100; y < 610; y += 8) {
      ctx.fillStyle = (Math.floor((y - 100) / 8) % 2) === 0 ? '#d5479a' : '#185b97';
      ctx.fillRect(175, y, 130, 8);
    }
    for (let x = 181; x <= 295; x += 12) {
      ctx.fillStyle = '#f7f23a';
      ctx.fillRect(x, 100, 3, 510);
    }
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(40, 0, 4, h);
    ctx.fillRect(440, 0, 4, h);
    const original = ctx.getImageData(0, 0, w, h).data;
    const pt = (x, y) => ({ x, y });
    const hipL = pt(212, 340), hipR = pt(268, 340);
    const leg = (x, hip) => ({
      hip, knee: pt(x, 460), ankle: pt(x, 600), hipGap: 56,
    });
    const body = {
      legs: [leg(212, hipL), leg(268, hipR)],
      shoulderLeft: pt(200, 150), shoulderRight: pt(280, 150),
      shoulderY: 150, hipY: 340, ankleY: 600, hipLeft: hipL, hipRight: hipR,
    };
    const stretched = lengthenLegs(canvas, body, 100);
    if (!stretched) throw new Error('Expected local full-body lengthening');
    const lengthData = stretched.getContext('2d').getImageData(0, 0, w, h).data;
    const thin = narrowLegs(canvas, [body], 100);
    const slimData = thin.getContext('2d').getImageData(0, 0, w, h).data;
    let lengthChanges = 0, slimChanges = 0, farChanges = 0, headChanges = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (lengthData[i] !== original[i] ||
            lengthData[i + 1] !== original[i + 1] ||
            lengthData[i + 2] !== original[i + 2]) {
          lengthChanges++;
          if (x < 45 || x > 435) farChanges++;
          if (y < 145) headChanges++;
        }
        if (slimData[i] !== original[i] ||
            slimData[i + 1] !== original[i + 1] ||
            slimData[i + 2] !== original[i + 2]) {
          slimChanges++;
        }
      }
    }
    const missingShoulders = lengthenLegs(canvas, {
      ...body, shoulderLeft: undefined, shoulderRight: undefined,
      shoulderY: -1,
    }, 100);
    const croppedAnkles = lengthenLegs(canvas, {
      ...body, ankleY: 710,
    }, 100);
    return {
      lengthChanges, slimChanges, farChanges, headChanges,
      sameSize: stretched.width === w && stretched.height === h,
      missingShouldersRefused: missingShoulders === null,
      croppedAnklesRefused: croppedAnkles === null,
    };
  }, moduleUrl);
  assert.ok(result.lengthChanges > 50,
    'Length correction must change actual source pixels');
  assert.ok(result.slimChanges > 50,
    'Slim correction must change actual source pixels');
  assert.equal(result.farChanges, 0, 'Far background must not change');
  assert.equal(result.headChanges, 0, 'Pixels above shoulders must not change');
  assert.equal(result.sameSize, true);
  assert.equal(result.missingShouldersRefused, true);
  assert.equal(result.croppedAnklesRefused, true);
  console.log('Local leg warp pixel/guard regression: PASS', result);
} finally {
  await browser.close();
}
