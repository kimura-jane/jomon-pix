export type LibrarySticker = {
  id: string;
  label: string;
  kind: 'svg' | 'image' | 'emoji';
  src?: string;
  emoji?: string;
};

export type StickerCategory = {
  id: 'haniwa' | 'dogu' | 'dog' | 'emoji';
  label: string;
  items: LibrarySticker[];
};

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg.replace(/\n\s+/g, ' ').trim(),
  )}`;
}

function wrapSvg(content: string) {
  return svgDataUrl(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width="200"
      height="200"
    >
      ${content}
    </svg>
  `);
}

function shadow() {
  return `<ellipse cx="100" cy="176" rx="56" ry="12" fill="rgba(0,0,0,0.10)" />`;
}

function dogSvg(opts: {
  fur: string;
  earInner?: string;
  scarf?: string;
  patch?: string;
  accessory?: string;
  eye?: 'dot' | 'happy' | 'wink';
  mouth?: 'smile' | 'tongue' | 'surprised';
  bodySpot?: string;
}) {
  const eyeLeft =
    opts.eye === 'happy'
      ? `<path d="M74 88 Q82 96 90 88" stroke="#3d2a22" stroke-width="4" fill="none" stroke-linecap="round" />`
      : `<circle cx="82" cy="90" r="4.8" fill="#3d2a22" />`;

  const eyeRight =
    opts.eye === 'wink'
      ? `<path d="M110 88 Q118 96 126 88" stroke="#3d2a22" stroke-width="4" fill="none" stroke-linecap="round" />`
      : opts.eye === 'happy'
        ? `<path d="M110 88 Q118 96 126 88" stroke="#3d2a22" stroke-width="4" fill="none" stroke-linecap="round" />`
        : `<circle cx="118" cy="90" r="4.8" fill="#3d2a22" />`;

  const mouth =
    opts.mouth === 'tongue'
      ? `
        <path d="M93 104 Q100 110 107 104" stroke="#3d2a22" stroke-width="4" fill="none" stroke-linecap="round" />
        <path d="M96 108 Q100 117 104 108" fill="#ff7b96" stroke="#e85c79" stroke-width="2" />
      `
      : opts.mouth === 'surprised'
        ? `<circle cx="100" cy="106" r="5.5" fill="#3d2a22" />`
        : `<path d="M92 104 Q100 114 108 104" stroke="#3d2a22" stroke-width="4" fill="none" stroke-linecap="round" />`;

  return wrapSvg(`
    ${shadow()}
    <g>
      <path d="M62 68 L82 34 L95 73 Z" fill="${opts.fur}" />
      <path d="M138 68 L118 34 L105 73 Z" fill="${opts.fur}" />
      <path d="M67 64 L82 43 L90 69 Z" fill="${opts.earInner ?? '#ffd4bf'}" />
      <path d="M133 64 L118 43 L110 69 Z" fill="${opts.earInner ?? '#ffd4bf'}" />

      <ellipse cx="100" cy="88" rx="42" ry="34" fill="${opts.fur}" />
      <ellipse cx="100" cy="101" rx="18" ry="12" fill="#fff6ef" />
      ${opts.patch ? `<ellipse cx="118" cy="78" rx="11" ry="9" fill="${opts.patch}" />` : ''}
      ${eyeLeft}
      ${eyeRight}
      <circle cx="100" cy="97" r="5.5" fill="#3d2a22" />
      ${mouth}

      <ellipse cx="100" cy="141" rx="44" ry="34" fill="${opts.fur}" />
      ${opts.bodySpot ? `<ellipse cx="100" cy="143" rx="24" ry="18" fill="${opts.bodySpot}" />` : ''}
      <ellipse cx="84" cy="160" rx="10" ry="13" fill="${opts.fur}" />
      <ellipse cx="116" cy="160" rx="10" ry="13" fill="${opts.fur}" />

      <ellipse cx="71" cy="123" rx="10" ry="20" fill="${opts.fur}" transform="rotate(25 71 123)" />
      <ellipse cx="129" cy="123" rx="10" ry="20" fill="${opts.fur}" transform="rotate(-25 129 123)" />

      <path d="M142 128 Q169 108 172 80" stroke="${opts.fur}" stroke-width="13" fill="none" stroke-linecap="round" />
      <path d="M148 92 Q163 79 171 88" stroke="#fff6ef" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8" />

      ${
        opts.scarf
          ? `
        <path d="M78 118 Q100 128 122 118" stroke="${opts.scarf}" stroke-width="12" fill="none" stroke-linecap="round" />
        <path d="M98 122 L108 144 L93 139 Z" fill="${opts.scarf}" />
      `
          : ''
      }

      ${opts.accessory ?? ''}
    </g>
  `);
}

