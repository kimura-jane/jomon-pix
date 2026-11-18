import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// Package the exact MediaPipe Apache-2.0 license from the locked npm package.
// Bundling a non-SIMD runtime from a different MediaPipe release would risk
// breaking the face/pose APIs; support for older iOS requires separate QA.
function bundleMediaPipeLicense() {
  let outDir = 'dist';
  return {
    name: 'jomon-pix-mediapipe-license',
    apply: 'build' as const,
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const packageRoot = resolve('node_modules/@mediapipe/tasks-vision');
      const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
      const license = candidates
        .map((name) => resolve(packageRoot, name))
        .find((name) => existsSync(name) && statSync(name).size > 1000);
      if (!license) {
        throw new Error('MediaPipe Apache-2.0 license text missing from the npm package');
      }
      const notices = resolve(outDir, 'third-party');
      mkdirSync(notices, { recursive: true });
      copyFileSync(license, resolve(notices, 'MEDIAPIPE-APACHE-2.0.txt'));
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleMediaPipeLicense()],
  base: '/jomon-pix/',
});
