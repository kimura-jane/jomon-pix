import type Konva from 'konva';

export const CANVAS_W = 800;
export const CANVAS_H = 800;

export const stageRef: { current: Konva.Stage | null } = { current: null };

export function exportPNG() {
  const stage = stageRef.current;
  if (!stage) return;
  const tr = stage.findOne('Transformer');
  tr?.hide();
  const url = stage.toDataURL({ pixelRatio: 2 / stage.scaleX() });
  tr?.show();
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jomon-pix.png';
  a.click();
}
