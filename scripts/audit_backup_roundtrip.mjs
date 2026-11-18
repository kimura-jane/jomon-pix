import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const browserName = process.argv[2] || 'chromium';
const base = process.argv[3] || '/jomon-pix/';
const port = Number(process.argv[4] || '4173');
assert(['chromium', 'webkit'].includes(browserName));
assert(['/jomon-pix/', '/'].includes(base));
const browser = await (browserName === 'chromium' ? chromium : webkit).launch({
  headless: true,
  ...(browserName === 'chromium' ? { args: ['--no-sandbox'] } : {}),
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
  isMobile: browserName === 'webkit',
  hasTouch: true,
});
const report = {
  browser: browserName,
  base,
  checks: [],
  errors: [],
  dialogs: [],
  date: new Date().toISOString(),
};
page.on('pageerror', (e) => report.errors.push(e.message));
page.on('dialog', (dialog) => {
  report.dialogs.push(dialog.message());
  void dialog.accept();
});

const readWork = () => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('jomon-pix-projects-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const raw = await new Promise((resolve, reject) => {
      const tx = db.transaction('work', 'readonly');
      let stored;
      const request = tx.objectStore('work').get('jomon-pix-work');
      request.onsuccess = () => { stored = request.result; };
      tx.oncomplete = () => resolve(stored);
      tx.onerror = () => reject(tx.error);
    });
    return typeof raw === 'string' ? JSON.parse(raw).state : null;
  } finally {
    db.close();
  }
});
const waitWork = async (predicate, label) => {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const state = await readWork();
    if (state && predicate(state)) return state;
    await page.waitForTimeout(250);
  }
  throw new Error('Saved work did not reach expected state: ' + label);
};
const onlyStickers = (work) => work.elements.filter((el) => el.type === 'sticker');
const expectedSuffixes = [
  'taf-dog/v2/taf_dog_01.webp',
  'archaeology/v1/haniwa/h01.webp',
  'archaeology/v1/dogu/d01.webp',
];

