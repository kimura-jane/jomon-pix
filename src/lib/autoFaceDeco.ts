import type { ImageEl, StickerEl } from '../types';
import { newId } from '../store';
import type { LibrarySticker } from './stickers';
import { detectFaceLandmarks, MAX_FACE_TARGETS, type Landmark } from './beautyProcessor';

type Point = { x: number; y: number };
type FaceSlot = 'ears' | 'head' | 'eyes' | 'nose' | 'whiskers' | 'cheeks' | 'mouth' | 'face';

// The original SVG art uses a 200x200 viewBox. Position each art category so
// its painted content—not the empty SVG margin—matches facial landmarks.
function layoutFor(stickerId: string): { slot: FaceSlot; width: number; anchorY?: number } {
  if (stickerId === 'face-cat-ears') return { slot: 'ears', width: 1.82, anchorY: 0.43 };
  if (stickerId === 'face-dog-ears') return { slot: 'ears', width: 1.52, anchorY: 0.31 };
  if (stickerId === 'face-rabbit-ears') return { slot: 'ears', width: 1.65, anchorY: 0.52 };
  if (stickerId === 'face-fox-ears') return { slot: 'ears', width: 1.80, anchorY: 0.45 };
  if (stickerId === 'face-panda-ears') return { slot: 'ears', width: 1.66, anchorY: 0.42 };
  if (stickerId.includes('horns') || stickerId.includes('crown') ||
      stickerId.includes('halo') || stickerId.includes('bow')) {
    return { slot: 'head', width: 1.52, anchorY: 0.60 };
  }
  if (stickerId === 'face-cat-nose') return { slot: 'nose', width: 0.58, anchorY: 0.52 };
  if (stickerId === 'face-dog-nose') return { slot: 'nose', width: 0.65, anchorY: 0.48 };
  if (stickerId === 'face-pig-snout') return { slot: 'nose', width: 0.75, anchorY: 0.54 };
  if (stickerId.includes('whiskers') || stickerId.includes('freckles')) {
    return { slot: 'whiskers', width: 1.23, anchorY: 0.54 };
  }
  if (stickerId.includes('blush') || stickerId.includes('cheek')) {
    return { slot: 'cheeks', width: 1.30, anchorY: 0.57 };
  }
  if (stickerId.includes('eyes') || stickerId.includes('glasses')) {
    return { slot: 'eyes', width: 1.34, anchorY: 0.51 };
  }
  if (stickerId.includes('moustache') || stickerId.includes('mask')) {
    return { slot: 'mouth', width: 1.22, anchorY: 0.55 };
  }
  return { slot: 'face', width: 1.35, anchorY: 0.5 };
}

function pixel(face: Landmark[], index: number, w: number, h: number): Point {
  const p = face[index];
  return { x: p.x * w, y: p.y * h };
}