function haniwaSvg(opts: {
  body?: string;
  accent?: string;
  mark?: 'heart' | 'sun' | 'wave' | 'stripe' | 'dot';
  hat?: boolean;
  arms?: 'up' | 'down' | 'wide';
  eyes?: 'round' | 'line' | 'happy';
}) {
  const body = opts.body ?? '#c98957';
  const accent = opts.accent ?? '#7d4d2b';

  const eyes =
    opts.eyes === 'line'
      ? `
        <rect x="76" y="78" width="14" height="6" rx="3" fill="${accent}" />
        <rect x="110" y="78" width="14" height="6" rx="3" fill="${accent}" />
      `
      : opts.eyes === 'happy'
        ? `
          <path d="M76 80 Q83 88 90 80" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round" />
          <path d="M110 80 Q117 88 124 80" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round" />
        `
        : `
          <circle cx="83" cy="81" r="6" fill="${accent}" />
          <circle cx="117" cy="81" r="6" fill="${accent}" />
        `;

  const arms =
    opts.arms === 'up'
      ? `
        <path d="M52 108 Q34 94 36 73" stroke="${body}" stroke-width="14" fill="none" stroke-linecap="round" />
        <path d="M148 108 Q166 94 164 73" stroke="${body}" stroke-width="14" fill="none" stroke-linecap="round" />
      `
      : opts.arms === 'wide'
        ? `
          <path d="M49 116 Q26 122 22 106" stroke="${body}" stroke-width="14" fill="none" stroke-linecap="round" />
          <path d="M151 116 Q174 122 178 106" stroke="${body}" stroke-width="14" fill="none" stroke-linecap="round" />
        `
        : `
          <path d="M52 116 Q34 129 33 147" stroke="${body}" stroke-width="14" fill="none" stroke-linecap="round" />
          <path d="M148 116 Q166 129 167 147" stroke="${body}" stroke-width="14" fill="none" stroke-linecap="round" />
        `;

  const mark =
    opts.mark === 'heart'
      ? `<path d="M100 121 C93 109 76 111 76 125 C76 137 89 143 100 152 C111 143 124 137 124 125 C124 111 107 109 100 121 Z" fill="${accent}" opacity="0.9" />`
      : opts.mark === 'sun'
        ? `<circle cx="100" cy="132" r="16" fill="none" stroke="${accent}" stroke-width="5" /><path d="M100 106 V95 M100 169 V158 M74 132 H62 M138 132 H126 M81 113 L72 104 M119 113 L128 104 M81 151 L72 160 M119 151 L128 160" stroke="${accent}" stroke-width="4" stroke-linecap="round" />`
        : opts.mark === 'wave'
          ? `<path d="M73 130 Q83 121 93 130 T113 130 T133 130" stroke="${accent}" stroke-width="5" fill="none" stroke-linecap="round" />`
          : opts.mark === 'stripe'
            ? `<path d="M74 121 H126 M74 133 H126 M74 145 H126" stroke="${accent}" stroke-width="5" stroke-linecap="round" />`
            : `<circle cx="84" cy="127" r="4" fill="${accent}" /><circle cx="100" cy="135" r="4" fill="${accent}" /><circle cx="116" cy="127" r="4" fill="${accent}" /><circle cx="92" cy="148" r="4" fill="${accent}" /><circle cx="108" cy="148" r="4" fill="${accent}" />`;

  return wrapSvg(`
    ${shadow()}
    <g>
      <ellipse cx="100" cy="154" rx="34" ry="20" fill="${body}" />
      <rect x="66" y="72" width="68" height="84" rx="18" fill="${body}" />
      <ellipse cx="100" cy="82" rx="38" ry="30" fill="${body}" />
      ${opts.hat ? `<ellipse cx="100" cy="49" rx="28" ry="11" fill="${body}" /><rect x="78" y="35" width="44" height="17" rx="8" fill="${body}" />` : ''}
      ${arms}
      <rect x="76" y="152" width="14" height="22" rx="7" fill="${body}" />
      <rect x="110" y="152" width="14" height="22" rx="7" fill="${body}" />

      ${eyes}
      <rect x="90" y="94" width="20" height="8" rx="4" fill="${accent}" />
      <rect x="84" y="106" width="32" height="10" rx="5" fill="${accent}" />

      ${mark}
    </g>
  `);
}

