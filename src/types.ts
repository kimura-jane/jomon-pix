export type FilterPreset = 'none' | 'vivid' | 'mono' | 'sepia' | 'soft' | 'cool';

type Base = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
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
  fontSize: number;
  fontFamily: string;
  fill: string;
  stroke?: string;
};

export type StickerEl = Base & {
  type: 'sticker';
  emoji: string;
  size: number;
};

export type CanvasEl = ImageEl | TextEl | StickerEl;
