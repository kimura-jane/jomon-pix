
import type Konva from 'konva';
import { useEditor } from '../store';

export const CANVAS_W = 800;
export const CANVAS_H = 800;

export const stageRef: {
  current: Konva.Stage | null;
} = {
  current: null,
};

const IMAGE_WAIT_TIMEOUT = 15000;
const IMAGE_CHECK_INTERVAL = 80;

// 表示対象の写真・画像スタンプが
// 実際に描画可能な状態か確認する。
function allImagesReady(stage: Konva.Stage): boolean {
  const elements = useEditor.getState().elements;

  return elements.every((el) => {
    if (el.hidden) return true;

    const isImage =
      el.type === 'image' ||
      (el.type === 'sticker' && !!el.src);

    if (!isImage) return true;

    const node = stage.findOne(`#${el.id}`);

    // 写真は「画像＋ペン描画」のGroupとして管理する。
    // スタンプは従来どおりImageノード。
    const imageNode = node?.getClassName() === 'Group'
      ? (node as Konva.Group).findOne('Image')
      : node;

    if (!imageNode || imageNode.getClassName() !== 'Image') {
      return false;
    }

    const image = (imageNode as Konva.Image).image();

    if (!(image instanceof HTMLImageElement)) {
      return false;
    }

    if (
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return false;
    }

    // dataURLの写真・スタンプでは、
    // 編集データと読み込まれた画像が
    // 同じものかどうかも検査する。
    if (
      el.src &&
      el.src.startsWith('data:') &&
      image.src !== el.src
    ) {
      return false;
    }

    return true;
  });
}

// 非同期で読み込み中の画像を待つ。
// 無期限には待たず、時間切れなら保存を中止する。
function waitForImages(stage: Konva.Stage): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (stageRef.current !== stage) {
        reject(
          new Error(
            'キャンバスが変更されました。もう一度保存してください。',
          ),
        );
        return;
      }

      if (allImagesReady(stage)) {
        resolve();
        return;
      }

      if (
        Date.now() - startedAt >= IMAGE_WAIT_TIMEOUT
      ) {
        reject(
          new Error(
            '写真またはスタンプの読み込みが完了しませんでした。画像を確認して、もう一度保存してください。',
          ),
        );
        return;
      }

      setTimeout(check, IMAGE_CHECK_INTERVAL);
    };

    check();
  });
}

// ReactとKonvaの描画が反映されるように
// ブラウザの描画タイミングを待つ。
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

// 完成画像をPNG Blobとして書き出す。
export async function exportBlob(): Promise<Blob> {
  const stage = stageRef.current;

  if (!stage) {
    throw new Error(
      'キャンバスが見つかりません',
    );
  }

  const scale = stage.scaleX();

  if (
    !Number.isFinite(scale) ||
    scale <= 0
  ) {
    throw new Error(
      'キャンバスの倍率が正しくありません',
    );
  }

  // 写真と画像スタンプがすべて読み込まれるまで待機
  await waitForImages(stage);

  // React側の画像表示とKonva側の描画を同期
  await nextPaint();

  if (
    stageRef.current !== stage ||
    !allImagesReady(stage)
  ) {
    throw new Error(
      '画像の状態が変更されました。もう一度保存してください。',
    );
  }

  const transformer = stage.findOne('Transformer');
  const wasVisible = transformer?.visible() ?? false;

  try {
    // 選択枠や操作ハンドルを完成画像に含めない
    transformer?.hide();
    stage.draw();

    const result = await stage.toBlob({
      pixelRatio: 2 / scale,
      mimeType: 'image/png',
    });

    if (
      !(result instanceof Blob) ||
      result.size === 0
    ) {
      throw new Error(
        '画像データを作成できませんでした',
      );
    }

    return result;
  } catch (error) {
    console.error(
      '[JOMON pix] PNG出力エラー:',
      error,
    );

    throw new Error(
      'PNG画像の作成に失敗しました。画像の枚数やサイズを確認して、もう一度保存してください。',
    );
  } finally {
    // 保存成功・失敗にかかわらず
    // 編集用の選択枠を元の表示状態に戻す
    if (wasVisible) {
      transformer?.show();
    } else {
      transformer?.hide();
    }

    if (stageRef.current === stage) {
      stage.draw();
    }
  }
}
