import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The IDs match the real application components, not mock UI artwork.
const groups = {
  border: ['none','simple','double','polaroid','film','album','neon','magazine'],
  scene: ['none','fuji','sakura','coast','shrine','skyline','dreamy'],
  social: ['none','live','game','video','shorts','social','story'],
};
const items = Object.entries(groups).flatMap(([group, ids]) =>
  ids.map((id) => ({ group, id, filename: group + '-' + id + '.png' })));
const destination = path.resolve('public/frame-previews');
fs.mkdirSync(destination, { recursive: true });

const browser = await chromium.launch({
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width: 510, height: 820 }, deviceScaleFactor: 1,
});
page.on('pageerror', (error) => console.error('[preview browser]', error.message));
try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/', {
    waitUntil: 'networkidle', timeout: 45000,
  });
  await page.locator('.stage-card canvas').first().waitFor();
  await page.addStyleTag({ content:
    '.top,.panel,.stage-wrap > div:not(.stage-card){display:none!important}' +
    'html,body,#root{width:100%;height:100%;overflow:hidden!important}' +
    '.app{height:100vh!important;width:100vw!important;display:flex!important}' +
    '.stage-wrap{flex:1!important;min-height:0!important;padding:4px!important}' +
    '.stage-card{border-radius:4px!important;box-shadow:none!important}',
  });

  // Synthetic reference portrait created locally. No user photos or NFT art.
  const photos = await page.evaluate(() => {
    const drawPortrait = (transparent) => {
      const c = document.createElement('canvas');
      c.width = 360; c.height = 640;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      if (!transparent) {
        const sky = ctx.createLinearGradient(0, 0, 360, 640);
        sky.addColorStop(0, '#9182dc');
        sky.addColorStop(.41, '#e9a4be');
        sky.addColorStop(.77, '#ffd4ab');
        sky.addColorStop(1, '#a76ba4');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 640);
        ctx.fillStyle = 'rgba(255,239,189,.53)';
        ctx.beginPath(); ctx.arc(287, 160, 68, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8471b3';
        ctx.beginPath(); ctx.moveTo(0, 375); ctx.lineTo(65, 304);
        ctx.lineTo(112, 355); ctx.lineTo(191, 278); ctx.lineTo(277, 383);
        ctx.lineTo(360, 307); ctx.lineTo(360, 640); ctx.lineTo(0, 640);ctx.fill();
        ctx.fillStyle = '#444275';
        ctx.fillRect(0,415,65,225);ctx.fillRect(300,390,60,250);
        ctx.fillStyle = '#f5d5ae';
        for(let y=422;y<595;y+=27){
          for(let x=11;x<64;x+=19)ctx.fillRect(x,y,6,10);
          for(let x=312;x<359;x+=19)ctx.fillRect(x,y+10,6,9);
        }
        ctx.fillStyle = '#fff7e9';
        for(const [x,y,r] of [[38,90,4],[95,137,3],[299,318,5],
          [310,75,3],[50,272,4],[321,249,3],[280,500,3]]) {
          ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
        }
      }
      // Original illustrated adult model with friendly expression.
      ctx.fillStyle='#322542';
      ctx.beginPath();ctx.ellipse(180,306,92,118,0,0,Math.PI*2);ctx.fill();
      const jacket=ctx.createLinearGradient(40,440,300,640);
      jacket.addColorStop(0,'#615bb0');jacket.addColorStop(1,'#2d306d');
      ctx.fillStyle=jacket;
      ctx.beginPath();ctx.moveTo(35,640);ctx.lineTo(59,498);
      ctx.quadraticCurveTo(64,445,143,429);ctx.lineTo(219,429);
      ctx.quadraticCurveTo(297,448,303,499);ctx.lineTo(325,640);ctx.fill();
      ctx.fillStyle='#fff4ef';
      ctx.beginPath();ctx.moveTo(144,427);ctx.lineTo(181,484);
      ctx.lineTo(218,427);ctx.lineTo(217,640);ctx.lineTo(145,640);ctx.fill();
      ctx.fillStyle='#e7a688';ctx.fillRect(157,388,48,59);
      ctx.fillStyle='#f2ba99';
      ctx.beginPath();ctx.ellipse(180,293,70,92,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#322541';
      ctx.beginPath();ctx.moveTo(110,277);
      ctx.bezierCurveTo(96,181,166,183,204,196);
      ctx.bezierCurveTo(255,204,253,249,240,285);
      ctx.bezierCurveTo(230,266,228,249,211,240);
      ctx.bezierCurveTo(185,267,154,251,139,238);
      ctx.bezierCurveTo(126,251,125,268,110,277);ctx.fill();
      ctx.strokeStyle='#51394e';ctx.lineWidth=4;ctx.lineCap='round';
      for(const side of [-1,1]){
        ctx.beginPath();ctx.moveTo(180+side*18,291);
        ctx.lineTo(180+side*46,288);ctx.stroke();
        ctx.fillStyle='#3c2c50';
        ctx.beginPath();ctx.ellipse(180+side*31,309,5,8,0,0,Math.PI*2);ctx.fill();
      }
      ctx.strokeStyle='#c58d7f';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(180,319);ctx.lineTo(176,338);
      ctx.lineTo(184,341);ctx.stroke();
      ctx.strokeStyle='#a95875';ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(181,348,20,.16,Math.PI-.17);ctx.stroke();
      ctx.fillStyle='rgba(239,125,152,.28)';
      for(const x of [130,231]){
        ctx.beginPath();ctx.ellipse(x,334,15,9,0,0,Math.PI*2);ctx.fill();
      }
      ctx.fillStyle='#322541';
      ctx.beginPath();ctx.moveTo(110,279);ctx.quadraticCurveTo(84,377,109,472);
      ctx.quadraticCurveTo(126,482,133,450);
      ctx.quadraticCurveTo(110,352,125,266);ctx.fill();
      ctx.beginPath();ctx.moveTo(242,272);ctx.quadraticCurveTo(272,388,251,473);
      ctx.quadraticCurveTo(229,478,225,448);
      ctx.quadraticCurveTo(252,353,231,264);ctx.fill();
      ctx.fillStyle='#ffe6ae';ctx.beginPath();
      for(let i=0;i<10;i++){
        const r=i%2===0?14:6;
        const angle=-Math.PI/2+i*Math.PI/5;
        const x=259+Math.cos(angle)*r,y=514+Math.sin(angle)*r;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }ctx.closePath();ctx.fill();
      return c.toDataURL('image/png');
    };
    return { full: drawPortrait(false), cutout: drawPortrait(true) };
  });

  for (const { group, id, filename } of items) {
    await page.evaluate(async (params) => {
      const { useEditor } = await import('/src/store.ts');
      const p = {
        id: 'frame-preview-photo', type: 'image',
        x: params.group === 'scene' ? 46 : 0,
        y: params.group === 'scene' ? 132 : 0,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        src: params.group === 'scene' ? params.photos.cutout : params.photos.full,
        width: params.group === 'scene' ? 268 : 360,
        height: params.group === 'scene' ? 480 : 640,
        filter: 'none',
      };
      if (params.group === 'border' && params.id !== 'none') {
        p.frame = { style: params.id, size: 7,
          color: params.id === 'neon' ? '#ff6faf' : '#fffdf8' };
      }
      useEditor.setState({
        elements: [p], bgColor: '#fff6fb',
        sceneBackground: params.group === 'scene' ? params.id : 'none',
        socialTemplate: params.group === 'social' ? params.id : 'none',
        canvasPreset: 'custom', canvasWidth: 360, canvasHeight: 640,
        selectedId: null, tab: 'frame', tool: 'select',
      });
    }, { group, id, photos });

    // Verify actual editor image assets completed before taking screenshots.
    await page.waitForFunction(async (params) => {
      const { stageRef } = await import('/src/lib/stageRef.ts');
      const stage = stageRef.current;
      if (!stage) return false;
      const image = stage.findOne('#frame-preview-photo')?.findOne('Image')?.image();
      if (!image || !image.complete || !image.naturalWidth) return false;
      if (params.group === 'scene' && params.id !== 'none') {
        const background = stage.findOne('.scene-art')?.image();
        return !!(background && background.complete && background.naturalWidth);
      }
      return true;
    }, { group, id }, { timeout: 30000 });
    await page.waitForTimeout(180);
    const buffer = await page.locator('.stage-card').screenshot({
      path: path.join(destination, filename),
      animations: 'disabled', timeout: 30000,
    });
    assert(buffer.length > 3000, 'Unexpectedly small preview ' + filename);
    console.log(group, id, buffer.length, 'bytes');
  }

  const digest = items.map(({ filename }) => ({
    file: filename,
    bytes: fs.statSync(path.join(destination, filename)).size,
    sha256: crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(destination, filename))).digest('hex'),
  }));
  assert.equal(digest.length, 22);
  for (const group of Object.keys(groups)) {
    const hashes = new Set(digest.filter((x) => x.file.startsWith(group + '-'))
      .map((x) => x.sha256));
    assert.equal(hashes.size, groups[group].length,
      'Some previews look identical in group ' + group);
  }
  fs.writeFileSync(path.join(destination, 'manifest.json'),
    JSON.stringify({
      generator: 'Actual JOMON pix Konva scene, social overlay, and photo frame renderer',
      sample: 'Original illustrated adult portrait created locally with Canvas',
      previews: digest,
    }, null, 2) + '\n');
  console.log('Generated 22 distinct frame reference images.');
} finally {
  await browser.close();
}
