import type { BeautySettings } from '../types';

type Landmark = { x: number; y: number };
type PixelPoint = { x: number; y: number };

export const DEFAULT_BEAUTY: BeautySettings = {
  smooth: 0, bright: 0, warmth: 0, slim: 0,
  chin: 0, eyes: 0, lip: 0, blush: 0,
};

export const BEAUTY_FIELDS: (keyof BeautySettings)[] = [
  'smooth', 'bright', 'warmth', 'slim',
  'chin', 'eyes', 'lip', 'blush',
];

export function beautySignature(settings?: BeautySettings): string {
  if (!settings || BEAUTY_FIELDS.every((key) => !(settings[key] > 0))) return 'none';
  return BEAUTY_FIELDS.map((key) => (
    Math.max(0, Math.min(100, Math.round(settings[key] ?? 0)))
  )).join('/');
}

let landmarkerPromise: Promise<import('@mediapipe/tasks-vision').FaceLandmarker> | undefined;
const faceCache = new WeakMap<HTMLImageElement, Landmark[] | null>();

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
          numFaces: 1,
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

async function facePoints(image: HTMLImageElement): Promise<Landmark[] | null> {
  if (faceCache.has(image)) return faceCache.get(image) ?? null;
  const landmarker = await getLandmarker();
  const faces = landmarker.detect(image).faceLandmarks;
  const points = faces[0]?.length >= 468
    ? faces[0].map((p) => ({ x: p.x, y: p.y }))
    : null;
  faceCache.set(image, points);
  return points;
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
  const slimAmount = faceWidth * 0.046 * (settings.slim / 100);
  const jawAmount = faceWidth * 0.034 * (settings.chin / 100);
  const eyeFactor = 0.12 * (settings.eyes / 100);

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

export async function renderBeauty(
  source: HTMLImageElement,
  settings: BeautySettings,
): Promise<HTMLCanvasElement | null> {
  const face = await facePoints(source);
  if (!face) return null;

  const w = source.naturalWidth;
  const h = source.naturalHeight;
  if (w <= 0 || h <= 0) throw new Error('写真が読み込めませんでした。');
  const width = Math.abs(face[454].x - face[234].x) * w;
  const height = Math.abs(face[152].y - face[10].y) * h;
  if (width < 36 || height < 36) return null;

  const canvas = makeCanvas(w, h);
  ctx2d(canvas).drawImage(source, 0, 0);
  reshape(canvas, face, settings, width, height);
  skinCorrection(canvas, face, settings, width);
  makeup(canvas, face, settings, width);
  return canvas;
}