function doguSvg(opts: {
  body?: string;
  accent?: string;
  crown?: boolean;
  side?: boolean;
  eyes?: 'goggle' | 'almond' | 'round';
  mark?: 'spiral' | 'triangle' | 'dots' | 'flower' | 'bars';
}) {
  const body = opts.body ?? '#b78263';
  const accent = opts.accent ?? '#5b3b2b';

  const eyes =
    opts.eyes === 'almond'
      ? `
        <path d="M70 72 Q82 58 94 72 Q82 86 70 72 Z" fill="none" stroke="${accent}" stroke-width="5" />
        <path d="M106 72 Q118 58 130 72 Q118 86 106 72 Z" fill="none" stroke="${accent}" stroke-width="5" />
      `
      : opts.eyes === 'round'
        ? `
          <circle cx="82" cy="72" r="11" fill="none" stroke="${accent}" stroke-width="5" />
          <circle cx="118" cy="72" r="11" fill="none" stroke="${accent}" stroke-width="5" />
        `
        : `
          <ellipse cx="82" cy="72" rx="16" ry="12" fill="none" stroke="${accent}" stroke-width="5" />
          <ellipse cx="118" cy="72" rx="16" ry="12" fill="none" stroke="${accent}" stroke-width="5" />
        `;

  const mark =
    opts.mark === 'spiral'
      ? `
        <path d="M88 122 q10 -10 20 0 q-6 8 -14 3 q5 -7 12 0" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round" />
        <path d="M112 138 q-10 -10 -20 0 q6 8 14 3 q-5 -7 -12 0" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round" />
      `
      : opts.mark === 'triangle'
        ? `
          <path d="M100 118 L115 143 H85 Z" fill="none" stroke="${accent}" stroke-width="5" stroke-linejoin="round" />
          <path d="M100 145 L110 158 H90 Z" fill="none" stroke="${accent}" stroke-width="4" stroke-linejoin="round" />
        `
        : opts.mark === 'flower'
          ? `
            <circle cx="100" cy="132" r="6" fill="${accent}" />
            <circle cx="88" cy="132" r="5" fill="none" stroke="${accent}" stroke-width="4" />
            <circle cx="112" cy="132" r="5" fill="none" stroke="${accent}" stroke-width="4" />
            <circle cx="100" cy="120" r="5" fill="none" stroke="${accent}" stroke-width="4" />
            <circle cx="100" cy="144" r="5" fill="none" stroke="${accent}" stroke-width="4" />
          `
          : opts.mark === 'bars'
            ? `<path d="M82 120 H118 M78 132 H122 M82 144 H118" stroke="${accent}" stroke-width="5" stroke-linecap="round" />`
            : `<circle cx="84" cy="122" r="4" fill="${accent}" /><circle cx="100" cy="130" r="4" fill="${accent}" /><circle cx="116" cy="122" r="4" fill="${accent}" /><circle cx="92" cy="145" r="4" fill="${accent}" /><circle cx="108" cy="145" r="4" fill="${accent}" />`;

  return wrapSvg(`
    ${shadow()}
    <g>
      ${opts.crown ? `<path d="M68 38 L82 20 L100 38 L118 20 L132 38 L132 50 L68 50 Z" fill="${body}" />` : ''}

      <ellipse cx="100" cy="72" rx="42" ry="32" fill="${body}" />
      <rect x="64" y="88" width="72" height="74" rx="26" fill="${body}" />
      <ellipse cx="100" cy="161" rx="24" ry="14" fill="${body}" />

      ${opts.side ? `<ellipse cx="52" cy="108" rx="15" ry="28" fill="${body}" /><ellipse cx="148" cy="108" rx="15" ry="28" fill="${body}" />` : ''}
      <rect x="72" y="156" width="16" height="22" rx="8" fill="${body}" />
      <rect x="112" y="156" width="16" height="22" rx="8" fill="${body}" />

      ${eyes}
      <rect x="92" y="89" width="16" height="10" rx="4" fill="${accent}" />
      <path d="M86 100 Q100 114 114 100" stroke="${accent}" stroke-width="5" fill="none" stroke-linecap="round" />

      <path d="M72 110 Q58 122 60 139" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round" />
      <path d="M128 110 Q142 122 140 139" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round" />

      ${mark}
    </g>
  `);
}

