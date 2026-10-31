import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { Image as KImage, Text, Line } from 'react-konva';
import useImage from 'use-image';
import { useEditor } from '../store';
import { penProps } from '../lib/pens';
import type { CanvasEl, FilterPreset, ImageEl, Tab } from '../types';

const PRESETS: Record<FilterPreset, { filters: any[]; props: Record<string, number> }> = {
  none: { filters: [], props: {} },
  vivid: { filters: [Konva.Filters.HSL, Konva.Filters.Contrast], props: { saturation: 0.6, contrast: 15 } },
  mono: { filters: [Konva.Filters.Grayscale], props: {} },
  sepia: { filters: [Konva.Filters.Sepia], props: {} },
  soft: { filters: [Konva.Filters.Brighten, Konva.Filters.Blur], props: { brightness: 0.08, blurRadius: 1 } },
  cool: { filters: [Konva.Filters.RGB], props: { red: 200, green: 225, blue: 255 } },
};

const TAB_OF: Record<CanvasEl['type'], Tab> = { image: 'edit', text: 'text', sticker: 'edit', line: 'pen' };

function useCommon(el: CanvasEl) {
  const { select, update, tool, setTab } = useEditor();
  const canMove = tool === 'select' && !el.locked;
  return {
    id: el.id,
    x: el.x, y: el.y, rotation: el.rotation,
    scaleX: el.scaleX, scaleY: el.scaleY, opacity: el.opacity,
    draggable: canMove,
    listening: tool !== 'pen',
    onClick: () => { if (tool === 'select') { select(el.id); setTab(TAB_OF[el.type]); } },
    onTap: () => { if (tool === 'select') { select(el.id); setTab(TAB_OF[el.type]); } },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => update(el.id, { x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      update(el.id, { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() });
    },
  };
}

function ImageNode({ el }: { el: ImageEl }) {
  const [img] = useImage(el.src, 'anonymous');
  const ref = useRef<Konva.Image>(null);
  const common = useCommon(el);
  const p = PRESETS[el.filter];
  useEffect(() => {
    const n = ref.current;
    if (!n || !img) return;
    if (el.filter === 'none') n.clearCache();
    else n.cache({ pixelRatio: 2 });
    n.getLayer()?.batchDraw();
  }, [img, el.filter, el.width, el.height]);
  return <KImage ref={ref} image={img} width={el.width} height={el.height} filters={p.filters} {...p.props} {...common} />;
}

export function ElementNode({ el }: { el: CanvasEl }) {
  const common = useCommon(el);
  const textRef = useRef<Konva.Text>(null);
  const update = useEditor((s) => s.update);

  const family = el.type === 'text' ? el.fontFamily : '';
  useEffect(() => {
    if (!family) return;
    document.fonts?.load(`40px "${family}"`).then(() => textRef.current?.getLayer()?.batchDraw());
  }, [family]);

  if (el.hidden) return null;

  if (el.type === 'image') return <ImageNode el={el} />;

  if (el.type === 'sticker')
    return <Text text={el.emoji} fontSize={el.size} {...common} />;

  if (el.type === 'line') return <Line {...penProps(el)} {...common} draggable={false} />;

  const shown = el.vertical ? el.text.split('\n').map((l) => [...l].join('\n')).join('\n\n') : el.text;
  return (
    <Text
      ref={textRef}
      text={shown}
      fontFamily={el.fontFamily}
      fontSize={el.fontSize}
      fill={el.fill}
      stroke={el.stroke || undefined}
      strokeWidth={el.stroke ? el.strokeWidth : 0}
      fillAfterStrokeEnabled
      lineJoin="round"
      letterSpacing={el.letterSpacing}
      align={el.align}
      lineHeight={el.vertical ? 1.05 : 1.25}
      shadowColor={el.glow || undefined}
      shadowBlur={el.glow ? 22 : 0}
      shadowOpacity={el.glow ? 1 : 0}
      onDblClick={() => { const t = prompt('文字を入力', el.text); if (t != null) update(el.id, { text: t }); }}
      onDblTap={() => { const t = prompt('文字を入力', el.text); if (t != null) update(el.id, { text: t }); }}
      {...common}
    />
  );
}
