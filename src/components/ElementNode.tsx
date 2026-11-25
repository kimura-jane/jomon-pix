
import { useEffect, useMemo, useRef } from 'react';
import Konva from 'konva';
import {
  Image as KImage,
  Group,
  Text,
  Line,
  Shape,
} from 'react-konva';
import useImage from 'use-image';
import { useEditor } from '../store';
import { penProps } from '../lib/pens';
import { PhotoFrame } from './PhotoFrame';
import { SpeechBubbleGraphic } from './SpeechBubbleGraphic';
import { useBeautyPreview } from './useBeautyPreview';
import type {
  CanvasEl,
  FilterPreset,
  ImageEl,
  ImageStroke,
  StickerEl,
  Tab,
} from '../types';

// 写真フィルター
const PRESETS: Record<
  FilterPreset,
  {
    filters: any[];
    props: Record<string, number>;
  }
> = {
  none: {
    filters: [],
    props: {},
  },
  vivid: {
    filters: [
      Konva.Filters.HSL,
      Konva.Filters.Contrast,
    ],
    props: {
      saturation: 0.6,
      contrast: 15,
    },
  },
  mono: {
    filters: [Konva.Filters.Grayscale],
    props: {},
  },
  sepia: {
    filters: [Konva.Filters.Sepia],
    props: {},
  },
  soft: {
    filters: [
      Konva.Filters.Brighten,
      Konva.Filters.Blur,
    ],
    props: {
      brightness: 0.08,
      blurRadius: 1,
    },
  },
  cool: {
    filters: [Konva.Filters.RGB],
    props: {
      red: 200,
      green: 225,
      blue: 255,
    },
  },
};

// 選択した装飾の設定パネルを自動表示する
const TAB_OF: Partial<
  Record<CanvasEl['type'], Tab>
> = {
  image: 'edit',
  text: 'text',
  sticker: 'stamp',
  line: 'pen',
};

// 選択・移動・回転・拡大縮小などの共通処理
function useCommon(el: CanvasEl) {
  const {
    select,
    update,
    tool,
    tab,
    setTab,
  } = useEditor();

  const canMove =
    tool === 'select' && !el.locked && !el.transformLocked;

  // 親写真のGroupへタップが伝わると、選択が写真で上書きされてしまう。
  // 子スタンプ・文字だけを確実に選ぶため、クリックをここで止める。
  const selectElement = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    event.cancelBubble = true;
    if (tool !== 'select') return;

    select(el.id);

    const nextTab = TAB_OF[el.type];

    // フレーム編集中に別の写真をタップしてもフレームタブを閉じない。
    if (nextTab && !(['frame', 'beauty'].includes(tab) && el.type === 'image')) {
      setTab(nextTab);
    }
    if (el.type === 'sticker' || el.type === 'text') window.dispatchEvent(new Event('jomon-pix:show-editor'));
  };

  return {
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    opacity: el.opacity,

    draggable: canMove,
    listening: tool !== 'pen',

    onClick: selectElement,
    onTap: selectElement,

    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      if (node.id() !== el.id || !canMove || el.type === 'line') return;
      e.cancelBubble = true;
      const stage = node.getStage();
      if (!stage) return;
      const state = useEditor.getState();
      const bounds = node.getClientRect({ relativeTo: stage, skipShadow: true });
      if (!bounds.width || !bounds.height) return;
      const scale = stage.scaleX() * (stage.container().getBoundingClientRect().width / Math.max(1, stage.width()));
      const tolerance = 5 / Math.max(0.01, scale);
      const nearest = (edges: number[], targets: number[]) => {
        let best: { delta: number; line: number } | null = null;
        for (const edge of edges) for (const line of targets) {
          const delta = line - edge;
          if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line };
        }
        return best;
      };
      const x = nearest([bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width], [0, state.canvasWidth / 2, state.canvasWidth]);
      const y = nearest([bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height], [0, state.canvasHeight / 2, state.canvasHeight]);
      if (x || y) {
        const transform = stage.getAbsoluteTransform();
        const zero = transform.point({ x: 0, y: 0 });
        const delta = transform.point({ x: x?.delta ?? 0, y: y?.delta ?? 0 });
        const current = node.getAbsolutePosition();
        node.absolutePosition({ x: current.x + delta.x - zero.x, y: current.y + delta.y - zero.y });
      }
      window.dispatchEvent(new CustomEvent('jomon-pix:alignment', { detail: { x: x?.line, y: y?.line } }));
    },

    onDragEnd: (
      e: Konva.KonvaEventObject<DragEvent>,
    ) => {
      // ネストした子のDragEndを親写真で処理しない。
      if (e.target.id() !== el.id) return;
      e.cancelBubble = true;
      window.dispatchEvent(new CustomEvent('jomon-pix:alignment', { detail: {} }));
      if (el.locked || el.transformLocked) {
        e.target.position({ x: el.x, y: el.y });
        return;
      }
      update(el.id, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },

    onTransformEnd: (
      e: Konva.KonvaEventObject<Event>,
    ) => {
      // 子の拡大・回転で親写真の座標が書き換わるのを防ぐ。
      const node = e.target;
      if (node.id() !== el.id) return;
      e.cancelBubble = true;
      if (el.locked || el.transformLocked) {
        node.position({ x: el.x, y: el.y });
        node.rotation(el.rotation);
        node.scale({ x: el.scaleX, y: el.scaleY });
        return;
      }

      update(el.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    },
  };
}

