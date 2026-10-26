import { useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import Konva from 'konva';
import { useEditor } from '../store';
import { stageRef } from '../lib/stageRef';
import { ElementNode } from './ElementNode';

const W = 800;
const H = 800;

export function Editor() {
  const elements = useEditor((s) => s.elements);
  const selectedId = useEditor((s) => s.selectedId);
  const bgColor = useEditor((s) => s.bgColor);
  const select = useEditor((s) => s.select);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId ? stage.findOne('#' + selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  const deselect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) select(null);
  };

  return (
    <Stage
      width={W}
      height={H}
      ref={(n) => { stageRef.current = n; }}
      onMouseDown={deselect}
      onTouchStart={deselect}
    >
      <Layer>
        <Rect width={W} height={H} fill={bgColor} listening={false} />
        {elements.map((el) => (
          <ElementNode key={el.id} el={el} />
        ))}
        <Transformer
          ref={trRef}
          keepRatio
          anchorSize={10}
          anchorCornerRadius={5}
          borderStroke="#ff4fa3"
          anchorStroke="#ff4fa3"
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      </Layer>
    </Stage>
  );
}
