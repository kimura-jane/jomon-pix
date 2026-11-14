import type { ImageEl, StickerEl } from '../types';
import { newId } from '../store';
import type { LibrarySticker } from './stickers';
import { detectFaceLandmarks, type Landmark } from './beautyProcessor';

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
      faceWidth < 18 || faceHeight < 20) return null;

  const theta = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  // Avoid wildly rotated decorations on profiles or failed landmarks.
  if (!Number.isFinite(theta) || Math.abs(theta) > 1.1) return null;
  const sine = Math.sin(theta);
  const cosine = Math.cos(theta);
  const down = { x: -sine, y: cosine };

  const { slot, width, anchorY = 0.5 } = layoutFor(sticker.id);
  const size = Math.max(26, faceWidth * width);
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

// Face candidates use the same left-to-right order as the photo. Each tap
// chooses ONE of these faces; a detected group never duplicates a sticker.
async function getFaceCandidates(photo: ImageEl): Promise<Landmark[][]> {
  const img = await imageFromSource(photo.src);
  const faces = await detectFaceLandmarks(img);
  return faces
    .filter((face) => face.length > 454 &&
      makePosition(face, photo, {
        id: 'face-cat-ears', label: 'reference', kind: 'svg',
        src: 'data:image/svg+xml,reference',
      }) !== null)
    .sort((a, b) => a[1].x - b[1].x)
    .slice(0, 4);
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