try {
  await page.addInitScript(() => {
    // Exercise the browser-download backup path in both engines.
    Object.defineProperty(navigator, 'canShare', {
      value: () => false, configurable: true,
    });
  });
  // Read the policy in a separate page so opening and closing its modal
  // cannot change selection or editor state used by backup roundtrip checks.
  const policyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await policyPage.goto(`http://127.0.0.1:${port}${base}`, { waitUntil: 'networkidle' });
    const privacyResponse = await policyPage.request.get(
      `http://127.0.0.1:${port}${base}privacy-policy.html`,
    );
    assert.equal(privacyResponse.status(), 200);
    const privacyHtml = await privacyResponse.text();
    assert(privacyHtml.includes('運営者：縄文'));
    assert(privacyHtml.includes('jomon@jomonkusama.com'));
    assert(privacyHtml.includes('Google Fonts'));
    assert(privacyHtml.includes('IMG.LY'));
    await policyPage.getByRole('button', { name: 'プライバシーポリシー' }).click();
    const privacyFrame = policyPage.frameLocator('iframe[title="プライバシーポリシー"]');
    await privacyFrame.getByRole('heading', { name: 'プライバシーポリシー' }).waitFor();
    await privacyFrame.locator('#policy-ja').getByRole('link', { name: 'jomon@jomonkusama.com' }).waitFor();
    await policyPage.getByRole('dialog', { name: 'プライバシーポリシー' })
      .getByRole('button', { name: '閉じる' }).click();
    report.checks.push('Privacy policy accessible in app and published on both asset bases');
  } finally {
    await policyPage.close();
  }
  await page.goto(`http://127.0.0.1:${port}${base}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /スタンプ/ }).first().click();

  for (const [category, name] of [
    ['犬', 'TAF DOG #01を追加'],
    ['縄文', '武人埴輪・立像を追加'],
    ['縄文', '小型土偶を追加'],
  ]) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  }
  const original = onlyStickers(await waitWork(
    (work) => onlyStickers(work).length === 3, 'three bundled stickers',
  ));
  for (let i = 0; i < original.length; i += 1) {
    assert.equal(original[i].src, base + 'stickers/' + expectedSuffixes[i]);
  }
  report.checks.push('Three bundled dog/haniwa/dogu assets saved in project');

  await page.getByRole('button', { name: '作品のバックアップと復元' }).click();
  const pendingDownload = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: '作品をバックアップ', exact: true }).click();
  const download = await pendingDownload;
  const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(backup.app, 'JOMON pix');
  assert.equal(backup.formatVersion, 1);
  assert.equal(backup.artwork.elements.length, 3);
  report.checks.push('User-facing JSON backup download contains all bundled stickers');

  // Restore both Web and native path variants into either build. Import must
  // preserve element IDs and labels, and map asset paths to this build's base.
  for (const prefix of ['/jomon-pix/', '/']) {
    // Leave the saved state in versioned form for the rejection test below.
    for (const legacyDog of [true, false]) {
    const suffixes = legacyDog
      ? ['taf-dog/taf_dog_01.webp', ...expectedSuffixes.slice(1)]
      : expectedSuffixes;
    const altered = structuredClone(backup);
    altered.artwork.elements.forEach((element, i) => {
      element.src = prefix + 'stickers/' + suffixes[i];
    });
    const previousSuccesses = report.dialogs.filter((d) => d.includes('作品を復元しました')).length;
    await page.locator('input[type="file"][accept=".json,application/json"]')
      .setInputFiles({
        name: 'roundtrip.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(altered)),
      });
    await page.getByRole('button', { name: '作品をバックアップ', exact: true })
      .waitFor({ state: 'hidden', timeout: 30000 });
    const restored = onlyStickers(await waitWork(
      (work) => onlyStickers(work).length === 3 &&
        onlyStickers(work).every((el, i) =>
          el.src === base + 'stickers/' + suffixes[i]),
      'cross-platform imported sticker paths',
    ));
    assert.deepEqual(restored.map((el) => el.id), original.map((el) => el.id));
    assert.deepEqual(restored.map((el) => el.label), original.map((el) => el.label));
    assert.equal(
      report.dialogs.filter((d) => d.includes('作品を復元しました')).length,
      previousSuccesses + 1,
    );
    report.checks.push(`Restored ${prefix} ${legacyDog ? 'legacy' : 'versioned'} paths into ${base} build`);
    await page.getByRole('button', { name: '作品のバックアップと復元' }).click();
    }
  }

  // Never accept an arbitrary relative file path from an untrusted backup.
  const malicious = structuredClone(backup);
  malicious.artwork.elements[0].src = '/jomon-pix/stickers/../../private.webp';
  const previousErrors = report.dialogs.filter((d) =>
    d.includes('作品データの形式またはサイズが正しくありません')).length;
  await page.locator('input[type="file"][accept=".json,application/json"]')
    .setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(malicious)),
    });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && report.dialogs.filter((d) =>
    d.includes('作品データの形式またはサイズが正しくありません')).length === previousErrors) {
    await page.waitForTimeout(100);
  }
  assert.equal(
    report.dialogs.filter((d) =>
      d.includes('作品データの形式またはサイズが正しくありません')).length,
    previousErrors + 1,
  );
  assert.deepEqual(
    onlyStickers(await readWork()).map((el) => el.src),
    original.map((_, i) => base + 'stickers/' + expectedSuffixes[i]),
  );
  report.checks.push('Path traversal rejected without overwriting project');

  // Real user-facing vector stickers are encoded SVG data URLs with leading
  // whitespace. Both must survive backup and restore (on both asset bases).
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: /スタンプ/ }).first().click();
  await page.getByRole('button', { name: 'サングラス', exact: true }).click();
  await page.getByRole('button', { name: '手動配置', exact: true }).click();
  await page.getByRole('button', { name: '定番ブラックを追加' }).click();
  await page.getByRole('button', { name: '顔デコ', exact: true }).click();
  await page.getByRole('button', { name: '手動配置', exact: true }).click();
  await page.getByRole('button', { name: 'ねこ耳を追加' }).click();
  const withSvg = onlyStickers(await waitWork(
    (work) => onlyStickers(work).length === 5, 'vector stickers saved',
  ));
  const svgSources = withSvg.slice(-2).map((element) => element.src);
  assert(svgSources.every((source) =>
    /^data:image\/svg\+xml;charset=UTF-8,%0A/i.test(source)));
  await page.getByRole('button', { name: '作品のバックアップと復元' }).click();
  const vectorDownloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: '作品をバックアップ', exact: true }).click();
  const vectorDownload = await vectorDownloadPromise;
  const vectorBackup = JSON.parse(fs.readFileSync(await vectorDownload.path(), 'utf8'));
  assert.equal(vectorBackup.artwork.elements.length, 5);
  const previousVectorSuccess = report.dialogs.filter((d) => d.includes('作品を復元しました')).length;
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({
    name: 'with-vectors.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(vectorBackup)),
  });
  await page.getByRole('button', { name: '作品をバックアップ', exact: true })
    .waitFor({ state: 'hidden', timeout: 30000 });
  const restoredVectors = onlyStickers(await waitWork(
    (work) => onlyStickers(work).length === 5 &&
      onlyStickers(work).slice(-2).every((el, i) => el.src === svgSources[i]),
    'vector stickers restored',
  ));
  assert.deepEqual(restoredVectors.slice(-2).map((el) => el.src), svgSources);
  // The IndexedDB write can finish before the success alert is dispatched.
  // Do not mistake this harmless dialog/event ordering for a failed restore.
  const successDeadline = Date.now() + 15000;
  while (Date.now() < successDeadline &&
    report.dialogs.filter((d) => d.includes('作品を復元しました')).length <
      previousVectorSuccess + 1) {
    await page.waitForTimeout(50);
  }
  assert.equal(
    report.dialogs.filter((d) => d.includes('作品を復元しました')).length,
    previousVectorSuccess + 1,
  );
  report.checks.push('Sunglasses and face-deco SVG data URLs roundtrip intact');

  // A crafted SVG must not be able to inject active tags via JSON import.
  await page.getByRole('button', { name: '作品のバックアップと復元' }).click();
  const unsafeSvg = structuredClone(vectorBackup);
  unsafeSvg.artwork.elements.at(-1).src =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const previousUnsafeErrors = report.dialogs.filter((d) =>
    d.includes('作品データの形式またはサイズが正しくありません')).length;
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({
    name: 'unsafe-svg.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(unsafeSvg)),
  });
  const unsafeDeadline = Date.now() + 15000;
  while (Date.now() < unsafeDeadline && report.dialogs.filter((d) =>
    d.includes('作品データの形式またはサイズが正しくありません')).length === previousUnsafeErrors) {
    await page.waitForTimeout(100);
  }
  assert.equal(
    report.dialogs.filter((d) => d.includes('作品データの形式またはサイズが正しくありません')).length,
    previousUnsafeErrors + 1,
  );
  assert.deepEqual(onlyStickers(await readWork()).slice(-2).map((el) => el.src), svgSources);
  report.checks.push('Untrusted SVG script rejected without overwriting work');

  assert.deepEqual(report.errors, []);
  report.status = 'success';
} catch (error) {
  report.status = 'failure';
  report.errors.push(error.stack ?? String(error));
  throw error;
} finally {
  fs.mkdirSync('docs/audit', { recursive: true });
  const suffix = base === '/' ? 'native' : 'web';
  fs.writeFileSync(`docs/audit/backup-roundtrip-${browserName}-${suffix}.json`,
    JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