// 写真
function ImageNode({
  el,
  draft,
  attached,
}: {
  el: ImageEl;
  draft?: ImageStroke;
  attached: CanvasEl[];
}) {
  const [img] = useImage(el.src, 'anonymous');
  const beautyPreview = useBeautyPreview(el.id, el.src, img, el.beauty, el.beautyFaceOverrides, el.makeupStyle, el.makeupFaceStyles);
  const ref = useRef<Konva.Image>(null);

  const common = useCommon(el);
  const preset = PRESETS[el.filter];
  useEffect(() => {
    const node = ref.current;

    if (!node || !beautyPreview.image) return;

    if (el.filter === 'none') {
      node.clearCache();
    } else {
      node.cache({
        pixelRatio: 2,
      });
    }

    node.getLayer()?.batchDraw();
  }, [
    beautyPreview.image,
    el.filter,
    el.width,
    el.height,
  ]);

  return (
    <Group {...common}>
      {/* 写真とペンは写真の縁で切り取る。スタンプ・文字は縁を越えて配置できる。 */}
      <Group
        clipX={0}
        clipY={0}
        clipWidth={el.width}
        clipHeight={el.height}
      >
        <KImage
          ref={ref}
          image={beautyPreview.image}
          beautySignature={beautyPreview.signature}
          beautySource={el.src}
          width={el.width}
          height={el.height}
          filters={preset.filters}
          {...preset.props}
        />
        {(el.drawings ?? []).map((stroke) => (
          <Line
            key={stroke.id}
            {...penProps(stroke)}
            opacity={
              stroke.opacity * (stroke.penStyle === 'marker' ? 0.45 : 1)
            }
            listening={false}
          />
        ))}
        {draft && (
          <Line
            {...penProps(draft)}
            opacity={
              draft.opacity * (draft.penStyle === 'marker' ? 0.45 : 1)
            }
            listening={false}
          />
        )}
      </Group>
      <PhotoFrame width={el.width} height={el.height} frame={el.frame} />
      {attached.map((child) => (
        <ElementNode key={child.id} el={child} />
      ))}
    </Group>
  );
}

