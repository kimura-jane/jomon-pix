
import type { LibrarySticker } from './stickers';

// すべて透明背景のSVG。
// 顔への位置合わせは写真上で手動調整する。
function make(
  id: string,
  label: string,
  drawing: string,
): LibrarySticker {
  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 200 200"
    >
      ${drawing}
    </svg>
  `;

  return {
    id,
    label,
    kind: 'svg',
    src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  };
}

const outline = '#47322f';

// ========================================
// 顔デコ 30種類
// ========================================

const ALL_FACE_STICKERS: LibrarySticker[] = [
  make('face-cat-ears', 'ねこ耳', `
    <path d="M39 86 L42 22 Q66 35 81 60 Q100 55 119 60 Q134 35 158 22 L161 86 Q100 101 39 86Z" fill="#f7b8cd" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M51 69 L51 40 Q66 52 72 65Z M149 69 L149 40 Q134 52 128 65Z" fill="#fff0f4"/>
  `),

  make('face-dog-ears', 'たれ犬耳', `
    <path d="M62 60 Q24 32 17 80 Q10 123 40 133 Q61 125 75 83Z" fill="#b77942" stroke="${outline}" stroke-width="6"/>
    <path d="M138 60 Q176 32 183 80 Q190 123 160 133 Q139 125 125 83Z" fill="#b77942" stroke="${outline}" stroke-width="6"/>
    <path d="M36 82 Q26 97 33 111 M164 82 Q174 97 167 111" stroke="#efc096" stroke-width="7" fill="none" stroke-linecap="round"/>
  `),

  make('face-rabbit-ears', 'うさ耳', `
    <path d="M62 103 Q37 30 47 13 Q73 -5 87 93Z M138 103 Q163 30 153 13 Q127 -5 113 93Z" fill="#fff6fc" stroke="${outline}" stroke-width="6"/>
    <path d="M68 86 Q54 30 60 24 Q71 24 76 87Z M132 86 Q146 30 140 24 Q129 24 124 87Z" fill="#ff99c0"/>
  `),

  make('face-panda-ears', 'パンダ耳', `
    <circle cx="52" cy="65" r="31" fill="#252832"/>
    <circle cx="148" cy="65" r="31" fill="#252832"/>
    <circle cx="52" cy="65" r="15" fill="#5b5968"/>
    <circle cx="148" cy="65" r="15" fill="#5b5968"/>
  `),

  make('face-fox-ears', 'きつね耳', `
    <path d="M34 96 L25 17 Q69 36 87 82Z M166 96 L175 17 Q131 36 113 82Z" fill="#f49636" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M46 80 L38 39 Q65 55 71 78Z M154 80 L162 39 Q135 55 129 78Z" fill="#fff2df"/>
  `),

  make('face-devil-horns', '小悪魔のツノ', `
    <path d="M45 98 Q17 70 39 16 Q36 66 82 85Z M155 98 Q183 70 161 16 Q164 66 118 85Z" fill="#f43c72" stroke="#7e2140" stroke-width="5" stroke-linejoin="round"/>
    <path d="M45 67 Q43 50 44 40 M155 67 Q157 50 156 40" stroke="#ffb1c4" stroke-width="6" fill="none" stroke-linecap="round"/>
  `),

  make('face-crown', '王冠', `
    <path d="M34 117 L24 52 L65 78 L100 25 L135 78 L176 52 L166 117Z" fill="#ffdb57" stroke="#a87322" stroke-width="6" stroke-linejoin="round"/>
    <rect x="34" y="111" width="132" height="19" rx="6" fill="#f5ab35" stroke="#a87322" stroke-width="5"/>
    <path d="M93 88 L100 76 L107 88 L100 100Z" fill="#ff5894"/>
    <circle cx="60" cy="96" r="7" fill="#58c8fd"/>
    <circle cx="140" cy="96" r="7" fill="#58c8fd"/>
  `),

  make('face-halo', '天使の輪', `
    <ellipse cx="100" cy="79" rx="71" ry="22" fill="none" stroke="#f3b737" stroke-width="13"/>
    <ellipse cx="100" cy="74" rx="72" ry="22" fill="none" stroke="#fff4ae" stroke-width="8"/>
    <path d="M29 38 L33 24 L37 38 L51 42 L37 46 L33 61 L29 46 L15 42Z M166 33 L170 20 L174 33 L187 37 L174 41 L170 54 L166 41 L153 37Z" fill="#ffde68"/>
  `),

  make('face-bow', '大きなリボン', `
    <path d="M96 83 Q50 32 28 64 Q9 99 71 111Z M104 83 Q150 32 172 64 Q191 99 129 111Z" fill="#fb5b92" stroke="#9e3657" stroke-width="5"/>
    <path d="M76 96 L66 147 L96 127 L106 148 L116 95Z" fill="#f27da3" stroke="#9e3657" stroke-width="5"/>
    <rect x="87" y="76" width="26" height="35" rx="8" fill="#ffbdd1" stroke="#9e3657" stroke-width="5"/>
  `),

  make('face-sunglasses', '黒サングラス', `
    <path d="M22 83 L53 89 Q61 125 81 127 Q102 126 101 99 L99 95 Q116 92 123 95 L123 99 Q123 128 145 127 Q167 125 174 89 L189 83" fill="none" stroke="#25252d" stroke-width="10" stroke-linecap="round"/>
    <path d="M45 87 L91 92 Q96 116 79 120 Q58 122 52 103Z M109 92 L155 87 L148 103 Q142 122 121 120 Q104 116 109 92Z" fill="#25252d"/>
    <path d="M56 99 L77 96 M119 97 L142 94" stroke="#a6e8ff" stroke-width="4" opacity=".65" stroke-linecap="round"/>
  `),

  make('face-heart-glasses', 'ハートメガネ', `
    <path d="M97 90 C91 71 70 68 61 83 C47 69 24 76 26 96 C27 117 48 125 63 139 C81 127 99 115 97 90Z" fill="#ff639e" stroke="#9a375e" stroke-width="5"/>
    <path d="M103 90 C109 71 130 68 139 83 C153 69 176 76 174 96 C173 117 152 125 137 139 C119 127 101 115 103 90Z" fill="#ff639e" stroke="#9a375e" stroke-width="5"/>
    <path d="M96 91 Q100 87 104 91 M27 90 L15 84 M173 90 L185 84" fill="none" stroke="#9a375e" stroke-width="6" stroke-linecap="round"/>
    <path d="M43 93 L55 87 M120 92 L132 86" stroke="#fff1f7" stroke-width="5" opacity=".8" stroke-linecap="round"/>
  `),

  make('face-round-glasses', '丸メガネ', `
    <circle cx="64" cy="102" r="30" fill="#a8e3ff" fill-opacity=".13" stroke="#ae8445" stroke-width="7"/>
    <circle cx="136" cy="102" r="30" fill="#a8e3ff" fill-opacity=".13" stroke="#ae8445" stroke-width="7"/>
    <path d="M94 100 Q100 95 106 100 M34 97 L17 91 M166 97 L183 91" fill="none" stroke="#ae8445" stroke-width="7" stroke-linecap="round"/>
  `),

  make('face-pixel-glasses', 'ドットサングラス', `
    <path d="M24 77 H87 V90 H100 V103 H113 V90 H176 V103 H163 V116 H150 V129 H124 V116 H111 V103 H89 V116 H76 V129 H50 V116 H37 V103 H24Z" fill="#202830"/>
    <path d="M34 84 H64 V92 H34Z M123 84 H153 V92 H123Z" fill="#fff" opacity=".65"/>
  `),

  make('face-3d-glasses', '3Dメガネ', `
    <path d="M16 86 H184" stroke="${outline}" stroke-width="9" stroke-linecap="round"/>
    <rect x="32" y="80" width="62" height="46" rx="11" fill="#fe5c6d" fill-opacity=".75" stroke="${outline}" stroke-width="6"/>
    <rect x="106" y="80" width="62" height="46" rx="11" fill="#49c9f2" fill-opacity=".75" stroke="${outline}" stroke-width="6"/>
  `),

  make('face-sleepy-eyes', 'ねむねむ目', `
    <path d="M35 103 Q62 119 90 103 M110 103 Q138 119 165 103" fill="none" stroke="${outline}" stroke-width="8" stroke-linecap="round"/>
    <path d="M48 116 L42 125 M66 118 L66 128 M134 118 L134 128 M152 116 L158 125" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
  `),

  make('face-sparkle-eyes', 'キラキラ目', `
    <path d="M58 65 L68 93 L96 103 L68 113 L58 141 L48 113 L20 103 L48 93Z M142 65 L152 93 L180 103 L152 113 L142 141 L132 113 L104 103 L132 93Z" fill="#ffcf44" stroke="#d88b25" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="94" cy="51" r="7" fill="#ff87bb"/>
    <circle cx="105" cy="155" r="5" fill="#6bd6ee"/>
  `),

  make('face-heart-eyes', 'ハート目', `
    <path d="M62 104 C46 83 23 96 28 116 C32 132 51 142 62 155 C73 142 92 132 96 116 C101 96 78 83 62 104Z" fill="#ff4e86"/>
    <path d="M138 104 C122 83 99 96 104 116 C108 132 127 142 138 155 C149 142 168 132 172 116 C177 96 154 83 138 104Z" fill="#ff4e86"/>
  `),

  make('face-blush', 'ほっぺピンク', `
    <ellipse cx="47" cy="112" rx="31" ry="17" fill="#ff85a6" fill-opacity=".7"/>
    <ellipse cx="153" cy="112" rx="31" ry="17" fill="#ff85a6" fill-opacity=".7"/>
    <path d="M28 115 L40 103 M44 120 L57 105 M141 115 L153 103 M156 120 L169 105" stroke="#ff4e86" stroke-width="4" stroke-linecap="round" opacity=".8"/>
  `),

  make('face-freckles', 'そばかす', `
    <g fill="#c47b5d">
      <circle cx="29" cy="106" r="4"/>
      <circle cx="42" cy="99" r="4"/>
      <circle cx="55" cy="107" r="3.5"/>
      <circle cx="70" cy="101" r="3"/>
      <circle cx="171" cy="106" r="4"/>
      <circle cx="158" cy="99" r="4"/>
      <circle cx="145" cy="107" r="3.5"/>
      <circle cx="130" cy="101" r="3"/>
    </g>
  `),

  make('face-whiskers', 'ねこのひげ', `
    <path d="M89 95 L100 101 L111 95 L100 111Z" fill="#ec7192" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M18 98 L77 105 M22 120 L77 114 M31 141 L79 123 M182 98 L123 105 M178 120 L123 114 M169 141 L121 123" stroke="${outline}" stroke-width="5" fill="none" stroke-linecap="round"/>
  `),

  make('face-pig-snout', 'ぶた鼻', `
    <ellipse cx="100" cy="109" rx="43" ry="29" fill="#ffb4c7" stroke="#b76680" stroke-width="6"/>
    <ellipse cx="86" cy="109" rx="8" ry="13" fill="#dc7393"/>
    <ellipse cx="114" cy="109" rx="8" ry="13" fill="#dc7393"/>
    <ellipse cx="77" cy="95" rx="7" ry="4" fill="#fff4f7" opacity=".7"/>
  `),

  make('face-moustache', 'おひげ', `
    <path d="M100 106 Q88 92 73 102 Q55 115 30 94 Q33 129 65 131 Q88 133 100 117 Q112 133 135 131 Q167 129 170 94 Q145 115 127 102 Q112 92 100 106Z" fill="#3c2e30"/>
  `),

  make('face-tears', '大泣き', `
    <path d="M51 75 Q20 120 38 147 Q51 163 63 146 Q78 123 51 75Z" fill="#62caf3" stroke="#2789c4" stroke-width="5"/>
    <path d="M149 75 Q180 120 162 147 Q149 163 137 146 Q122 123 149 75Z" fill="#62caf3" stroke="#2789c4" stroke-width="5"/>
    <path d="M46 108 Q40 122 44 133 M154 108 Q160 122 156 133" stroke="#d7f7ff" stroke-width="6" fill="none" stroke-linecap="round"/>
  `),

  make('face-sweat', 'あせあせ', `
    <path d="M143 43 Q121 88 137 106 Q149 120 161 104 Q174 86 143 43Z" fill="#64cbf1" stroke="#2789bc" stroke-width="5"/>
    <path d="M140 77 Q134 90 139 97" stroke="#e6f9ff" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M49 83 L69 76 M57 107 L76 103" stroke="#fc8ca4" stroke-width="7" stroke-linecap="round"/>
  `),

  make('face-bandage', 'ばんそうこう', `
    <g transform="rotate(-23 100 100)">
      <rect x="40" y="80" width="120" height="40" rx="18" fill="#e8bfa4" stroke="#a47761" stroke-width="4"/>
      <rect x="83" y="86" width="34" height="28" rx="7" fill="#fff0df"/>
      <g fill="#c18e72">
        <circle cx="56" cy="92" r="2.5"/>
        <circle cx="65" cy="106" r="2.5"/>
        <circle cx="144" cy="92" r="2.5"/>
        <circle cx="135" cy="106" r="2.5"/>
      </g>
    </g>
  `),

  make('face-cheek-hearts', 'ハートほっぺ', `
    <path d="M48 116 C37 99 16 111 24 127 C29 138 43 147 48 155 C54 147 68 138 72 127 C80 111 59 99 48 116Z" fill="#ff679a"/>
    <path d="M152 116 C141 99 120 111 128 127 C133 138 147 147 152 155 C158 147 172 138 176 127 C184 111 163 99 152 116Z" fill="#ff679a"/>
    <circle cx="101" cy="92" r="6" fill="#ffc34c"/>
  `),

  make('face-sparkles', '顔キラキラ', `
    <path d="M36 63 L44 86 L67 94 L44 102 L36 125 L28 102 L5 94 L28 86Z" fill="#ffd65c"/>
    <path d="M160 44 L168 66 L190 74 L168 82 L160 104 L152 82 L130 74 L152 66Z" fill="#ff8ac3"/>
    <path d="M141 129 L147 144 L162 150 L147 156 L141 171 L135 156 L120 150 L135 144Z" fill="#7dd8ef"/>
  `),

  make('face-mask', 'マスク', `
    <path d="M31 91 Q18 96 19 115 Q19 133 44 130 M169 91 Q182 96 181 115 Q181 133 156 130" fill="none" stroke="#b0bcc9" stroke-width="6"/>
    <path d="M43 86 Q100 107 157 86 L151 143 Q100 178 49 143Z" fill="#f9fcff" stroke="#8ba9b8" stroke-width="5"/>
    <path d="M57 110 Q100 124 143 110 M56 125 Q100 141 144 125" fill="none" stroke="#c6d7df" stroke-width="4"/>
  `),

  make('face-angry', '怒りマーク', `
    <path d="M91 39 L78 88 L41 72 M91 39 L112 91 L153 73" fill="none" stroke="#fa5269" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M42 72 L30 53 M152 73 L165 52" fill="none" stroke="#fa5269" stroke-width="9" stroke-linecap="round"/>
  `),

  make('face-mustache-glasses', '変装メガネ', `
    <circle cx="63" cy="80" r="26" fill="none" stroke="#242d32" stroke-width="8"/>
    <circle cx="137" cy="80" r="26" fill="none" stroke="#242d32" stroke-width="8"/>
    <path d="M89 77 Q100 71 111 77" stroke="#242d32" stroke-width="7" fill="none"/>
    <path d="M100 100 L83 131 H117Z" fill="#ef9d5b" stroke="${outline}" stroke-width="4"/>
    <path d="M100 144 Q81 130 69 143 Q51 158 29 143 Q42 179 76 165 Q89 163 100 151 Q111 163 124 165 Q158 179 171 143 Q149 158 131 143 Q119 130 100 144Z" fill="#262932"/>
  `),
];

// ========================================
// 犬 8種類
// 犬種ごとに顔・耳・体形を変更
// ========================================

export const VARIETY_DOG_STICKERS: LibrarySticker[] = [
  make('breed-corgi', 'コーギー', `
    <path d="M45 117 L23 61 L69 87 L125 87 L172 61 L155 121Z" fill="#d58a40" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M39 110 Q100 75 161 110 L148 158 Q100 181 52 158Z" fill="#e9aa62" stroke="${outline}" stroke-width="5"/>
    <path d="M66 120 Q100 97 134 120 L128 154 Q100 175 72 154Z" fill="#fff2e2"/>
    <circle cx="69" cy="122" r="6" fill="${outline}"/>
    <circle cx="131" cy="122" r="6" fill="${outline}"/>
    <ellipse cx="100" cy="139" rx="10" ry="7" fill="${outline}"/>
    <path d="M92 150 Q100 161 108 150" stroke="${outline}" stroke-width="4" fill="none" stroke-linecap="round"/>
  `),

  make('breed-poodle', 'プードル', `
    <g fill="#f0c48e" stroke="#ad7f50" stroke-width="3">
      <circle cx="56" cy="89" r="20"/>
      <circle cx="74" cy="66" r="23"/>
      <circle cx="105" cy="62" r="25"/>
      <circle cx="131" cy="68" r="23"/>
      <circle cx="147" cy="94" r="20"/>
      <circle cx="105" cy="112" r="51"/>
    </g>
    <ellipse cx="105" cy="129" rx="30" ry="25" fill="#fff0df"/>
    <circle cx="83" cy="108" r="5" fill="${outline}"/>
    <circle cx="126" cy="108" r="5" fill="${outline}"/>
    <ellipse cx="105" cy="125" rx="8" ry="6" fill="${outline}"/>
    <path d="M94 139 Q105 149 116 139" fill="none" stroke="${outline}" stroke-width="4" stroke-linecap="round"/>
    <path d="M85 164 L75 186 M126 164 L135 186" stroke="#d9a46b" stroke-width="12" stroke-linecap="round"/>
  `),

  make('breed-dachshund', 'ダックス', `
    <path d="M47 113 Q82 92 147 109 Q177 116 169 141 Q151 153 61 147Z" fill="#b67547" stroke="${outline}" stroke-width="5"/>
    <path d="M54 121 Q32 98 20 75 Q11 85 15 111 Q24 134 45 135Z" fill="#825034" stroke="${outline}" stroke-width="5"/>
    <ellipse cx="49" cy="117" rx="30" ry="28" fill="#ce925d" stroke="${outline}" stroke-width="5"/>
    <path d="M27 107 Q15 131 32 140 Q48 147 49 115" fill="#864f32"/>
    <circle cx="56" cy="109" r="5" fill="${outline}"/>
    <ellipse cx="73" cy="128" rx="7" ry="5" fill="${outline}"/>
    <path d="M69 142 L67 164 M148 143 L149 164 M171 122 Q184 103 189 111" stroke="#9b613a" stroke-width="11" stroke-linecap="round" fill="none"/>
  `),

  make('breed-dalmatian', 'ダルメシアン', `
    <path d="M58 82 Q29 40 25 93 Q27 126 51 126 M142 82 Q171 40 175 93 Q173 126 149 126" fill="#27272f" stroke="#27272f" stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="100" cy="111" rx="54" ry="59" fill="#ffffff" stroke="${outline}" stroke-width="6"/>
    <path d="M65 94 Q70 76 87 82 L89 104 Q76 115 65 94Z" fill="#30313a"/>
    <circle cx="74" cy="105" r="5" fill="#fff"/>
    <circle cx="123" cy="105" r="6" fill="${outline}"/>
    <ellipse cx="101" cy="132" rx="11" ry="8" fill="${outline}"/>
    <path d="M92 143 Q101 154 110 143" stroke="${outline}" stroke-width="4" fill="none"/>
    <circle cx="74" cy="155" r="8" fill="#30313a"/>
    <circle cx="129" cy="69" r="6" fill="#30313a"/>
  `),

  make('breed-husky', 'ハスキー', `
    <path d="M54 88 L39 29 L82 63 L119 63 L161 29 L146 88" fill="#546477" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M48 88 Q49 50 99 55 Q151 49 153 88 L144 154 Q100 187 55 154Z" fill="#708296" stroke="${outline}" stroke-width="5"/>
    <path d="M60 92 Q73 104 94 88 L100 115 L107 88 Q128 103 140 91 L135 150 Q100 176 65 150Z" fill="#f9f9fb"/>
    <path d="M70 106 Q83 97 91 107 M109 107 Q120 97 132 106" stroke="#344659" stroke-width="5" fill="none"/>
    <circle cx="81" cy="109" r="5" fill="#6fbef5"/>
    <circle cx="119" cy="109" r="5" fill="#6fbef5"/>
    <ellipse cx="100" cy="140" rx="10" ry="7" fill="${outline}"/>
  `),

  make('breed-bulldog', 'フレンチブル', `
    <path d="M43 99 Q23 24 71 48 L85 86Z M157 99 Q177 24 129 48 L115 86Z" fill="#444551" stroke="${outline}" stroke-width="5"/>
    <path d="M54 92 Q100 61 146 92 L159 144 Q143 176 100 178 Q57 176 41 144Z" fill="#4f505e" stroke="${outline}" stroke-width="5"/>
    <ellipse cx="100" cy="140" rx="37" ry="28" fill="#e6d0b5"/>
    <circle cx="69" cy="116" r="6" fill="#fcfcfc"/>
    <circle cx="131" cy="116" r="6" fill="#fcfcfc"/>
    <circle cx="70" cy="117" r="3" fill="${outline}"/>
    <circle cx="130" cy="117" r="3" fill="${outline}"/>
    <ellipse cx="100" cy="131" rx="16" ry="11" fill="${outline}"/>
    <path d="M100 140 L100 152 M89 153 Q100 163 111 153" stroke="${outline}" stroke-width="4" fill="none"/>
  `),

  make('breed-samoyed', 'サモエド', `
    <path d="M46 87 L29 47 L71 62 M154 87 L171 47 L129 62" fill="#fff" stroke="#c9bfc2" stroke-width="5"/>
    <path d="M55 72 Q100 26 145 72 Q188 95 165 142 Q173 182 130 177 Q100 197 70 177 Q27 182 35 142 Q12 95 55 72Z" fill="#fffefa" stroke="#c9bfc2" stroke-width="5"/>
    <circle cx="76" cy="111" r="6" fill="${outline}"/>
    <circle cx="124" cy="111" r="6" fill="${outline}"/>
    <ellipse cx="100" cy="127" rx="10" ry="7" fill="${outline}"/>
    <path d="M84 144 Q100 160 116 144" stroke="${outline}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="52" cy="135" rx="15" ry="8" fill="#f8c6cf" opacity=".5"/>
    <ellipse cx="148" cy="135" rx="15" ry="8" fill="#f8c6cf" opacity=".5"/>
  `),

  make('breed-retriever', 'レトリバー', `
    <path d="M55 84 Q18 87 24 129 Q31 161 60 143 M145 84 Q182 87 176 129 Q169 161 140 143" fill="#af723e" stroke="${outline}" stroke-width="5"/>
    <path d="M53 97 Q46 48 100 48 Q154 48 147 97 L145 152 Q100 191 55 152Z" fill="#e1a65d" stroke="${outline}" stroke-width="5"/>
    <path d="M72 134 Q100 110 128 134 Q124 162 100 163 Q76 162 72 134Z" fill="#ffdfb3"/>
    <circle cx="76" cy="111" r="5" fill="${outline}"/>
    <circle cx="124" cy="111" r="5" fill="${outline}"/>
    <ellipse cx="100" cy="132" rx="9" ry="7" fill="${outline}"/>
    <path d="M89 148 Q100 157 111 148" stroke="${outline}" stroke-width="4" fill="none"/>
    <path d="M76 73 Q100 58 124 73" stroke="#fff0cf" stroke-width="7" fill="none" stroke-linecap="round"/>
  `),
];

// サングラス・メガネ類は独立した「サングラス」カテゴリで選択する。
// 既存のSVG定義は残し、顔デコ一覧からだけ除外する（保存済み作品を守る）。
export const FACE_STICKERS: LibrarySticker[] = ALL_FACE_STICKERS.filter(
  (sticker) => ![
    'face-sunglasses',
    'face-heart-glasses',
    'face-round-glasses',
    'face-pixel-glasses',
    'face-3d-glasses',
    'face-mustache-glasses',
  ].includes(sticker.id),
);

// ========================================
// 埴輪 6種類
// ========================================

export const VARIETY_HANIWA_STICKERS: LibrarySticker[] = [
  make('haniwa-horse', '馬形埴輪', `
    <path d="M32 87 L52 51 L70 68 L91 76 L142 82 Q162 91 162 117 L146 129 L142 174 L128 174 L126 130 L81 130 L78 174 L64 174 L61 123 L46 118 L30 105Z" fill="#c68b5e" stroke="#754b37" stroke-width="5" stroke-linejoin="round"/>
    <path d="M44 63 L44 38 L60 50 L69 41 L76 71" fill="#c68b5e" stroke="#754b37" stroke-width="5"/>
    <circle cx="48" cy="83" r="5" fill="#754b37"/>
    <path d="M81 82 L81 122 M98 83 L98 122 M116 85 L116 126" stroke="#754b37" stroke-width="4"/>
    <path d="M152 100 Q184 93 174 66" stroke="#754b37" stroke-width="8" fill="none" stroke-linecap="round"/>
  `),

  make('haniwa-bird', '鳥形埴輪', `
    <path d="M42 108 Q54 58 106 67 Q142 68 146 95 Q180 88 185 103 L151 116 Q139 152 98 156 L101 177 L87 177 L86 156 Q49 146 42 108Z" fill="#cf9768" stroke="#744c39" stroke-width="5"/>
    <path d="M57 96 Q87 106 96 139 Q61 137 57 96Z" fill="#b87751" stroke="#744c39" stroke-width="4"/>
    <path d="M40 100 L17 112 L42 120" fill="#d7aa7f" stroke="#744c39" stroke-width="4"/>
    <circle cx="55" cy="83" r="5" fill="#744c39"/>
    <path d="M105 156 L119 175 M92 156 L77 177" stroke="#744c39" stroke-width="5"/>
  `),

  make('haniwa-house', '家形埴輪', `
    <path d="M24 84 L100 31 L176 84Z" fill="#a76e50" stroke="#704632" stroke-width="6" stroke-linejoin="round"/>
    <rect x="43" y="85" width="114" height="89" rx="5" fill="#d4a178" stroke="#704632" stroke-width="6"/>
    <rect x="85" y="120" width="30" height="54" rx="4" fill="#714833"/>
    <rect x="57" y="104" width="19" height="25" rx="3" fill="#71503a"/>
    <rect x="124" y="104" width="19" height="25" rx="3" fill="#71503a"/>
    <path d="M47 74 H153" stroke="#e8bb95" stroke-width="5"/>
  `),

  make('haniwa-dancer', '踊る埴輪', `
    <circle cx="100" cy="60" r="31" fill="#c99067" stroke="#754935" stroke-width="5"/>
    <path d="M78 94 L122 94 L138 164 L62 164Z" fill="#c99067" stroke="#754935" stroke-width="5"/>
    <path d="M77 112 Q35 103 28 70 M123 112 Q169 94 174 58" stroke="#c99067" stroke-width="20" fill="none" stroke-linecap="round"/>
    <circle cx="88" cy="59" r="5" fill="#754935"/>
    <circle cx="112" cy="59" r="5" fill="#754935"/>
    <ellipse cx="100" cy="75" rx="6" ry="8" fill="#754935"/>
    <path d="M80 126 H120 M79 140 H121" stroke="#754935" stroke-width="4"/>
    <path d="M78 165 L67 184 M120 165 L133 184" stroke="#c99067" stroke-width="15" stroke-linecap="round"/>
  `),

  make('haniwa-warrior', '武人埴輪', `
    <path d="M70 47 L130 47 L138 77 L62 77Z" fill="#b98157" stroke="#714b34" stroke-width="5"/>
    <circle cx="100" cy="83" r="32" fill="#c89062" stroke="#714b34" stroke-width="5"/>
    <path d="M62 119 H138 L147 172 H53Z" fill="#ba7c52" stroke="#714b34" stroke-width="5"/>
    <circle cx="88" cy="82" r="5" fill="#714b34"/>
    <circle cx="112" cy="82" r="5" fill="#714b34"/>
    <path d="M89 99 H111 M72 136 H128 M74 149 H126" stroke="#714b34" stroke-width="5"/>
    <path d="M51 125 L24 108 L17 155 L48 169Z" fill="#d0a079" stroke="#714b34" stroke-width="5"/>
    <path d="M156 46 L171 46 L171 182" stroke="#714b34" stroke-width="6" fill="none"/>
  `),

  make('haniwa-boat', '舟形埴輪', `
    <path d="M22 112 Q98 145 178 112 L151 163 Q100 189 49 163Z" fill="#be8157" stroke="#704935" stroke-width="6" stroke-linejoin="round"/>
    <path d="M100 37 V137" stroke="#704935" stroke-width="8" stroke-linecap="round"/>
    <path d="M103 41 L157 96 L103 96Z" fill="#d4a47a" stroke="#704935" stroke-width="5"/>
    <path d="M33 139 Q100 166 167 139" fill="none" stroke="#80543d" stroke-width="5"/>
    <circle cx="58" cy="148" r="5" fill="#704935"/>
    <circle cx="99" cy="158" r="5" fill="#704935"/>
    <circle cx="143" cy="149" r="5" fill="#704935"/>
  `),
];

// ========================================
// 土偶 6種類
// ========================================

export const VARIETY_DOGU_STICKERS: LibrarySticker[] = [
  make('dogu-shakoki', '遮光器土偶', `
    <path d="M48 74 L32 49 L56 41 L72 48 L90 31 L110 31 L128 48 L144 41 L168 49 L152 74Z" fill="#b87a5b" stroke="#674435" stroke-width="5"/>
    <ellipse cx="100" cy="80" rx="56" ry="38" fill="#cb9270" stroke="#674435" stroke-width="5"/>
    <ellipse cx="76" cy="80" rx="21" ry="15" fill="none" stroke="#674435" stroke-width="7"/>
    <ellipse cx="124" cy="80" rx="21" ry="15" fill="none" stroke="#674435" stroke-width="7"/>
    <path d="M88 99 H112 M93 113 H107" stroke="#674435" stroke-width="5"/>
    <path d="M75 114 Q100 106 125 114 L144 166 L117 182 L100 167 L83 182 L56 166Z" fill="#bd805f" stroke="#674435" stroke-width="5"/>
    <path d="M75 133 H125 M69 148 H131 M85 164 L100 150 L115 164" stroke="#674435" stroke-width="4" fill="none"/>
  `),

  make('dogu-heart-face', 'ハート形土偶', `
    <path d="M100 60 C68 23 22 45 34 87 C43 110 72 123 100 142 C128 123 157 110 166 87 C178 45 132 23 100 60Z" fill="#bd7e61" stroke="#664536" stroke-width="6"/>
    <path d="M65 101 L75 90 L87 101 M113 101 L125 90 L137 101" fill="none" stroke="#664536" stroke-width="6" stroke-linecap="round"/>
    <path d="M93 112 H107" stroke="#664536" stroke-width="5"/>
    <path d="M81 133 L67 176 L91 176 L100 152 L109 176 L133 176 L119 133" fill="#bd7e61" stroke="#664536" stroke-width="5"/>
    <path d="M51 123 L28 148 M149 123 L172 148" stroke="#bd7e61" stroke-width="16" stroke-linecap="round"/>
  `),

  make('dogu-spikes', '角付き土偶', `
    <path d="M54 67 L34 15 L77 52 L100 26 L123 52 L166 15 L146 67Z" fill="#a56c56" stroke="#624033" stroke-width="5" stroke-linejoin="round"/>
    <path d="M49 80 Q49 49 100 49 Q151 49 151 80 L137 114 Q100 136 63 114Z" fill="#c48867" stroke="#624033" stroke-width="5"/>
    <path d="M71 83 H88 M112 83 H129" stroke="#624033" stroke-width="9" stroke-linecap="round"/>
    <circle cx="100" cy="103" r="6" fill="#624033"/>
    <path d="M69 124 L131 124 L149 160 L126 180 H74 L51 160Z" fill="#ad765b" stroke="#624033" stroke-width="5"/>
    <path d="M100 136 L118 157 L100 173 L82 157Z" fill="none" stroke="#624033" stroke-width="5"/>
  `),

  make('dogu-sitting', 'おすわり土偶', `
    <ellipse cx="100" cy="68" rx="37" ry="34" fill="#bf896b" stroke="#694737" stroke-width="5"/>
    <path d="M80 65 Q88 59 95 65 M105 65 Q112 59 120 65" fill="none" stroke="#694737" stroke-width="6"/>
    <path d="M94 88 H106" stroke="#694737" stroke-width="4"/>
    <path d="M73 104 Q100 96 127 104 L140 147 L60 147Z" fill="#b67a5d" stroke="#694737" stroke-width="5"/>
    <path d="M68 135 Q28 126 34 156 Q51 177 91 167 M132 135 Q172 126 166 156 Q149 177 109 167" fill="#c28b6a" stroke="#694737" stroke-width="5"/>
    <path d="M79 118 H121 M83 132 H117" stroke="#694737" stroke-width="5"/>
  `),

  make('dogu-mask', '仮面土偶', `
    <path d="M49 50 Q100 9 151 50 L156 121 Q138 155 100 167 Q62 155 44 121Z" fill="#c18a6c" stroke="#674332" stroke-width="6"/>
    <path d="M53 90 L85 78 L89 105 L56 115Z M147 90 L115 78 L111 105 L144 115Z" fill="#6c4938"/>
    <path d="M100 101 L87 130 H113Z" fill="#8d5a44" stroke="#674332" stroke-width="4"/>
    <path d="M83 145 L117 145" stroke="#674332" stroke-width="7" stroke-linecap="round"/>
    <circle cx="51" cy="67" r="7" fill="#674332"/>
    <circle cx="149" cy="67" r="7" fill="#674332"/>
    <path d="M49 51 L28 85 M151 51 L172 85" stroke="#674332" stroke-width="5"/>
  `),

  make('dogu-triangle', '三角模様土偶', `
    <circle cx="100" cy="57" r="31" fill="#a86e52" stroke="#613f30" stroke-width="5"/>
    <circle cx="88" cy="53" r="5" fill="#613f30"/>
    <circle cx="112" cy="53" r="5" fill="#613f30"/>
    <path d="M93 71 H107" stroke="#613f30" stroke-width="4"/>
    <path d="M100 87 L158 174 H42Z" fill="#c28b68" stroke="#613f30" stroke-width="6" stroke-linejoin="round"/>
    <path d="M100 113 L117 143 H83Z M75 150 L85 166 H65Z M125 150 L135 166 H115Z" fill="none" stroke="#613f30" stroke-width="4"/>
    <path d="M72 108 L35 130 M128 108 L165 130" fill="none" stroke="#b87e5b" stroke-width="15" stroke-linecap="round"/>
  `),
];
