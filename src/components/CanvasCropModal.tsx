
import { useEffect, useState } from 'react';
import {
  useEditor,
  type CanvasCrop,
} from '../store';
import { stageRef } from '../lib/stageRef';

type Props = {
  onClose: () => void;
};

type Edge = 'left' | 'right' | 'top' | 'bottom';

type Edges = Record<Edge, number>;

const MIN_SIZE = 32;

const INITIAL: Edges = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const OPPOSITE: Record<Edge, Edge> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

const LABELS: { id: Edge; label: string }[] = [
  { id: 'left', label: '左' },
  { id: 'right', label: '右' },
  { id: 'top', label: '上' },
  { id: 'bottom', label: '下' },
];

const RATIOS = [
  { label: '自由', value: 0 },
  { label: '正方形', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '9:16', value: 9 / 16 },
];

export function CanvasCropModal({ onClose }: Props) {
  const canvasWidth = useEditor(
    (s) => s.canvasWidth,
  );
  const canvasHeight = useEditor(
    (s) => s.canvasHeight,
  );
  const cropCanvas = useEditor(
    (s) => s.cropCanvas,
  );

  const [edges, setEdges] = useState<Edges>({
    ...INITIAL,
  });
  const [preset, setPreset] = useState('自由');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 編集中の作品をプレビュー画像にする
  const refreshPreview = () => {
    const stage = stageRef.current;

    if (!stage) {
      setError('キャンバスが見つかりません');
      return;
    }

    const transformer = stage.findOne(
      'Transformer',
    );
    const wasVisible = transformer?.visible();

    try {
      setError('');

      // 編集用の選択枠は画像に含めない
      transformer?.hide();

      const longest = Math.max(
        stage.width(),
        stage.height(),
        1,
      );

      // iPhoneのメモリを使いすぎないプレビュー
      const pixelRatio = Math.min(
        5,
        1100 / longest,
      );

      const dataURL = stage.toDataURL({
        pixelRatio,
        mimeType: 'image/png',
      });

      setPreview(dataURL);
    } catch {
      setError(
        'プレビューを作成できませんでした',
      );
    } finally {
      if (wasVisible) {
        transformer?.show();
      }

      transformer?.getLayer()?.batchDraw();
    }
  };

  useEffect(() => {
    refreshPreview();
  }, [canvasWidth, canvasHeight]);

  // 各方向の切り抜き範囲を調整
  const changeEdge = (
    edge: Edge,
    value: number,
  ) => {
    const dimension =
      edge === 'left' || edge === 'right'
        ? canvasWidth
        : canvasHeight;

    setEdges((current) => {
      const available =
        100 -
        MIN_SIZE / dimension * 100 -
        current[OPPOSITE[edge]];

      return {
        ...current,
        [edge]: Math.max(
          0,
          Math.min(value, available),
        ),
      };
    });

    setPreset('自由');
  };

  // 指定した縦横比で中央から切り抜く
  const chooseRatio = (
    label: string,
    ratio: number,
  ) => {
    if (ratio === 0) {
      setEdges({ ...INITIAL });
      setPreset('自由');
      return;
    }

    const currentRatio =
      canvasWidth / canvasHeight;

    let next: Edges = {
      ...INITIAL,
    };

    if (currentRatio > ratio) {
      const cut =
        (1 - ratio / currentRatio) * 50;

      next = {
        ...next,
        left: cut,
        right: cut,
      };
    } else {
      const cut =
        (1 - currentRatio / ratio) * 50;

      next = {
        ...next,
        top: cut,
        bottom: cut,
      };
    }

    const remainingWidth =
      canvasWidth *
      (1 - (next.left + next.right) / 100);

    const remainingHeight =
      canvasHeight *
      (1 - (next.top + next.bottom) / 100);

    if (
      remainingWidth < MIN_SIZE ||
      remainingHeight < MIN_SIZE
    ) {
      alert(
        'このサイズでは、その比率に切り抜けません',
      );
      return;
    }

    setEdges(next);
    setPreset(label);
  };

  // 選択範囲を実際のキャンバス座標に変換
  const left = Math.round(
    canvasWidth * edges.left / 100,
  );
  const right = Math.round(
    canvasWidth * edges.right / 100,
  );
  const top = Math.round(
    canvasHeight * edges.top / 100,
  );
  const bottom = Math.round(
    canvasHeight * edges.bottom / 100,
  );

  const crop: CanvasCrop = {
    x: left,
    y: top,
    width: canvasWidth - left - right,
    height: canvasHeight - top - bottom,
  };

  const canApply =
    crop.width >= MIN_SIZE &&
    crop.height >= MIN_SIZE &&
    !!preview &&
    !busy;

  // トリミングを確定
  const apply = () => {
    if (!canApply) return;

    setBusy(true);

    const success = cropCanvas(crop);

    if (success) {
      onClose();
    } else {
      setBusy(false);
      alert(
        '切り抜き範囲が正しくありません',
      );
    }
  };

  return (
    <div
      className="modal-bg"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="modal"
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          maxWidth: 460,
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
      >
        <h3>キャンバスをトリミング</h3>

        <p className="hint">
          写真・文字・スタンプを含む作品全体を
          切り抜きます
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 10,
            borderRadius: 14,
            background: '#f7eef4',
            overflow: 'hidden',
            minHeight: 100,
          }}
        >
          {preview ? (
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: '100%',
                lineHeight: 0,
                overflow: 'hidden',
              }}
            >
              <img
                src={preview}
                alt="作品全体のプレビュー"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '36dvh',
                  width: 'auto',
                  height: 'auto',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  left: `${edges.left}%`,
                  right: `${edges.right}%`,
                  top: `${edges.top}%`,
                  bottom: `${edges.bottom}%`,
                  border: '2px solid #ff4fa3',
                  boxShadow:
                    '0 0 0 999px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          ) : (
            <p className="hint">
              {error || 'プレビューを作成中…'}
            </p>
          )}
        </div>

        <button
          className="btn big"
          onClick={refreshPreview}
          disabled={busy}
        >
          プレビューを更新
        </button>

        <div className="label">
          切り抜く比率
        </div>

        <div className="row">
          {RATIOS.map((item) => (
            <button
              key={item.label}
              className={`chip ${
                preset === item.label
                  ? 'on'
                  : ''
              }`}
              disabled={busy}
              onClick={() =>
                chooseRatio(
                  item.label,
                  item.value,
                )
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="label">
          切り抜く位置を調整
        </div>

        {LABELS.map(({ id, label }) => {
          const dimension =
            id === 'left' || id === 'right'
              ? canvasWidth
              : canvasHeight;

          const maxValue = Math.max(
            0,
            100 -
            MIN_SIZE / dimension * 100 -
            edges[OPPOSITE[id]],
          );

          return (
            <label
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '5px 0',
                fontSize: 13,
              }}
            >
              <span style={{ width: 24 }}>
                {label}
              </span>

              <input
                type="range"
                min={0}
                max={maxValue}
                step={0.1}
                value={edges[id]}
                disabled={busy}
                onChange={(event) =>
                  changeEdge(
                    id,
                    Number(event.target.value),
                  )
                }
                style={{
                  flex: 1,
                  minWidth: 0,
                  accentColor: '#ff4fa3',
                }}
              />

              <span
                style={{
                  width: 46,
                  textAlign: 'right',
                }}
              >
                {Math.round(edges[id])}%
              </span>
            </label>
          );
        })}

        <p className="hint">
          切り抜き後のサイズ：
          {crop.width} × {crop.height}
        </p>

        <p className="hint">
          ピンクの枠の外側は表示されなくなります。
          「戻す」で元の作品に戻せます。
        </p>

        <button
          className="btn primary big"
          onClick={apply}
          disabled={!canApply}
        >
          {busy
            ? '処理中…'
            : 'この範囲で切り抜く'}
        </button>

        <button
          className="btn big ghost"
          disabled={busy}
          onClick={onClose}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
