import type { LibrarySticker } from './stickers';

// Built-in SVG assets are free to use and work without a server or CDN.
// These are textured overlays, not AI-generated changes to a person's real hair.
export type HairColorId =
  | 'black' | 'dark-brown' | 'brown' | 'blonde'
  | 'ash' | 'copper' | 'pink' | 'silver';

export type HairStyleId =
  | 'bob' | 'long' | 'pixie' | 'wave' | 'layered' | 'bangs';

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
];

// Each outline has a face-sized opening, so the user's eyes and skin
// remain visible. Paths share the same 240 x 240 coordinate system.
const OUTLINES: Record<HairStyleId, string> = {
  bob: 'M35 185 C28 157 24 123 27 82 C31 36 61 16 119 16 C174 14 205 36 211 84 C217 125 213 163 204 185 Q194 199 174 187 Q182 154 174 112 C171 73 152 51 120 51 C86 49 68 74 66 111 C59 152 67 166 67 187 Q47 201 35 185 Z',
  long: 'M18 238 C29 190 17 131 23 85 C27 37 59 11 120 10 C180 11 210 37 217 87 C224 139 209 188 227 238 L170 238 C160 196 180 145 173 107 C169 70 148 46 119 46 C88 46 68 69 66 109 C59 151 77 198 65 238 Z',
  pixie: 'M41 149 C18 129 19 103 27 70 C34 35 66 22 114 17 C163 11 201 30 210 68 C218 109 200 134 183 150 L174 114 C173 76 149 54 119 52 C85 49 66 76 64 114 L61 149 Z',
  wave: 'M18 235 C42 209 10 188 24 160 C45 139 10 119 28 88 C14 53 65 8 116 13 C165 6 211 38 209 80 C233 106 205 121 222 151 C199 172 239 205 228 238 L172 238 C150 214 184 180 170 146 C186 122 166 77 143 58 C117 43 83 49 68 78 C52 111 72 139 57 164 C70 197 47 213 65 238 Z',
  layered: 'M19 233 C28 206 17 176 39 148 C23 120 18 93 31 64 C43 28 80 11 118 14 C172 11 201 36 214 83 C224 117 205 145 203 164 C226 192 220 216 229 237 L178 237 Q151 204 169 168 Q180 134 168 104 C159 63 142 51 117 51 C85 50 66 78 65 113 C63 151 71 178 55 194 Q72 215 65 238 Z',
  bangs: 'M25 216 C25 172 17 138 27 86 C32 34 63 14 120 15 C180 12 209 37 213 87 C219 136 214 181 221 218 L172 218 C166 188 180 135 174 103 C169 72 152 56 121 55 C87 53 68 72 66 104 C61 140 73 186 65 218 Z',
};

function mix(hex: string, toward: string, weight: number): string {
  const rgb = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const c = [1, 3, 5].map((i) => Math.round(
    rgb(hex, i) * (1 - weight) + rgb(toward, i) * weight,
  ));
  return '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function strandPaths(style: HairStyleId): string {
  const waves = style === 'wave' ? 14 : style === 'layered' ? 8 : 2;
  const short = style === 'pixie';
  const end = short ? 155 : style === 'bob' ? 192 : style === 'bangs' ? 220 : 240;
  const count = 110;
  let result = '';
  for (let i = 0; i < count; i += 1) {
    const x = 22 + (i * 196 / (count - 1));
    const sway = Math.sin(i * 2.08) * waves;
    const y = 26 + Math.sin(i * 1.51) * 13;
    const midY = short ? 103 : 139;
    const opacity = 0.12 + (i % 8) * 0.023;
    const width = i % 9 === 0 ? 2.4 : i % 3 === 0 ? 1.1 : 0.55;
    const stroke = i % 5 === 0 ? '#fff9e5' : i % 4 === 0 ? '#151014' : '#ffffff';
    const d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1) +
      ' Q' + (x + sway).toFixed(1) + ' ' + (midY * 0.57).toFixed(1) +
      ' ' + (x - sway * 0.5).toFixed(1) + ' ' + midY +
      ' Q' + (x + sway * 1.45).toFixed(1) + ' ' + (midY + 35) +
      ' ' + (x + sway * 0.4).toFixed(1) + ' ' + end;
    result += '<path d="' + d + '" fill="none" stroke="' + stroke +
      '" stroke-width="' + width + '" opacity="' + opacity.toFixed(2) + '"/>';
  }
  return result;
}

