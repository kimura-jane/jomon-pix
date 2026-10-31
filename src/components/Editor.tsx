import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva';
import { useEditor, newId } from '../store';
import { ElementNode } from './ElementNode';
import { penProps } from '../lib/pens';
import { CANVAS_W, CANVAS_H, stageRef } from '../lib/stageRef';

export function Editor() {
  const { elements, selectedId, bgColor, tool, pen, select, add, remove } = useEditor();
  const wrap = useRef<HTMLDivElement>(null);
  const sRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [scale, setScale] = useState(0.4);
  const [draft, setDraft] = useState<number[] | null>(null);
  const erasing = useRef(false);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setScale(Math.max(0.1, Math.min(width / CANVAS_W, height / CANVAS_H) * 0.96));
    });
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { stageRef.current = sRef.current; });

  useEffect(() => {
    const tr = trRef.current, st = sRef.current;
    if (!tr || !st) return;
    const el = elements.find((e) => e.id === selectedId);
    const ok = el && tool === 'select' && !el.locked && !el.hidden && el.type !== 'line';
    const node = ok ? st.findOne('#' + selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, tool]);

  const eraseAt = () => {
    const st = sRef.current;
    const p = st?.getPointerPosition();
    if (!st || !p) return;
    const shape = st.getIntersection(p);
    const id = shape?.id();
    const el = elements.find((e) => e.id === id);
    if (el?.type === 'line' && !el.locked) remove(el.id);
  };

  const down = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const st = sRef.current!;
    if (tool === 'pen') {
      const p = st.getRelativePointerPosition();
      if (p) setDraft([p.x, p.y, p.x + 0.1, p.y]);
    } else if (tool === 'eraser') {
      erasing.current = true;
      eraseAt();
    } else if (e.target === st || e.target.name() === 'bg') {
      select(null);
    }
  };
  const moveH = () => {
    if (tool === 'pen' && draft) {
      const p = sRef.current!.getRelativePointerPosition();
      if (p) setDraft([...draft, p.x, p.y]);
    } else if (tool === 'eraser' && erasing.current) eraseAt();
  };
  const up = () => {
    erasing.current = false;
    if (draft && draft.length > 2) {
      add({
        id: newId(), type: 'line', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        points: draft, color: pen.color, width: pen.width, penStyle: pen.style,
      });
    }
    setDraft(null);
  };

  return (
    <div className="stage-wrap" ref={wrap}>
      <div className="stage-card" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
        <Stage
          ref={sRef}
          width={CANVAS_W * scale}
          height={CANVAS_H * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={down}
          onTouchStart={down}
          onMouseMove={moveH}
          onTouchMove={moveH}
          onMouseUp={up}
          onTouchEnd={up}
          style={{ touchAction: 'none' }}
        >
          <Layer>
            <Rect name="bg" width={CANVAS_W} height={CANVAS_H} fill={bgColor} />
            {elements.map((el) => <ElementNode key={el.id} el={el} />)}
            {draft && <Line {...penProps({ points: draft, color: pen.color, width: pen.width, penStyle: pen.style })} listening={false} />}
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
              boundBoxFunc={(o, n) => (Math.abs(n.width) < 20 || Math.abs(n.height) < 20 ? o : n)}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