function average(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function makePosition(
  face: Landmark[], photo: ImageEl, sticker: LibrarySticker,
): Pick<StickerEl, 'x' | 'y' | 'rotation' | 'size'> | null {
  if (face.length < 455) return null;
  const left = pixel(face, 234, photo.width, photo.height);
  const right = pixel(face, 454, photo.width, photo.height);
  const forehead = pixel(face, 10, photo.width, photo.height);
  const chin = pixel(face, 152, photo.width, photo.height);
  const leftEye = pixel(face, 33, photo.width, photo.height);
  const rightEye = pixel(face, 263, photo.width, photo.height);
  const nose = pixel(face, 1, photo.width, photo.height);
  const lips = average(
    pixel(face, 13, photo.width, photo.height),
    pixel(face, 14, photo.width, photo.height),
  );
  const eyes = average(leftEye, rightEye);
  const faceWidth = Math.hypot(right.x - left.x, right.y - left.y);
  const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  if (!Number.isFinite(faceWidth) || !Number.isFinite(faceHeight) ||
      faceWidth < 7 || faceHeight < 8) return null;

  const theta = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  // Avoid wildly rotated decorations on profiles or failed landmarks.
  if (!Number.isFinite(theta) || Math.abs(theta) > 1.1) return null;
  const sine = Math.sin(theta);
  const cosine = Math.cos(theta);
  const down = { x: -sine, y: cosine };

  const { slot, width, anchorY = 0.5 } = layoutFor(sticker.id);
  // Group-photo faces are smaller than selfies; a fixed 26px minimum
  // would cover adjacent faces when attaching ears or a nose.
  const size = Math.max(12, faceWidth * width);
  let anchor: Point;
  if (slot === 'ears' || slot === 'head') anchor = forehead;
  else if (slot === 'eyes') anchor = eyes;
  else if (slot === 'nose' || slot === 'whiskers') anchor = nose;
  else if (slot === 'mouth') anchor = lips;
  else if (slot === 'cheeks') {
    anchor = {
      x: nose.x + down.x * faceHeight * 0.13,
      y: nose.y + down.y * faceHeight * 0.13,
    };
  } else anchor = average(eyes, lips);

  // The sticker is positioned by its *painted reference point* while
  // React-Konva rotates around its upper-left origin, not its center.
  const referenceX = size * 0.5;
  const referenceY = size * anchorY;
  const x = anchor.x - (cosine * referenceX - sine * referenceY);
  const y = anchor.y - (sine * referenceX + cosine * referenceY);

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    rotation: Math.round(theta * 180 / Math.PI * 100) / 100,
    size: Math.round(size * 100) / 100,
  };
}

function imageFromSource(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('画像のサイズを取得できませんでした。'));
      } else resolve(img);
    };
    img.onerror = () => reject(new Error('写真を読み込めませんでした。'));
    img.src = src;
  });
}

// The full-frame model may only find the largest person in a group photo.
// For small faces, scan four overlapping enlarged regions and map their
// landmarks back onto the original image's normalized coordinates.
// Every candidate remains individually selectable; repeated detections
// across the overlapping regions are merged.
type FaceCandidate = { face: Landmark[]; x: number; y: number; width: number };

function faceCandidate(face: Landmark[], image: HTMLImageElement): FaceCandidate | null {
  if (face.length <= 454) return null;
  const nose = face[1];
  const left = face[234];
  const right = face[454];
  if (!nose || !left || !right) return null;
  const width = Math.hypot(
    (right.x - left.x) * image.naturalWidth,
    (right.y - left.y) * image.naturalHeight,
  );
  if (!Number.isFinite(width) || width < 15 ||
      !Number.isFinite(nose.x) || !Number.isFinite(nose.y) ||
      nose.x < 0 || nose.x > 1 || nose.y < 0 || nose.y > 1) return null;
  return { face, x: nose.x, y: nose.y, width };
}

function uniqueFaceCandidates(faces: FaceCandidate[], image: HTMLImageElement): FaceCandidate[] {
  const result: FaceCandidate[] = [];
  // Prefer the higher-resolution crop detection when two overlap.
  for (const candidate of faces) {
    const duplicateIndex = result.findIndex((existing) => {
      const distance = Math.hypot(
        (existing.x - candidate.x) * image.naturalWidth,
        (existing.y - candidate.y) * image.naturalHeight,
      );
      return distance < Math.max(10, Math.min(existing.width, candidate.width) * 0.48);
    });
    if (duplicateIndex === -1) result.push(candidate);
    else if (candidate.width > result[duplicateIndex].width) result[duplicateIndex] = candidate;
  }
  return result;
}

