// Stage exactly the six user-supplied icon previews for Vite and Capacitor.
// Never rename or modify the user-created source assets in gazo/icon/.
import { mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const dest = join('public', 'icon-choices');
mkdirSync(dest, { recursive: true });
for (let index = 1; index <= 6; index += 1) {
  for (const name of ['master_1024.png', 'icon_192.png']) {
    const bytes = readFileSync(join('gazo', 'icon', String(index), name));
    if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
      throw new Error(`Icon ${index} is not a PNG: ${name}`);
    }
    const dimension = name === 'master_1024.png' ? 1024 : 192;
    if (bytes.readUInt32BE(16) !== dimension || bytes.readUInt32BE(20) !== dimension) {
      throw new Error(`Icon ${index} must be ${dimension}x${dimension}: ${name}`);
    }
  }
  copyFileSync(join('gazo', 'icon', String(index), 'icon_192.png'),
    join(dest, `${index}.png`));
}
console.log('Staged six existing JOMON PIX icon previews (192px) without renaming originals.');
