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
  // Stop BEFORE the eyebrows and eyes; never deliberately erase them.
  const bottom = Math.max(0.10, Math.min(0.38,
    downDistance(brow) - 0.055, downDistance(eye) - 0.16));
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

  // Small enough to keep an iPhone's IndexedDB, Undo and exported projects
  // practical. Expand for the feathered mask and for tilted faces.
  const margin = Math.max(8, Math.ceil(faceW * 0.08));
  const halfW = faceW * 0.65 + Math.abs(sine) * faceH * 0.65 + margin;
  const minY = forehead.y - faceH * 0.43 - Math.abs(sine) * faceW * 0.65 - margin;
  const maxY = forehead.y + faceH * (bottom + 0.18) + Math.abs(sine) * faceW * 0.65 + margin;
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
