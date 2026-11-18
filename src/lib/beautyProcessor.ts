import type { BeautySettings } from '../types';
import { renderLegBeauty } from './legProcessor';

export type Landmark = { x: number; y: number };
// Shared detection limit for automatic face stickers and multi-face beauty.
export const MAX_FACE_TARGETS = 10;
type PixelPoint = { x: number; y: number };

export const DEFAULT_BEAUTY: BeautySettings = {
  smooth: 0, bright: 0, warmth: 0, slim: 0,
  chin: 0, eyes: 0, lip: 0, blush: 0,
  legSlim: 0, legLength: 0,
};

export const BEAUTY_FIELDS: (keyof BeautySettings)[] = [
  'smooth', 'bright', 'warmth', 'slim',
  'chin', 'eyes', 'lip', 'blush',
  'legSlim', 'legLength',
];

const FACE_BEAUTY_FIELDS: (keyof BeautySettings)[] = BEAUTY_FIELDS.filter(
  (field) => field !== 'legSlim' && field !== 'legLength',
);

export function beautySignature(
  settings?: BeautySettings,
  faceOverrides?: Record<string, Partial<BeautySettings>>,
): string {
  const base = settings ?? DEFAULT_BEAUTY;
  const entries = Object.entries(faceOverrides ?? {})
    .filter(([key, patch]) =>
      /^(?:0|[1-9][0-9]?)$/.test(key) &&
      patch && typeof patch === 'object' &&
      BEAUTY_FIELDS.some((field) => typeof patch[field] === 'number'))
    .sort(([a], [b]) => Number(a) - Number(b));
  if (!BEAUTY_FIELDS.some((key) => base[key] > 0) &&
      !entries.some(([, patch]) => BEAUTY_FIELDS.some((field) =>
        (patch[field] ?? base[field]) > 0))) return 'none';
  const normalized = (values: Partial<BeautySettings>) =>
    BEAUTY_FIELDS.map((key) => Math.max(0, Math.min(100, Math.round(values[key] ?? 0)))).join('/');
  return normalized(base) + entries.map(([key, patch]) =>
    '|' + key + ':' + BEAUTY_FIELDS.map((field) =>
      patch[field] === undefined ? '-' : Math.round(patch[field] ?? 0)).join('/')).join('');
}

let landmarkerPromise: Promise<import('@mediapipe/tasks-vision').FaceLandmarker> | undefined;
const faceCache = new WeakMap<HTMLImageElement | HTMLCanvasElement, Landmark[][]>();

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      // No photograph or face data is transmitted. Both WASM and ML model
      // are hosted under the same GitHub Pages application origin.
      const root = `${import.meta.env.BASE_URL}mediapipe`;
      const vision = await FilesetResolver.forVisionTasks(root);

      // Explicitly bind a dedicated WebGL canvas. Safari / WKWebView may fail
      // to create MediaPipe's implicit GL context even with the CPU delegate.
      // A real canvas owned by the document avoids GLctx.activeTexture errors.
      const glCanvas = document.createElement('canvas');
      glCanvas.width = 2;
      glCanvas.height = 2;
      glCanvas.setAttribute('aria-hidden', 'true');
      glCanvas.style.cssText =
        'position:fixed;left:-100px;top:-100px;width:2px;height:2px;pointer-events:none;opacity:0';
      document.body.appendChild(glCanvas);
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          canvas: glCanvas,
          baseOptions: {
            modelAssetPath: `${root}/face_landmarker.task`,
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          // Group photos must apply beauty to every visible face, not just one.
          numFaces: MAX_FACE_TARGETS,
          outputFaceBlendshapes: false,
        });
      } catch (error) {
        glCanvas.remove();
        throw error;
      }
    })().catch((error) => {
      landmarkerPromise = undefined; // allow retry after transient load error
      throw error;
    });
  }
  return landmarkerPromise;
}

async function facePoints(image: HTMLImageElement | HTMLCanvasElement): Promise<Landmark[][]> {
  const cached = faceCache.get(image);
  if (cached) return cached;
  const landmarker = await getLandmarker();
  const faces = landmarker.detect(image).faceLandmarks
    .filter((points) => points.length >= 468)
    .map((points) => points.map((p) => ({ x: p.x, y: p.y })));
  faceCache.set(image, faces);
  return faces;
}