// 犬・埴輪・土偶・顔デコなどの画像スタンプ
function StickerImageNode({
  el,
  src,
}: {
  el: StickerEl;
  src: string;
}) {
  const [img] = useImage(src, 'anonymous');
  const common = useCommon(el);
  const width = Math.max(0, Math.min(30, Number(el.outlineWidth) || 0));
  const pad = width + 1;
  const extent = el.size + pad * 2;
  const silhouette = useMemo(() => {
    if (!img || !width || !Number.isFinite(extent) || extent <= 0) return null;
    const ratio = Math.min(2, 512 / extent);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.max(1, Math.ceil(extent * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(ratio, ratio);
    ctx.drawImage(img, pad, pad, el.size, el.size);
    // Use the source alpha to create a white silhouette, including transparent PNG/WebP.
    for (const fraction of [0.5, 1]) for (let i = 0; i < 24; i++) {
      const a = i * Math.PI * 2 / 24;
      ctx.drawImage(img, pad + width * fraction * Math.cos(a), pad + width * fraction * Math.sin(a), el.size, el.size);
    }
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, extent + 1, extent + 1);
    return canvas;
  }, [img, width, el.size]);

  if (width > 0) return <Group {...common}>
    {silhouette && <Shape x={-pad} y={-pad} width={extent} height={extent} listening={false}
      sceneFunc={(context) => { context.drawImage(silhouette, 0, 0, extent, extent); }} />}
    <KImage image={img} width={el.size} height={el.size} />
  </Group>;
  return <KImage image={img} width={el.size} height={el.size} {...common} />;
}

export function ElementNode({
  el,
  draft,
  attached = [],
}: {
  el: CanvasEl;
  draft?: ImageStroke;
  attached?: CanvasEl[];
}) {
  const common = useCommon(el);
  const textRef = useRef<Konva.Text>(null);
  const update = useEditor((s) => s.update);

  const family =
    el.type === 'text'
      ? el.fontFamily
      : '';

  // 使用フォントの読み込み後に再描画
  useEffect(() => {
    if (!family) return;

    document.fonts
      ?.load(`40px "${family}"`)
      .then(() => {
        textRef.current
          ?.getLayer()
          ?.batchDraw();
      });
  }, [family]);

  // 非表示の要素
  if (el.hidden) return null;

  // 写真
  if (el.type === 'image') {
    return <ImageNode el={el} draft={draft} attached={attached} />;
  }

  // スタンプ
  if (el.type === 'sticker') {
    // イラスト画像スタンプ
    if (el.src) {
      return (
        <StickerImageNode
          el={el}
          src={el.src}
        />
      );
    }

    // 従来の絵文字スタンプ
    return (
      <Text
        text={el.emoji}
        fontSize={el.size}
        stroke={el.outlineWidth ? '#ffffff' : undefined}
        strokeWidth={Math.max(0, Math.min(30, Number(el.outlineWidth) || 0)) * 2}
        fillAfterStrokeEnabled
        lineJoin="round"
        {...common}
      />
    );
  }

  // ペンで描いた線
  if (el.type === 'line') {
    return (
      <Line
        {...penProps(el)}
        {...common}
        draggable={false}
      />
    );
  }

  // 吹き出しは文字と背景を同じGroupで操作し、写真移動にも追従する。
  if (el.bubble) {
    const edit = () => {
      const value = prompt('セリフを編集', el.text);
      if (value !== null) update(el.id, { text: value.slice(0, 500) });
    };
    return (
      <Group {...common} onDblClick={edit} onDblTap={edit}>
        <SpeechBubbleGraphic el={el} />
      </Group>
    );
  }

  // 文字
  const shown = el.vertical
    ? el.text
        .split('\n')
        .map((line) =>
          [...line].join('\n'),
        )
        .join('\n\n')
    : el.text;

  return (
    <Text
      ref={textRef}
      text={shown}
      fontFamily={el.fontFamily}
      fontSize={el.fontSize}
      fill={el.fill}
      stroke={el.stroke || undefined}
      strokeWidth={
        el.stroke
          ? el.strokeWidth
          : 0
      }
      fillAfterStrokeEnabled
      lineJoin="round"
      letterSpacing={el.letterSpacing}
      align={el.align}
      lineHeight={
        el.vertical
          ? 1.05
          : 1.25
      }
      shadowColor={el.glow || undefined}
      shadowBlur={el.glow ? 22 : 0}
      shadowOpacity={el.glow ? 1 : 0}
      onDblClick={() => {
        const value = prompt(
          '文字を入力',
          el.text,
        );

        if (value != null) {
          update(el.id, {
            text: value,
          });
        }
      }}
      onDblTap={() => {
        const value = prompt(
          '文字を入力',
          el.text,
        );

        if (value != null) {
          update(el.id, {
            text: value,
          });
        }
      }}
      {...common}
    />
  );
}
