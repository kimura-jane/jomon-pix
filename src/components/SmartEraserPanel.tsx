import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAutosaveStatus, useEditor } from '../store';
import { getPhotoLabel } from '../lib/photoAttachments';
import { smartErase } from '../lib/smartErase';
import type { ImageEl } from '../types';

type Point = { x: number; y: number };
type Stroke = { size: number; points: Point[] };
type Rectangle = { start: Point; end: Point };
type EraseMode = 'brush' | 'rectangle';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight) resolve(image);
      else reject(new Error('写真のサイズを取得できません。'));
    };
    image.onerror = () => reject(new Error('写真を読み込めませんでした。'));
    image.src = src;
  });
}

function SelectionDialog({
  photo,
  onClose,
}: {
  photo: ImageEl;
  onClose: () => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<EraseMode>('brush');
  const [brushPercent, setBrushPercent] = useState(9);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const start = useRef<Point | null>(null);
  const brushSize = image
    ? Math.max(2, Math.min(image.naturalWidth, image.naturalHeight) * brushPercent / 100)
    : 20;

  useEffect(() => {
    let alive = true;
    void loadImage(photo.src).then((next) => {
      if (alive) { setImage(next); setError(''); }
    }).catch((e: unknown) => {
      if (alive) setError(e instanceof Error ? e.message : '読み込みに失敗しました。');
    });
    return () => { alive = false; };
  }, [photo.src]);

  useEffect(() => {
    if (!image || !frameRef.current) return;
    const frame = frameRef.current;
    const resize = () => {
      const width = Math.max(100, frame.clientWidth - 8);
      const height = Math.max(150, window.innerHeight * 0.44);
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      setView({
        width: Math.max(1, Math.floor(image.naturalWidth * scale)),
        height: Math.max(1, Math.floor(image.naturalHeight * scale)),
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, [image]);

  const pointFromClient = (clientX: number, clientY: number): Point | null => {
    if (!image || !pictureRef.current) return null;
    const rect = pictureRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(image.naturalWidth,
        (clientX - rect.left) * image.naturalWidth / rect.width)),
      y: Math.max(0, Math.min(image.naturalHeight,
        (clientY - rect.top) * image.naturalHeight / rect.height)),
    };
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (working || !image || pointerId.current !== null ||
        (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    pointerId.current = event.pointerId;
    start.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === 'brush') {
      setStrokes((previous) => [...previous, { size: brushSize, points: [point] }]);
    } else {
      setRectangle({ start: point, end: point });
    }
    setError('');
    event.preventDefault();
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (working || pointerId.current !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    if (mode === 'brush') {
      setStrokes((previous) => {
        if (!previous.length) return previous;
        const next = previous.slice();
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, points: [...last.points, point] };
        return next;
      });
    } else if (start.current) {
      setRectangle({ start: start.current, end: point });
    }
  };

  const pointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    start.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const changeMode = (next: EraseMode) => {
    pointerId.current = null;
    start.current = null;
    setMode(next);
    setError('');
    setStrokes([]);
    setRectangle(null);
  };

  const hasSelection = mode === 'brush'
    ? strokes.length > 0
    : !!rectangle &&
      Math.abs(rectangle.end.x - rectangle.start.x) >= 3 &&
      Math.abs(rectangle.end.y - rectangle.start.y) >= 3;

  const apply = async () => {
    if (!image || !hasSelection || working) return;
    setWorking(true);
    setError('');
    try {
      const selection = document.createElement('canvas');
      selection.width = image.naturalWidth;
      selection.height = image.naturalHeight;
      const context = selection.getContext('2d');
      if (!context) throw new Error('選択範囲を作成できません。');
      context.fillStyle = '#fff';
      context.strokeStyle = '#fff';
      context.lineCap = 'round';
      context.lineJoin = 'round';
      if (mode === 'rectangle' && rectangle) {
        context.fillRect(
          Math.min(rectangle.start.x, rectangle.end.x),
          Math.min(rectangle.start.y, rectangle.end.y),
          Math.abs(rectangle.end.x - rectangle.start.x),
          Math.abs(rectangle.end.y - rectangle.start.y),
        );
      } else {
        for (const stroke of strokes) {
          if (!stroke.points.length) continue;
          context.lineWidth = stroke.size;
          context.beginPath();
          context.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (const point of stroke.points.slice(1)) {
            context.lineTo(point.x, point.y);
          }
          context.stroke();
          if (stroke.points.length === 1) {
            context.beginPath();
            context.arc(stroke.points[0].x, stroke.points[0].y,
              stroke.size / 2, 0, Math.PI * 2);
            context.fill();
          }
        }
      }

      const newSource = await smartErase(image, selection);
      const state = useEditor.getState();
      const latest = state.elements.find((item) => item.id === photo.id);
      if (latest?.type !== 'image' || latest.src !== photo.src ||
          latest.locked || latest.hidden) {
        throw new Error('写真が変更されました。操作をやり直してください。');
      }
      state.update(photo.id, { src: newSource });
      if (useAutosaveStatus.getState().status === 'failed') {
        alert('画像は加工されましたが、自動保存できません。画像保存やバックアップを行ってください。');
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '消去処理に失敗しました。');
    } finally {
      setWorking(false);
    }
  };

  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true"
      aria-label="スマート消去" style={{ zIndex: 100, padding: 10 }}>
      <div className="modal" style={{
        maxWidth: 650, maxHeight: 'calc(100dvh - 20px)',
        overflowY: 'auto', gap: 10,
      }}>
        <h3>スマート消去</h3>
        <div className="seg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button type="button" className={mode === 'brush' ? 'on' : ''}
            disabled={working} onClick={() => changeMode('brush')}>指でなぞる</button>
          <button type="button" className={mode === 'rectangle' ? 'on' : ''}
            disabled={working} onClick={() => changeMode('rectangle')}>四角で囲む</button>
        </div>
        <div ref={frameRef} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', minHeight: 155, padding: 4, borderRadius: 12,
          background: '#f6eef4',
        }}>
          {image && view.width > 0 ? (
            <div ref={pictureRef}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerEnd}
              onPointerCancel={pointerEnd}
              style={{
                position: 'relative', flexShrink: 0,
                width: view.width, height: view.height,
                overflow: 'hidden', touchAction: 'none', cursor: 'crosshair',
              }}>
              <img src={photo.src} alt="消去する写真" draggable={false}
                style={{ display: 'block', width: '100%', height: '100%',
                  pointerEvents: 'none', userSelect: 'none' }} />
              <svg viewBox={'0 0 ' + image.naturalWidth + ' ' + image.naturalHeight}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                  pointerEvents: 'none' }}>
                {mode === 'rectangle' && rectangle && (
                  <rect x={Math.min(rectangle.start.x, rectangle.end.x)}
                    y={Math.min(rectangle.start.y, rectangle.end.y)}
                    width={Math.abs(rectangle.end.x - rectangle.start.x)}
                    height={Math.abs(rectangle.end.y - rectangle.start.y)}
                    fill="rgba(255,79,163,.35)" stroke="#ec4092"
                    strokeWidth={Math.max(2, image.naturalWidth / 360)} />
                )}
                {mode === 'brush' && strokes.map((stroke, index) => (
                  stroke.points.length === 1
                    ? <circle key={index} cx={stroke.points[0].x}
                        cy={stroke.points[0].y} r={stroke.size / 2}
                        fill="rgba(255,79,163,.55)" />
                    : <polyline key={index}
                        points={stroke.points.map((point) =>
                          point.x + ',' + point.y).join(' ')}
                        fill="none" stroke="rgba(255,79,163,.55)"
                        strokeWidth={stroke.size} strokeLinecap="round"
                        strokeLinejoin="round" />
                ))}
              </svg>
            </div>
          ) : <p className="hint-s">写真を読み込み中…</p>}
        </div>
        {mode === 'brush' && (
          <label className="slider">
            ブラシの太さ {brushPercent}%
            <input type="range" min={2} max={25} step={1}
              value={brushPercent} disabled={working}
              onChange={(event) => setBrushPercent(Number(event.target.value))} />
          </label>
        )}
        <p className="hint-s" style={{ margin: 0 }}>
          周囲の画像を使って選択部分を補完します。模様が複雑な場所では不自然になることがあります。
        </p>
        <button type="button" className="chip"
          disabled={working || !hasSelection}
          onClick={() => { setStrokes([]); setRectangle(null); }}>
          選択範囲をクリア
        </button>
        {error && <p role="alert" style={{ color: '#c02660', fontSize: 13 }}>{error}</p>}
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button type="button" className="btn" style={{ flex: 1 }}
            disabled={working} onClick={onClose}>キャンセル</button>
          <button type="button" className="btn primary" style={{ flex: 1 }}
            disabled={working || !image || !hasSelection}
            onClick={() => { void apply(); }}>
            {working ? '補完中…' : '消去して補完'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SmartEraserPanel() {
  const { elements, selectedId, select } = useEditor();
  const [open, setOpen] = useState(false);
  const photos = elements.filter(
    (item): item is ImageEl =>
      item.type === 'image' && !item.hidden && !item.locked,
  );
  const target = photos.find((item) => item.id === selectedId) ?? photos[photos.length - 1];

  return (
    <>
      {photos.length > 1 && (
        <>
          <div className="label">写真を選択</div>
          <div className="row" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
            {photos.map((photo) => (
              <button type="button" key={photo.id}
                aria-label={getPhotoLabel(elements, photo.id) + 'を選択'}
                aria-pressed={target?.id === photo.id}
                onClick={() => select(photo.id)}
                style={{
                  flex: '0 0 64px', padding: 4, borderRadius: 12,
                  border: target?.id === photo.id ? '2px solid #ff4fa3' : '2px solid #eadbe6',
                  background: '#fff',
                }}>
                <img src={photo.src} alt="" style={{
                  display: 'block', width: 50, height: 50, objectFit: 'contain',
                }} />
                <span style={{ fontSize: 10 }}>{getPhotoLabel(elements, photo.id)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {photos.length === 0 ? (
        <p className="hint-s">先に写真を追加し、ロックを解除してください。</p>
      ) : (
        <>
          <button type="button" className="big-btn"
            disabled={!target} onClick={() => setOpen(true)}>
            不要なものを消す
          </button>
          <p className="hint-s">
            無料・端末内処理。元の写真は「戻す」で復元できます。
          </p>
        </>
      )}
      {open && target && (
        <SelectionDialog key={target.id + ':' + target.src.length}
          photo={target} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
