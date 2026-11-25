import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, webkit } from 'playwright';

const engine = process.argv[2] || 'chromium';
assert(['chromium', 'webkit'].includes(engine));
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true, ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}),
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const report = { engine, checks: [], errors: [], status: 'failure' };
page.on('pageerror', error => report.errors.push(error.message));
const stage = page.locator('.stage-card');
const wrap = page.locator('.stage-wrap');
const plus = page.getByRole('button', { name: '拡大', exact: true });
const minus = page.getByRole('button', { name: '縮小', exact: true });
const fit = page.getByRole('button', { name: '全体表示', exact: true });
const epsilon = 3;
const settle = () => page.evaluate(() => new Promise(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));
const geometry = () => wrap.evaluate(el => {
  const box = el.getBoundingClientRect();
  const card = el.querySelector('.stage-card');
  const r = card.getBoundingClientRect();
  return { view: { x: box.x, y: box.y, w: box.width, h: box.height },
    card: { x: r.x, y: r.y, w: r.width, h: r.height },
    zoom: r.width / card.offsetWidth };
});
function checkBounds(g, label, full = false) {
  const { view: v, card: c } = g;
  assert(v.w > 0 && v.h > 0 && c.w > 0 && c.h > 0, label + ': invisible editor');
  for (const [p, size] of [['x','w'],['y','h']]) {
    if (c[size] <= v[size] + epsilon || full) {
      assert(Math.abs(c[p] + c[size]/2 - v[p] - v[size]/2) <= epsilon,
        label + ': canvas not centered on ' + p + ' ' + JSON.stringify(g));
      if (full) assert(c[size] <= v[size] + epsilon, label + ': fit clipped');
    } else {
      assert(c[p] <= v[p]+epsilon && c[p]+c[size] >= v[p]+v[size]-epsilon,
        label + ': blank space exposed on ' + p + ' ' + JSON.stringify(g));
    }
  }
}
async function fitCheck(label) {
  await fit.click();
  await settle();
  const g = await geometry();
  assert(Math.abs(g.zoom - 1) < .025, label + ': fit did not reset zoom');
  checkBounds(g, label, true);
}
async function saved() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('jomon-pix-projects-v1', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve,reject) => {
        const req = db.transaction('work','readonly').objectStore('work').get('jomon-pix-work');
        req.onsuccess = () => resolve(req.result ? JSON.parse(req.result).state : null);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  });
}
async function waitSaved(predicate, label) {
  for (let i = 0; i < 100; i++) {
    const s = await saved();
    if (s && predicate(s)) return s;
    await page.waitForTimeout(150);
  }
  throw Error('Saved project missing: ' + label);
}
async function pinch(shift, endDistance = 120) {
  // WebKit in CI does not expose physical multi-touch automation.
  // Exercise the actual capture-phase handlers with DOM touch-shaped events.
  await page.locator('.konvajs-content').evaluate((el, {shift, endDistance}) => {
    const r = el.closest('.stage-wrap').getBoundingClientRect();
    const x = r.left+r.width/2, y = r.top+r.height/2;
    const point = (id, px, py) => ({ identifier:id, target:el, clientX:px, clientY:py,
      pageX:px+window.scrollX, pageY:py+window.scrollY, screenX:px, screenY:py });
    const emit = (kind,touches,changed=touches) => {
      const event = new Event(kind,{ bubbles:true,cancelable:true });
      Object.defineProperties(event,{touches:{value:touches},targetTouches:{value:touches},changedTouches:{value:changed}});
      el.dispatchEvent(event);
    };
    const a=point(1,x-20,y), b=point(2,x+20,y);
    emit('touchstart',[a],[a]);
    emit('touchstart',[a,b],[b]);
    const c=point(1,x+shift-endDistance/2,y), d=point(2,x+shift+endDistance/2,y);
    emit('touchmove',[c,d],[c,d]);
    // Leaving one finger on the photo must not resume its drag.
    emit('touchend',[c],[d]);
    const e=point(1,c.clientX+35,c.clientY+12);
    emit('touchmove',[e],[e]);
    emit('touchend',[],[e]);
  }, {shift,endDistance});
  await settle();
}
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', { waitUntil: 'domcontentloaded' });
  await stage.waitFor();
  await page.locator('.bar button.tab').filter({hasText:'ホーム'}).click();
  const data = await page.evaluate(() => {
    const c=document.createElement('canvas'); c.width=320;c.height=640;
    const ctx=c.getContext('2d');ctx.fillStyle='#527a95';ctx.fillRect(0,0,320,640);
    ctx.fillStyle='#efc26d';ctx.fillRect(40,80,130,180);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file][accept="image/*"]').first().setInputFiles({
    name:'zoom-regression.png',mimeType:'image/png',buffer:Buffer.from(data,'base64'),
  });
  const initial=await waitSaved(s=>s.elements.some(e=>e.type==='image'),'image');
  const geometryOfArt = s => s.elements.map(e=>({id:e.id,x:e.x,y:e.y,rotation:e.rotation,
    scaleX:e.scaleX,scaleY:e.scaleY,width:e.width,height:e.height,src:e.src,drawings:e.drawings}));
  const original=geometryOfArt(initial);
  await fitCheck('initial portrait');
  for(let i=0;i<3;i++) {
    await plus.click();await settle();checkBounds(await geometry(),'button zoom '+i);
  }
  assert((await geometry()).zoom>1.5,'Zoom buttons must actually enlarge canvas');
  for(let i=0;i<3;i++) { await minus.click(); await settle(); checkBounds(await geometry(),'button shrink '+i); }
  await fitCheck('button reset');
  report.checks.push('Repeated plus/minus preserves centered geometry');
  for(const shift of [160,-160,800,-800]) {
    await fitCheck('before pinch');
    await pinch(shift);
    const g=await geometry();
    assert(g.zoom>2.5,'Pinch must actually enlarge canvas');
    checkBounds(g,'pinch shift '+shift);
  }
  await fitCheck('after pinches');
  report.checks.push('Two-finger zoom and extreme pan stay bounded; remaining finger is ignored');
  const grip=page.locator('.panel-grip');
  const moveGrip=async dy=>{
    const r=await grip.boundingBox();assert(r);
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
    await page.mouse.down();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2+dy,{steps:5});
    await page.mouse.up();await settle();
  };
  await plus.click();await plus.click();await settle();
  await moveGrip(-70);
  await page.locator('.editor-panel.panel-max').waitFor();
  await settle();checkBounds(await geometry(),'expanded panel at zoom');
  await fitCheck('expanded panel reset');
  await moveGrip(70);
  await page.locator('.editor-panel.panel-normal').waitFor();
  await moveGrip(70);
  await page.locator('.editor-panel.panel-min').waitFor();
  await settle();checkBounds(await geometry(),'collapsed panel');
  await fitCheck('collapsed panel reset');
  report.checks.push('Panel resizing clamps the camera without moving artwork');
  for(const viewport of [{width:375,height:667},{width:430,height:932},{width:844,height:390},{width:390,height:844}]) {
    await page.setViewportSize(viewport);await settle();await fitCheck('viewport '+viewport.width+'x'+viewport.height);
    await plus.click();await settle();checkBounds(await geometry(),'viewport zoom');
  }
  await fitCheck('final fit');
  await page.waitForTimeout(1000);
  assert.deepEqual(geometryOfArt(await saved()),original,'Viewport gestures must not alter persisted artwork');
  await page.reload({waitUntil:'domcontentloaded'});await stage.waitFor();await fitCheck('reload');
  assert.deepEqual(geometryOfArt(await saved()),original,'Artwork geometry survives reload unchanged');
  report.checks.push('Portrait/landscape viewport resize and reload preserve saved photo coordinates');
  assert.deepEqual(report.errors,[]);
  report.status='success';
} catch(error) {
  report.errors.push(error.stack??String(error));
  throw error;
} finally {
  fs.mkdirSync('docs/audit',{recursive:true});
  fs.writeFileSync('docs/audit/zoom-regression-'+engine+'.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
