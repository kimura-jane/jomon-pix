import type { CanvasEl, ImageEl, StickerEl, TextEl } from '../types';

export type PhotoAttachment = StickerEl | TextEl;

export function isPhotoAttachment(el: CanvasEl): el is PhotoAttachment {
  return el.type === 'sticker' || el.type === 'text';
}

export function findAttachmentPhoto(
  elements: CanvasEl[],
  selectedId: string | null,
): ImageEl | undefined {
  const selected = elements.find((el) => el.id === selectedId);
  const selectedPhotoId =
    selected?.type === 'image' ? selected.id :
    selected && isPhotoAttachment(selected) ? selected.parentImageId : undefined;

  const available = elements.filter(
    (el): el is ImageEl => el.type === 'image' && !el.hidden && !el.locked,
  );

  return available.find((photo) => photo.id === selectedPhotoId) ??
    available[available.length - 1];
}

// 画像の変形を反転し、キャンバス座標を写真内の座標に変換する。
// 通常の平行移動・回転・拡大縮小・反転を保持する。
export function toPhotoLocal<T extends PhotoAttachment>(
  el: T,
  photo: ImageEl,
): T {
  const angle = photo.rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = el.x - photo.x;
  const dy = el.y - photo.y;

  const scaleX = Math.abs(photo.scaleX) > 0.0001 ? photo.scaleX : 1;
  const scaleY = Math.abs(photo.scaleY) > 0.0001 ? photo.scaleY : 1;

  return {
    ...el,
    parentImageId: photo.id,
    x: (cos * dx + sin * dy) / scaleX,
    y: (-sin * dx + cos * dy) / scaleY,
    rotation: el.rotation - photo.rotation,
    scaleX: el.scaleX / scaleX,
    scaleY: el.scaleY / scaleY,
  };
}

export function toCanvasWorld<T extends PhotoAttachment>(
  el: T,
  photo: ImageEl,
): T {
  const angle = photo.rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const dx = el.x * photo.scaleX;
  const dy = el.y * photo.scaleY;

  return {
    ...el,
    parentImageId: undefined,
    x: photo.x + cos * dx - sin * dy,
    y: photo.y + sin * dx + cos * dy,
    rotation: el.rotation + photo.rotation,
    scaleX: el.scaleX * photo.scaleX,
    scaleY: el.scaleY * photo.scaleY,
  };
}
