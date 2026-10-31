export type FilterPreset = 'none' | 'vivid' | 'mono' | 'sepia' | 'soft' | 'cool';
export type Tool = 'select' | 'pen' | 'eraser';
export type PenStyle = 'pen' | 'marker' | 'dashed' | 'neon' | 'dotted' | 'rainbow' | 'sparkle';
export type Tab =
  | 'image' | 'text' | 'pen' | 'stamp' | 'glasses'
  | 'mosaic' | 'beauty' | 'edit' | 'frame' | 'layer';

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

export type ImageEl = Base & {
  type: 'image';
  src: string;
  width: number;
  height: number;
  filter: FilterPreset;
};

export type TextEl = Base & {
  type: 'text';
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

export type StickerEl = Base & { type: 'sticker'; emoji: string; size: number };

export type LineEl = Base & {
  type: 'line';
  points: number[];
  color: string;
  width: number;
  penStyle: PenStyle;
};

export type CanvasEl = ImageEl | TextEl | StickerEl | LineEl;

export type Patch = Partial<
  Omit<ImageEl, 'type'> & Omit<TextEl, 'type'> & Omit<StickerEl, 'type'> & Omit<LineEl, 'type'>
>;
