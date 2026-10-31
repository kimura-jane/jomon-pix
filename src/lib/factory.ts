import { useEditor, newId } from '../store';
import type { TextEl } from '../types';

const base = () => ({ id: newId(), x: 150, y: 150, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });

// 自動保存できるように、画像を小さくして文字データ(dataURL)にする
function fileToDataURL(file: File, max = 1400): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * r);
      const h = Math.round(img.height * r);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const png = file.type === 'image/png' || file.type === 'image/webp';
      resolve({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w, h });
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function addImageFromFile(file: File) {
  const { src, w, h } = await fileToDataURL(file);
  const r = Math.min(1, 500 / Math.max(w, h));
  useEditor.getState().add({
    ...base(), type: 'image', src, width: w * r, height: h * r, filter: 'none',
  });
}

export function addSticker(emoji: string) {
  useEditor.getState().add({ ...base(), x: 340, y: 340, type: 'sticker', emoji, size: 120 });
}

export function addText(preset?: Partial<TextEl>) {
  useEditor.getState().add({
    ...base(),
    x: 200, y: 340,
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
