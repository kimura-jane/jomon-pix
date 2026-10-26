import { useEffect, useRef } from 'react';
import { Image as KImage, Text as KText } from 'react-konva';
import Konva from 'konva';
import type { ImageConfig } from 'konva/lib/shapes/Image';
import useImage from 'use-image';
import { useEditor } from '../store';
import type { CanvasEl, FilterPreset, ImageEl } from '../types';

// LINEカメラ風フィルター
export const PRESETS: Record<FilterPreset, Partial<ImageConfig>> = {
  none: { filters: [] },
  vivid: { filters: [Konva.Filters.HSL, Konva.Filters.Contrast], saturation: 0.6, contrast: 15 },
  mono: { filters: [Konva.Filters.Grayscale] },
  sepia: { filters: [Konva.Filters.Sepia] },
  soft: { filters: [Konva.Filters.Brighten, Konva.Filters.Blur], brightness: 0.08, blurRadius: 1 },
  cool: { filters: [Konva.Filters.RGB], red: 200, green: 225, blue: 255 },
};

function commonProps(el: CanvasEl) {
  const { select, update } = useEditor.getState();
  return {
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    opacity: el.opacity,
    draggable: true,
    onMouseDown: () => select(el.id),
    onTap: () => select(el.id),
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

  // フィルターはキャッシュしないと効かない
  useEffect(() => {
    const node = ref.current;
    if (!node || !img) return;
    if (el.filter === 'none') node.clearCache();
    else node.cache({ pixelRatio: 2 });
    node.getLayer()?.batchDraw();
  }, [img, el.filter]);

  return (
    <KImage
      ref={ref}
      image={img}
      width={el.width}
      height={el.height}
      {...PRESETS[el.filter]}
      {...common}
    />
  );
}

export function ElementNode({ el }: { el: CanvasEl }) {
  const common = commonProps(el);

  switch (el.type) {
    case 'image':
      return <ImageShape el={el} common={common} />;

    case 'text': {
      const edit = () => {
        const t = prompt('テキストを編集', el.text);
        if (t !== null) useEditor.getState().update(el.id, { text: t });
      };
      return (
        <KText
          {...common}
          text={el.text}
          fontSize={el.fontSize}
          fontFamily={el.fontFamily}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.stroke ? 6 : 0}
          fillAfterStrokeEnabled
          shadowColor="rgba(0,0,0,0.2)"
          shadowBlur={6}
          onDblClick={edit}
          onDblTap={edit}
        />
      );
    }

    case 'sticker':
      return <KText {...common} text={el.emoji} fontSize={el.size} />;
  }
}
