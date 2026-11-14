
import { useState } from 'react';
import { useEditor } from '../store';
import type { ImageEl } from '../types';

type Props = {
  el: ImageEl;
  onClose: () => void;
};

type Edge = 'left' | 'right' | 'top' | 'bottom';

type Edges = Record<Edge, number>;

const OPPOSITE: Record<Edge, Edge> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

const INITIAL: Edges = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const EDGE_LABELS: { id: Edge; label: string }[] = [
  { id: 'left', label: '左' },
  { id: 'right', label: '右' },
  { id: 'top', label: '上' },
  { id: 'bottom', label: '下' },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('写真を読み込めませんでした'));
    img.src = src;
  });
}

export function PhotoCropModal({ el, onClose }: Props) {
  const [edges, setEdges] = useState<Edges>(INITIAL);
  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
  });
  const [preset, setPreset] = useState('自由');
  const [busy, setBusy] = useState(false);

  const changeEdge = (edge: Edge, value: number) => {
    setEdges((current) => ({
      ...current,
      [edge]: Math.max(
        0,
        Math.min(value, 90 - current[OPPOSITE[edge]]),
      ),
    }));
    setPreset('自由');
  };

  const chooseRatio = (label: string, ratio: number) => {
    if (!imageSize.width || !imageSize.height) {
      alert('写真を読み込み中です');
      return;
    }

    const currentRatio = imageSize.width / imageSize.height;

    let next: Edges = { ...INITIAL };

    if (currentRatio > ratio) {
      const cut = (1 - ratio / currentRatio) * 50;
      next = { ...next, left: cut, right: cut };
    } else {
      const cut = (1 - currentRatio / ratio) * 50;
      next = { ...next, top: cut, bottom: cut };
    }

    if (
      next.left + next.right > 90 ||
      next.top + next.bottom > 90
    ) {
      alert('この写真では、その比率に切り抜けません');
      return;
    }

    setEdges(next);
    setPreset(label);
  };

  const apply = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const img = await loadImage(el.src);

      const originalW = img.naturalWidth;
      const originalH = img.naturalHeight;

      if (!originalW || !originalH) {
        throw new Error('写真のサイズが取得できません');
      }

      const sx = Math.round(originalW * edges.left / 100);
      const sy = Math.round(originalH * edges.top / 100);
      const ex = Math.round(originalW * (1 - edges.right / 100));
      const ey = Math.round(originalH * (1 - edges.bottom / 100));

      const sw = ex - sx;
      const sh = ey - sy;

      if (sw < 1 || sh < 1) {
        throw new Error('切り抜く範囲が小さすぎます');
      }

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('画像を処理できません');
      }

      context.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        sw,
        sh,
      );

      const format = /^data:image\/jpe?g/i.test(el.src)
        ? 'image/jpeg'
        : 'image/png';

      const src = canvas.toDataURL(format, 0.9);

      const fractionX = sx / originalW;
      const fractionY = sy / originalH;

      const localX = el.width * fractionX * el.scaleX;
      const localY = el.height * fractionY * el.scaleY;

      const angle = el.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x = el.x + localX * cos - localY * sin;
      const y = el.y + localX * sin + localY * cos;

      // 写真に付いたペンも、トリミング後のローカル座標へ移す。
      // 移動・拡大・回転した後でも画像との位置関係を維持する。
      const offsetX = el.width * fractionX;
      const offsetY = el.height * fractionY;
      const drawings = (el.drawings ?? []).map((stroke) => ({
        ...stroke,
        points: stroke.points.map((value, index) =>
          value - (index % 2 === 0 ? offsetX : offsetY),
        ),
      }));

      useEditor.getState().update(el.id, {
        src,
        width: el.width * sw / originalW,
        height: el.height * sh / originalH,
        x,
        y,
        drawings,
      });

      onClose();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'トリミングに失敗しました',
      );
    } finally {
      setBusy(false);
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
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: 460,
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
      >
        <h3>写真をトリミング</h3>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 8,
            overflow: 'hidden',
            borderRadius: 14,
            background: '#f7eef4',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
              overflow: 'hidden',
              lineHeight: 0,
            }}
          >
            <img
              src={el.src}
              alt="トリミング対象"
              onLoad={(event) => {
                const img = event.currentTarget;
                setImageSize({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
              }}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '32dvh',
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
                  '0 0 0 999px rgba(0,0,0,0.45)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        <div className="label">比率</div>

        <div className="row">
          {[
            { label: '自由', ratio: 0 },
            { label: '1:1', ratio: 1 },
            { label: '4:5', ratio: 4 / 5 },
            { label: '9:16', ratio: 9 / 16 },
          ].map((item) => (
            <button
              key={item.label}
              className={`chip ${
                preset === item.label ? 'on' : ''
              }`}
              onClick={() => {
                if (item.ratio === 0) {
                  setEdges({ ...INITIAL });
                  setPreset('自由');
                } else {
                  chooseRatio(item.label, item.ratio);
                }
              }}
              disabled={busy}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="label">範囲</div>

        {EDGE_LABELS.map(({ id, label }) => (
          <label
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              padding: '5px 0',
            }}
          >
            <span style={{ width: 24 }}>{label}</span>

            <input
              type="range"
              min={0}
              max={90 - edges[OPPOSITE[id]]}
              step={1}
              value={edges[id]}
              disabled={busy}
              onChange={(event) =>
                changeEdge(id, Number(event.target.value))
              }
              style={{
                flex: 1,
                accentColor: '#ff4fa3',
              }}
            />

            <span style={{ width: 44, textAlign: 'right' }}>
              {Math.round(edges[id])}%
            </span>
          </label>
        ))}

        <button
          className="btn primary big"
          onClick={apply}
          disabled={busy || !imageSize.width}
        >
          {busy ? '処理中…' : '切り抜く'}
        </button>

        <button
          className="btn big ghost"
          onClick={onClose}
          disabled={busy}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