async function scanFaceCandidates(photo: ImageEl): Promise<Landmark[][]> {
  const image = await imageFromSource(photo.src);
  const firstPass = (await detectFaceLandmarks(image))
    .map((face) => faceCandidate(face, image))
    .filter((candidate): candidate is FaceCandidate => candidate !== null);
  const collected = [...firstPass];
  const largestRatio = firstPass.length
    ? Math.max(...firstPass.map((candidate) => candidate.width)) / image.naturalWidth
    : 0;

  // Full-frame detection is sufficient for a large, isolated face.
  // Avoid repeated CPU inference for ordinary selfies on iPhone.
  if (image.naturalWidth >= 500 && firstPass.length < MAX_FACE_TARGETS &&
      (firstPass.length !== 1 || largestRatio < 0.27)) {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    // 55% tiles overlap by 10% of the photograph on each axis.
    for (const topRatio of [0, 0.45]) {
      for (const leftRatio of [0, 0.45]) {
        const left = Math.round(sourceWidth * leftRatio);
        const top = Math.round(sourceHeight * topRatio);
        const width = Math.min(sourceWidth - left, Math.ceil(sourceWidth * 0.55));
        const height = Math.min(sourceHeight - top, Math.ceil(sourceHeight * 0.55));
        const tile = document.createElement('canvas');
        tile.width = width;
        tile.height = height;
        const ctx = tile.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(image, left, top, width, height, 0, 0, width, height);
        // Give the UI a chance to show "顔の位置を確認中…" between passes.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const found = await detectFaceLandmarks(tile);
        for (const face of found) {
          const mapped = face.map((point) => ({
            x: (left + point.x * width) / sourceWidth,
            y: (top + point.y * height) / sourceHeight,
          }));
          const candidate = faceCandidate(mapped, image);
          if (candidate) collected.push(candidate);
        }
        tile.width = 0;
        tile.height = 0;
      }
    }
  }

  return uniqueFaceCandidates(collected, image)
    .map(({ face }) => face)
    .filter((face) => makePosition(face, photo, {
      id: 'face-cat-ears', label: 'reference', kind: 'svg',
      src: 'data:image/svg+xml,reference',
    }) !== null)
    .sort((a, b) => a[1].x - b[1].x)
    .slice(0, MAX_FACE_TARGETS);
}

// Reuse exactly the same detected faces when the user places a sticker:
// recounting every tile on each tap would be slow and could change face order.
let cachedFaces: { src: string; width: number; height: number;
  promise: Promise<Landmark[][]> } | null = null;

function getFaceCandidates(photo: ImageEl): Promise<Landmark[][]> {
  if (cachedFaces?.src === photo.src &&
      cachedFaces.width === photo.width && cachedFaces.height === photo.height) {
    return cachedFaces.promise;
  }
  const promise = scanFaceCandidates(photo).catch((error: unknown) => {
    if (cachedFaces?.promise === promise) cachedFaces = null;
    throw error;
  });
  cachedFaces = { src: photo.src, width: photo.width, height: photo.height, promise };
  return promise;
}

export async function countAutoFaceTargets(photo: ImageEl): Promise<number> {
  return (await getFaceCandidates(photo)).length;
}

export type FaceDecoPlacementResult = {
  sticker: StickerEl;
  faceCount: number;
  faceIndex: number;
};

/**
 * Each click creates exactly ONE separately editable sticker on exactly ONE
 * chosen face, even when the original photo contains several people.
 * faceIndex is zero-based, ordered from left to right on the photo.
 */
export async function createAutoFaceSticker(
  photo: ImageEl,
  decoration: LibrarySticker,
  faceIndex = 0,
): Promise<FaceDecoPlacementResult> {
  if (!decoration.src) {
    throw new Error('配置する顔デコが見つかりません。');
  }
  const faces = await getFaceCandidates(photo);
  if (!faces.length) {
    throw new Error('顔を検出できませんでした。正面に近い写真で試すか、手動配置を使ってください。');
  }
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= faces.length) {
    throw new Error('顔の選択が変わりました。対象の顔をもう一度選んでください。');
  }
  const placement = makePosition(faces[faceIndex], photo, decoration);
  if (!placement) {
    throw new Error('顔の位置を取得できませんでした。手動で配置してください。');
  }
  return {
    faceCount: faces.length,
    faceIndex,
    sticker: {
      id: newId(),
      type: 'sticker',
      parentImageId: photo.id,
      emoji: '',
      src: decoration.src,
      label: decoration.label,
      ...placement,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    },
  };
}
