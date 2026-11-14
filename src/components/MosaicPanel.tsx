import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAutosaveStatus, useEditor } from '../store';
import { removeBg } from '../lib/removeBg';
import type { ImageEl } from '../types';

type Mode = 'rectangle' | 'brush' | 'all' | 'background';
type Point = { x: number; y: number };
type Region = { start: Point; end: Point };
type Stroke = { points: Point[]; size: number };
type View = { width: number; height: number };

const OPTIONS: { id: Mode; label: string }[] = [
  { id: 'rectangle', label: '範囲指定' },
  { id: 'brush', label: 'ブラシ' },
  { id: 'all', label: '画像全体' },
  { id: 'background', label: '背景だけ' },
];

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('この端末で画像を加工できません');
  return ctx;
}

function loadProcessedImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img);
      } else {
        reject(new Error('AIによる切り抜き画像が正しくありません'));
      }
    };
    img.onerror = () => reject(new Error('AIによる切り抜き画像を読み込めません'));
    img.src = src;
  });
}

function pixelate(
  img: HTMLImageElement,
  mode: Mode,
  tileSize: number,
  region: Region | null,
  strokes: Stroke[],
  foreground: HTMLImageElement | null = null,
): string {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) throw new Error('画像サイズを取得できません');

  const output = createCanvas(width, height);
  const out = context(output);
  out.drawImage(img, 0, 0);

  const tile = Math.max(4, Math.min(80, Math.round(tileSize)));
  const reduced = createCanvas(
    Math.max(1, Math.ceil(width / tile)),
    Math.max(1, Math.ceil(height / tile)),
  );
  const reducedCtx = context(reduced);
  reducedCtx.drawImage(img, 0, 0, reduced.width, reduced.height);

  const mosaic = createCanvas(width, height);
  const mosaicCtx = context(mosaic);
  mosaicCtx.imageSmoothingEnabled = false;
  mosaicCtx.drawImage(reduced, 0, 0, width, height);

  if (mode !== 'all' && mode !== 'background') {
    const mask = createCanvas(width, height);
    const ctx = context(mask);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (mode === 'rectangle' && region) {
      const x = Math.min(region.start.x, region.end.x);
      const y = Math.min(region.start.y, region.end.y);
      const w = Math.abs(region.end.x - region.start.x);
      const h = Math.abs(region.end.y - region.start.y);
      if (w < 2 || h < 2) {
        throw new Error('加工する範囲をもう少し大きく指定してください');
      }
      ctx.fillRect(x, y, w, h);
    } else if (mode === 'brush' && strokes.length) {
      for (const stroke of strokes) {
        if (!stroke.points.length) continue;
        ctx.lineWidth = stroke.size;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        if (stroke.points.length === 1) {
          ctx.arc(
            stroke.points[0].x,
            stroke.points[0].y,
            stroke.size / 2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        } else {
          for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
    } else {
      throw new Error('加工する場所を選んでください');
    }

    mosaicCtx.globalCompositeOperation = 'destination-in';
    mosaicCtx.drawImage(mask, 0, 0);
    mosaicCtx.globalCompositeOperation = 'source-over';
  }

  out.drawImage(mosaic, 0, 0);

  if (mode === 'background') {
    if (!foreground) throw new Error('被写体の自動判定が完了していません');

    // 背景削除AIが返す透明PNGは「被写体の位置」のみを判定する。
    // 元の写真のRGBをアルファマスクで切り出し、モザイクの上に戻す。
    // これにより人物の色調を保持し、背景部分だけがピクセル化される。
    const subject = createCanvas(width, height);
    const subjectCtx = context(subject);
    subjectCtx.drawImage(img, 0, 0);
    subjectCtx.globalCompositeOperation = 'destination-in';
    subjectCtx.drawImage(foreground, 0, 0, width, height);
    subjectCtx.globalCompositeOperation = 'source-over';

    out.drawImage(subject, 0, 0);
  }

  const jpeg = img.src.startsWith('data:image/jpeg') ||
    img.src.startsWith('data:image/jpg');
  return output.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.87);
}

function MosaicDialog({
  photo,
  mode: initialMode,
  onClose,
}: {
  photo: ImageEl;
  mode: Mode;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [tileSize, setTileSize] = useState(22);
  const [brushPercent, setBrushPercent] = useState(12);
  const [region, setRegion] = useState<Region | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [view, setView] = useState<View>({ width: 0, height: 0 });
  const spaceRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<number | null>(null);
  const regionStartRef = useRef<Point | null>(null);
  const lastStrokeRef = useRef<number | null>(null);

  useEffect(() => {
    let valid = true;
    const img = new Image();
    img.onload = () => {
      if (valid) {
        setSource(img);
        setError('');
      }
    };
    img.onerror = () => {
      if (valid) setError('画像の読み込みに失敗しました');
    };
    img.src = photo.src;
    return () => {
      valid = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [photo.src]);

  useEffect(() => {
    if (!source || !spaceRef.current) return;
    const element = spaceRef.current;
    const resize = () => {
      const maxWidth = Math.max(100, element.clientWidth);
      const maxHeight = Math.max(180, window.innerHeight * 0.43);
      const ratio = Math.min(
        maxWidth / source.naturalWidth,
        maxHeight / source.naturalHeight,
      );
      setView({
        width: Math.max(1, Math.round(source.naturalWidth * ratio)),
        height: Math.max(1, Math.round(source.naturalHeight * ratio)),
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [source]);

  const reset = () => {
    setRegion(null);
    setStrokes([]);
    drawingRef.current = null;
    regionStartRef.current = null;
    lastStrokeRef.current = null;
    setError('');
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    reset();
  };

  const getPoint = (clientX: number, clientY: number): Point | null => {
    if (!source || !pictureRef.current) return null;
    const r = pictureRef.current.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(source.naturalWidth, (clientX - r.left) / r.width * source.naturalWidth)),
      y: Math.max(0, Math.min(source.naturalHeight, (clientY - r.top) / r.height * source.naturalHeight)),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (working || (mode !== 'rectangle' && mode !== 'brush') || !source) return;
    const p = getPoint(event.clientX, event.clientY);
    if (!p) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = event.pointerId;
    if (mode === 'rectangle') {
      regionStartRef.current = p;
      setRegion({ start: p, end: p });
    } else {
      const stroke = {
        points: [p],
        size: Math.min(source.naturalWidth, source.naturalHeight) * brushPercent / 100,
      };
      setStrokes((old) => {
        lastStrokeRef.current = old.length;
        return [...old, stroke];
      });
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawingRef.current !== event.pointerId) return;
    const p = getPoint(event.clientX, event.clientY);
    if (!p) return;
    event.preventDefault();
    if (mode === 'rectangle' && regionStartRef.current) {
      setRegion({ start: regionStartRef.current, end: p });
    } else if (mode === 'brush') {
      setStrokes((old) => {
        const last = old.length - 1;
        if (last < 0) return old;
        const next = old.slice();
        next[last] = { ...next[last], points: [...next[last].points, p] };
        return next;
      });
    }
  };

  const stopDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawingRef.current !== event.pointerId) return;
    drawingRef.current = null;
    regionStartRef.current = null;
    lastStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const brushWidth = source
    ? Math.min(source.naturalWidth, source.naturalHeight) * brushPercent / 100
    : 0;

  const apply = async () => {
    if (!source || working) return;
    setError('');
    setWorking(true);

    try {
      // 他の加工ではAIモデルを読み込まない。通信が必要なのは「背景だけ」。
      let foreground: HTMLImageElement | null = null;
      if (mode === 'background') {
        try {
          const extracted = await removeBg(photo.src);
          foreground = await loadProcessedImage(extracted);
        } catch (error) {
          console.error('[JOMON pix] 背景だけモザイク: 被写体の検出に失敗', error);
          throw new Error(
            '被写体の自動判定に失敗しました。通信状態や端末の空きメモリを確認して再試行してください。元の写真は変更していません。',
          );
        }
      }

      // AI処理中に対象が変わった場合、古い画像で上書きしない。
      const state = useEditor.getState();
      const latest = state.elements.find((el) => el.id === photo.id);
      if (!latest || latest.type !== 'image' ||
          latest.src !== photo.src || latest.locked || latest.hidden) {
        throw new Error('画像が変更されました。画面を閉じて選び直してください');
      }

      const result = pixelate(source, mode, tileSize, region, strokes, foreground);
      state.update(photo.id, { src: result });
      const saved = useAutosaveStatus.getState();
      if (saved.status === 'failed') {
        alert('加工は反映されましたが、自動保存できません。画像サイズや保存容量を確認してください。');
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'モザイク加工に失敗しました');
    } finally {
      setWorking(false);
    }
  };

  return createPortal(
    <div
      className="modal-bg"
      role="dialog"
      aria-modal="true"
      aria-label="モザイク加工"
      style={{ zIndex: 100, padding: 10 }}
    >
      <div
        className="modal"
        style={{
          maxWidth: 660,
          maxHeight: 'calc(100dvh - 20px)',
          overflowY: 'auto',
          gap: 10,
        }}
      >
        <h3>▦ モザイク加工</h3>
        <div
          className="seg"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 6,
            marginBottom: 0,
          }}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={mode === option.id ? 'on' : ''}
              disabled={working}
              onClick={() => changeMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="hint-s" style={{ margin: 0 }}>
          {mode === 'rectangle'
            ? '写真の上で指を滑らせて四角い範囲を指定'
            : mode === 'brush'
              ? '指で隠したい場所をなぞる。何度でも追加できます'
              : mode === 'all'
                ? '選択した写真全体を加工します。上のスタンプや文字はそのままです'
                : 'AIが人物などの被写体を検出し、被写体を残して背景だけ加工します。判定結果は「適用」後に確認できます。初回はモデルのダウンロードが必要です'}
        </p>

        <div
          ref={spaceRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            minHeight: 160,
            borderRadius: 12,
            padding: 4,
            background: '#f7eef4',
          }}
        >
          {source && view.width > 0 ? (
            <div
              ref={pictureRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              style={{
                position: 'relative',
                flexShrink: 0,
                width: view.width,
                height: view.height,
                overflow: 'hidden',
                touchAction: 'none',
                cursor: mode === 'rectangle' || mode === 'brush' ? 'crosshair' : 'default',
              }}
            >
              <img
                src={photo.src}
                alt="モザイク対象の写真"
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
              <svg
                viewBox={'0 0 ' + source.naturalWidth + ' ' + source.naturalHeight}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                {mode === 'all' && (
                  <rect
                    width={source.naturalWidth}
                    height={source.naturalHeight}
                    fill="rgba(255,79,163,0.13)"
                  />
                )}
                {mode === 'rectangle' && region && (
                  <rect
                    x={Math.min(region.start.x, region.end.x)}
                    y={Math.min(region.start.y, region.end.y)}
                    width={Math.abs(region.end.x - region.start.x)}
                    height={Math.abs(region.end.y - region.start.y)}
                    fill="rgba(255,79,163,0.22)"
                    stroke="#ff4fa3"
                    strokeWidth={Math.max(2, source.naturalWidth / 320)}
                    strokeDasharray="8 5"
                  />
                )}
                {mode === 'brush' && strokes.map((stroke, i) =>
                  stroke.points.length === 1 ? (
                    <circle
                      key={i}
                      cx={stroke.points[0].x}
                      cy={stroke.points[0].y}
                      r={stroke.size / 2}
                      fill="rgba(255,79,163,0.45)"
                    />
                  ) : (
                    <polyline
                      key={i}
                      points={stroke.points.map((p) => p.x + ',' + p.y).join(' ')}
                      fill="none"
                      stroke="rgba(255,79,163,0.45)"
                      strokeWidth={stroke.size}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ),
                )}
                {mode === 'brush' && brushWidth > 0 && null}
              </svg>
            </div>
          ) : (
            <p className="hint-s">写真を読み込み中…</p>
          )}
        </div>

        <label className="slider">
          モザイクの粗さ {tileSize}px
          <input
            type="range"
            min={8}
            max={60}
            step={2}
            value={tileSize}
            disabled={working}
            onChange={(e) => setTileSize(Number(e.target.value))}
          />
        </label>

        {mode === 'brush' && (
          <label className="slider">
            ブラシの太さ {brushPercent}%
            <input
              type="range"
              min={2}
              max={35}
              step={1}
              value={brushPercent}
              disabled={working}
              onChange={(e) => setBrushPercent(Number(e.target.value))}
            />
          </label>
        )}

        {(mode === 'rectangle' || mode === 'brush') && (
          <button
            type="button"
            className="chip"
            disabled={working}
            onClick={reset}
          >
            指定した範囲をクリア
          </button>
        )}

        {error && (
          <p role="alert" style={{ margin: 0, color: '#c02660', fontSize: 13 }}>
            {error}
          </p>
        )}

        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button
            type="button"
            className="btn"
            style={{ flex: 1 }}
            disabled={working}
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="btn primary"
            style={{ flex: 1 }}
            disabled={!source || working ||
              (mode === 'rectangle' && !region) ||
              (mode === 'brush' && !strokes.length)}
            onClick={apply}
          >
            {working
              ? mode === 'background' ? '被写体を判定中…' : '加工中…'
              : mode === 'background' ? '背景だけにモザイク' : 'モザイクを適用'}
          </button>
        </div>

        <p className="hint-s" style={{ margin: 0 }}>
          適用後は「戻す」で元に戻せます。背景だけモザイクはAIモデルを端末に読み込み、写真をブラウザ内で処理します。判定結果は写真によって異なります。
        </p>
      </div>
    </div>,
    document.body,
  );
}

export function MosaicPanel() {
  const { elements, selectedId, select } = useEditor();
  const [mode, setMode] = useState<Mode>('rectangle');
  const [open, setOpen] = useState(false);
  const photos = elements.filter(
    (el): el is ImageEl => el.type === 'image' && !el.locked && !el.hidden,
  );
  const selected = photos.find((el) => el.id === selectedId);
  // どのモードも、選択中の写真を処理する。
  // 「背景だけ」はキャンバスの最背面画像という意味ではない。
  const target = selected ?? photos[photos.length - 1];

  return (
    <>
      <div
        className="seg"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 6,
        }}
      >
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={mode === option.id ? 'on' : ''}
            onClick={() => setMode(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {photos.length === 0 ? (
        <p className="hint-s">
          加工できる写真がありません。画像タブから写真を追加してください。
        </p>
      ) : (
        <>
          <p className="hint-s">
            {mode === 'all'
              ? '選択した写真全体にモザイクをかけます。スタンプや文字は加工しません。'
              : mode === 'background'
                ? 'AIで人物などの被写体を検出し、その写真の背景だけにモザイクをかけます。'
                : '選択した写真の指定部分だけを加工します。'}
          </p>
          {photos.length > 1 && (
            <>
              <div className="label">加工する画像を選択</div>
              <div className="row" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
                {[...photos].reverse().map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    aria-label={'画像' + (index + 1) + 'を選択'}
                    aria-pressed={photo.id === target?.id}
                    onClick={() => select(photo.id)}
                    style={{
                      flex: '0 0 auto',
                      width: 62,
                      padding: 4,
                      border: photo.id === target?.id
                        ? '2px solid #ff4fa3' : '2px solid transparent',
                      borderRadius: 12,
                      background: '#fff',
                    }}
                  >
                    <img
                      src={photo.src}
                      alt=""
                      style={{ display: 'block', width: 50, height: 50, objectFit: 'contain' }}
                    />
                    <span style={{ fontSize: 10 }}>画像{index + 1}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            className="big-btn"
            disabled={!target}
            onClick={() => setOpen(true)}
          >
            {mode === 'all'
              ? '▦ 画像全体を加工'
              : mode === 'background'
                ? '▦ 背景だけモザイク'
                : '▦ モザイクを指定する'}
          </button>
          <p className="hint-s">
            元の写真は「戻す」で復元できます。加工するのは写真レイヤーだけです。
          </p>
        </>
      )}
      {open && target && (
        <MosaicDialog
          key={target.id + ':' + mode}
          photo={target}
          mode={mode}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
