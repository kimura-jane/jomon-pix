
import { useEffect, useRef } from 'react';
import Konva from 'konva';
import {
  Image as KImage,
  Group,
  Text,
  Line,
} from 'react-konva';
import useImage from 'use-image';
import { useEditor } from '../store';
import { penProps } from '../lib/pens';
import { PhotoFrame } from './PhotoFrame';
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
    tool === 'select' && !el.locked;

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
    if (nextTab && !(tab === 'frame' && el.type === 'image')) {
      setTab(nextTab);
    }
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

    onDragEnd: (
      e: Konva.KonvaEventObject<DragEvent>,
    ) => {
      // ネストした子のDragEndを親写真で処理しない。
      if (e.target.id() !== el.id) return;
      e.cancelBubble = true;
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
  const ref = useRef<Konva.Image>(null);

  const common = useCommon(el);
  const preset = PRESETS[el.filter];

  useEffect(() => {
    const node = ref.current;

    if (!node || !img) return;

    if (el.filter === 'none') {
      node.clearCache();
    } else {
      node.cache({
        pixelRatio: 2,
      });
    }

    node.getLayer()?.batchDraw();
  }, [
    img,
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
          image={img}
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

  return (
    <KImage
      image={img}
      width={el.size}
      height={el.size}
      {...common}
    />
  );
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