function fringe(style: HairStyleId, dark: string, shine: string): string {
  if (style === 'pixie') {
    return '<path d="M46 74 Q67 35 124 31 Q176 27 194 66 Q144 52 101 88 Q76 77 57 102Z" fill="' +
      dark + '" opacity=".94"/><path d="M55 77 Q99 38 171 48" fill="none" stroke="' +
      shine + '" opacity=".45" stroke-width="2"/>';
  }
  if (style === 'bangs') {
    return '<path d="M63 67 Q78 49 117 44 Q154 44 177 65 C172 84 149 93 141 105 Q133 81 125 104 Q111 85 103 108 Q87 87 76 108Z" fill="' +
      dark + '"/>' +
      Array.from({ length: 23 }, (_, i) => {
        const x = 78 + i * 3.7;
        return '<path d="M' + x.toFixed(1) + ' 57 Q' +
          (x + 7).toFixed(1) + ' 76 ' + (x - 2).toFixed(1) +
          ' ' + (92 + (i % 4) * 3) +
          '" fill="none" stroke="' + shine + '" opacity=".25" stroke-width=".7"/>';
      }).join('');
  }
  if (style === 'bob') {
    return '<path d="M55 77 Q86 35 123 38 Q158 37 176 69 Q139 62 110 81 Q88 84 66 107Z" fill="' +
      dark + '" opacity=".83"/>';
  }
  if (style === 'layered') {
    return '<path d="M46 85 Q74 32 121 36 Q168 39 190 82 Q153 61 126 58 Q108 79 68 105Z" fill="' +
      dark + '" opacity=".72"/>';
  }
  return '<path d="M62 68 Q97 34 119 36 Q147 36 176 73 Q143 52 124 60 Q112 46 99 59 Q78 57 62 89Z" fill="' +
    dark + '" opacity=".75"/>';
}

function svgFor(style: HairStyleId, base: string): string {
  const outline = OUTLINES[style];
  const deep = mix(base, '#09070b', 0.52);
  const shadow = mix(base, '#09070b', 0.32);
  const light = mix(base, '#fff6e5', 0.38);
  const tip = mix(base, '#f3d0ac', 0.12);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">',
    '<defs>',
    '<linearGradient id="hair-fill" x1="0" y1="0" x2=".98" y2=".88">',
    '<stop offset="0" stop-color="' + deep + '"/>',
    '<stop offset=".2" stop-color="' + light + '"/>',
    '<stop offset=".43" stop-color="' + base + '"/>',
    '<stop offset=".72" stop-color="' + shadow + '"/>',
    '<stop offset="1" stop-color="' + tip + '"/>',
    '</linearGradient>',
    '<radialGradient id="hair-glow" cx=".43" cy=".19" r=".76">',
    '<stop offset="0" stop-color="' + light + '" stop-opacity=".45"/>',
    '<stop offset=".56" stop-color="' + base + '" stop-opacity=".05"/>',
    '<stop offset="1" stop-color="' + deep + '" stop-opacity=".32"/>',
    '</radialGradient>',
    '<clipPath id="hair-clip"><path d="' + outline + '"/></clipPath>',
    '</defs>',
    '<path d="' + outline + '" fill="url(#hair-fill)" stroke="' + deep + '" stroke-width="1.4" stroke-linejoin="round"/>',
    '<g clip-path="url(#hair-clip)">',
    '<rect x="0" y="0" width="240" height="240" fill="url(#hair-glow)"/>',
    strandPaths(style),
    '</g>',
    fringe(style, shadow, light),
    '</svg>',
  ].join('');
}

const cache = new Map<HairColorId, LibrarySticker[]>();
export function getHairStickers(color: HairColorId): LibrarySticker[] {
  const existing = cache.get(color);
  if (existing) return existing;
  const palette = HAIR_COLORS.find((item) => item.id === color) ?? HAIR_COLORS[0];
  const stickers = HAIR_STYLES.map((style): LibrarySticker => ({
    id: 'hair-' + style.id + '-' + color,
    label: '髪型:' + style.label + '（' + palette.label + '）',
    kind: 'svg',
    src: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      svgFor(style.id, palette.hex),
    ),
  }));
  cache.set(color, stickers);
  return stickers;
}

export function findHairStyle(label?: string): HairStyleId | null {
  const match = HAIR_STYLES.find((item) =>
    label?.startsWith('髪型:' + item.label + '（'),
  );
  return match?.id ?? null;
}

export function getRecoloredHair(style: HairStyleId, color: HairColorId): LibrarySticker {
  return getHairStickers(color).find((item) => item.id === 'hair-' + style + '-' + color)!;
}
