
import { useEffect, useRef, useState } from 'react';
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
  { label: '16:9', value: 16 / 9 },
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
  const pictureRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; kind: 'move' | 'tl' | 'tr' | 'bl' | 'br';
    x: number; y: number; edges: Edges; width: number; height: number } | null>(null);
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const startDrag = (event: React.PointerEvent<HTMLDivElement>, kind: 'move' | 'tl' | 'tr' | 'bl' | 'br') => {
    const rect = pictureRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height || busy || drag.current ||
        (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, kind, x: event.clientX, y: event.clientY,
      edges: { ...edges }, width: rect.width, height: rect.height };
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const dx = (event.clientX - d.x) / d.width * 100;
    const dy = (event.clientY - d.y) / d.height * 100;
    const e = d.edges;
    if (d.kind === 'move') {
      const x = clamp(dx, -e.left, e.right);
      const y = clamp(dy, -e.top, e.bottom);
      setEdges({ left: e.left + x, right: e.right - x, top: e.top + y, bottom: e.bottom - y });
      return;
    }
    const left = d.kind.endsWith('l');
    const top = d.kind.startsWith('t');
    const ax = left ? 100 - e.right : e.left;
    const ay = top ? 100 - e.bottom : e.top;
    const targetX = (left ? e.left : 100 - e.right) + dx;
    const targetY = (top ? e.top : 100 - e.bottom) + dy;
    const maxW = left ? ax : 100 - ax;
    const maxH = top ? ay : 100 - ay;
    let w = clamp((left ? ax - targetX : targetX - ax), Math.min(MIN_SIZE / canvasWidth * 100, maxW), maxW);
    let h = clamp((top ? ay - targetY : targetY - ay), Math.min(MIN_SIZE / canvasHeight * 100, maxH), maxH);
    if (preset !== '自由') {
      // Preserve the selected aspect ratio in source coordinates.
      const ratio = (100 - e.left - e.right) / (100 - e.top - e.bottom);
      const max = Math.min(maxW, maxH * ratio);
      const min = Math.min(max, Math.max(MIN_SIZE / canvasWidth * 100, MIN_SIZE / canvasHeight * 100 * ratio));
      const targetW = Math.abs(dx) / Math.max(1, 100 - e.left - e.right) >=
        Math.abs(dy) / Math.max(1, 100 - e.top - e.bottom) ? w : h * ratio;
      w = clamp(targetW, min, max);
      h = w / ratio;
    }
    setEdges({ left: left ? ax - w : ax, right: left ? 100 - ax : 100 - ax - w,
      top: top ? ay - h : ay, bottom: top ? 100 - ay : 100 - ay - h });
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };



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

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            borderRadius: 14,
            background: '#f7eef4',
            overflow: 'hidden',
            minHeight: 100,
          }}
        >
          {preview ? (
            <div
              ref={pictureRef}
              style={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: '100%',
                lineHeight: 0,
                overflow: 'visible', touchAction: 'none',
              }}
            >
              <img
                src={preview}
                alt="作品全体のプレビュー"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '43dvh', pointerEvents: 'none', userSelect: 'none',
                  width: 'auto',
                  height: 'auto',
                }}
              />

              <div onPointerDown={(event) => startDrag(event, 'move')}
                onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                style={{
                  position: 'absolute',
                  left: `${edges.left}%`,
                  right: `${edges.right}%`,
                  top: `${edges.top}%`,
                  bottom: `${edges.bottom}%`,
                  border: '2px solid #ff4fa3',
                  boxShadow:
                    '0 0 0 999px rgba(0,0,0,0.5)',
                  touchAction: 'none', cursor: 'move',
                }}
              >
              {[1, 2].map((n) => <div key={n} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderLeft: '1px solid rgba(255,255,255,.75)', left: (n * 100 / 3) + '%' }} />)}
              {[1, 2].map((n) => <div key={n} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderTop: '1px solid rgba(255,255,255,.75)', top: (n * 100 / 3) + '%' }} />)}
              {(['tl','tr','bl','br'] as const).map((corner) => <div key={corner}
                onPointerDown={(event) => startDrag(event, corner)} onPointerMove={moveDrag}
                onPointerUp={endDrag} onPointerCancel={endDrag}
                style={{ position: 'absolute', width: 36, height: 36, display: 'grid', placeItems: 'center',
                  left: corner.endsWith('l') ? -18 : undefined, right: corner.endsWith('r') ? -18 : undefined,
                  top: corner.startsWith('t') ? -18 : undefined, bottom: corner.startsWith('b') ? -18 : undefined,
                  cursor: 'nwse-resize', touchAction: 'none' }}>
                <span style={{ width: 16, height: 16, border: '2px solid #ff4fa3', borderRadius: 5, background: '#fff', pointerEvents: 'none' }} />
              </div>)}
              </div>
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
          比率
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
          範囲
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
          切り抜き後：
          {crop.width} × {crop.height}
        </p>

        <button
          className="btn primary big"
          onClick={apply}
          disabled={!canApply}
        >
          {busy
            ? '処理中…'
            : '切り抜く'}
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
