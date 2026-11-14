
import { useEditor, newId } from '../store';
import type { TextEl } from '../types';
import type { LibrarySticker } from './stickers';
import { findAttachmentPhoto } from './photoAttachments';

const base = () => ({
  id: newId(),
  x: 150,
  y: 150,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

// 写真を縮小して自動保存できるデータURLに変換
function fileToDataURL(
  file: File,
  max = 1400,
): Promise<{
  src: string;
  w: number;
  h: number;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const r = Math.min(
          1,
          max / Math.max(img.width, img.height),
        );

        const w = Math.max(
          1,
          Math.round(img.width * r),
        );

        const h = Math.max(
          1,
          Math.round(img.height * r),
        );

        const canvas = document.createElement('canvas');

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('画像を処理できません');
        }

        ctx.drawImage(img, 0, 0, w, h);

        const usePng =
          file.type === 'image/png' ||
          file.type === 'image/webp';

        const src = canvas.toDataURL(
          usePng ? 'image/png' : 'image/jpeg',
          0.85,
        );

        resolve({ src, w, h });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('写真を読み込めませんでした'));
    };

    img.src = url;
  });
}

// 写真を追加
export async function addImageFromFile(file: File) {
  const { src, w, h } = await fileToDataURL(file);

  const r = Math.min(
    1,
    500 / Math.max(w, h),
  );

  useEditor.getState().add({
    ...base(),
    type: 'image',
    src,
    width: w * r,
    height: h * r,
    filter: 'none',
  });
}

// キャンバスに合わせてスタンプの初期サイズを決定
function getStickerPlacement() {
  const editor = useEditor.getState();
  const photo = findAttachmentPhoto(editor.elements, editor.selectedId);

  // 写真がある場合、新規スタンプはその写真の中に配置する。
  // 写真がなければ従来通りキャンバスのスタンプとして追加する。
  const shorterSide = photo
    ? Math.min(photo.width, photo.height)
    : Math.min(editor.canvasWidth, editor.canvasHeight);

  const size = Math.min(
    520,
    Math.max(24, Math.round(shorterSide * 0.42)),
  );

  const width = photo ? photo.width : editor.canvasWidth;
  const height = photo ? photo.height : editor.canvasHeight;

  return {
    size,
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    ...(photo ? { parentImageId: photo.id } : {}),
  };
}

// 既存の絵文字スタンプを追加
export function addSticker(emoji: string) {
  if (!emoji) return;

  const placement = getStickerPlacement();

  useEditor.getState().add({
    ...base(),
    ...placement,
    type: 'sticker',
    emoji,
  });
}

// 犬・埴輪・土偶・顔デコなどの
// イラストスタンプを追加
export function addLibrarySticker(
  sticker: LibrarySticker,
) {
  // 絵文字は従来方式で追加する
  if (sticker.kind === 'emoji') {
    if (sticker.emoji) {
      addSticker(sticker.emoji);
    }
    return;
  }

  // SVGデータがない場合は何もしない
  if (!sticker.src) return;

  const placement = getStickerPlacement();

  useEditor.getState().add({
    ...base(),
    ...placement,
    type: 'sticker',
    emoji: '',
    src: sticker.src,
    label: sticker.label,
  });
}

// 文字を追加
export function addText(preset?: Partial<TextEl>) {
  const state = useEditor.getState();
  const photo = findAttachmentPhoto(state.elements, state.selectedId);

  useEditor.getState().add({
    ...base(),
    x: photo ? Math.round(photo.width * 0.25) : 200,
    y: photo ? Math.round(photo.height * 0.5) : 340,
    ...(photo ? { parentImageId: photo.id } : {}),
    type: 'text',
    text: 'テキスト',
    fontFamily: 'Hachi Maru Pop',
    fontSize: 56,
    fill: '#ff4fa3',
    stroke: '#ffffff',
    strokeWidth: 6,
    glow: '',
    letterSpacing: 0,
    vertical: false,
    align: 'center',
    ...preset,
  });
}
