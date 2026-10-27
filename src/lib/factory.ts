import { useEditor } from '../store';
import type { TextPreset } from './fonts';

export const newId = () =>
  'el-' +
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const base = () => ({
  id: newId(),
  x: 150,
  y: 150,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

function loadSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

export async function addImageFromFile(file: File) {
  const src = URL.createObjectURL(file);
  const { w, h } = await loadSize(src);
  const scale = Math.min(1, 500 / Math.max(w, h));
  useEditor.getState().add({
    ...base(),
    type: 'image',
    src,
    width: w * scale,
    height: h * scale,
    filter: 'none',
  });
}

export function addSticker(emoji: string) {
  useEditor.getState().add({ ...base(), type: 'sticker', emoji, size: 120 });
}

export function addText(p: TextPreset) {
  useEditor.getState().add({
    ...base(),
    type: 'text',
    text: 'テキスト',
    fontSize: 56,
    fontFamily: p.fontFamily,
    fill: p.fill,
    stroke: p.stroke,
    glow: p.glow,
    letterSpacing: 0,
  });
}
