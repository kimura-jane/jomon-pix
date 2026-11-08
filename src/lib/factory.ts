
import { useEditor, newId } from '../store';
import type { TextEl } from '../types';
import type { LibrarySticker } from './stickers';

const base = () => ({
  id: newId(),
  x: 150,
  y: 150,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

// 自動保存できるように画像を縮小してデータURLに変換
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

        const w = Math.round(img.width * r);
        const h = Math.round(img.height * r);

        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;

        const ctx = c.getContext('2d');

        if (!ctx) {
          throw new Error('画像を処理できません');
        }

        ctx.drawImage(img, 0, 0, w, h);

        const png =
          file.type === 'image/png' ||
          file.type === 'image/webp';

        const src = c.toDataURL(
          png ? 'image/png' : 'image/jpeg',
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

// 従来の絵文字スタンプを追加
export function addSticker(emoji: string) {
  useEditor.getState().add({
    ...base(),
    x: 340,
    y: 340,
    type: 'sticker',
    emoji,
    size: 120,
  });
}

// 犬・埴輪・土偶などのイラストスタンプを追加
export function addLibrarySticker(
  sticker: LibrarySticker,
) {
  // 絵文字はこれまでどおり追加する
  if (sticker.kind === 'emoji') {
    if (sticker.emoji) {
      addSticker(sticker.emoji);
    }
    return;
  }

  // 画像データがない場合は追加しない
  if (!sticker.src) return;

  const editor = useEditor.getState();
  const size = 160;

  // キャンバスの中央に配置
  const x = Math.round(
    (editor.canvasWidth - size) / 2,
  );

  const y = Math.round(
    (editor.canvasHeight - size) / 2,
  );

  editor.add({
    ...base(),
    x,
    y,
    type: 'sticker',
    emoji: '',
    src: sticker.src,
    label: sticker.label,
    size,
  });
}

// 文字を追加
export function addText(preset?: Partial<TextEl>) {
  useEditor.getState().add({
    ...base(),
    x: 200,
    y: 340,
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
