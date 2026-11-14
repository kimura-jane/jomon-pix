import type { LibrarySticker } from './stickers';

// All assets are locally bundled transparent WebP cutouts of genuine pottery.
// Photograph source/rights: docs/audit/archaeology-sticker-source-manifest.json
// Older SVG stamp definitions and saved artworks are kept untouched.
type MuseumAsset = readonly [id: string, label: string];

const HANIWA: MuseumAsset[] = [
  ['h01', '武人埴輪・立像'],
  ['h02', '女性埴輪・結髪'],
  ['h03', '家形埴輪'],
  ['h04', '猪形埴輪・頭部'],
  ['h05', '猪の子埴輪'],
  ['h06', '武人埴輪・頭部'],
  ['h07', '女性埴輪・祭祀'],
  ['h08', '馬形埴輪'],
  ['h09', '盾形埴輪'],
  ['h10', '女性人物埴輪'],
];

const DOGU: MuseumAsset[] = [
  ['d01', '小型土偶'],
  ['d02', '遮光器土偶・模造'],
  ['d03', '土偶頭部・縄文後期'],
  ['d04', '腕を広げる土偶'],
  ['d05', '遮光器土偶・頭部'],
  ['d06', '土偶顔面・大きな眉'],
  ['d07', '土偶頭部・口開き'],
  ['d08', '女性立像土偶'],
  ['d09', '装飾土偶・縄文'],
  ['d10', 'ギメ美術館の土偶'],
];

function toMuseumStickers(
  group: 'haniwa' | 'dogu',
  assets: MuseumAsset[],
): LibrarySticker[] {
  return assets.map(([id, label]) => ({
    id: `museum-${group}-${id}`,
    label,
    kind: 'image',
    src: `${import.meta.env.BASE_URL}stickers/archaeology/v1/${group}/${id}.webp`,
  }));
}

export const REAL_HANIWA_STICKERS: LibrarySticker[] =
  toMuseumStickers('haniwa', HANIWA);

export const REAL_DOGU_STICKERS: LibrarySticker[] =
  toMuseumStickers('dogu', DOGU);
