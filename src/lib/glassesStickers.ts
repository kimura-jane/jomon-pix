import type { LibrarySticker } from './stickers';

// 透明背景・画像ファイル不要の独立したSVGスタンプ。
// 色だけでなく、レンズの形とフレームの形も変えている。
type GlassShape =
  | 'classic' | 'bold' | 'round' | 'oval' | 'aviator' | 'cat'
  | 'heart' | 'star' | 'pixel' | 'narrow' | 'shield' | 'wrap'
  | 'hex' | 'butterfly' | 'goggle' | 'rimless' | 'triangle'
  | 'diamond' | 'flower' | 'flame' | 'shutter' | 'sport'
  | 'teardrop' | 'octagon' | 'square' | 'club';

type GlassSpec = {
  id: string;
  label: string;
  shape: GlassShape;
  frame: string;
  lens: string;
  highlight?: string;
};

const DESIGNS: GlassSpec[] = [
  { id: 'classic-black', label: '定番ブラック', shape: 'classic', frame: '#1f232b', lens: '#1a2332' },
  { id: 'bold-black', label: '極太ブラック', shape: 'bold', frame: '#17191f', lens: '#30343e' },
  { id: 'round-gold', label: '丸型ゴールド', shape: 'round', frame: '#c79a44', lens: '#7a4668' },
  { id: 'oval-lavender', label: 'オーバル紫', shape: 'oval', frame: '#b798d9', lens: '#604e8e' },
  { id: 'aviator-gold', label: 'ティアドロップ金', shape: 'aviator', frame: '#c7a054', lens: '#6a7c6e' },
  { id: 'cat-red', label: 'キャットアイ赤', shape: 'cat', frame: '#e63c58', lens: '#9d234b' },
  { id: 'heart-pink', label: 'ハートピンク', shape: 'heart', frame: '#ff75b5', lens: '#ff87c7' },
  { id: 'star-yellow', label: '星型イエロー', shape: 'star', frame: '#ecb72f', lens: '#fbd968' },
  { id: 'pixel-black', label: 'ドット8ビット', shape: 'pixel', frame: '#232735', lens: '#141821' },
  { id: 'narrow-white', label: '細長Y2Kホワイト', shape: 'narrow', frame: '#f8f7f8', lens: '#56536c' },
  { id: 'shield-blue', label: '一枚レンズ青', shape: 'shield', frame: '#2c5cc8', lens: '#34c7f5' },
  { id: 'wrap-black', label: 'スポーツラップ', shape: 'wrap', frame: '#151b27', lens: '#559cd7' },
  { id: 'hex-green', label: '六角エメラルド', shape: 'hex', frame: '#42ac97', lens: '#8be1ce' },
  { id: 'butterfly-rose', label: '蝶々ローズ', shape: 'butterfly', frame: '#d26a95', lens: '#f1b1d8' },
  { id: 'goggle-orange', label: 'ゴーグルオレンジ', shape: 'goggle', frame: '#f19e3f', lens: '#f8ba48' },
  { id: 'rimless-smoke', label: 'リムレス', shape: 'rimless', frame: '#a8a4b7', lens: '#787990' },
  { id: 'triangle-purple', label: '三角ネオン紫', shape: 'triangle', frame: '#9c42ed', lens: '#cb7df7' },
  { id: 'diamond-silver', label: 'ダイヤシルバー', shape: 'diamond', frame: '#d1dce7', lens: '#74b7d9' },
  { id: 'flower-pink', label: 'お花ピンク', shape: 'flower', frame: '#ff82af', lens: '#f8b9d2' },
  { id: 'flame-red', label: '炎レッド', shape: 'flame', frame: '#f45841', lens: '#f5a542' },
  { id: 'shutter-white', label: 'シャッターメガネ', shape: 'shutter', frame: '#f4f4f6', lens: '#303342' },
  { id: 'sport-lime', label: 'レーシング蛍光', shape: 'sport', frame: '#b7e82a', lens: '#52c48b' },
  { id: 'teardrop-sky', label: 'しずくブルー', shape: 'teardrop', frame: '#50a8da', lens: '#9bdcf8' },
  { id: 'octagon-gold', label: '八角クラシック', shape: 'octagon', frame: '#ba8745', lens: '#845d55' },
  { id: 'square-white', label: 'スクエア白', shape: 'square', frame: '#f8f6f6', lens: '#b88bcb' },
  { id: 'club-glitter', label: 'クラブキラキラ', shape: 'club', frame: '#e688dd', lens: '#915acf' },
];

// 左側のレンズを左右反転し、二眼式のフレームを構成する。
function mirrored(fragment: string) {
  return `${fragment}<g transform="translate(200 0) scale(-1 1)">${fragment}</g>`;
}

