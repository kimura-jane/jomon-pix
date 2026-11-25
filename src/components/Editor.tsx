
import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import {
  Stage,
  Layer,
  Rect,
  Transformer,
} from 'react-konva';
import { useEditor, newId } from '../store';
import { ElementNode } from './ElementNode';
import { SceneBackdrop, SocialOverlay } from './SceneLayers';
import { stageRef } from '../lib/stageRef';
import type { CanvasEl, ImageEl, ImageStroke } from '../types';

type Point = {
  x: number;
  y: number;
};

type DraftStroke = {
  imageId: string;
  stroke: ImageStroke;
};

function pointToSegmentDistance(
  p: Point,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0
    ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / lenSq))
    : 0;
  return Math.hypot(p.x - (ax + dx * t), p.y - (ay + dy * t));
}

function touchesStroke(p: Point, stroke: ImageStroke, tolerance: number): boolean {
  const points = stroke.points;
  if (points.length < 2) return false;

  const realWidth = stroke.width *
    (stroke.penStyle === 'marker' ? 3 :
      stroke.penStyle === 'sparkle' ? 1.4 : 1);
  const radius = realWidth / 2 + tolerance;
  for (let i = 2; i < points.length; i += 2) {
    if (pointToSegmentDistance(
      p,
      points[i - 2],
      points[i - 1],
      points[i],
      points[i + 1],
    ) <= radius) return true;
  }
  return Math.hypot(p.x - points[0], p.y - points[1]) <= radius;
}

type Camera = { zoom: number; offset: Point };
const FIT_CAMERA: Camera = { zoom: 1, offset: { x: 0, y: 0 } };

type Gesture = {
  distance: number;
  zoom: number;
  anchorX: number;
  anchorY: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const EDIT_WIDTH_FRACTION = 0.75;

// 操作ハンドルは固定サイズにする。
// Stageの縮小率で割ると巨大化するため禁止。
const HANDLE_SIZE = 18;
const ROTATE_OFFSET = 35;

function limitZoom(value: number) {
  return Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, value),
  );
}

function touchInfo(touches: TouchList) {
  const a = touches[0];
  const b = touches[1];

  if (!a || !b) return null;

  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;

  return {
    distance: Math.hypot(dx, dy),
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}


const LAYER_LABEL: Record<CanvasEl['type'], string> = {
  image: '画像',
  text: '文字',
  sticker: 'スタンプ',
  line: 'ペン',
};

// HTMLのプレビューだけに使う。キャンバスと画像の保存には含めない。
function LayerPreview({ el }: { el: CanvasEl }) {
  const src =
    el.type === 'image' ? el.src :
    el.type === 'sticker' ? el.src : undefined;

  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 9,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        backgroundColor: '#f7eef4',
        backgroundImage:
          'linear-gradient(45deg,#f2e7f0 25%,transparent 25%),' +
          'linear-gradient(-45deg,#f2e7f0 25%,transparent 25%),' +
          'linear-gradient(45deg,transparent 75%,#f2e7f0 75%),' +
          'linear-gradient(-45deg,transparent 75%,#f2e7f0 75%)',
        backgroundSize: '12px 12px',
        backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      ) : el.type === 'text' ? (
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: el.fill,
            maxWidth: '100%',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {el.text.slice(0, 4) || 'T'}
        </span>
      ) : el.type === 'sticker' ? (
        <span style={{ fontSize: 28, lineHeight: 1 }}>
          {el.emoji}
        </span>
      ) : (
        <span
          style={{
            color: el.type === 'line' ? el.color : '#3a2a36',
            opacity: el.opacity,
            fontSize: 32,
            lineHeight: 1,
          }}
        >
          〜
        </span>
      )}
    </div>
  );
}

