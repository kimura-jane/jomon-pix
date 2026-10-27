import { useEffect, useRef } from 'react';
import { Image as KImage, Text as KText, Line } from 'react-konva';
import Konva from 'konva';
import type { ImageConfig } from 'konva/lib/shapes/Image';
import useImage from 'use-image';
import { useEditor } from '../store';
import { penProps } from '../lib/pens';
import type { CanvasEl, FilterPreset, ImageEl, TextEl } from '../types';

export const PRESETS: Record<FilterPreset, Partial<ImageConfig>> = {
  none: { filters: [] },
  vivid: { filters: [Konva.Filters.HSL, Konva.Filters.Contrast], saturation: 0.6, contrast: 15 },
  mono: { filters: [Konva.Filters.Grayscale] },
  sepia: { filters: [Konva.Filters.Sepia] },
  soft: { filters: [Konva.Filters.Brighten, Konva.Filters.Blur], brightness: 0.08, blurRadius: 1 },
  cool: { filters: [Konva.Filters.RGB], red: 200, green: 225, blue: 255 },
};

function commonProps(el: CanvasEl, interactive: boolean) {
  const { select, update } = useEditor.getState();
  return {
    id: el.id,
    name: el.type,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    opacity: el.opacity,
    draggable: interactive,
    onMouseDown: () => {
      if (interactive) select(el.id);
    },
    onTouchStart: () => {
      if (interactive) select(el.id);
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      update(el.id, { x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      update(el.id, {
        x: n.x(),
        y: n.y(),
        rotation: n.rotation(),
        scaleX: n.scaleX(),
        scaleY: n.scaleY(),
      });
    },
  };
}
type CommonProps = ReturnType<typeof commonProps>;

function ImageShape({ el, common }: { el: ImageEl; common: CommonProps }) {
  const [img] = useImage(el.src, 'anonymous');
  const ref = useRef<Konva.Image>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !img) return;
    if (el.filter === 'none') node.clearCache();
    else node.cache({ pixelRatio: 2 });
    node.getLayer()?.batchDraw();
  }, [img, el.filter]);

  return (
    <KImage ref={ref} image={img} width={el.width} height={el.height} {...PRESETS[el.filter]} {...common} />
  );
}

function TextShape({ el, common }: { el: TextEl; common: CommonProps }) {
  const ref = useRef<Konva.Text>(null);

  // フォントが読み込まれたら描き直す
  useEffect(() => {
    let alive = true;
    document.fonts
      .load(`${el.fontSize}px "${el.fontFamily}"`, el.text)
      .then(() => {
        const node = ref.current;
        if (!alive || !node) return;
        node.fontFamily('sans-serif');
        node.fontFamily(el.fontFamily);
        node.getLayer()?.batchDraw();
        node.getStage()?.findOne<Konva.Transformer>('Transformer')?.forceUpdate();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [el.fontFamily, el.text, el.fontSize]);

  return (
    <KText
      ref={ref}
      {...common}
      text={el.text}
      fontSize={el.fontSize}
      fontFamily={el.fontFamily}
      fill={el.fill}
      stroke={el.stroke}
      strokeWidth={el.stroke ? Math.max(4, el.fontSize * 0.12) : 0}
      fillAfterStrokeEnabled
      letterSpacing={el.letterSpacing}
      lineHeight={1.2}
      shadowColor={el.glow ?? 'rgba(0,0,0,0.15)'}
      shadowBlur={el.glow ? 18 : 4}
      shadowOpacity={1}
    />
  );
}

export function ElementNode({ el }: { el: CanvasEl }) {
  const tool = useEditor((s) => s.tool);
  const common = commonProps(el, tool === 'select');

  switch (el.type) {
    case 'image':
      return <ImageShape el={el} common={common} />;
    case 'text':
      return <TextShape el={el} common={common} />;
    case 'sticker':
      return <KText {...common} text={el.emoji} fontSize={el.size} />;
    case 'line':
      return <Line {...common} {...penProps(el)} />;
    default:
      return null;
  }
}
