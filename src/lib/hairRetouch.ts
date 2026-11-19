import type { HairRetouch, ImageEl } from '../types';
import { detectFaceLandmarksEnhanced, type Landmark } from './beautyProcessor';
import { aiSmartErase } from './aiInpaint';

// A lightweight validity key, not a security fingerprint.  It prevents a
// patch made for a previous edit/crop from being painted on a new photograph.
export function hairPhotoKey(src: string): string {
  let h = 2166136261;
  const stride = Math.max(1, Math.floor(src.length / 2048));
  for (let i = 0; i < src.length; i += stride) {
    h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  }
  return src.length.toString(36) + '-' + (h >>> 0).toString(36);
}

function imageFrom(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => image.naturalWidth && image.naturalHeight
      ? resolve(image) : reject(new Error('写真を読み込めませんでした。'));
    image.onerror = () => reject(new Error('写真を読み込めませんでした。'));
    image.src = src;
  });
}

function point(face: Landmark[], index: number, w: number, h: number) {
  return { x: face[index].x * w, y: face[index].y * h };
}


// The forehead patch alone leaves long, dark original strands peeking out
// along the sides of shorter wigs. Follow connected old-hair-colored pixels
// near the head, while refusing to follow onto eyes, clothing or open scenery.
// This is a conservative, local matte: uncertain pixels stay untouched.
function extendDarkHairMask(
  image: HTMLImageElement, face: Landmark[], mask: HTMLCanvasElement,
  forehead: { x: number; y: number }, faceW: number, faceH: number, theta: number,
): void {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const ratio = Math.min(1, 640 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * ratio));
  const sh = Math.max(1, Math.round(h * ratio));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(image, 0, 0, sw, sh);
  const pixels = ctx.getImageData(0, 0, sw, sh).data;
  const colorAt = (x: number, y: number): [number, number, number] => {
    const xx = Math.min(sw - 1, Math.max(0, Math.round(x * ratio)));
    const yy = Math.min(sh - 1, Math.max(0, Math.round(y * ratio)));
    const i = (yy * sw + xx) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  const lightness = (c: number[]) => c[0] * .24 + c[1] * .68 + c[2] * .08;
  const cheeks = [point(face, 205, w, h), point(face, 425, w, h)]
    .map((p) => colorAt(p.x, p.y));
  const skinLightness = cheeks.reduce((n, c) => n + lightness(c), 0) / cheeks.length;
  const ca = Math.cos(theta);
  const sa = Math.sin(theta);
  // Prefer the top of the existing hairstyle (not the eyebrows/eye bar).
  const candidates = [-0.20, -0.12, -0.06].map((dy) =>
    colorAt(forehead.x, forehead.y + dy * faceH));
  const hairColor = candidates.reduce((best, c) =>
    lightness(c) < lightness(best) ? c : best, candidates[0]);
  if (lightness(hairColor) > skinLightness - 28) return;

  const nearHair = (index: number) => {
    const i = index * 4;
    const color = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const distance = Math.hypot(
      color[0] - hairColor[0], color[1] - hairColor[1],
      color[2] - hairColor[2],
    );
    return distance < 95 && lightness(color) < skinLightness - 14;
  };
  const inHead = (i: number) => {
    const x = ((i % sw) / ratio - forehead.x);
    const y = (Math.floor(i / sw) / ratio - forehead.y);
    const u = (ca * x + sa * y) / faceW;
    const v = (-sa * x + ca * y) / faceH;
    if (v < -0.34 || v > 0.76 || Math.abs(u) > 0.86) return false;
    // Never traverse across the eyes or central lower face.
    if (v > 0.40 && Math.abs(u) < 0.48) return false;
    if (v > 0.62 && Math.abs(u) < 0.56) return false;
    return true;
  };

  const visited = new Uint8Array(sw * sh);
  const selected = new Uint8Array(sw * sh);
  const queue = new Int32Array(sw * sh);
  let head = 0;
  let tail = 0;
  // Use only actual connected hair from several scalp-adjacent seeds.
  for (const dy of [-0.20, -0.12, -0.06]) {
    for (const dx of [-0.25, 0, 0.25]) {
      const x = forehead.x + dx * faceW * ca - dy * faceH * sa;
      const y = forehead.y + dx * faceW * sa + dy * faceH * ca;
      const xx = Math.round(x * ratio);
      const yy = Math.round(y * ratio);
      if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
      const i = yy * sw + xx;
      if (!visited[i] && inHead(i) && nearHair(i)) {
        visited[i] = 1;
        selected[i] = 1;
        queue[tail++] = i;
      }
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % sw;
    const y = Math.floor(i / sw);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
      const index = ny * sw + nx;
      if (visited[index]) continue;
      visited[index] = 1;
      if (!inHead(index) || !nearHair(index)) continue;
      selected[index] = 1;
      queue[tail++] = index;
    }
  }
  if (!tail) return;
  const alpha = ctx.createImageData(sw, sh);
  for (let i = 0; i < selected.length; i++) {
    if (!selected[i]) continue;
    alpha.data[i * 4] = 255;
    alpha.data[i * 4 + 1] = 255;
    alpha.data[i * 4 + 2] = 255;
    alpha.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(alpha, 0, 0);
  const maskCtx = mask.getContext('2d');
  maskCtx?.drawImage(small, 0, 0, w, h);
  small.width = 0;
  small.height = 0;
}

function createMask(image: HTMLImageElement, face: Landmark[]) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const forehead = point(face, 10, w, h);
  const chin = point(face, 152, w, h);
  const left = point(face, 234, w, h);
  const right = point(face, 454, w, h);
  const leftEye = point(face, 33, w, h);
  const rightEye = point(face, 263, w, h);
  const leftBrow = point(face, 70, w, h);
  const rightBrow = point(face, 300, w, h);
  const faceW = Math.hypot(right.x - left.x, right.y - left.y);
  const faceH = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  if (!Number.isFinite(faceW) || !Number.isFinite(faceH) || faceW < 12 || faceH < 16) {
    throw new Error('髪の位置を取得できませんでした。');
  }
  const theta = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  if (Math.abs(theta) > 1.1) throw new Error('正面に近い顔でお試しください。');
  const cosine = Math.cos(theta);
  const sine = Math.sin(theta);
  const downDistance = (p: { x: number; y: number }) =>
    (-(p.x - forehead.x) * sine + (p.y - forehead.y) * cosine) / faceH;
  const eye = { x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2 };
  const brow = { x: (leftBrow.x + rightBrow.x) / 2,
    y: (leftBrow.y + rightBrow.y) / 2 };
  // Clear the old fringe to just above the eyes. The outer side matte keeps
  // the eye/eyebrow region protected while still removing side strands.
  const bottom = Math.max(0.18, Math.min(0.55,
    downDistance(eye) - 0.06, downDistance(brow) + 0.19));
  const top = -0.28;

  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const ctx = mask.getContext('2d');
  if (!ctx) throw new Error('髪の補完範囲を作成できませんでした。');
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(forehead.x, forehead.y);
  ctx.rotate(theta);
  ctx.scale(faceW, faceH);
  // Rounded hairline/forehead cutout. Only the central forehead is filled:
  // the physical outer hairstyle strands are supplied by the hair WebP.
  ctx.beginPath();
  ctx.moveTo(-0.34, top);
  ctx.bezierCurveTo(-0.58, top + 0.06, -0.54, bottom - 0.06, -0.41, bottom);
  ctx.quadraticCurveTo(0, bottom + 0.08, 0.41, bottom);
  ctx.bezierCurveTo(0.54, bottom - 0.06, 0.58, top + 0.06, 0.34, top);
  ctx.quadraticCurveTo(0, top - 0.10, -0.34, top);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  extendDarkHairMask(image, face, mask, forehead, faceW, faceH, theta);

  // Small enough to keep an iPhone's IndexedDB, Undo and exported projects
  // practical. Expand for the feathered mask and for tilted faces.
  const margin = Math.max(8, Math.ceil(faceW * 0.08));
  const halfW = faceW * 0.94 + Math.abs(sine) * faceH * 0.84 + margin;
  const minY = forehead.y - faceH * 0.45 - Math.abs(sine) * faceW * 0.86 - margin;
  const maxY = forehead.y + faceH * 0.84 + Math.abs(sine) * faceW * 0.86 + margin;
  const x = Math.max(0, Math.floor(forehead.x - halfW));
  const y = Math.max(0, Math.floor(minY));
  const width = Math.min(w - x, Math.ceil(forehead.x + halfW) - x);
  const height = Math.min(h - y, Math.ceil(maxY) - y);
  if (width < 10 || height < 10) throw new Error('髪の補完範囲を作成できませんでした。');
  return { mask, x, y, width, height };
}