const DOG_STICKERS: LibrarySticker[] = [
  {
    id: 'dog-shiba-smile',
    label: '柴犬スマイル',
    kind: 'svg',
    src: dogSvg({
      fur: '#d9924e',
      earInner: '#ffd8be',
      eye: 'dot',
      mouth: 'smile',
      scarf: '#ff6b8d',
      bodySpot: '#fff2dd',
    }),
  },
  {
    id: 'dog-shiba-tongue',
    label: '柴犬ぺろ',
    kind: 'svg',
    src: dogSvg({
      fur: '#e1a256',
      earInner: '#ffd7b3',
      eye: 'happy',
      mouth: 'tongue',
      bodySpot: '#fff2dd',
    }),
  },
  {
    id: 'dog-black',
    label: '黒わんこ',
    kind: 'svg',
    src: dogSvg({
      fur: '#3d3b42',
      earInner: '#cfc5c0',
      patch: '#f6e2cb',
      eye: 'dot',
      mouth: 'smile',
      scarf: '#67c5ff',
      bodySpot: '#5f5b65',
    }),
  },
  {
    id: 'dog-white',
    label: 'しろわん',
    kind: 'svg',
    src: dogSvg({
      fur: '#f7f5f0',
      earInner: '#ffd4d8',
      patch: '#e9dfd7',
      eye: 'happy',
      mouth: 'smile',
      scarf: '#8fe388',
      bodySpot: '#ece7e0',
    }),
  },
  {
    id: 'dog-brown',
    label: 'たれ耳わんこ',
    kind: 'svg',
    src: dogSvg({
      fur: '#b97a4c',
      earInner: '#f2c8a2',
      patch: '#7d4d2a',
      eye: 'wink',
      mouth: 'tongue',
      bodySpot: '#e8c1a1',
    }),
  },
  {
    id: 'dog-heart',
    label: 'ハートわんこ',
    kind: 'svg',
    src: dogSvg({
      fur: '#d28a52',
      earInner: '#ffd0b9',
      eye: 'happy',
      mouth: 'smile',
      bodySpot: '#fff0df',
      accessory:
        '<path d="M145 52 C140 42 127 44 127 54 C127 63 136 67 145 75 C154 67 163 63 163 54 C163 44 150 42 145 52 Z" fill="#ff5e7e" />',
    }),
  },
  {
    id: 'dog-bone',
    label: 'ほねわんこ',
    kind: 'svg',
    src: dogSvg({
      fur: '#cf9257',
      earInner: '#ffd8b8',
      eye: 'dot',
      mouth: 'smile',
      scarf: '#a77bff',
      bodySpot: '#fff2e6',
      accessory:
        '<g transform="translate(35 132)"><rect x="0" y="8" width="28" height="10" rx="5" fill="#f3e8d2"/><circle cx="4" cy="6" r="6" fill="#f3e8d2"/><circle cx="4" cy="20" r="6" fill="#f3e8d2"/><circle cx="24" cy="6" r="6" fill="#f3e8d2"/><circle cx="24" cy="20" r="6" fill="#f3e8d2"/></g>',
    }),
  },
  {
    id: 'dog-ball',
    label: 'ボールわんこ',
    kind: 'svg',
    src: dogSvg({
      fur: '#d89e62',
      earInner: '#ffd7be',
      eye: 'happy',
      mouth: 'smile',
      bodySpot: '#fff1e2',
      accessory:
        '<circle cx="149" cy="145" r="14" fill="#7bd0ff" /><path d="M139 145 H159 M149 135 V155" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />',
    }),
  },
  {
    id: 'dog-sunnies',
    label: 'サングラス犬',
    kind: 'svg',
    src: dogSvg({
      fur: '#c98547',
      earInner: '#ffd2b2',
      eye: 'dot',
      mouth: 'smile',
      bodySpot: '#fff2e5',
      accessory:
        '<rect x="70" y="78" width="22" height="13" rx="6" fill="#2b3c44" /><rect x="108" y="78" width="22" height="13" rx="6" fill="#2b3c44" /><rect x="92" y="82" width="16" height="4" rx="2" fill="#2b3c44" />',
    }),
  },
  {
    id: 'dog-paw',
    label: '肉球プレート',
    kind: 'svg',
    src: wrapSvg(`
      ${shadow()}
      <circle cx="100" cy="102" r="48" fill="#fff4ee" stroke="#d88d56" stroke-width="10" />
      <ellipse cx="100" cy="120" rx="23" ry="20" fill="#ff9aad" />
      <circle cx="78" cy="96" r="10" fill="#ff9aad" />
      <circle cx="96" cy="84" r="10" fill="#ff9aad" />
      <circle cx="120" cy="84" r="10" fill="#ff9aad" />
      <circle cx="138" cy="96" r="10" fill="#ff9aad" />
    `),
  },
];

