import type Konva from 'konva';

export const CANVAS_W = 800;
export const CANVAS_H = 800;

export const stageRef: { current: Konva.Stage | null } = { current: null };

// 完成画像を Blob（ファイルのもと）として作る
export function exportBlob(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stage = stageRef.current;
    if (!stage) {
      reject(new Error('キャンバスが見つかりません'));
      return;
    }
    const tr = stage.findOne('Transformer');
    tr?.hide();
    stage.toBlob({
      pixelRatio: 2 / stage.scaleX(), // 1600px で書き出し
      mimeType: 'image/png',
      callback: (blob) => {
        tr?.show();
        tr?.getLayer()?.batchDraw();
        if (blob) resolve(blob as Blob);
        else reject(new Error('画像の作成に失敗しました'));
      },
    });
  });
}