function FloatingLayers({
  elements,
  selectedId,
}: {
  elements: CanvasEl[];
  selectedId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const reorder = useRef<{ pointerId: number; id: string } | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number; clientX: number; clientY: number; x: number; y: number;
  } | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const positionRef = useRef<Point | null>(null);

  const clampLayerPosition = (x: number, y: number): Point => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return { x, y };
    return {
      x: Math.max(0, Math.min(x, parent.clientWidth - panel.offsetWidth)),
      y: Math.max(0, Math.min(y, parent.clientHeight - panel.offsetHeight)),
    };
  };

  const saveLayerPosition = (point: Point) => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return;
    const w = Math.max(1, parent.clientWidth - panel.offsetWidth);
    const h = Math.max(1, parent.clientHeight - panel.offsetHeight);
    try {
      localStorage.setItem('jomon-pix-floating-layers-v1', JSON.stringify({
        x: Math.max(0, Math.min(1, point.x / w)),
        y: Math.max(0, Math.min(1, point.y / h)),
      }));
    } catch { /* Storage is optional; dragging still works. */ }
  };

  useEffect(() => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return;
    try {
      const data = JSON.parse(localStorage.getItem('jomon-pix-floating-layers-v1') ?? 'null');
      if (data && typeof data.x === 'number' && typeof data.y === 'number' &&
          Number.isFinite(data.x) && Number.isFinite(data.y) &&
          data.x >= 0 && data.x <= 1 && data.y >= 0 && data.y <= 1) {
        const restored = clampLayerPosition(
          data.x * Math.max(0, parent.clientWidth - panel.offsetWidth),
          data.y * Math.max(0, parent.clientHeight - panel.offsetHeight),
        );
        positionRef.current = restored;
        setPosition(restored);
      }
    } catch { /* Invalid stored position: use top right. */ }
    const observer = new ResizeObserver(() => {
      setPosition((current) => {
        if (!current) return current;
        const next = clampLayerPosition(current.x, current.y);
        positionRef.current = next;
        return next.x === current.x && next.y === current.y ? current : next;
      });
    });
    observer.observe(parent);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, elements.some((element) => element.type !== 'line')]);

  // Safari's finger gestures use TouchEvents, while desktop mouse/pen
  // uses PointerEvents. Both move the SAME panel and never drag the image.
  const beginLayerDragAt = (clientX: number, clientY: number, id: number) => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return;
    const rect = panel.getBoundingClientRect();
    const container = parent.getBoundingClientRect();
    const origin = clampLayerPosition(rect.left - container.left, rect.top - container.top);
    dragRef.current = { id, clientX, clientY, x: origin.x, y: origin.y };
  };

  const moveLayerDragTo = (clientX: number, clientY: number, id: number) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;
    const next = clampLayerPosition(
      drag.x + clientX - drag.clientX,
      drag.y + clientY - drag.clientY,
    );
    positionRef.current = next;
    setPosition(next);
  };

  const finishLayerDrag = (id: number) => {
    if (dragRef.current?.id !== id) return;
    dragRef.current = null;
    if (positionRef.current) saveLayerPosition(positionRef.current);
  };

  const startLayerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    // Touch is handled independently to work reliably in Safari / WKWebView.
    if (event.pointerType === 'touch' ||
        (event.pointerType === 'mouse' && event.button !== 0)) return;
    beginLayerDragAt(event.clientX, event.clientY, event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const moveLayerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch') return;
    moveLayerDragTo(event.clientX, event.clientY, event.pointerId);
  };
  const stopLayerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch') return;
    finishLayerDrag(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startTouchDrag = (event: React.TouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    beginLayerDragAt(touch.clientX, touch.clientY, -touch.identifier - 1);
    event.stopPropagation();
  };
  const moveTouchDrag = (event: React.TouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    moveLayerDragTo(touch.clientX, touch.clientY, -touch.identifier - 1);
    event.stopPropagation();
  };
  const stopTouchDrag = (event: React.TouchEvent<HTMLButtonElement>) => {
    for (const touch of Array.from(event.changedTouches)) {
      finishLayerDrag(-touch.identifier - 1);
    }
    event.stopPropagation();
  };

  // Show attached stickers/text separately, not merged into their photo:
  // users must be able to lock the large background while keeping the
  // overlaid sticker independently draggable.
  const ordered = [...elements].filter((el) => el.type !== 'line').reverse();
  const selected = ordered.find((el) => el.id === selectedId);

  const choose = (el: CanvasEl) => {
    const state = useEditor.getState();
    // ペンの線を選んでも描画モードへ戻さない。
    const nextTab =
      el.type === 'image' ? 'edit' :
      el.type === 'text' ? 'text' :
      el.type === 'sticker' ? 'stamp' : 'layer';

    state.setTab(nextTab);
    state.select(el.id);
  };

  const dropTarget = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-layer-row]')?.dataset.layerRow ?? null;
  if (!ordered.length) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: position?.y ?? 8,
        left: position?.x,
        right: position ? undefined : 8,
        zIndex: 8,
        width: open ? 104 : 46,
        maxHeight: 'calc(100% - 72px)',
        display: 'flex',
        flexDirection: 'column',
        padding: 5,
        gap: 5,
        borderRadius: 15,
        background: 'rgba(255,255,255,0.94)',
        boxShadow: '0 4px 18px rgba(80,45,70,0.18)',
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 3, minHeight: 36 }}>
        {!open ? <button type="button" aria-label="レイヤー一覧を開く" aria-expanded={false}
          onClick={() => setOpen(true)} style={{ width: 36, height: 36, border: 0, borderRadius: 9, background: '#fff0f7', color: '#c13781', fontSize: 22 }}>▱</button> : <>
        <button
          type="button"
          aria-label="重なり順パネルを移動"
          title="指でドラッグして移動"
          onPointerDown={startLayerDrag}
          onPointerMove={moveLayerDrag}
          onPointerUp={stopLayerDrag}
          onPointerCancel={stopLayerDrag}
          onTouchStart={startTouchDrag}
          onTouchMove={moveTouchDrag}
          onTouchEnd={stopTouchDrag}
          onTouchCancel={stopTouchDrag}
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            borderRadius: 9,
            padding: '3px 1px',
            background: '#fff0f7',
            color: '#c13781',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <span aria-hidden="true" style={{ display: 'block', fontSize: 18, lineHeight: 1 }}>⠿</span>
          重なり順
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'レイヤー一覧を閉じる' : 'レイヤー一覧を開く'}
          aria-expanded={open}
          style={{
            width: 32,
            flexShrink: 0,
            border: 0,
            borderRadius: 9,
            padding: 0,
            background: '#fff0f7',
            color: '#c13781',
            fontSize: 14,
            fontWeight: 700,
            touchAction: 'manipulation',
          }}
        >
          {open ? '▴' : '▾'}
        </button>
        </>}
      </div>

      {open && (
        <>
          <div
            role="list"
            aria-label="レイヤー一覧（上ほど手前）"
            style={{
              overflowY: 'auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 2,
              scrollbarWidth: 'thin',
              overscrollBehavior: 'contain',
            }}
          >
            {ordered.map((el, index) => {
              const active = el.id === selectedId;
              const name = LAYER_LABEL[el.type];
              const fixed = !!el.transformLocked;
              const lockLabel = el.locked
                ? `${name}${index + 1}は編集ロック中`
                : `${name}${index + 1}の位置とサイズを${fixed ? '解除' : '固定'}`;
              return (
                <div key={el.id} role="listitem" data-layer-row={el.id} style={{
                  position: 'relative',
                  width: '100%',
                  border: active || dropId === el.id ? '2px solid #ff4fa3' : '2px solid transparent',
                  borderRadius: 12,
                  background: active ? '#fff0f7' : 'transparent',
                  opacity: el.hidden ? 0.5 : 1,
                }}>
                  <button
                    type="button"
                    onClick={() => choose(el)}
                    aria-label={`${name}、${index + 1}番目（最前面から）、${el.hidden ? '非表示' : '表示中'}`}
                    aria-pressed={active}
                    title={`${name}を選択`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      width: '100%',
                      border: 0,
                      borderRadius: 10,
                      padding: '4px 1px',
                      background: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    <LayerPreview el={el} />
                    <span style={{
                      fontSize: 9, lineHeight: 1.2,
                      maxWidth: '100%', overflow: 'hidden',
                      whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      color: '#62465a',
                    }}>
                      {index + 1}. {name}
                    </span>
                  </button>
                  <button type="button" aria-label={name + 'の重なり順をドラッグ'}
                    disabled={!!el.locked}
                    onPointerDown={(event) => {
                      if (event.pointerType === 'mouse' && event.button !== 0) return;
                      event.stopPropagation(); event.preventDefault();
                      reorder.current = { pointerId: event.pointerId, id: el.id };
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDropId(el.id);
                    }}
                    onPointerMove={(event) => {
                      if (reorder.current?.pointerId !== event.pointerId) return;
                      event.preventDefault();
                      setDropId(dropTarget(event.clientX, event.clientY));
                    }}
                    onPointerUp={(event) => {
                      const active = reorder.current;
                      if (!active || active.pointerId !== event.pointerId) return;
                      const target = dropTarget(event.clientX, event.clientY);
                      reorder.current = null; setDropId(null);
                      if (target) useEditor.getState().reorderLayer(active.id, target);
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                    onPointerCancel={() => { reorder.current = null; setDropId(null); }}
                    onLostPointerCapture={() => { reorder.current = null; setDropId(null); }}
                    style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 44,
                      border: 0, borderRadius: 6, background: '#fff5fa', color: '#ab4382', fontSize: 20,
                      touchAction: 'none', cursor: 'grab' }}>⠿</button>
                  <button
                    type="button"
                    aria-label={lockLabel}
                    title={el.locked ? '編集ロック中（レイヤー画面で解除）'
                      : fixed ? '位置・サイズ固定を解除' : '位置・サイズを固定'}
                    aria-pressed={fixed || !!el.locked}
                    disabled={!!el.locked}
                    onClick={(event) => {
                      event.stopPropagation();
                      useEditor.getState().update(el.id, { transformLocked: !fixed });
                    }}
                    style={{
                      position: 'absolute', right: 2, top: 2,
                      width: 32, height: 36, padding: 0,
                      display: 'grid', placeItems: 'center',
                      border: fixed || el.locked ? '1px solid #ce3b8e' : '1px solid #e8d4e0',
                      borderRadius: 9,
                      background: fixed || el.locked ? '#f9d5e9' : '#ffffff',
                      fontSize: 15, color: '#a52c73',
                      cursor: el.locked ? 'not-allowed' : 'pointer',
                      touchAction: 'manipulation',
                      boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                    }}
                  >
                    {fixed || el.locked ? '🔒' : '🔓'}
                  </button>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 2,
              borderTop: '1px solid #f2d7e8',
              paddingTop: 4,
            }}
          >
            {([
              ['up', '↑', '手前へ移動'],
              ['down', '↓', '奥へ移動'],
            ] as const).map(([dir, icon, label]) => (
              <button
                type="button"
                key={dir}
                title={label}
                aria-label={label}
                disabled={!selected || !!selected.locked}
                onClick={() => {
                  if (selected && !selected.locked) {
                    useEditor.getState().move(selected.id, dir);
                  }
                }}
                style={{
                  flex: 1,
                  border: 0,
                  borderRadius: 7,
                  minHeight: 40,
                  background: '#f7eef4',
                  fontSize: 17,
                  opacity: !selected || selected.locked ? 0.35 : 1,
                  touchAction: 'manipulation',
                }}
              >
                {icon}
              </button>
            ))}
            <button
              type="button"
              title="レイヤーの詳細設定"
              aria-label="レイヤーの詳細設定"
              onClick={() => useEditor.getState().setTab('layer')}
              style={{
                flex: 1,
                border: 0,
                borderRadius: 7,
                minHeight: 28,
                background: '#f7eef4',
                fontSize: 17,
                touchAction: 'manipulation',
              }}
            >
              ⋯
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Editor() {
  const {
    elements,
    selectedId,
    bgColor,
    sceneBackground,
    socialTemplate,
    canvasWidth,
    canvasHeight,
    tab,
    tool,
    pen,
    select,
    remove,
  } = useEditor();

  const wrap = useRef<HTMLDivElement>(null);
  const sRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const erasing = useRef(false);
  const erasedImage = useRef<string | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  useEffect(() => {
    const alignment = (event: Event) => setGuides((event as CustomEvent<{ x?: number; y?: number }>).detail ?? {});
    const clear = () => setGuides({});
    window.addEventListener('jomon-pix:alignment', alignment);
    window.addEventListener('blur', clear);
    return () => { window.removeEventListener('jomon-pix:alignment', alignment); window.removeEventListener('blur', clear); };
  }, []);
  const gesture = useRef<Gesture | null>(null);

  const [scale, setScale] = useState(0.4);
  const [camera, setCamera] = useState<Camera>(FIT_CAMERA);
  const cameraRef = useRef<Camera>(FIT_CAMERA);
  const { zoom, offset } = camera;
  const pinchSession = useRef(false);
  const viewportRef = useRef({ width: 0, height: 0, scale: 0.4 });
  const hasPhoto = elements.some((el) => el.type === 'image' && !el.hidden);
  const updateCamera = (next: Camera) => {
    const z = limitZoom(next.zoom);
    const v = viewportRef.current;
    const maxX = z === MIN_ZOOM ? 0 : Math.max(0, (canvasWidth * v.scale * z - v.width) / 2);
    const maxY = z === MIN_ZOOM ? 0 : Math.max(0, (canvasHeight * v.scale * z - v.height) / 2);
    const bounded = { zoom: z, offset: {
      x: Math.max(-maxX, Math.min(maxX, next.offset.x)),
      y: Math.max(-maxY, Math.min(maxY, next.offset.y)),
    } };
    cameraRef.current = bounded;
    setCamera((old) => old.zoom === bounded.zoom && old.offset.x === bounded.offset.x && old.offset.y === bounded.offset.y ? old : bounded);
  };

  const [draft, setDraft] = useState<DraftStroke | null>(
    null,
  );

  // ドラッグ中も2本指操作を受け取る
  useEffect(() => {
    const previous = Konva.hitOnDragEnabled;
    Konva.hitOnDragEnabled = true;

    return () => {
      Konva.hitOnDragEnabled = previous;
    };
  }, []);

  // キャンバスの基本表示サイズ
  useEffect(() => {
    const element = wrap.current;
    if (!element) return;

    const resize = () => {
      const { width, height } =
        element.getBoundingClientRect();

      if (width <= 0 || height <= 0) return;

      const availableWidth = Math.max(
        1,
        width - 12,
      );

      const availableHeight = Math.max(
        1,
        height - 12,
      );

      const nextScale = Math.min(
        availableWidth / canvasWidth,
        availableHeight / canvasHeight,
      );

      const fittedScale = Math.max(0.01, nextScale * 0.96);
      const previous = viewportRef.current;
      const current = cameraRef.current;
      // The fit scale changes when the panel opens. Keep the actual displayed
      // canvas size, rather than keeping its old multiplier against a smaller fit.
      const renderedScale = previous.width > 0
        ? previous.scale * current.zoom * (width / previous.width)
        : fittedScale;
      const nextZoom = limitZoom(renderedScale / fittedScale);
      const ratio = (fittedScale * nextZoom) / Math.max(0.0001, previous.scale * current.zoom);
      viewportRef.current = { width, height, scale: fittedScale };
      setScale(fittedScale);
      updateCamera({
        zoom: nextZoom,
        offset: previous.width > 0
          ? { x: current.offset.x * ratio, y: current.offset.y * ratio }
          : { x: 0, y: 0 },
      });
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  // キャンバス比率変更時は全体表示に戻す
  useEffect(() => {
    updateCamera(FIT_CAMERA);
    gesture.current = null;
  }, [canvasWidth, canvasHeight]);

  // Opening a tool makes a portrait canvas large enough for detailed work.
  // Preserve any larger user zoom; only the explicit Fit button shrinks to fit.
  useEffect(() => {
    if (!hasPhoto || tab === 'image' || tab === 'layer') return;
    const v = viewportRef.current;
    if (!v.width || !v.height) return;
    const targetZoom = limitZoom(v.width * EDIT_WIDTH_FRACTION / (canvasWidth * v.scale));
    const c = cameraRef.current;
    if (targetZoom > c.zoom + 0.001) {
      updateCamera({ zoom: targetZoom, offset: { x: 0, y: 0 } });
    }
  }, [tab, hasPhoto, canvasWidth, canvasHeight]);

  // Applying an image effect must not make an enlarged preview suddenly tiny.
  // Recenter the viewport, but keep its current scale and the artwork geometry.
  useEffect(() => {
    const resetView = () => {
      gesture.current = null;
      pinchSession.current = false;
      sRef.current?.setAttr('jomonPinching', false);
      erasing.current = false;
      setDraft(null);
      updateCamera({ zoom: cameraRef.current.zoom, offset: { x: 0, y: 0 } });
      const element = wrap.current;
      if (element) { element.scrollLeft = 0; element.scrollTop = 0; }
    };
    window.addEventListener('jomon-pix:fit-canvas', resetView);
    return () => window.removeEventListener('jomon-pix:fit-canvas', resetView);
  }, [canvasWidth, canvasHeight]);


  // 保存処理で使うStage参照
  useEffect(() => {
    stageRef.current = sRef.current;

    return () => {
      stageRef.current = null;
    };
  });

  // 選択中の要素に編集枠を接続
  useEffect(() => {
    const tr = trRef.current;
    const st = sRef.current;

    if (!tr || !st) return;

    const el = elements.find(
      (item) => item.id === selectedId,
    );

    const canTransform =
      el &&
      tool === 'select' &&
      !el.locked &&
      !el.transformLocked &&
      !el.hidden &&
      el.type !== 'line';

    const node = canTransform
      ? st.findOne('#' + selectedId)
      : null;

    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [
    selectedId,
    elements,
    tool,
    scale,
    canvasWidth,
    canvasHeight,
  ]);

  // キャンバス表示倍率の変更
  const endPinchForControl = () => {
    pinchSession.current = false;
    gesture.current = null;
    sRef.current?.setAttr('jomonPinching', false);
  };
  const changeZoom = (factor: number) => {
    endPinchForControl();
    const c = cameraRef.current;
    const z = limitZoom(c.zoom * factor);
    updateCamera({ zoom: z, offset: { x: c.offset.x * z / c.zoom, y: c.offset.y * z / c.zoom } });
  };

  // 全体表示に戻す
  const fitCanvas = () => {
    endPinchForControl();
    updateCamera(FIT_CAMERA);
  };

  // 2本指操作の開始
  const beginPinch = (touches: TouchList) => {
    const info = touchInfo(touches);
    const element = wrap.current;

    if (!info || !element) return;

    const rect = element.getBoundingClientRect();

    const centerX =
      rect.left + rect.width / 2;

    const centerY =
      rect.top + rect.height / 2;

    const c = cameraRef.current;
    gesture.current = { distance: Math.max(1, info.distance), zoom: c.zoom,
      anchorX: (info.x - centerX - c.offset.x) / c.zoom,
      anchorY: (info.y - centerY - c.offset.y) / c.zoom };

    setDraft(null);
    setGuides({});
    erasing.current = false;
    useEditor.getState().endHistoryGroup();
    erasedImage.current = null;
  };

  // 2本指で拡大縮小・移動
  const movePinch = (touches: TouchList) => {
    const info = touchInfo(touches);
    const g = gesture.current;
    const element = wrap.current;

    if (!info || !g || !element) return;

    const rect = element.getBoundingClientRect();

    const centerX =
      rect.left + rect.width / 2;

    const centerY =
      rect.top + rect.height / 2;

    const nextZoom = limitZoom(
      g.zoom * info.distance / g.distance,
    );

    const nextOffset = {
      x:
        info.x -
        centerX -
        g.anchorX * nextZoom,
      y:
        info.y -
        centerY -
        g.anchorY * nextZoom,
    };

    updateCamera({ zoom: nextZoom, offset: nextOffset });
  };

  // ペンをキャンバスではなく画像のローカル座標へ変換する。
  // 回転・反転・拡大縮小された写真にも正しく描けるようにする。
  const localPoint = (image: ImageEl): Point | null => {
    const stage = sRef.current;
    const node = stage?.findOne('#' + image.id);
    const point = node?.getRelativePointerPosition();
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    return point;
  };

  const editableImages = () => {
    const state = useEditor.getState();
    return state.elements.filter(
      (el): el is ImageEl =>
        el.type === 'image' && !el.hidden && !el.locked,
    );
  };

  const insidePhoto = (image: ImageEl, point: Point) =>
    point.x >= 0 &&
    point.y >= 0 &&
    point.x <= image.width &&
    point.y <= image.height;

  // 選択中の写真を優先。未選択ならタッチ位置にある最前面の写真。
  const imageAtPointer = () => {
    const images = editableImages();
    const state = useEditor.getState();
    const current = state.elements.find((el) => el.id === state.selectedId);
    const linkedImageId =
      current?.type === 'image' ? current.id :
      current && (current.type === 'text' || current.type === 'sticker')
        ? current.parentImageId
        : undefined;
    const selected = images.find((image) => image.id === linkedImageId);
    const candidates = selected ? [selected] : [...images].reverse();
    for (const image of candidates) {
      const point = localPoint(image);
      if (point && insidePhoto(image, point)) return { image, point };
    }
    return null;
  };

  // 消しゴムは選択した写真内の線を1本単位で消す。
  // 旧形式の独立した線も引き続き消せる。
  const eraseAt = () => {
    const target = imageAtPointer();
    if (target) {
      const { image, point } = target;
      const drawings = image.drawings ?? [];
      const nodeScale = sRef.current?.findOne('#' + image.id)?.getAbsoluteScale();
      const screenScale = Math.min(Math.abs(nodeScale?.x ?? scale), Math.abs(nodeScale?.y ?? scale)) * zoom;
      const tolerance = Math.max(1, Math.min(24, 5 / Math.max(0.01, screenScale)));
      for (let i = drawings.length - 1; i >= 0; i--) {
        if (touchesStroke(point, drawings[i], tolerance)) {
          if (erasedImage.current !== image.id) {
            useEditor.getState().beginHistoryGroup(image.id);
            erasedImage.current = image.id;
          }
          useEditor.getState().update(image.id, {
            drawings: drawings.filter((_, index) => index !== i),
          });
          return;
        }
      }
    }

    const stage = sRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;

    const shape = stage.getIntersection(pointer);
    const id = shape?.id();
    const line = useEditor.getState().elements.find(
      (item) => item.id === id && item.type === 'line',
    );
    if (line && !line.locked) remove(line.id);
  };

  const down = (
    e: Konva.KonvaEventObject<
      MouseEvent | TouchEvent
    >,
  ) => {
    const stage = sRef.current;
    if (!stage || gesture.current) return;

    if (tool === 'pen') {
      const target = imageAtPointer();
      if (!target) return;
      const { image, point } = target;

      // 画像を選択してから描くので、どの写真に付くか明確になる。
      if (useEditor.getState().selectedId !== image.id) {
        select(image.id);
      }
      setDraft({
        imageId: image.id,
        stroke: {
          id: newId(),
          points: [point.x, point.y, point.x + 0.1, point.y],
          color: pen.color,
          width: pen.width,
          penStyle: pen.style,
          opacity: pen.opacity,
        },
      });
    } else if (tool === 'eraser') {
      erasing.current = true;
      erasedImage.current = null;
      // A second finger may be about to start a pinch. Erase on move/up, not touch-down.
    } else if (
      e.target === stage ||
      e.target.name() === 'bg'
    ) {
      select(null);
    }
  };

  const moveH = () => {
    if (gesture.current) return;
    if (tool === 'pen' && draft) {
      const image = useEditor.getState().elements.find(
        (item): item is ImageEl =>
          item.id === draft.imageId && item.type === 'image',
      );
      if (!image) return;
      const point = localPoint(image);
      if (!point) return;
      // 写真から指が出ても境界で止める。
      const x = Math.max(0, Math.min(image.width, point.x));
      const y = Math.max(0, Math.min(image.height, point.y));
      setDraft((previous) =>
        previous && previous.imageId === image.id
          ? {
              ...previous,
              stroke: {
                ...previous.stroke,
                points: [...previous.stroke.points, x, y],
              },
            }
          : previous,
      );
    } else if (tool === 'eraser' && erasing.current) {
      eraseAt();
    }
  };

  const up = () => {
    if (erasing.current && !gesture.current && !erasedImage.current) eraseAt();
    erasing.current = false;
    if (erasedImage.current) useEditor.getState().endHistoryGroup();
    erasedImage.current = null;
    if (gesture.current) {
      setDraft(null);
      return;
    }

    if (draft && draft.stroke.points.length >= 4) {
      const image = useEditor.getState().elements.find(
        (item): item is ImageEl =>
          item.id === draft.imageId && item.type === 'image',
      );
      if (image && !image.hidden && !image.locked) {
        useEditor.getState().update(image.id, {
          drawings: [...(image.drawings ?? []), draft.stroke],
        });
      }
    }
    setDraft(null);
  };
  // Multi-touch belongs to the viewport, not Konva's element drag handlers.
  useEffect(() => {
    const element = wrap.current;
    const stage = sRef.current;
    if (!element || !stage) return;
    const stopElementManipulation = () => {
      stage.setAttr('jomonPinching', true);
      if (trRef.current?.isTransforming()) trRef.current.stopTransform();
      for (const item of useEditor.getState().elements) {
        const node = stage.findOne('#' + item.id);
        if (!node) continue;
        if (node.isDragging() || node.draggable()) node.stopDrag();
        node.position({ x: item.x, y: item.y });
        node.rotation(item.rotation);
        node.scale({ x: item.scaleX, y: item.scaleY });
      }
      stage.batchDraw();
    };
    const intercept = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    };
    const start = (event: TouchEvent) => {
      // A stale pinch must not swallow a subsequent tap on the zoom toolbar.
      if (event.touches.length === 1 && event.target instanceof Element &&
          event.target.closest('button')) {
        endPinchForControl();
        return;
      }
      if (event.touches.length < 2 && !pinchSession.current) return;
      intercept(event);
      if (!pinchSession.current) {
        pinchSession.current = true;
        stopElementManipulation();
      }
      if (event.touches.length >= 2 && !gesture.current) beginPinch(event.touches);
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length < 2 && !pinchSession.current) return;
      intercept(event);
      if (!pinchSession.current) {
        pinchSession.current = true;
        stopElementManipulation();
      }
      if (event.touches.length >= 2) {
        if (!gesture.current) beginPinch(event.touches);
        else movePinch(event.touches);
      }
    };
    const finish = (event: TouchEvent) => {
      if (!pinchSession.current) return;
      intercept(event);
      if (event.touches.length < 2) gesture.current = null;
      if (event.touches.length === 0) {
        pinchSession.current = false;
        stage.setAttr('jomonPinching', false);
        setDraft(null); setGuides({}); erasing.current = false;
      }
    };
    const cancel = (event: TouchEvent) => {
      if (!pinchSession.current) return;
      intercept(event);
      gesture.current = null; pinchSession.current = false;
      stage.setAttr('jomonPinching', false);
      setDraft(null); erasing.current = false;
    };
    const options = { capture: true, passive: false };
    const outsideEnd = (event: TouchEvent) => {
      if (pinchSession.current && event.touches.length === 0 &&
          event.target instanceof Node && !element.contains(event.target)) {
        endPinchForControl();
      }
    };
    const blur = () => endPinchForControl();
    window.addEventListener('touchend', outsideEnd, true);
    window.addEventListener('touchcancel', outsideEnd, true);
    window.addEventListener('blur', blur);
    element.addEventListener('touchstart', start, options);
    element.addEventListener('touchmove', move, options);
    element.addEventListener('touchend', finish, options);
    element.addEventListener('touchcancel', cancel, options);
    return () => {
      window.removeEventListener('touchend', outsideEnd, true);
      window.removeEventListener('touchcancel', outsideEnd, true);
      window.removeEventListener('blur', blur);
      element.removeEventListener('touchstart', start, true);
      element.removeEventListener('touchmove', move, true);
      element.removeEventListener('touchend', finish, true);
      element.removeEventListener('touchcancel', cancel, true);
      stage.setAttr('jomonPinching', false);
      gesture.current = null; pinchSession.current = false;
    };
  }, [canvasWidth, canvasHeight]);

  const onTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!pinchSession.current && e.evt.touches.length === 1) down(e);
  };
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!pinchSession.current && e.evt.touches.length === 1) moveH();
  };
  const onTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!pinchSession.current && e.evt.touches.length === 0) up();
  };
  const onTouchCancel = () => {
    gesture.current = null;
    erasing.current = false;
    if (erasedImage.current) useEditor.getState().endHistoryGroup();
    erasedImage.current = null;
    setDraft(null);
    setGuides({});
  };

  const displayWidth = canvasWidth * scale;
  const displayHeight = canvasHeight * scale;

  const zoomButtonStyle = {
    width: 42,
    height: 42,
    padding: 0,
    border: '1px solid #f2d7e8',
    borderRadius: 11,
    background: 'rgba(255,255,255,0.95)',
    color: '#3a2a36',
    fontSize: 17,
    fontWeight: 700,
    boxShadow:
      '0 2px 8px rgba(0,0,0,0.08)',
    touchAction: 'manipulation' as const,
  };

  return (
    <div
      className="stage-wrap"
      ref={wrap}
      style={{
        position: 'relative',
        overflow: 'clip',
        minWidth: 0,
        touchAction: 'none',
      }}
    >
      <div
        className="stage-card"
        style={{
          width: displayWidth,
          height: displayHeight,
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: offset.x - displayWidth / 2,
          marginTop: offset.y - displayHeight / 2,
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <Stage
          ref={sRef}
          width={displayWidth}
          height={displayHeight}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={down}
          onMouseMove={moveH}
          onMouseUp={up}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
          style={{
            touchAction: 'none',
          }}
        >
          <Layer>
            <Rect
              name="bg"
              width={canvasWidth}
              height={canvasHeight}
              fill={bgColor}
            />
            <SceneBackdrop scene={sceneBackground} width={canvasWidth} height={canvasHeight} />

            {elements.map((el) => {
              // 子レイヤーは親写真のKonva.Group内で描画する。
              // 親が存在しない古いデータは、消さずに単独表示する。
              if (
                (el.type === 'sticker' || el.type === 'text') &&
                el.parentImageId &&
                elements.some((candidate) =>
                  candidate.type === 'image' &&
                  candidate.id === el.parentImageId,
                )
              ) return null;

              const attached = el.type === 'image'
                ? elements.filter((candidate) =>
                    (candidate.type === 'sticker' || candidate.type === 'text') &&
                    candidate.parentImageId === el.id,
                  )
                : [];

              return (
                <ElementNode
                  key={el.id}
                  el={el}
                  attached={attached}
                  draft={el.type === 'image' && draft?.imageId === el.id
                    ? draft.stroke : undefined}
                />
              );
            })}

            <SocialOverlay kind={socialTemplate} width={canvasWidth} height={canvasHeight} />

            <Transformer
              ref={trRef}
              keepRatio
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
              ]}
              rotateEnabled
              rotateAnchorOffset={ROTATE_OFFSET}
              anchorSize={HANDLE_SIZE}
              anchorCornerRadius={HANDLE_SIZE / 2}
              anchorStroke="#ff4fa3"
              anchorFill="#ffffff"
              borderStroke="#ff4fa3"
              borderDash={[6, 4]}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 20 ||
                Math.abs(newBox.height) < 20
                  ? oldBox
                  : newBox
              }
            />
          </Layer>
        </Stage>
        {(guides.x !== undefined || guides.y !== undefined) && <svg aria-hidden="true"
          viewBox={'0 0 ' + canvasWidth + ' ' + canvasHeight} preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {guides.x !== undefined && <line x1={guides.x} y1={0} x2={guides.x} y2={canvasHeight} stroke="#ff4fa3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
          {guides.y !== undefined && <line x1={0} y1={guides.y} x2={canvasWidth} y2={guides.y} stroke="#ff4fa3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
        </svg>}
      </div>

      {tool === 'select' && (
        <FloatingLayers
          elements={elements}
          selectedId={selectedId}
        />
      )}

      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          zIndex: 5,
          display: 'flex',
          gap: 5,
          padding: 5,
          borderRadius: 15,
          background: 'rgba(255,246,251,0.9)',
          boxShadow:
            '0 3px 14px rgba(0,0,0,0.08)',
        }}
      >
        <button
          type="button"
          style={zoomButtonStyle}
          onClick={() => changeZoom(1.25)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="拡大"
        >
          ＋
        </button>

        <button
          type="button"
          style={zoomButtonStyle}
          onClick={() => changeZoom(0.8)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="縮小"
        >
          −
        </button>

        <button
          type="button"
          style={zoomButtonStyle}
          onClick={fitCanvas}
          aria-label="全体表示"
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
