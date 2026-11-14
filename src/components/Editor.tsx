
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

function touchesStroke(p: Point, stroke: ImageStroke): boolean {
  const points = stroke.points;
  if (points.length < 2) return false;

  const realWidth = stroke.width *
    (stroke.penStyle === 'marker' ? 3 :
      stroke.penStyle === 'sparkle' ? 1.4 : 1);
  const radius = realWidth / 2 + 9;
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

type Gesture = {
  distance: number;
  zoom: number;
  anchorX: number;
  anchorY: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

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
  const [open, setOpen] = useState(true);
  // ペンは写真の内部データ。旧形式の独立した線も一覧に載せない。
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

  if (!ordered.length) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 8,
        width: 72,
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'レイヤー一覧を閉じる' : 'レイヤー一覧を開く'}
        aria-expanded={open}
        title={open ? 'レイヤーを閉じる' : 'レイヤーを開く'}
        style={{
          border: 0,
          borderRadius: 9,
          minHeight: 28,
          padding: '4px 2px',
          background: '#fff0f7',
          color: '#d63383',
          fontSize: 10,
          fontWeight: 700,
          touchAction: 'manipulation',
        }}
      >
        {open ? '重なり順 ▴' : 'レイヤー ▾'}
      </button>

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
              return (
                <button
                  type="button"
                  role="listitem"
                  key={el.id}
                  onClick={() => choose(el)}
                  aria-label={`${name}、${index + 1}番目（最前面から）、${el.hidden ? '非表示' : '表示中'}`}
                  aria-pressed={active}
                  title={`${index === 0 ? '最前面' : `前から${index + 1}番目`}・${name}${el.locked ? '・ロック中' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    width: '100%',
                    border: active ? '2px solid #ff4fa3' : '2px solid transparent',
                    borderRadius: 12,
                    padding: '3px 1px',
                    background: active ? '#fff0f7' : 'transparent',
                    opacity: el.hidden ? 0.45 : 1,
                    touchAction: 'manipulation',
                  }}
                >
                  <LayerPreview el={el} />
                  <span
                    style={{
                      fontSize: 9,
                      lineHeight: 1.2,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {el.locked ? '🔒 ' : ''}{index + 1}. {name}
                  </span>
                </button>
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
                  minHeight: 28,
                  background: '#f7eef4',
                  fontSize: 17,
                  opacity: !selected || selected.locked ? 0.35 : 1,
                  touchAction: 'manipulation',
                }}
              >
                {icon}
              </button>
            ))}
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
    canvasWidth,
    canvasHeight,
    tool,
    pen,
    select,
    remove,
  } = useEditor();

  const wrap = useRef<HTMLDivElement>(null);
  const sRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const erasing = useRef(false);
  const gesture = useRef<Gesture | null>(null);

  const [scale, setScale] = useState(0.4);
  const [zoom, setZoom] = useState(1);

  const [offset, setOffset] = useState<Point>({
    x: 0,
    y: 0,
  });

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

      setScale(
        Math.max(0.01, nextScale * 0.96),
      );
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  // キャンバス比率変更時は全体表示に戻す
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    gesture.current = null;
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
  const changeZoom = (amount: number) => {
    setZoom((current) =>
      limitZoom(
        Math.round(
          (current + amount) * 100,
        ) / 100,
      ),
    );
  };

  // 全体表示に戻す
  const fitCanvas = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    gesture.current = null;
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

    gesture.current = {
      distance: Math.max(1, info.distance),
      zoom,
      anchorX:
        (info.x - centerX - offset.x) / zoom,
      anchorY:
        (info.y - centerY - offset.y) / zoom,
    };

    setDraft(null);
    erasing.current = false;
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

    setZoom(nextZoom);
    setOffset(nextOffset);
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
      for (let i = drawings.length - 1; i >= 0; i--) {
        if (touchesStroke(point, drawings[i])) {
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
      eraseAt();
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
    erasing.current = false;
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
  const onTouchStart = (
    e: Konva.KonvaEventObject<TouchEvent>,
  ) => {
    if (e.evt.touches.length >= 2) {
      if (e.evt.cancelable) {
        e.evt.preventDefault();
      }

      if (!gesture.current) {
        beginPinch(e.evt.touches);
      }

      return;
    }

    if (!gesture.current) {
      down(e);
    }
  };

  const onTouchMove = (
    e: Konva.KonvaEventObject<TouchEvent>,
  ) => {
    if (e.evt.touches.length >= 2) {
      if (e.evt.cancelable) {
        e.evt.preventDefault();
      }

      if (!gesture.current) {
        beginPinch(e.evt.touches);
      } else {
        movePinch(e.evt.touches);
      }

      return;
    }

    if (!gesture.current) {
      moveH();
    }
  };

  const onTouchEnd = (
    e: Konva.KonvaEventObject<TouchEvent>,
  ) => {
    if (gesture.current) {
      if (e.evt.touches.length < 2) {
        gesture.current = null;
        erasing.current = false;
        setDraft(null);
      }

      return;
    }

    if (e.evt.touches.length === 0) {
      up();
    }
  };

  const onTouchCancel = () => {
    gesture.current = null;
    erasing.current = false;
    setDraft(null);
  };

  const displayWidth = canvasWidth * scale;
  const displayHeight = canvasHeight * scale;

  const zoomButtonStyle = {
    width: 34,
    height: 34,
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
        overflow: 'hidden',
      }}
    >
      <div
        className="stage-card"
        style={{
          width: displayWidth,
          height: displayHeight,
          flexShrink: 0,
          transform:
            `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
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
          onClick={() => changeZoom(0.25)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="拡大"
        >
          ＋
        </button>

        <button
          type="button"
          style={zoomButtonStyle}
          onClick={() => changeZoom(-0.25)}
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