function lensShapes(shape: GlassShape, frame: string, fill: string): string {
  const border = `stroke="${frame}" stroke-width="7" stroke-linejoin="round"`;
  const thinBorder = `stroke="${frame}" stroke-width="4" stroke-linejoin="round"`;
  const styled = (d: string, thin = false) =>
    `<path d="${d}" fill="${fill}" ${thin ? thinBorder : border}/>`;

  switch (shape) {
    case 'classic':
      return mirrored(styled('M27 78 Q60 73 96 83 L89 113 Q81 132 63 133 Q43 132 37 110Z'));
    case 'bold':
      return mirrored(`<rect x="24" y="71" width="70" height="62" rx="13" fill="${fill}" stroke="${frame}" stroke-width="14"/>`);
    case 'round':
      return mirrored(`<circle cx="65" cy="105" r="31" fill="${fill}" ${border}/>`);
    case 'oval':
      return mirrored(`<ellipse cx="65" cy="105" rx="35" ry="23" fill="${fill}" ${border}/>`);
    case 'aviator':
      return mirrored(styled('M35 72 Q65 63 93 79 Q96 91 85 118 Q72 147 58 138 Q34 122 30 94 Q27 78 35 72Z'));
    case 'cat':
      return mirrored(styled('M25 66 Q44 78 60 80 Q78 77 96 67 L91 117 Q72 142 45 126Z'));
    case 'heart':
      return mirrored(styled('M64 92 C45 68 17 79 25 104 C30 124 50 141 64 151 C78 141 98 124 103 104 C111 79 82 68 64 92Z'));
    case 'star':
      return mirrored(styled('M64 64 L76 91 L103 95 L83 116 L88 145 L64 130 L40 145 L45 116 L25 95 L52 91Z'));
    case 'pixel':
      return mirrored(styled('M22 72 H91 V85 H103 V110 H91 V124 H76 V136 H38 V122 H24 V110 H13 V85 H22Z'));
    case 'narrow':
      return mirrored(styled('M23 91 Q58 81 97 91 L90 110 Q60 121 30 108Z', true));
    case 'shield':
      return `<path d="M18 78 Q100 61 182 78 L171 118 Q100 151 29 118Z" fill="${fill}" stroke="${frame}" stroke-width="9" stroke-linejoin="round"/>`;
    case 'wrap':
      return `<path d="M17 77 Q51 61 100 72 Q149 61 183 77 L164 117 Q132 134 101 107 Q68 134 36 117Z" fill="${fill}" stroke="${frame}" stroke-width="9" stroke-linejoin="round"/>`;
    case 'hex':
      return mirrored(styled('M42 71 H84 L102 96 L88 130 H45 L24 99Z'));
    case 'butterfly':
      return mirrored(styled('M23 69 Q45 76 64 77 Q84 66 100 82 L95 117 Q88 141 58 134 Q30 130 23 69Z'));
    case 'goggle':
      return mirrored(`<rect x="21" y="71" width="77" height="69" rx="26" fill="${fill}" stroke="${frame}" stroke-width="13"/>`);
    case 'rimless':
      return mirrored(styled('M30 82 Q67 70 96 86 L84 132 Q55 141 37 121Z', true));
    case 'triangle':
      return mirrored(styled('M17 80 H99 L63 143Z'));
    case 'diamond':
      return mirrored(styled('M64 66 L103 105 L64 144 L25 105Z'));
    case 'flower':
      return mirrored(`<path d="M65 64 C80 53 96 66 91 83 C113 80 113 107 95 117 C107 139 78 153 65 137 C46 153 25 135 34 117 C12 107 18 79 37 83 C34 65 52 54 65 64Z" fill="${fill}" ${border}/>`);
    case 'flame':
      return mirrored(styled('M26 100 L32 68 L47 82 L58 57 L70 77 L88 64 L99 103 Q94 140 61 140 Q30 137 26 100Z'));
    case 'shutter':
      return mirrored(`
        <rect x="25" y="77" width="71" height="56" rx="7" fill="${fill}" stroke="${frame}" stroke-width="6"/>
        <path d="M28 88 H93 M28 99 H93 M28 110 H93 M28 121 H93" stroke="${frame}" stroke-width="7"/>
      `);
    case 'sport':
      return `<path d="M14 83 Q57 57 100 78 Q143 57 186 83 L169 121 Q133 140 100 104 Q67 140 31 121Z" fill="${fill}" stroke="${frame}" stroke-width="10" stroke-linejoin="round"/>`;
    case 'teardrop':
      return mirrored(styled('M63 65 C91 69 103 98 91 123 Q75 151 61 142 Q22 118 29 92 Q33 75 63 65Z'));
    case 'octagon':
      return mirrored(styled('M46 73 H82 L99 90 V115 L82 135 H46 L27 115 V90Z'));
    case 'square':
      return mirrored(`<rect x="25" y="74" width="71" height="59" rx="3" fill="${fill}" stroke="${frame}" stroke-width="11"/>`);
    case 'club':
      return mirrored(`<path d="M62 79 Q44 57 31 80 Q16 96 32 113 Q25 142 53 140 Q68 156 82 138 Q106 138 99 112 Q111 92 95 79 Q78 59 62 79Z" fill="${fill}" ${border}/>`);
  }
}

function glassesSvg(spec: GlassSpec): string {
  const lens = spec.lens;
  const frame = spec.frame;
  const highlight = spec.highlight ?? '#ffffff';
  const bridge = spec.shape === 'shield' || spec.shape === 'wrap' || spec.shape === 'sport'
    ? ''
    : `<path d="M93 89 Q100 81 107 89" fill="none" stroke="${frame}" stroke-width="8" stroke-linecap="round"/>`;

  const decorations = `
    <path d="M24 90 L8 82 M176 90 L192 82"
          fill="none" stroke="${frame}" stroke-width="7" stroke-linecap="round"/>
    <path d="M42 91 L56 85 M127 86 L145 93"
          fill="none" stroke="${highlight}" opacity=".52"
          stroke-width="4" stroke-linecap="round"/>
    ${spec.shape === 'club'
      ? '<circle cx="98" cy="53" r="6" fill="#f7dc74"/><circle cx="111" cy="60" r="3" fill="#ffffff"/>'
      : ''}
  `;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="200" height="200" viewBox="0 0 200 200">
      ${lensShapes(spec.shape, frame, lens)}
      ${bridge}
      ${decorations}
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const SUNGLASSES_STICKERS: LibrarySticker[] = DESIGNS.map((item) => ({
  id: `glasses-${item.id}`,
  label: item.label,
  kind: 'svg',
  src: glassesSvg(item),
}));
