
export type FilterPreset =
  | 'none'
  | 'vivid'
  | 'mono'
  | 'sepia'
  | 'soft'
  | 'cool';

export type Tool = 'select' | 'pen' | 'eraser';

export type PenStyle =
  | 'pen'
  | 'marker'
  | 'dashed'
  | 'neon'
  | 'dotted'
  | 'rainbow'
  | 'sparkle';

export type Tab =
  | 'image'
  | 'text'
  | 'pen'
  | 'stamp'
  | 'glasses'
  | 'mosaic'
  | 'beauty'
  | 'edit'
  | 'frame'
  | 'layer';

type Base = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
};

export type ImageStroke = {
  id: string;
  points: number[];
  color: string;
  width: number;
  penStyle: PenStyle;
  opacity: number;
};

export type FrameStyle =
  | 'none'
  | 'simple'
  | 'double'
  | 'polaroid'
  | 'film'
  | 'album'
  | 'neon'
  | 'magazine';

export type ImageFrame = {
  style: FrameStyle;
  // CSS hex color of the decorative frame.
  color: string;
  // Thickness as a percentage of the photo's shorter side (2-18).
  size: number;
};

export type ImageEl = Base & {
  type: 'image';
  // 写真内の座標で保存。画像の移動・変形に追従する。
  drawings?: ImageStroke[];
  src: string;
  width: number;
  height: number;
  filter: FilterPreset;
  frame?: ImageFrame;
};

export type TextEl = Base & {
  type: 'text';
  // 紐づけ先の写真。座標は写真内のローカル座標。
  parentImageId?: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  glow: string;
  letterSpacing: number;
  vertical: boolean;
  align: 'left' | 'center' | 'right';
};

// 絵文字とイラスト画像の両方に対応
// 既存の絵文字スタンプもそのまま使える
export type StickerEl = Base & {
  type: 'sticker';
  parentImageId?: string;
  emoji: string;
  size: number;
  src?: string;
  label?: string;
};

export type LineEl = Base & {
  type: 'line';
  points: number[];
  color: string;
  width: number;
  penStyle: PenStyle;
};

export type CanvasEl =
  | ImageEl
  | TextEl
  | StickerEl
  | LineEl;

export type Patch = Partial<
  Omit<ImageEl, 'type'> &
  Omit<TextEl, 'type'> &
  Omit<StickerEl, 'type'> &
  Omit<LineEl, 'type'>
>;