// Share the same locally-hosted face model between Beauty and Face Deco.
// Reuse its in-memory results to avoid loading two copies on iPhone.
export async function detectFaceLandmarks(
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<Landmark[][]> {
  return facePoints(image);
}


/**
 * Shared multi-pass detector for Beauty and Face Deco.
 * Landmark coordinates are always normalized to the ORIGINAL photo.
 *
 * MediaPipe can miss small faces when it evaluates an entire group photo.
 * Extra overlapped crops make a smaller face occupy more of the detector input.
 * A central crop covers faces straddling the seams of the 2x2 grid.
 *
 * Results are cached per decoded image object, so moving a beauty slider
 * doesn't run the five image inferences again.
 */
type FaceCandidate = {
  points: Landmark[];
  x: number;
  y: number;
  width: number;
};

const enhancedFaces = new WeakMap<
  HTMLImageElement | HTMLCanvasElement, Promise<Landmark[][]>
>();
// Beauty's preview Image and Face Deco's decoded Image are different DOM
// objects for the same photograph. Cache by the actual source too, so the
// two panels use the *same* detected faces and the same left-to-right indices.
// Bound the cache to avoid retaining many megabytes of data-URL keys on iPhone.
const sharedPhotoFaces = new Map<string, Promise<Landmark[][]>>();
const SHARED_PHOTO_CACHE_LIMIT = 4;

function candidateForFace(
  points: Landmark[], imageWidth: number, imageHeight: number,
): FaceCandidate | null {
  if (points.length < 468) return null;
  const nose = points[1];
  const left = points[234];
  const right = points[454];
  const forehead = points[10];
  const chin = points[152];
  if (![nose, left, right, forehead, chin].every(Boolean)) return null;
  if (![nose, left, right, forehead, chin].every((p) =>
    Number.isFinite(p.x) && Number.isFinite(p.y))) return null;

  const width = Math.hypot(
    (left.x - right.x) * imageWidth,
    (left.y - right.y) * imageHeight,
  );
  const height = Math.hypot(
    (forehead.x - chin.x) * imageWidth,
    (forehead.y - chin.y) * imageHeight,
  );
  if (width < 14 || height < 14 || nose.x < 0 || nose.x > 1 ||
      nose.y < 0 || nose.y > 1) return null;
  return { points, x: nose.x, y: nose.y, width };
}

function mergeCandidates(
  candidates: FaceCandidate[], imageWidth: number, imageHeight: number,
): FaceCandidate[] {
  const unique: FaceCandidate[] = [];
  for (const item of candidates) {
    const duplicate = unique.findIndex((current) =>
      Math.hypot(
        (current.x - item.x) * imageWidth,
        (current.y - item.y) * imageHeight,
      ) < Math.max(10, Math.min(current.width, item.width) * 0.55),
    );
    if (duplicate === -1) unique.push(item);
    else if (item.width > unique[duplicate].width) unique[duplicate] = item;
  }
  return unique;
}

/**
 * The one canonical face index for Beauty, Face Deco and sunglasses.
 * It is intentionally independent of sticker placement: extreme poses can
 * be selected for Beauty, but a sticker may refuse unsafe automatic placement.
 * Every detector return path (including short images and 10-face first passes)
 * calls this function before assigning "left-to-right" face numbers.
 */
export function indexDetectedFaces(
  landmarks: Landmark[][], imageWidth: number, imageHeight: number,
): Landmark[][] {
  const candidates = landmarks
    .map((points) => candidateForFace(points, imageWidth, imageHeight))
    .filter((candidate): candidate is FaceCandidate => candidate !== null);
  return mergeCandidates(candidates, imageWidth, imageHeight)
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .slice(0, MAX_FACE_TARGETS)
    .map((candidate) => candidate.points);
}

async function scanFaceLandmarks(
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<Landmark[][]> {
  const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  if (!width || !height) throw new Error('写真のサイズを取得できませんでした。');

  const original = (await detectFaceLandmarks(image))
    .map((points) => candidateForFace(points, width, height))
    .filter((face): face is FaceCandidate => face !== null);
  const results = [...original];
  if (mergeCandidates(results, width, height).length >= MAX_FACE_TARGETS) {
    return indexDetectedFaces(results.map((f) => f.points), width, height);
  }

  const largeSolo = results.length === 1 && results[0].width / width > 0.28;
  // Single portraits already detected at good scale need no extra CPU work.
  if (largeSolo || Math.min(width, height) < 180) {
    return indexDetectedFaces(results.map((f) => f.points), width, height);
  }

  const crops: Array<readonly [number, number, number, number]> = [
    [0, 0, 0.57, 0.57],
    [0.43, 0, 0.57, 0.57],
    [0, 0.43, 0.57, 0.57],
    [0.43, 0.43, 0.57, 0.57],
    [0.17, 0.17, 0.66, 0.66],
  ];
  for (const [leftRatio, topRatio, widthRatio, heightRatio] of crops) {
    if (mergeCandidates(results, width, height).length >= MAX_FACE_TARGETS) break;
    const x = Math.round(width * leftRatio);
    const y = Math.round(height * topRatio);
    const cropWidth = Math.min(width - x, Math.round(width * widthRatio));
    const cropHeight = Math.min(height - y, Math.round(height * heightRatio));
    if (cropWidth <= 40 || cropHeight <= 40) continue;
    const tile = document.createElement('canvas');
    tile.width = cropWidth;
    tile.height = cropHeight;
    const context = tile.getContext('2d');
    if (!context) continue;
    try {
      context.drawImage(image, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      // Yield so a busy iPhone still paints its "detecting" status.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const detected = await detectFaceLandmarks(tile);
      for (const local of detected) {
        const mapped = local.map((p) => ({
          x: (x + p.x * cropWidth) / width,
          y: (y + p.y * cropHeight) / height,
        }));
        const candidate = candidateForFace(mapped, width, height);
        if (candidate) results.push(candidate);
      }
    } finally {
      // Release temporary canvas memory immediately on iPhone.
      tile.width = 0;
      tile.height = 0;
    }
  }

  return indexDetectedFaces(results.map((f) => f.points), width, height);
}

export function detectFaceLandmarksEnhanced(
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<Landmark[][]> {
  const cached = enhancedFaces.get(image);
  if (cached) return cached;

  // Normal decoded photos have a stable source URI; temporary crop canvases
  // must never share source-key results because their coordinates are local.
  const src = image instanceof HTMLImageElement ? (image.currentSrc || image.src) : '';
  const shared = src ? sharedPhotoFaces.get(src) : undefined;
  if (shared) {
    enhancedFaces.set(image, shared);
    return shared;
  }

  const pending = scanFaceLandmarks(image).catch((error: unknown) => {
    enhancedFaces.delete(image);
    if (src && sharedPhotoFaces.get(src) === pending) sharedPhotoFaces.delete(src);
    throw error;
  });
  enhancedFaces.set(image, pending);
  if (src) {
    sharedPhotoFaces.set(src, pending);
    if (sharedPhotoFaces.size > SHARED_PHOTO_CACHE_LIMIT) {
      const oldest = sharedPhotoFaces.keys().next().value;
      if (oldest !== undefined) sharedPhotoFaces.delete(oldest);
    }
  }
  return pending;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('画像を編集できるCanvasが使用できません。');
  return ctx;
}

function bound(num: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, num));
}

function point(face: Landmark[], index: number, w: number, h: number): PixelPoint {
  const pt = face[index];
  return { x: pt.x * w, y: pt.y * h };
}

const OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361,
  288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
  150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54,
  103, 67, 109,
];
const LIPS = [61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91];

function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  face: Landmark[], ids: number[], w: number, h: number,
): void {
  ctx.beginPath();
  ids.forEach((index, n) => {
    const p = point(face, index, w, h);
    if (n === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

function skinMask(
  face: Landmark[], w: number, h: number, faceWidth: number,
): Uint8ClampedArray {
  const mask = makeCanvas(w, h);
  const m = ctx2d(mask);
  m.fillStyle = '#ffffff';
  polygon(m, face, OVAL, w, h);

  // Eye details, eyebrow texture and lips remain sharp and retain their
  // natural colour. This avoids the typical "plastic face" blur.
  m.globalCompositeOperation = 'destination-out';
  const excluded = [
    [33, 133, 159, 145], [362, 263, 386, 374],
    [70, 105, 107, 55], [300, 334, 336, 285],
  ];
  for (const feature of excluded) {
    const ps = feature.map((id) => point(face, id, w, h));
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    ellipse(
      m,
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
      (Math.max(...xs) - Math.min(...xs)) * 0.8 + faceWidth * 0.02,
      (Math.max(...ys) - Math.min(...ys)) * 1.1 + faceWidth * 0.027,
    );
  }
  const mouthIds = [61, 291, 0, 17, 13, 14];
  const mouth = mouthIds.map((id) => point(face, id, w, h));
  const xs = mouth.map((p) => p.x);
  const ys = mouth.map((p) => p.y);
  ellipse(
    m, (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
    (Math.max(...xs) - Math.min(...xs)) * 0.8 + faceWidth * 0.02,
    (Math.max(...ys) - Math.min(...ys)) * 1.35 + faceWidth * 0.018,
  );
  const soft = makeCanvas(w, h);
  const sctx = ctx2d(soft);
  sctx.filter = `blur(${Math.max(2, faceWidth * 0.013)}px)`;
  sctx.drawImage(mask, 0, 0);
  return sctx.getImageData(0, 0, w, h).data;
}

function weight(x: number, y: number, p: PixelPoint, rx: number, ry: number): number {
  const dx = (x - p.x) / rx;
  const dy = (y - p.y) / ry;
  const d = dx * dx + dy * dy;
  return d > 3 ? 0 : Math.exp(-2.5 * d);
}

function sampleBilinear(
  source: Uint8ClampedArray,
  w: number, h: number,
  x: number, y: number, result: Uint8ClampedArray, dest: number,
): void {
  const xx = bound(x, 0, w - 1);
  const yy = bound(y, 0, h - 1);
  const x0 = Math.floor(xx);
  const y0 = Math.floor(yy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = xx - x0;
  const fy = yy - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    result[dest + c] =
      source[i00 + c] * (1 - fx) * (1 - fy) +
      source[i10 + c] * fx * (1 - fy) +
      source[i01 + c] * (1 - fx) * fy +
      source[i11 + c] * fx * fy;
  }
}

function reshape(
  input: HTMLCanvasElement,
  face: Landmark[],
  settings: BeautySettings,
  faceWidth: number, faceHeight: number,
): HTMLCanvasElement {
  if (!(settings.slim > 0 || settings.chin > 0 || settings.eyes > 0)) return input;
  const w = input.width;
  const h = input.height;
  const context = ctx2d(input);
  const data = context.getImageData(0, 0, w, h);
  const source = data.data;
  const result = new Uint8ClampedArray(source);
  const leftCheek = point(face, 234, w, h);
  const rightCheek = point(face, 454, w, h);
  const leftJaw = point(face, 172, w, h);
  const rightJaw = point(face, 397, w, h);
  const eyes = [
    [33, 133, 159, 145],
    [362, 263, 386, 374],
  ].map((ids) => {
    const ps = ids.map((i) => point(face, i, w, h));
    return {
      x: ps.reduce((sum, p) => sum + p.x, 0) / ps.length,
      y: ps.reduce((sum, p) => sum + p.y, 0) / ps.length,
    };
  });
  // Strong enough to be visible at iPhone canvas preview size, still bounded.
  const slimAmount = faceWidth * 0.095 * (settings.slim / 100);
  const jawAmount = faceWidth * 0.075 * (settings.chin / 100);
  const eyeFactor = 0.36 * (settings.eyes / 100);

  const oval = OVAL.map((i) => point(face, i, w, h));
  const minX = Math.max(0, Math.floor(Math.min(...oval.map((p) => p.x)) - faceWidth * 0.36));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(...oval.map((p) => p.x)) + faceWidth * 0.36));
  const minY = Math.max(0, Math.floor(Math.min(...oval.map((p) => p.y)) - faceHeight * 0.22));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(...oval.map((p) => p.y)) + faceHeight * 0.19));

  const lrx = faceWidth * 0.24;
  const lry = faceHeight * 0.26;
  const eyeR = faceWidth * 0.18;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let dx = 0;
      let dy = 0;
      if (slimAmount > 0) {
        dx -= slimAmount * weight(x, y, leftCheek, lrx, lry);
        dx += slimAmount * weight(x, y, rightCheek, lrx, lry);
      }
      if (jawAmount > 0) {
        dx -= jawAmount * weight(x, y, leftJaw, faceWidth * 0.24, faceHeight * 0.22);
        dx += jawAmount * weight(x, y, rightJaw, faceWidth * 0.24, faceHeight * 0.22);
      }
      if (eyeFactor > 0) {
        for (const eye of eyes) {
          const mask = weight(x, y, eye, eyeR, eyeR * 0.70);
          const factor = -eyeFactor * mask;
          dx += (x - eye.x) * factor;
          dy += (y - eye.y) * factor;
        }
      }
      if (Math.abs(dx) + Math.abs(dy) < 0.015) continue;
      const index = (y * w + x) * 4;
      sampleBilinear(source, w, h, x + dx, y + dy, result, index);
    }
  }

  data.data.set(result);
  context.putImageData(data, 0, 0);
  return input;
}

