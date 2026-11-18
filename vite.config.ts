import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// MediaPipe chooses non-SIMD WASM on older Safari/WebKit (iOS 15/16).
// The canonical node_modules version must supply matching fallback assets.
// Copy from the installed package at build time so these binaries are not
// committed to the repository or accidentally served from an external CDN.
function bundleNonSimdVision() {
  let outDir = 'dist';
  return {
    name: 'jomon-pix-local-vision-nosimd',
    apply: 'build' as const,
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const source = resolve('node_modules/@mediapipe/tasks-vision/wasm');
      const destination = resolve(outDir, 'mediapipe');
      mkdirSync(destination, { recursive: true });
      for (const [name, minimum] of [
        ['vision_wasm_nosimd_internal.js', 50000],
        ['vision_wasm_nosimd_internal.wasm', 1000000],
      ] as const) {
        const input = resolve(source, name);
        if (!existsSync(input) || statSync(input).size < minimum) {
          throw new Error('MediaPipe non-SIMD runtime missing from installed package: ' + name);
        }
        copyFileSync(input, resolve(destination, name));
      }
      // Redistribute the matching Apache-2.0 notice with both web and native
      // bundles; the app's privacy page links to this local license file.
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
  plugins: [react(), bundleNonSimdVision()],
  base: '/jomon-pix/',
});
