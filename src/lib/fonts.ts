export type FontGroup = 'かわいい' | '手書き' | 'まじめ' | 'インパクト';

export const FONT_GROUPS: FontGroup[] = ['かわいい', '手書き', 'まじめ', 'インパクト'];

export const FONTS: { family: string; label: string; group: FontGroup }[] = [
  { family: 'Hachi Maru Pop', label: 'はちまるポップ', group: 'かわいい' },
  { family: 'Mochiy Pop One', label: 'もちポップ', group: 'かわいい' },
  { family: 'Kiwi Maru', label: 'キウイ丸', group: 'かわいい' },
  { family: 'Zen Maru Gothic', label: 'まるゴシック', group: 'かわいい' },
  { family: 'Yomogi', label: 'よもぎ', group: '手書き' },
  { family: 'Klee One', label: 'クレー', group: '手書き' },
  { family: 'Zen Kurenaido', label: 'くれないど', group: '手書き' },
  { family: 'Yusei Magic', label: '油性マジック', group: '手書き' },
  { family: 'Shippori Mincho', label: 'しっぽり明朝', group: 'まじめ' },
  { family: 'Noto Sans JP', label: 'ゴシック', group: 'まじめ' },
  { family: 'Dela Gothic One', label: 'デラゴシック', group: 'インパクト' },
  { family: 'Rampart One', label: 'ランパート', group: 'インパクト' },
  { family: 'Reggae One', label: 'レゲエ', group: 'インパクト' },
  { family: 'RocknRoll One', label: 'ロックンロール', group: 'インパクト' },
  { family: 'DotGothic16', label: 'ドット', group: 'インパクト' },
];

export type TextPreset = {
  label: string;
  fontFamily: string;
  fill: string;
  stroke?: string;
  glow?: string;
};

export const TEXT_PRESETS: TextPreset[] = [
  { label: 'ポップ', fontFamily: 'Mochiy Pop One', fill: '#ff4fa3', stroke: '#ffffff' },
  { label: 'ゆめかわ', fontFamily: 'Hachi Maru Pop', fill: '#ffffff', stroke: '#b28dff' },
  { label: 'ネオン', fontFamily: 'RocknRoll One', fill: '#ffffff', glow: '#ff4fa3' },
  { label: '手書きメモ', fontFamily: 'Yomogi', fill: '#333333' },
  { label: '見出し', fontFamily: 'Dela Gothic One', fill: '#111111', stroke: '#ffe14d' },
  { label: '明朝', fontFamily: 'Shippori Mincho', fill: '#222222' },
  { label: 'レトロ', fontFamily: 'DotGothic16', fill: '#3a86ff' },
  { label: 'シンプル', fontFamily: 'Noto Sans JP', fill: '#111111' },
];