function skinCorrection(
  canvas: HTMLCanvasElement,
  face: Landmark[], settings: BeautySettings,
  faceWidth: number,
): void {
  if (!(settings.smooth > 0 || settings.bright > 0 || settings.warmth > 0)) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = ctx2d(canvas);
  const src = ctx.getImageData(0, 0, w, h);
  const skin = skinMask(face, w, h, faceWidth);
  const blurred = makeCanvas(w, h);
  const bx = ctx2d(blurred);
  bx.filter = `blur(${Math.max(1.5, faceWidth * 0.008)}px)`;
  bx.drawImage(canvas, 0, 0);
  const bb = bx.getImageData(0, 0, w, h).data;
  const smooth = 0.55 * settings.smooth / 100;
  const bright = 15 * settings.bright / 100;
  const warm = 14 * settings.warmth / 100;
  for (let i = 0; i < src.data.length; i += 4) {
    const alpha = skin[i + 3] / 255;
    if (alpha < 0.001 || src.data[i + 3] === 0) continue;
    const lumDelta = Math.abs(
      (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3 -
      (bb[i] + bb[i + 1] + bb[i + 2]) / 3
    );
    const edgeProtect = lumDelta > 22 ? 0.2 : 1;
    const a = smooth * alpha * edgeProtect;
    for (let c = 0; c < 3; c++) {
      const original = src.data[i + c];
      const softened = original + (bb[i + c] - original) * a;
      const tint = c === 0 ? warm : c === 2 ? -warm * 0.55 : warm * 0.15;
      src.data[i + c] = bound(softened + alpha * (bright + tint), 0, 255);
    }
  }
  ctx.putImageData(src, 0, 0);
}

function makeup(canvas: HTMLCanvasElement, face: Landmark[], settings: BeautySettings, faceWidth: number): void {
  if (!(settings.lip > 0 || settings.blush > 0)) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = ctx2d(canvas);
  if (settings.blush > 0) {
    const cheekPoints = [
      [117, 101, 205],
      [346, 330, 425],
    ];
    for (const ids of cheekPoints) {
      const ps = ids.map((i) => point(face, i, w, h));
      const x = ps.reduce((sum, p) => sum + p.x, 0) / ps.length;
      const y = ps.reduce((sum, p) => sum + p.y, 0) / ps.length;
      const radius = Math.max(5, faceWidth * 0.17);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.1, 0.67);
      const gradient = ctx.createRadialGradient(0, 0, radius * 0.06, 0, 0, radius);
      const opacity = (settings.blush / 100) * 0.23;
      gradient.addColorStop(0, `rgba(234, 72, 113, ${opacity})`);
      gradient.addColorStop(1, 'rgba(234, 72, 113, 0)');
      ctx.fillStyle = gradient;
      ellipse(ctx, 0, 0, radius, radius);
      ctx.restore();
    }
  }
  if (settings.lip > 0) {
    const mask = makeCanvas(w, h);
    const mx = ctx2d(mask);
    mx.fillStyle = '#ffffff';
    polygon(mx, face, LIPS, w, h);
    const soft = makeCanvas(w, h);
    const sx = ctx2d(soft);
    sx.filter = `blur(${Math.max(1, faceWidth * 0.003)}px)`;
    sx.drawImage(mask, 0, 0);
    const data = ctx.getImageData(0, 0, w, h);
    const alpha = sx.getImageData(0, 0, w, h).data;
    const amount = settings.lip / 100 * 0.34;
    for (let i = 0; i < data.data.length; i += 4) {
      const a = alpha[i + 3] / 255 * amount;
      if (a < 0.001 || data.data[i + 3] === 0) continue;
      data.data[i] = data.data[i] * (1 - a) + 179 * a;
      data.data[i + 1] = data.data[i + 1] * (1 - a) + 62 * a;
      data.data[i + 2] = data.data[i + 2] * (1 - a) + 99 * a;
    }
    ctx.putImageData(data, 0, 0);
  }
}

