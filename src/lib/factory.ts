import { useEditor } from '../store';
import { stageRef } from './stageRef';

const base = () => ({
  id: 'el-' + crypto.randomUUID(),
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

export async function addText(style: { fontFamily: string; fill: string; stroke?: string }) {
  useEditor.getState().add({
    ...base(),
    type: 'text',
    text: 'ダブルクリックで編集',
    fontSize: 48,
    ...style,
  });
  // Webフォントの読み込みが終わったら描き直す
  await document.fonts.load(`48px "${style.fontFamily}"`);
  stageRef.current?.batchDraw();
}
