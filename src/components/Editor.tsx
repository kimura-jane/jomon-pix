
import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
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

  const [scale, setScale] = useState(0.4);
  const [draft, setDraft] = useState<number[] | null>(null);

  // キャンバスを画面の大きさに合わせて表示
  useEffect(() => {
    const element = wrap.current;
    if (!element) return;

    const resize = () => {
      const { width, height } = element.getBoundingClientRect();

      if (width <= 0 || height <= 0) return;

      const availableWidth = Math.max(1, width - 12);
      const availableHeight = Math.max(1, height - 12);

      const nextScale = Math.min(
        availableWidth / canvasWidth,
        availableHeight / canvasHeight,
      );

      setScale(Math.max(0.01, nextScale * 0.96));
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    stageRef.current = sRef.current;

    return () => {
      if (stageRef.current === sRef.current) {
        stageRef.current = null;
      }
    };
  });

  // 選んだ写真・文字などに編集枠を表示
  useEffect(() => {
    const tr = trRef.current;
    const st = sRef.current;

    if (!tr || !st) return;

    const el = elements.find((e) => e.id === selectedId);

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
  }, [selectedId, elements, tool, scale, canvasWidth, canvasHeight]);

  // ペンの線を消す
  const eraseAt = () => {
    const st = sRef.current;
    const p = st?.getPointerPosition();

    if (!st || !p) return;

    const shape = st.getIntersection(p);
    const id = shape?.id();

    const el = elements.find((e) => e.id === id);

    if (el?.type === 'line' && !el.locked) {
      remove(el.id);
    }
  };

  // タップ・描き始め
  const down = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const st = sRef.current;
    if (!st) return;

    if (tool === 'pen') {
      const p = st.getRelativePointerPosition();

      if (p) {
        setDraft([p.x, p.y, p.x + 0.1, p.y]);
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

  // ペンを動かす
  const moveH = () => {
    const st = sRef.current;
    if (!st) return;

    if (tool === 'pen' && draft) {
      const p = st.getRelativePointerPosition();

      if (p) {
        setDraft([...draft, p.x, p.y]);
      }
    } else if (
      tool === 'eraser' &&
      erasing.current
    ) {
      eraseAt();
    }
  };

  // 描き終わり
  const up = () => {
    erasing.current = false;

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

  const displayWidth = canvasWidth * scale;
  const displayHeight = canvasHeight * scale;

  return (
    <div className="stage-wrap" ref={wrap}>
      <div
        className="stage-card"
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      >
        <Stage
          ref={sRef}
          width={displayWidth}
          height={displayHeight}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={down}
          onTouchStart={down}
          onMouseMove={moveH}
          onTouchMove={moveH}
          onMouseUp={up}
          onTouchEnd={up}
          onTouchCancel={up}
          style={{ touchAction: 'none' }}
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
              rotateAnchorOffset={30}
              anchorSize={12}
              anchorCornerRadius={6}
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
    </div>
  );
}
