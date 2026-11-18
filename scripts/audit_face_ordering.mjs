import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transform } from 'esbuild';

// Exercise the actual pure production face ordering function. No AI inference
// is mocked into the editor; browser integration tests cover real MediaPipe.
const source = fs.readFileSync('src/lib/beautyProcessor.ts', 'utf8');
// The face ordering unit runs in a data: URL; it does not execute pose AI.
// Remove only this import because relative imports cannot resolve in data: URLs.
const pureFaceSource = source.replace(
  "import { renderLegBeauty } from './legProcessor';", '',
);
assert.notEqual(pureFaceSource, source, 'Expected the leg module import');
const compiled = await transform(pureFaceSource, { loader: 'ts', format: 'esm' });
const moduleUrl = 'data:text/javascript;base64,' +
  Buffer.from(compiled.code, 'utf8').toString('base64');
const { indexDetectedFaces, MAX_FACE_TARGETS } = await import(moduleUrl);
assert.equal(MAX_FACE_TARGETS, 10);

function syntheticFace(x, { tilt = false, width = 0.052, y = 0.5 } = {}) {
  const points = Array.from({ length: 478 }, () => ({ x, y }));
  points[1] = { x, y };
  points[234] = { x: x - width / 2, y };
  points[454] = { x: x + width / 2, y };
  points[10] = { x, y: y - 0.12 };
  points[152] = { x, y: y + 0.12 };
  points[33] = { x: x - width / 4, y: tilt ? y - 0.23 : y - 0.03 };
  points[263] = { x: x + width / 4, y: tilt ? y + 0.23 : y - 0.03 };
  return points;
}

const xs = Array.from({ length: 12 }, (_, i) => 0.055 + i * 0.077);
const group = xs.map((x, index) => syntheticFace(x, { tilt: index === 3 }));
// Deliberately simulate MediaPipe returning faces in reverse/random order.
const reverse = [...group].reverse();
const ordered = indexDetectedFaces(reverse, 800, 600);
assert.equal(ordered.length, 10, 'Choose only ten faces from valid candidates');
assert.deepEqual(ordered.map((landmarks) => landmarks[1].x), xs.slice(0, 10),
  'All face numbers must be assigned left-to-right before limiting to ten');
// A very tilted person still occupies face slot 4, even though automatic
// glasses may refuse the pose. Never skip them and renumber other people.
assert.equal(ordered[3], group[3], 'A tilted person keeps the fourth face index');

// Exact-ten early-return detector output must also be sorted.
const ten = indexDetectedFaces(group.slice(0, 10).reverse(), 800, 600);
assert.deepEqual(ten.map((landmarks) => landmarks[1].x), xs.slice(0, 10));

// Duplicate detections from overlapping cropped regions must not consume a
// face number or shift which person gets an individual beauty override.
const duplicate = syntheticFace(xs[3], { tilt: true, width: 0.03 });
const deduped = indexDetectedFaces([...reverse, duplicate], 800, 600);
assert.equal(deduped.length, 10);
assert.deepEqual(deduped.map((landmarks) => landmarks[1].x), xs.slice(0, 10));

// Every exit in the production enhanced scanner must run the same sorter.
const scanner = source.slice(
  source.indexOf('async function scanFaceLandmarks('),
  source.indexOf('export function detectFaceLandmarksEnhanced('),
);
assert.equal((scanner.match(/return indexDetectedFaces\(/g) ?? []).length, 3,
  'All 3 early and final returns must use the same canonical indexer');
// Auto Face Deco must not drop faces before the selector numbers are assigned.
const deco = fs.readFileSync('src/lib/autoFaceDeco.ts', 'utf8');
const scan = deco.slice(
  deco.indexOf('async function scanFaceCandidates('),
  deco.indexOf('// Reuse exactly the same detected faces'),
);
assert.match(scan, /return detectFaceLandmarksEnhanced\(image\)/);
assert.doesNotMatch(scan, /\.filter\(/);

console.log('Canonical left-to-right face indices, tilted person and max 10: PASS');
