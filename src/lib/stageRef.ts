import type Konva from 'konva';

export const stageRef: { current: Konva.Stage | null } = { current: null };

export function exportPNG() {
  const stage = stageRef.current;
  if (!stage) return;
  const tr = stage.findOne('Transformer');
  tr?.hide();
  const url = stage.toDataURL({ pixelRatio: 2 });
  tr?.show();
  const a = document.createElement('a');
  a.href = url;
  a.download = 'decopix.png';
  a.click();
}