export type BeautyRender = {
  canvas: HTMLCanvasElement;
  faceCount: number;
  legCount: number;
  legUnavailable: boolean;
  slimApplied: boolean;
  lengthApplied: boolean;
  hasEffects: boolean;
};

export async function renderBeauty(
  source: HTMLImageElement,
  settings: BeautySettings,
  faceOverrides?: Record<string, Partial<BeautySettings>>,
): Promise<BeautyRender | null> {
  const naturalW = source.naturalWidth;
  const naturalH = source.naturalHeight;
  if (naturalW <= 0 || naturalH <= 0) {
    throw new Error('写真が読み込めませんでした。');
  }
  const needFace = (settings.legLength ?? 0) > 0 ||
    FACE_BEAUTY_FIELDS.some((key) => (settings[key] ?? 0) > 0) ||
    Object.values(faceOverrides ?? {}).some((patch) => FACE_BEAUTY_FIELDS.some(
      (key) => (patch[key] ?? settings[key] ?? 0) > 0,
    ));
  const needLeg = (settings.legSlim ?? 0) > 0 || (settings.legLength ?? 0) > 0;

  // Leg slimming alone does not need face AI. Lengthening cross-checks face
  // count so a second person missed by pose detection is not warped.
  const faces = needFace ? await detectFaceLandmarksEnhanced(source) : [];
  const ratio = Math.min(1, 1600 / Math.max(naturalW, naturalH));
  const w = Math.max(1, Math.round(naturalW * ratio));
  const h = Math.max(1, Math.round(naturalH * ratio));
  const usableFaces = faces.map((face, index) => ({ face, index })).filter(({ face }) => {
    const width = Math.hypot(
      (face[454].x - face[234].x) * w,
      (face[454].y - face[234].y) * h,
    );
    const height = Math.hypot(
      (face[152].x - face[10].x) * w,
      (face[152].y - face[10].y) * h,
    );
    return width >= 18 && height >= 18;
  });

  let canvas = makeCanvas(w, h);
  ctx2d(canvas).drawImage(source, 0, 0, w, h);
  let legCount = 0;
  let legUnavailable = false;
  let lengthApplied = false;
  let applied = false;
  let slimApplied = false;
  // Apply face effects to original coordinates BEFORE any leg warp.
  // The localized leg warp leaves the head area and face indices unchanged.
  for (const { face, index } of usableFaces) {
    const localSettings = { ...DEFAULT_BEAUTY, ...settings, ...faceOverrides?.[String(index)] };
    if (!FACE_BEAUTY_FIELDS.some((key) => localSettings[key] > 0)) continue;
    const width = Math.hypot(
      (face[454].x - face[234].x) * w,
      (face[454].y - face[234].y) * h,
    );
    const height = Math.hypot(
      (face[152].x - face[10].x) * w,
      (face[152].y - face[10].y) * h,
    );
    reshape(canvas, face, localSettings, width, height);
    skinCorrection(canvas, face, localSettings, width);
    makeup(canvas, face, localSettings, width);
    applied = true;
  }

  if (needLeg) {
    try {
      // Never lengthen when at least two faces are visible, even if pose
      // inference missed the other person's body.
      const requestedLength = usableFaces.length > 1 ? 0 : settings.legLength ?? 0;
      const result = await renderLegBeauty(
        source, canvas, settings.legSlim ?? 0, requestedLength,
      );
      canvas = result.canvas;
      legCount = result.legCount;
      lengthApplied = result.lengthApplied;
      slimApplied = result.slimApplied;
      applied = applied || result.applied;
    } catch (error) {
      console.error('[JOMON PIX] Leg detection or adjustment failed:', error);
      legUnavailable = true;
    }
  }


  if (!applied && !needLeg) return null;
  // Return the original canvas with explicit non-applied flags when pose
  // detection rejects a photo, so the UI never pretends the slider worked.
  return {
    canvas, faceCount: usableFaces.length, legCount,
    legUnavailable, slimApplied, lengthApplied, hasEffects: applied,
  };
}
