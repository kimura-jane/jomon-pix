import type { LibrarySticker } from './stickers';
import type { StickerEl } from '../types';

// Original studio-rendered transparent WebP assets, bundled with JOMON PIX.
// No paid API, external server or download is required at editing time.
export type HairColorId =
  | 'black' | 'dark-brown' | 'brown' | 'blonde'
  | 'ash' | 'copper' | 'pink' | 'silver';

export type HairStyleId =
  | 'bob' | 'long' | 'pixie' | 'wave' | 'layered' | 'bangs'
  | 'flattop' | 'afro' | 'pompadour';

export const HAIR_COLORS: ReadonlyArray<{ id: HairColorId; label: string; hex: string }> = [
  { id: 'black', label: '黒髪', hex: '#241e20' },
  { id: 'dark-brown', label: 'ダークブラウン', hex: '#47312b' },
  { id: 'brown', label: 'ブラウン', hex: '#815039' },
  { id: 'blonde', label: 'ブロンド', hex: '#cba46c' },
  { id: 'ash', label: 'アッシュ', hex: '#817974' },
  { id: 'copper', label: 'レッド', hex: '#9f4934' },
  { id: 'pink', label: 'ピンク', hex: '#b67c8c' },
  { id: 'silver', label: 'シルバー', hex: '#b5b6b8' },
];

export const HAIR_STYLES: ReadonlyArray<{ id: HairStyleId; label: string }> = [
  { id: 'bob', label: 'ボブ' },
  { id: 'long', label: 'ストレートロング' },
  { id: 'pixie', label: 'ショート' },
  { id: 'wave', label: 'ウェーブ' },
  { id: 'layered', label: 'レイヤー' },
  { id: 'bangs', label: '前髪ありミディアム' },
  { id: 'flattop', label: '角刈り' },
  { id: 'afro', label: 'アフロ' },
  { id: 'pompadour', label: 'リーゼント' },
];

const cache = new Map<HairColorId, LibrarySticker[]>();
export function getHairStickers(color: HairColorId): LibrarySticker[] {
  const found = cache.get(color);
  if (found) return found;
  const palette = HAIR_COLORS.find((item) => item.id === color) ?? HAIR_COLORS[0];
  const stickers: LibrarySticker[] = HAIR_STYLES.map((style) => ({
    id: 'hair-' + style.id + '-' + color,
    label: '髪型:' + style.label + '（' + palette.label + '）',
    kind: 'image',
    src: import.meta.env.BASE_URL + 'stickers/hair/v2/' + style.id + '-' + color + '.webp',
  }));
  cache.set(color, stickers);
  return stickers;
}

export function isHairSticker(el: StickerEl): boolean {
  // Both new photo assets and old SVG hair stickers use this persistent label.
  return el.label?.startsWith('髪型:') === true;
}

export function findHairStyle(label?: string): HairStyleId | null {
  return HAIR_STYLES.find((style) => label?.startsWith('髪型:' + style.label + '（'))?.id ?? null;
}

export function getRecoloredHair(style: HairStyleId, color: HairColorId): LibrarySticker {
  const result = getHairStickers(color).find((item) =>
    item.id === 'hair-' + style + '-' + color);
  if (!result) throw new Error('髪型の画像が見つかりません');
  return result;
}
