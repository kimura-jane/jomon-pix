import type { TextEl } from '../types';

export type FontGroup = 'かわいい' | '手書き' | 'まじめ' | 'インパクト';
export const FONT_GROUPS: FontGroup[] = ['かわいい', '手書き', 'まじめ', 'インパクト'];

export const FONTS: { family: string; label: string; group: FontGroup }[] = [
  { family: 'Hachi Maru Pop', label: 'はちまるポップ', group: 'かわいい' },
  { family: 'Mochiy Pop One', label: 'もちっとポップ', group: 'かわいい' },
  { family: 'Kiwi Maru', label: 'キウイ丸', group: 'かわいい' },
  { family: 'Zen Maru Gothic', label: '丸ゴシック', group: 'かわいい' },
  { family: 'Yomogi', label: 'よもぎ', group: '手書き' },
  { family: 'Klee One', label: 'クレー', group: '手書き' },
  { family: 'Zen Kurenaido', label: 'くれない堂', group: '手書き' },
  { family: 'Yusei Magic', label: 'マジック', group: '手書き' },
  { family: 'Shippori Mincho', label: 'しっぽり明朝', group: 'まじめ' },
  { family: 'Noto Sans JP', label: 'ゴシック', group: 'まじめ' },
  { family: 'Dela Gothic One', label: 'デラゴシック', group: 'インパクト' },
  { family: 'Rampart One', label: 'ランパート', group: 'インパクト' },
  { family: 'Reggae One', label: 'レゲエ', group: 'インパクト' },
  { family: 'RocknRoll One', label: 'ロックンロール', group: 'インパクト' },
  { family: 'DotGothic16', label: 'ドット', group: 'インパクト' },
];

export const TEXT_PRESETS: { label: string; style: Partial<TextEl> }[] = [
  { label: 'ポップ', style: { fontFamily: 'Mochiy Pop One', fill: '#ff4fa3', stroke: '#ffffff', strokeWidth: 8, glow: '' } },
  { label: 'ゆめかわ', style: { fontFamily: 'Hachi Maru Pop', fill: '#b98cff', stroke: '#fff0fb', strokeWidth: 8, glow: '#ffc3ec' } },
  { label: 'ネオン', style: { fontFamily: 'Zen Maru Gothic', fill: '#ffffff', stroke: '#ff2fd0', strokeWidth: 3, glow: '#ff2fd0' } },
  { label: '手書きメモ', style: { fontFamily: 'Yomogi', fill: '#333333', stroke: '', strokeWidth: 0, glow: '' } },
  { label: '見出し', style: { fontFamily: 'Dela Gothic One', fill: '#222222', stroke: '#ffe14d', strokeWidth: 10, glow: '' } },
  { label: '明朝', style: { fontFamily: 'Shippori Mincho', fill: '#222222', stroke: '', strokeWidth: 0, glow: '' } },
  { label: 'レトロ', style: { fontFamily: 'DotGothic16', fill: '#39ff88', stroke: '#003b1c', strokeWidth: 4, glow: '#39ff88' } },
  { label: 'シンプル', style: { fontFamily: 'Noto Sans JP', fill: '#ffffff', stroke: '#000000', strokeWidth: 4, glow: '' } },
];
