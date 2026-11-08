
import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import {
  Stage,
  Layer,
  Rect,
  Line,
  Transformer,
} from 'react-konva';
import { useEditor, newId } from '../store';
import { ElementNode } from './ElementNode';
import { penProps } from '../lib/pens';
import { stageRef } from '../lib/stageRef';

type Point = {
  x: number;
  y: number;
};

type Gesture = {
  distance: number;
  zoom: number;
  anchorX: number;
  anchorY: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

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
    add,
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

  const [draft, setDraft] = useState<number[] | null>(
    null,
  );

  // ドラッグ中も2本指の動きを受け取る
  useEffect(() => {
    const previous = Konva.hitOnDragEnabled;
    Konva.hitOnDragEnabled = true;

    return () => {
      Konva.hitOnDragEnabled = previous;
    };
  }, []);

  // キャンバスの基本表示サイズを計算
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

  // 保存用のStage参照
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

  // 画面上で指でつかみやすい大きさに調整
  // KonvaのStage拡大率とCSSズームの両方を考慮
  const visibleScale = Math.max(
    0.05,
    scale * zoom,
  );

  // 画面上で約26pxの操作点を目標とする
  const anchorSize = Math.max(
    18,
    Math.min(
      170,
      Math.round(26 / visibleScale),
    ),
  );

  // 回転ハンドルと要素の間隔
  const rotateAnchorOffset = Math.max(
    34,
    Math.min(
      200,
      Math.round(38 / visibleScale),
    ),
  );

  // 拡大・縮小ボタン
  const changeZoom = (amount: number) => {
    setZoom((current) =>
      limitZoom(
        Math.round(
          (current + amount) * 100,
        ) / 100,
      ),
    );
  };

  // 全体表示
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

  // 消しゴム
  const eraseAt = () => {
    const st = sRef.current;
    const p = st?.getPointerPosition();

    if (!st || !p) return;

    const shape = st.getIntersection(p);
    const id = shape?.id();

    const el = elements.find(
      (item) => item.id === id,
    );

    if (
      el?.type === 'line' &&
      !el.locked
    ) {
      remove(el.id);
    }
  };

  // ペン・消しゴム・選択操作
  const down = (
    e: Konva.KonvaEventObject<
      MouseEvent | TouchEvent
    >,
  ) => {
    const st = sRef.current;

    if (!st || gesture.current) return;

    if (tool === 'pen') {
      const p = st.getRelativePointerPosition();

      if (p) {
        setDraft([
          p.x,
          p.y,
          p.x + 0.1,
          p.y,
        ]);
      }
    } else if (tool === 'eraser') {
      erasing.current = true;
      eraseAt();
    } else if (
      e.target === st ||
      e.target.name() === 'bg'
    ) {
      select(null);
    }
  };

  const moveH = () => {
    if (gesture.current) return;

    const st = sRef.current;
    if (!st) return;

    if (tool === 'pen' && draft) {
      const p = st.getRelativePointerPosition();

      if (p) {
        setDraft((previous) =>
          previous
            ? [...previous, p.x, p.y]
            : null,
        );
      }
    } else if (
      tool === 'eraser' &&
      erasing.current
    ) {
      eraseAt();
    }
  };

  const up = () => {
    erasing.current = false;

    if (gesture.current) {
      setDraft(null);
      return;
    }

    if (draft && draft.length > 2) {
      add({
        id: newId(),
        type: 'line',
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        points: draft,
        color: pen.color,
        width: pen.width,
        penStyle: pen.style,
      });
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

            {elements.map((el) => (
              <ElementNode
                key={el.id}
                el={el}
              />
            ))}

            {draft && (
              <Line
                {...penProps({
                  points: draft,
                  color: pen.color,
                  width: pen.width,
                  penStyle: pen.style,
                })}
                listening={false}
              />
            )}

            <Transformer
              ref={trRef}
              keepRatio
              // 四隅だけを使い、操作点の重なりを減らす
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
              ]}
              rotateEnabled
              rotateAnchorOffset={rotateAnchorOffset}
              anchorSize={anchorSize}
              anchorCornerRadius={anchorSize / 2}
              anchorStroke="#ff4fa3"
              anchorFill="#fff"
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