/**
 * Inpaint the person's forehead once using the bundled offline MI-GAN model.
 * Only a soft, cropped retouch patch is persisted; the original image and
 * every other face remain untouched. Removing the hairstyle removes the patch.
 */
export async function createHairRetouch(
  photo: ImageEl, faceIndex: number, progress?: (text: string) => void,
): Promise<HairRetouch> {
  progress?.('元の髪を自然に補完中…');
  const image = await imageFrom(photo.src);
  const faces = await detectFaceLandmarksEnhanced(image);
  const face = faces[faceIndex];
  if (!face || face.length < 455) throw new Error('顔を認識できませんでした。');
  const { mask, x, y, width, height } = createMask(image, face);
  // AI runs locally. If unavailable, do NOT silently leave the old hair
  // showing while claiming the new hairstyle has been fitted.
  const processedSrc = await aiSmartErase(image, mask, (message) =>
    progress?.(message));
  const processed = await imageFrom(processedSrc);
  const patch = document.createElement('canvas');
  patch.width = width;
  patch.height = height;
  const ctx = patch.getContext('2d');
  if (!ctx) throw new Error('髪の補完結果を作成できませんでした。');
  ctx.drawImage(processed, x, y, width, height, 0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = 'blur(' + Math.max(2, Math.round(image.naturalWidth / 380)) + 'px)';
  ctx.drawImage(mask, x, y, width, height, 0, 0, width, height);
  ctx.filter = 'none';
  const src = patch.toDataURL('image/png');
  // Release pixel buffers once the patch is encoded.
  mask.width = 0;
  mask.height = 0;
  patch.width = 0;
  patch.height = 0;
  return {
    src, sourceKey: hairPhotoKey(photo.src),
    x: x / image.naturalWidth * photo.width,
    y: y / image.naturalHeight * photo.height,
    width: width / image.naturalWidth * photo.width,
    height: height / image.naturalHeight * photo.height,
  };
}
