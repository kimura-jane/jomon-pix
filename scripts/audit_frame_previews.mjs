import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const target = process.argv[2] || 'chromium';
assert(['chromium', 'webkit'].includes(target));
const engine = target === 'webkit' ? webkit : chromium;
const browser = await engine.launch({
  headless: true,
  ...(target === 'chromium' ? {args: ['--no-sandbox']} : {}),
});
const page = await browser.newPage({
  viewport: {width:390,height:844},
  deviceScaleFactor: target === 'webkit' ? 3 : 1,
  isMobile: target === 'webkit', hasTouch: true,
});
const report = {browser:target, checks:[], errors:[], status:'running'};
page.on('pageerror', (error) => report.errors.push(error.message));

const groups = {
  scene:['none','fuji','sakura','coast','shrine','skyline','dreamy'],
  social:['none','live','game','video','shorts','social','story'],
  border:['none','simple','double','polaroid','film','album','neon','magazine'],
};
const switchSection = async (section) => {
  await page.getByRole('button',{name:section,exact:true}).click();
};
const verifyImages = async (group) => {
  const images = page.locator('img.frame-reference');
  const ids = groups[group];
  assert.equal(await images.count(), ids.length,
    'Wrong number of '+group+' previews');
  for(let i=0;i<ids.length;i++){
    const img=images.nth(i);
    await img.scrollIntoViewIfNeeded();
    await img.evaluate(async (node)=>{
      if(!node.complete) await new Promise((resolve,reject)=>{
        node.addEventListener('load',resolve,{once:true});
        node.addEventListener('error',reject,{once:true});
      });
      await node.decode();
    });
    const data = await img.evaluate((element)=>({
      src:element.getAttribute('src'),
      naturalWidth:element.naturalWidth,
      naturalHeight:element.naturalHeight,
    }));
    assert(data.src.endsWith('/frame-previews/'+group+'-'+ids[i]+'.png'),
      'Unexpected preview URL: '+data.src);
    assert(data.naturalWidth>150 && data.naturalHeight>150,
      'Blank/missing preview: '+group+'-'+ids[i]);
  }
  report.checks.push(group+': all '+ids.length+' actual rendered thumbnails are visible');
};

try {
  await page.goto('http://127.0.0.1:4173/jomon-pix/',{
    waitUntil:'networkidle',timeout:45000,
  });
  await page.locator('button.tab').filter({hasText:'フレーム'}).click();
  await verifyImages('scene');
  await switchSection('配信・SNS');
  await verifyImages('social');
  const social=page.locator('button:has(img.frame-reference)')
    .filter({hasText:'ライブ配信風'});
  await social.click();
  assert.equal(await social.getAttribute('aria-pressed'),'true');
  report.checks.push('Social preview click applies live template');

  await switchSection('枠');
  await verifyImages('border');
  const polaroid=page.locator('button:has(img.frame-reference)')
    .filter({hasText:'ポラロイド'});
  assert(await polaroid.isDisabled(),
    'Border previews must display even without a photo');

  const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');
    canvas.width=600;canvas.height=780;
    const c=canvas.getContext('2d');
    const gradient=c.createLinearGradient(0,0,600,780);
    gradient.addColorStop(0,'#fac4e9');
    gradient.addColorStop(1,'#8177d7');
    c.fillStyle=gradient;c.fillRect(0,0,600,780);
    c.fillStyle='#fdf0dd';c.beginPath();c.arc(300,335,130,0,Math.PI*2);c.fill();
    return canvas.toDataURL('image/png');
  });
  await page.locator('button.tab').filter({hasText:'画像'}).click();
  await page.locator('input[type="file"][accept="image/*"]').first()
    .setInputFiles({name:'frame-test.png',mimeType:'image/png',
      buffer:Buffer.from(png.split(',')[1],'base64')});
  await page.locator('button.tab').filter({hasText:'フレーム'}).click();
  await switchSection('枠');
  const targetButton=page.locator('button:has(img.frame-reference)')
    .filter({hasText:'ポラロイド'});
  await targetButton.click();
  assert.equal(await targetButton.getAttribute('aria-pressed'),'true');
  report.checks.push('Before photo: 8 frame references visible but disabled; after adding photo: border selected');

  await page.screenshot({path:'docs/audit/frame-previews-'+target+'.png',
    fullPage:true});
  assert.deepEqual(report.errors, []);
  report.status='success';
}catch(error){
  report.status='failure';report.errors.push(error.stack??String(error));
  throw error;
}finally{
  fs.mkdirSync('docs/audit',{recursive:true});
  fs.writeFileSync('docs/audit/frame-previews-'+target+'.json',
    JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