const HANIWA_STICKERS: LibrarySticker[] = [
  {
    id: 'haniwa-classic',
    label: 'にっこり埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'wave',
      arms: 'down',
      eyes: 'round',
    }),
  },
  {
    id: 'haniwa-heart',
    label: 'ハート埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'heart',
      arms: 'wide',
      eyes: 'happy',
      accent: '#8d4c38',
    }),
  },
  {
    id: 'haniwa-sun',
    label: 'たいよう埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'sun',
      arms: 'up',
      hat: true,
    }),
  },
  {
    id: 'haniwa-dot',
    label: 'みずたま埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'dot',
      arms: 'down',
      eyes: 'line',
      body: '#d19460',
    }),
  },
  {
    id: 'haniwa-stripe',
    label: 'しましま埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'stripe',
      arms: 'wide',
      eyes: 'round',
      body: '#b77345',
    }),
  },
  {
    id: 'haniwa-crown',
    label: 'ぼうし埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'wave',
      hat: true,
      arms: 'down',
      eyes: 'happy',
      body: '#c07b48',
    }),
  },
  {
    id: 'haniwa-cheer',
    label: 'ばんざい埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'sun',
      arms: 'up',
      eyes: 'happy',
      body: '#cb8b54',
    }),
  },
  {
    id: 'haniwa-calm',
    label: 'おすわり埴輪',
    kind: 'svg',
    src: haniwaSvg({
      mark: 'dot',
      arms: 'down',
      eyes: 'line',
      body: '#a96a42',
      accent: '#6b4028',
    }),
  },
];

const DOGU_STICKERS: LibrarySticker[] = [
  {
    id: 'dogu-goggle',
    label: 'ゴーグル土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'goggle',
      mark: 'spiral',
      side: true,
    }),
  },
  {
    id: 'dogu-almond',
    label: 'アーモンド土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'almond',
      mark: 'triangle',
      body: '#b68163',
      side: true,
    }),
  },
  {
    id: 'dogu-round',
    label: 'まるめ土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'round',
      mark: 'dots',
      body: '#c58d6d',
      side: true,
    }),
  },
  {
    id: 'dogu-flower',
    label: 'おはな土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'goggle',
      mark: 'flower',
      body: '#b97f5f',
      crown: true,
    }),
  },
  {
    id: 'dogu-bars',
    label: 'しま土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'round',
      mark: 'bars',
      body: '#aa7358',
      accent: '#56372b',
    }),
  },
  {
    id: 'dogu-princess',
    label: 'ひめ土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'almond',
      mark: 'flower',
      body: '#c08a70',
      crown: true,
      side: true,
    }),
  },
  {
    id: 'dogu-power',
    label: 'げんき土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'goggle',
      mark: 'triangle',
      body: '#b77b5e',
      accent: '#4f3426',
    }),
  },
  {
    id: 'dogu-moon',
    label: 'しずか土偶',
    kind: 'svg',
    src: doguSvg({
      eyes: 'round',
      mark: 'spiral',
      body: '#9f6c53',
      accent: '#4d3227',
      crown: true,
    }),
  },
];

const EMOJI_STICKERS: LibrarySticker[] = [
  { id: 'emoji-heart', label: 'ハート', kind: 'emoji', emoji: '💖' },
  { id: 'emoji-sparkle', label: 'キラキラ', kind: 'emoji', emoji: '✨' },
  { id: 'emoji-sakura', label: 'さくら', kind: 'emoji', emoji: '🌸' },
  { id: 'emoji-star', label: 'スター', kind: 'emoji', emoji: '⭐' },
  { id: 'emoji-ribbon', label: 'リボン', kind: 'emoji', emoji: '🎀' },
  { id: 'emoji-strawberry', label: 'いちご', kind: 'emoji', emoji: '🍓' },
  { id: 'emoji-rainbow', label: 'にじ', kind: 'emoji', emoji: '🌈' },
  { id: 'emoji-crown', label: 'クラウン', kind: 'emoji', emoji: '👑' },
  { id: 'emoji-speech', label: 'ふきだし', kind: 'emoji', emoji: '💬' },
  { id: 'emoji-fire', label: 'ほのお', kind: 'emoji', emoji: '🔥' },
  { id: 'emoji-party', label: 'おいわい', kind: 'emoji', emoji: '🎉' },
  { id: 'emoji-100', label: '100', kind: 'emoji', emoji: '💯' },
];

export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: 'haniwa',
    label: '埴輪',
    items: HANIWA_STICKERS,
  },
  {
    id: 'dogu',
    label: '土偶',
    items: DOGU_STICKERS,
  },
  {
    id: 'dog',
    label: '犬',
    items: DOG_STICKERS,
  },
  {
    id: 'emoji',
    label: '絵文字',
    items: EMOJI_STICKERS,
  },
];
