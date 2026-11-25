import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAutosaveStatus, useEditor } from '../store';
import { getPhotoLabel } from '../lib/photoAttachments';
import { smartErase } from '../lib/smartErase';
import { aiSmartErase } from '../lib/aiInpaint';
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
  const [mode, setMode] = useState<EraseMode>('brush');
  const [brushPercent, setBrushPercent] = useState(5);
  const [engine, setEngine] = useState<'ai' | 'simple'>('ai');
  const [preview, setPreview] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [progress, setProgress] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const cameraRef = useRef(camera);
  const [moveMode, setMoveMode] = useState(false);
  type Draft = { mode: EraseMode; strokes: Stroke[]; rectangle: Rectangle | null };
  const [history, setHistory] = useState<Draft[]>([]);
  const beforeStroke = useRef<Draft | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number; anchor: Point } | null>(null);
  const suppress = useRef(false);
  const pan = useRef<{ point: Point; camera: typeof camera } | null>(null);
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

  const pointFromClient = (clientX: number, clientY: number): Point | null => {
    if (!image || !pictureRef.current) return null;
    const rect = pictureRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // Both the <img> and SVG use 'contain' (xMidYMid meet). Map
    // pointer coordinates through that SAME letterboxed rectangle.
    // Otherwise the selected mask drifts on tall images.
    const scale = Math.min(rect.width / image.naturalWidth,
      rect.height / image.naturalHeight);
    const contentW = image.naturalWidth * scale;
    const contentH = image.naturalHeight * scale;
    const left = rect.left + (rect.width - contentW) / 2;
    const top = rect.top + (rect.height - contentH) / 2;
    if (clientX < left || clientX > left + contentW ||
        clientY < top || clientY > top + contentH) return null;
    return {
      x: Math.max(0, Math.min(image.naturalWidth, (clientX - left) / scale)),
      y: Math.max(0, Math.min(image.naturalHeight, (clientY - top) / scale)),
    };
  };

  const updateCamera = (next: typeof camera) => {
    const frame = frameRef.current;
    const picture = pictureRef.current;
    if (!image || !frame || !picture) return;
    const zoom = Math.max(1, Math.min(6, next.zoom));
    const scale = Math.min(picture.clientWidth / image.naturalWidth, picture.clientHeight / image.naturalHeight);
    const maxX = Math.max(0, (image.naturalWidth * scale * zoom - frame.clientWidth) / 2);
    const maxY = Math.max(0, (image.naturalHeight * scale * zoom - frame.clientHeight) / 2);
    const bounded = { zoom, x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
    cameraRef.current = bounded; setCamera(bounded);
  };
  const zoomBy = (factor: number) => {
    if (working || pointers.current.size) return;
    const c = cameraRef.current;
    const z = Math.max(1, Math.min(6, c.zoom * factor));
    updateCamera({ zoom: z, x: c.x * z / c.zoom, y: c.y * z / c.zoom });
  };
  useEffect(() => {
    if (!image || !frameRef.current) return;
    const observer = new ResizeObserver(() => updateCamera(cameraRef.current));
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [image]);
  const remember = () => setHistory((old) => [...old.slice(-49), { mode, strokes, rectangle }]);
  const undo = () => {
    if (working || pointers.current.size) return;
    if (preview) { setPreview(null); setShowOriginal(false); return; }
    const previous = history[history.length - 1];
    if (!previous) return;
    setMode(previous.mode); setStrokes(previous.strokes); setRectangle(previous.rectangle);
    setHistory((old) => old.slice(0, -1)); setError('');
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.shiftKey) undo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [history, preview, working]);
  const cancelStroke = () => {
    const before = beforeStroke.current;
    if (before) { setStrokes(before.strokes); setRectangle(before.rectangle); }
    beforeStroke.current = null; pointerId.current = null; start.current = null;
  };
  const pinchInfo = () => {
    const [a, b] = Array.from(pointers.current.values());
    const rect = frameRef.current?.getBoundingClientRect();
    if (!a || !b || !rect) return null;
    return { distance: Math.max(1, Math.hypot(a.x-b.x,a.y-b.y)),
      center: { x: (a.x+b.x)/2-rect.left-rect.width/2, y: (a.y+b.y)/2-rect.top-rect.height/2 } };
  };
  const beginPinch = () => {
    const info = pinchInfo(), c = cameraRef.current;
    if (info) pinch.current = { distance: info.distance, zoom: c.zoom,
      anchor: { x: (info.center.x-c.x)/c.zoom, y: (info.center.y-c.y)/c.zoom } };
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (working || !image || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const screen = { x: event.clientX, y: event.clientY };
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, screen);
    if (pointers.current.size >= 2) {
      cancelStroke(); pan.current = null; suppress.current = true;
      if (pointers.current.size === 2) beginPinch();
      return;
    }
    if (suppress.current) return;
    if (moveMode || preview) { pan.current = { point: screen, camera: cameraRef.current }; return; }
    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    beforeStroke.current = { mode, strokes, rectangle };
    pointerId.current = event.pointerId;
    start.current = point;
    if (mode === 'brush') {
      setStrokes((previous) => [...previous, { size: brushSize, points: [point] }]);
    } else {
      setRectangle({ start: point, end: point });
    }
    setError('');
    event.preventDefault();
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (working || !pointers.current.has(event.pointerId)) return;
    const screen = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, screen);
    event.preventDefault();
    if (pinch.current && pointers.current.size >= 2) {
      const info = pinchInfo(), g = pinch.current;
      if (!info) return;
      const z = Math.max(1, Math.min(6, g.zoom * info.distance / g.distance));
      updateCamera({ zoom: z, x: info.center.x - g.anchor.x * z, y: info.center.y - g.anchor.y * z });
      return;
    }
    if (suppress.current) return;
    if (pan.current) {
      const p = pan.current;
      updateCamera({ zoom: p.camera.zoom, x: p.camera.x + screen.x-p.point.x, y: p.camera.y + screen.y-p.point.y });
      return;
    }
    if (preview || pointerId.current !== event.pointerId) return;
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

  const pointerEnd = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pointerId.current === event.pointerId) {
      const before = beforeStroke.current, a = start.current;
      const b = pointFromClient(event.clientX,event.clientY) ?? rectangle?.end;
      if (cancelled || (mode === 'rectangle' && (!a || !b || Math.abs(a.x-b.x)<3 || Math.abs(a.y-b.y)<3))) cancelStroke();
      else {
        if (mode === 'rectangle' && a && b) setRectangle({start:a,end:b});
        if (before) setHistory((old) => [...old.slice(-49), before]);
        beforeStroke.current = null; pointerId.current = null; start.current = null;
      }
    }
    if (pointers.current.size < 2) pinch.current = null;
    else if (suppress.current) beginPinch();
    if (!pointers.current.size) { suppress.current = false; pan.current = null; }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const changeMode = (next: EraseMode) => {
    if (next === mode || pointers.current.size) return;
    remember();
    pointerId.current = null;
    start.current = null;
    setMode(next);
    setError('');
    setStrokes([]);
    setRectangle(null);
    setPreview(null);
    setShowOriginal(false);
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
    setProgress(engine === 'ai' ? 'AIを準備中…' : '補完中…');
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

      const result = engine === 'ai'
        ? await aiSmartErase(image, selection, setProgress)
        : await smartErase(image, selection);
      setPreview(result);
      setProgress('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '消去処理に失敗しました。');
    } finally {
      setWorking(false);
    }
  };

  const confirm = () => {
    if (!preview || working) return;
    const state = useEditor.getState();
    const latest = state.elements.find((item) => item.id === photo.id);
    if (latest?.type !== 'image' || latest.src !== photo.src ||
        latest.locked || latest.hidden) {
      setError('写真が変更されました。操作をやり直してください。');
      return;
    }
    state.endHistoryGroup();
    state.update(photo.id, { src: preview });
    window.dispatchEvent(new Event('jomon-pix:fit-canvas'));
    if (useAutosaveStatus.getState().status === 'failed') {
      alert('画像は加工されましたが、自動保存できません。画像保存やバックアップを行ってください。');
    }
    onClose();
  };

  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true"
      aria-label="スマート消去" style={{ zIndex: 100, padding: 10 }}>
      <div className="modal" style={{
        maxWidth: 650, maxHeight: 'calc(100dvh - 20px)',
        overflowY: 'auto', overscrollBehavior: 'contain', gap: 8,
      }}>
        <div className="mosaic-dialog-heading"><h3>AI消しゴム</h3>
          <button type="button" className="btn mosaic-undo" aria-label="戻す" disabled={working || (!history.length && !preview)} onClick={undo}>↶ <span>戻す</span></button>
        </div>
        <div className="seg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button type="button" className={engine === 'ai' ? 'on' : ''}
            disabled={working} aria-pressed={engine === 'ai'}
            onClick={() => { setEngine('ai'); setPreview(null); setShowOriginal(false); setError(''); }}>AI補完</button>
          <button type="button" className={engine === 'simple' ? 'on' : ''}
            disabled={working} aria-pressed={engine === 'simple'}
            onClick={() => { setEngine('simple'); setPreview(null); setShowOriginal(false); setError(''); }}>軽量補完</button>
        </div>
        <div className="seg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
          <button type="button" className={mode === 'brush' ? 'on' : ''}
            disabled={working || !!preview} onClick={() => changeMode('brush')}>なぞる</button>
          <button type="button" className={mode === 'rectangle' ? 'on' : ''}
            disabled={working || !!preview} onClick={() => changeMode('rectangle')}>囲む</button>
          <button type="button" aria-label="選択をクリア"
            disabled={working || !!preview || !hasSelection}
            style={{ paddingInline: 8 }}
            onClick={() => { if (pointers.current.size) return; remember(); setStrokes([]); setRectangle(null); setError(''); }}>クリア</button>
        </div>
        <div role="group" aria-label="画像の表示倍率" style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <button type="button" className="chip" aria-label="縮小" disabled={working || camera.zoom <= 1} onClick={() => zoomBy(1/1.5)}>−</button>
          <span style={{fontSize:12,fontWeight:700}}>{Math.round(camera.zoom*100)}%</span>
          <button type="button" className="chip" aria-label="拡大" disabled={working || camera.zoom >= 6} onClick={() => zoomBy(1.5)}>＋</button>
          <button type="button" className="chip" aria-label="全体表示" disabled={working} onClick={() => { if (!pointers.current.size) updateCamera({zoom:1,x:0,y:0}); }}>⤢</button>
          <button type="button" className={'chip '+(moveMode?'on':'')} aria-pressed={moveMode} disabled={working}
            onClick={() => { if (!pointers.current.size) setMoveMode((old)=>!old); }}>✋ <span>移動</span></button>
        </div>
        <div ref={frameRef} data-testid="eraser-preview-frame"
          onPointerDown={pointerDown} onPointerMove={pointerMove}
          onPointerUp={(event)=>pointerEnd(event)} onPointerCancel={(event)=>pointerEnd(event,true)}
          onLostPointerCapture={(event)=>pointerEnd(event,true)}
          style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: 'min(42dvh, 360px)', minHeight: 160,
          boxSizing: 'border-box', flex: '0 0 auto',
          overflow: 'hidden', padding: 4, borderRadius: 12, touchAction:'none', userSelect:'none',
          background: '#f6eef4',
        }}>
          {image ? (
            <div ref={pictureRef}
              style={{
                position: 'relative', flexShrink: 0,
                width: '100%', height: '100%', minWidth: 0, minHeight: 0,
                overflow: 'hidden', pointerEvents:'none', transformOrigin:'center',
                transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
              }}>
              <img src={preview && !showOriginal ? preview : photo.src} alt="消去する写真" draggable={false}
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain',
                  pointerEvents: 'none', userSelect: 'none' }} />
              {!preview && <svg viewBox={'0 0 ' + image.naturalWidth + ' ' + image.naturalHeight}
                preserveAspectRatio="xMidYMid meet"
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
              </svg>}
            </div>
          ) : <p className="hint-s">写真を読み込み中…</p>}
        </div>
        {!preview && mode === 'brush' && (
          <label className="slider">
            ブラシの太さ {brushPercent}%
            <input type="range" min={1} max={25} step={1}
              value={brushPercent} disabled={working}
              onChange={(event) => setBrushPercent(Number(event.target.value))} />
          </label>
        )}
        {working && progress && (
          <p role="status" className="hint-s" style={{ margin: 0 }}>{progress}</p>
        )}
        {error && <p role="alert" style={{ color: '#c02660', fontSize: 13 }}>{error}</p>}
        {preview && (
          <button type="button" className="chip" disabled={working}
            aria-label="長押しで比較"
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerCancel={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            onContextMenu={(event) => event.preventDefault()}
            style={{
              userSelect: 'none', WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none', touchAction: 'none',
            }}>
            長押しで比較
          </button>
        )}
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button type="button" className="btn" style={{ flex: 1 }}
            disabled={working} onClick={() => {
              if (preview) { setPreview(null); setShowOriginal(false); setProgress(''); }
              else onClose();
            }}>{preview ? '選択し直す' : 'キャンセル'}</button>
          <button type="button" className="btn primary" style={{ flex: 1 }}
            disabled={working || (!preview && (!image || !hasSelection))}
            onClick={() => { if (preview) confirm(); else void apply(); }}>
            {working ? '補完中…' : preview ? 'この結果を適用' : engine === 'ai' ? 'AIで消す' : '消去して補完'}
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

        </>
      )}
      {open && target && (
        <SelectionDialog key={target.id + ':' + target.src.length}
          photo={target} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
