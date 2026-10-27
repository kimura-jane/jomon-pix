import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva';
import Konva from 'konva';
import { useEditor } from '../store';
import { stageRef, CANVAS_W, CANVAS_H } from '../lib/stageRef';
import { penProps } from '../lib/pens';
import { newId } from '../lib/factory';
import { ElementNode } from './ElementNode';
import type { LineEl } from '../types';

type KEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;

export function Editor() {
  const elements = useEditor((s) => s.elements);
  const selectedId = useEditor((s) => s.selectedId);
  const bgColor = useEditor((s) => s.bgColor);
  const tool = useEditor((s) => s.tool);

  const trRef = useRef<Konva.Transformer>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [draft, setDraft] = useState<LineEl | null>(null);
  const draftRef = useRef<LineEl | null>(null);
  const isDown = useRef(false);

  // 画面サイズに合わせてキャンバスを縮める
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const s = Math.min(1, (wrap.clientWidth - 16) / CANVAS_W, (wrap.clientHeight - 16) / CANVAS_H);
      setScale(Math.max(0.2, s));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // 選んだ部品に変形ハンドルを付ける
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = tool === 'select' && selectedId ? stage.findOne('#' + selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, tool]);

  const setDraftBoth = (d: LineEl | null) => {
    draftRef.current = d;
    setDraft(d);
  };

  const eraseAt = () => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!stage || !pos) return;
    const shape = stage.getIntersection(pos);
    if (shape && shape.name() === 'line') useEditor.getState().remove(shape.id());
  };

  const onDown = (e: KEvent) => {
    const { tool, pen, select } = useEditor.getState();
    if (tool === 'select') {
      if (e.target === e.target.getStage()) select(null);
      return;
    }
    isDown.current = true;
    if (tool === 'eraser') {
      eraseAt();
      return;
    }
    const pos = e.target.getStage()?.getRelativePointerPosition();
    if (!pos) return;
    setDraftBoth({
      id: newId(),
      type: 'line',
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      points: [pos.x, pos.y, pos.x, pos.y],
      penStyle: pen.style,
      color: pen.color,
      width: pen.width,
    });
  };

  const onMove = (e: KEvent) => {
    if (!isDown.current) return;
    e.evt.preventDefault();
    if (useEditor.getState().tool === 'eraser') {
      eraseAt();
      return;
    }
    const pos = e.target.getStage()?.getRelativePointerPosition();
    const d = draftRef.current;
    if (!pos || !d) return;
    setDraftBoth({ ...d, points: [...d.points, pos.x, pos.y] });
  };

  const onUp = () => {
    isDown.current = false;
    const d = draftRef.current;
    if (d) {
      useEditor.getState().add(d, false);
      setDraftBoth(null);
    }
  };

  return (
    <div className="canvas-wrap" ref={wrapRef} style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}>
      <Stage
        width={CANVAS_W * scale}
        height={CANVAS_H * scale}
        scaleX={scale}
        scaleY={scale}
        ref={(n) => {
          stageRef.current = n;
        }}
        onMouseDown={onDown}
        onTouchStart={onDown}
        onMouseMove={onMove}
        onTouchMove={onMove}
        onMouseUp={onUp}
        onTouchEnd={onUp}
        onMouseLeave={onUp}
      >
        <Layer>
          <Rect width={CANVAS_W} height={CANVAS_H} fill={bgColor} listening={false} />
          {elements.map((el) => (
            <ElementNode key={el.id} el={el} />
          ))}
          {draft && <Line {...penProps(draft)} listening={false} />}
          <Transformer
            ref={trRef}
            keepRatio
            anchorSize={14}
            anchorCornerRadius={7}
            borderStroke="#ff4fa3"
            anchorStroke="#ff4fa3"
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 || newBox.height < 20 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
    </div>
  );
}
