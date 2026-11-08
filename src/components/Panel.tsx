
import {
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  useEditor,
  type CanvasPreset,
} from '../store';
import {
  addImageFromFile,
  addSticker,
  addLibrarySticker,
  addText,
} from '../lib/factory';
import { STICKER_CATEGORIES } from '../lib/stickers';
import { removeBg } from '../lib/removeBg';
import { PhotoCropModal } from './PhotoCropModal';
import { CanvasCropModal } from './CanvasCropModal';
import {
  FONTS,
  FONT_GROUPS,
  TEXT_PRESETS,
} from '../lib/fonts';
import { PENS } from '../lib/pens';
import type {
  CanvasEl,
  FilterPreset,
  TextEl,
} from '../types';

const COLORS = [
  '#ff4fa3', '#ff5e5e', '#ffb84d',
  '#ffe94d', '#5be37d', '#4dc3ff',
  '#a77bff', '#ffffff', '#222222',
];

const BG = [
  '#ffffff', '#fff6fb', '#ffe4ef',
  '#efe6ff', '#e8f4ff', '#fdf6e3',
  '#e9f7ee', '#222222',
];

const FILTERS: {
  id: FilterPreset;
  label: string;
}[] = [
  { id: 'none', label: 'なし' },
  { id: 'vivid', label: 'ビビッド' },
  { id: 'soft', label: 'ふんわり' },
  { id: 'cool', label: 'クール' },
  { id: 'sepia', label: 'セピア' },
  { id: 'mono', label: 'モノクロ' },
];

const CANVAS_PRESETS: {
  id: CanvasPreset;
  label: string;
}[] = [
  { id: 'square', label: '□ 正方形' },
  { id: '4:5', label: '▯ 4:5' },
  { id: '9:16', label: '▯ 9:16' },
  { id: 'photo', label: '写真に合わせる' },
];

// 従来の犬の絵文字も残す
const DOG_EMOJI = [
  '🐶', '🐕', '🐩', '🦮',
  '🐕‍🦺', '🐾', '🦴', '🌭',
];

// 既存の絵文字で、新しい一覧にないもの
const EXTRA_EMOJI = [
  '🐰', '🫶', '🥳',
  '😂', '😍', '🙈',
];

const GLASSES = [
  '🕶', '😎', '🥽', '👓',
];

function Seg({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="seg">
      {items.map((item) => (
        <button
          key={item}
          className={
            value === item ? 'on' : ''
          }
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const Soon = ({
  em,
  children,
}: {
  em: string;
  children: ReactNode;
}) => (
  <div className="soon">
    <span className="em">{em}</span>
    {children}
    <br />
    準備中だよ
  </div>
);

function Dots({
  value,
  colors,
  onPick,
}: {
  value: string;
  colors: string[];
  onPick: (c: string) => void;
}) {
  return (
    <div className="dots">
      {colors.map((color) => (
        <button
          key={color}
          className={`dot ${
            value === color ? 'on' : ''
          }`}
          style={{
            background: color,
          }}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) =>
          onChange(Number(e.target.value))
        }
      />
    </label>
  );
}

// 写真タブ
function ImageTab() {
  const ref = useRef<HTMLInputElement>(null);
  const clear = useEditor((s) => s.clear);

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          for (
            const file of Array.from(
              e.target.files ?? [],
            )
          ) {
            await addImageFromFile(file);
          }

          e.target.value = '';
        }}
      />

      <button
        className="big-btn"
        onClick={() => ref.current?.click()}
      >
        ＋ 写真を追加
      </button>

      <button
        className="big-btn light"
        onClick={() => {
          if (
            confirm(
              '今の作品を消して新しく作る？',
            )
          ) {
            clear();
          }
        }}
      >
        ✨ 新しく作る
      </button>

      <p className="hint-s">
        作品は自動で保存されます。
        コラージュと作品一覧は準備中だよ
      </p>
    </>
  );
}

// 文字タブ
function TextTab({
  el,
}: {
  el?: TextEl;
}) {
  const [sub, setSub] = useState('文字');

  const [group, setGroup] =
    useState<string>(FONT_GROUPS[0]);

  const update = useEditor((s) => s.update);

  const up = (patch: Partial<TextEl>) => {
    if (el) {
      update(el.id, patch);
    }
  };

  return (
    <>
      <Seg
        items={['文字', '吹き出し']}
        value={sub}
        onChange={setSub}
      />

      {sub === '吹き出し' ? (
        <Soon em="💬">
          丸・ギザギザ・もくもく・LINE風の吹き出し
        </Soon>
      ) : (
        <>
          {!el && (
            <button
              className="big-btn"
              onClick={() => addText()}
            >
              ＋ 文字を入れる
            </button>
          )}

          {el && (
            <textarea
              className="input"
              rows={2}
              value={el.text}
              onChange={(e) =>
                up({
                  text: e.target.value,
                })
              }
            />
          )}

          <div className="label">
            スタイル
          </div>

          <div className="row">
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="chip"
                style={{
                  fontFamily:
                    preset.style.fontFamily,
                }}
                onClick={() => {
                  if (el) {
                    up(preset.style);
                  } else {
                    addText(preset.style);
                  }
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {el && (
            <>
              <div className="label">
                フォント
              </div>

              <Seg
                items={FONT_GROUPS}
                value={group}
                onChange={setGroup}
              />

              <div className="row">
                {FONTS.filter(
                  (font) =>
                    font.group === group,
                ).map((font) => (
                  <button
                    key={font.family}
                    className={`chip ${
                      el.fontFamily ===
                      font.family
                        ? 'on'
                        : ''
                    }`}
                    style={{
                      fontFamily: font.family,
                    }}
                    onClick={() =>
                      up({
                        fontFamily:
                          font.family,
                      })
                    }
                  >
                    {font.label}
                  </button>
                ))}
              </div>

              <div className="label">
                色
              </div>

              <Dots
                value={el.fill}
                colors={COLORS}
                onPick={(color) =>
                  up({ fill: color })
                }
              />

              <div className="label">
                ふちどり
              </div>

              <Dots
                value={el.stroke}
                colors={['', ...COLORS]}
                onPick={(color) =>
                  up({
                    stroke: color,
                    strokeWidth:
                      el.strokeWidth || 6,
                  })
                }
              />

              <div className="label">
                光る
              </div>

              <Dots
                value={el.glow}
                colors={[
                  '',
                  '#ff2fd0',
                  '#ffe14d',
                  '#4dc3ff',
                  '#39ff88',
                  '#ffffff',
                ]}
                onPick={(color) =>
                  up({ glow: color })
                }
              />

              <div className="label">
                形
              </div>

              <div className="row">
                <button
                  className={`chip ${
                    !el.vertical
                      ? 'on'
                      : ''
                  }`}
                  onClick={() =>
                    up({
                      vertical: false,
                    })
                  }
                >
                  横書き
                </button>

                <button
                  className={`chip ${
                    el.vertical
                      ? 'on'
                      : ''
                  }`}
                  onClick={() =>
                    up({
                      vertical: true,
                    })
                  }
                >
                  縦書き
                </button>

                {(
                  [
                    'left',
                    'center',
                    'right',
                  ] as const
                ).map((align) => (
                  <button
                    key={align}
                    className={`chip ${
                      el.align === align
                        ? 'on'
                        : ''
                    }`}
                    onClick={() =>
                      up({ align })
                    }
                  >
                    {align === 'left'
                      ? '左'
                      : align === 'center'
                        ? '中央'
                        : '右'}
                  </button>
                ))}
              </div>

              <Slider
                label="大きさ"
                min={16}
                max={200}
                value={el.fontSize}
                onChange={(value) =>
                  up({
                    fontSize: value,
                  })
                }
              />

              <Slider
                label="字間"
                min={-5}
                max={40}
                value={el.letterSpacing}
                onChange={(value) =>
                  up({
                    letterSpacing: value,
                  })
                }
              />

              <button
                className="big-btn light"
                onClick={() => addText()}
              >
                ＋ もう1つ文字を入れる
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}

// ペンタブ
function PenTab() {
  const {
    tool,
    setTool,
    pen,
    setPen,
  } = useEditor();

  return (
    <>
      <Seg
        items={[
          'ペン',
          '消しゴム',
        ]}
        value={
          tool === 'eraser'
            ? '消しゴム'
            : 'ペン'
        }
        onChange={(value) =>
          setTool(
            value === '消しゴム'
              ? 'eraser'
              : 'pen',
          )
        }
      />

      {tool === 'eraser' ? (
        <p className="hint-s">
          なぞった線を1本ずつ消せるよ
        </p>
      ) : (
        <>
          {(
            [
              'まじめ',
              'かわいい',
            ] as const
          ).map((group) => (
            <div key={group}>
              <div className="label">
                {group}
              </div>

              <div className="row">
                {PENS.filter(
                  (p) =>
                    p.group === group,
                ).map((p) => (
                  <button
                    key={p.style}
                    className={`chip ${
                      pen.style ===
                      p.style
                        ? 'on'
                        : ''
                    }`}
                    onClick={() =>
                      setPen({
                        style: p.style,
                      })
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="label">
            色
          </div>

          <Dots
            value={pen.color}
            colors={COLORS}
            onPick={(color) =>
              setPen({
                color,
              })
            }
          />

          <Slider
            label="太さ"
            min={2}
            max={40}
            value={pen.width}
            onChange={(width) =>
              setPen({
                width,
              })
            }
          />
        </>
      )}
    </>
  );
}

// スタンプタブ
function StampTab() {
  const [sub, setSub] = useState('犬');

  const category =
    STICKER_CATEGORIES.find(
      (item) =>
        item.label === sub,
    );

  const categoryNames = [
    'マイスタンプ',
    ...STICKER_CATEGORIES.map(
      (item) => item.label,
    ),
  ];

  const extraEmoji =
    sub === '犬'
      ? DOG_EMOJI
      : sub === '絵文字'
        ? EXTRA_EMOJI
        : [];

  return (
    <>
      <Seg
        items={categoryNames}
        value={sub}
        onChange={setSub}
      />

      {sub === 'マイスタンプ' && (
        <Soon em="📷">
          カメラロール → 背景を自動で消す → 登録
        </Soon>
      )}

      {category && (
        <>
          <p className="hint-s">
            {category.label}スタンプ
            {category.items.length}種類
            ・タップすると追加できます
          </p>

          <div className="grid">
            {category.items.map(
              (sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className="cell"
                  title={sticker.label}
                  aria-label={
                    `${sticker.label}を追加`
                  }
                  onClick={() =>
                    addLibrarySticker(
                      sticker,
                    )
                  }
                  style={{
                    minWidth: 0,
                    padding: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent:
                      'center',
                    alignItems:
                      'center',
                    gap: 2,
                    overflow: 'hidden',
                  }}
                >
                  {sticker.kind ===
                    'svg' &&
                  sticker.src ? (
                    <img
                      src={sticker.src}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      style={{
                        width: '78%',
                        height: '72%',
                        objectFit:
                          'contain',
                        pointerEvents:
                          'none',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 23,
                        lineHeight: 1,
                      }}
                    >
                      {sticker.emoji}
                    </span>
                  )}

                  <span
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign:
                        'center',
                      fontSize: 9,
                      lineHeight: 1.1,
                      whiteSpace:
                        'nowrap',
                      overflow:
                        'hidden',
                      textOverflow:
                        'ellipsis',
                    }}
                  >
                    {sticker.label}
                  </span>
                </button>
              ),
            )}
          </div>

          {extraEmoji.length > 0 && (
            <>
              <div className="label">
                {sub === '犬'
                  ? '犬の絵文字'
                  : 'その他の絵文字'}
              </div>

              <div className="grid">
                {extraEmoji.map(
                  (emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="cell"
                      onClick={() =>
                        addSticker(
                          emoji,
                        )
                      }
                    >
                      {emoji}
                    </button>
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// 加工タブ
function EditTab({
  el,
}: {
  el?: CanvasEl;
}) {
  const s = useEditor();

  const [sub, setSub] = useState(
    el?.type === 'image'
      ? '切り抜き'
      : el
        ? '配置'
        : 'キャンバス',
  );

  const [busy, setBusy] =
    useState(false);

  const [cropOpen, setCropOpen] =
    useState(false);

  const [
    canvasCropOpen,
    setCanvasCropOpen,
  ] = useState(false);

  const off = !el;

  const changeCanvas = (
    preset: CanvasPreset,
  ) => {
    const success =
      s.setCanvasPreset(
        preset,
      );

    if (!success) {
      alert(
        '写真がありません。先に写真を追加してください。',
      );
    }
  };

  return (
    <>
      <Seg
        items={[
          '配置',
          '切り抜き',
          '色',
          'キャンバス',
        ]}
        value={sub}
        onChange={setSub}
      />

      {sub === '配置' && (
        <>
          {off && (
            <p className="hint-s">
              キャンバスの物をタップして選んでね
            </p>
          )}

          <div className="row">
            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.move(
                  el.id,
                  'front',
                )
              }
            >
              ⤒ 最前面
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.move(
                  el.id,
                  'up',
                )
              }
            >
              ↑ 1つ前へ
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.move(
                  el.id,
                  'down',
                )
              }
            >
              ↓ 1つ後ろへ
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.move(
                  el.id,
                  'back',
                )
              }
            >
              ⤓ 最背面
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.update(
                  el.id,
                  {
                    scaleX:
                      -el.scaleX,
                  },
                )
              }
            >
              ⇋ 左右反転
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.update(
                  el.id,
                  {
                    scaleY:
                      -el.scaleY,
                  },
                )
              }
            >
              ⇵ 上下反転
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.duplicate(
                  el.id,
                )
              }
            >
              ⧉ 複製
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.update(
                  el.id,
                  {
                    locked:
                      !el.locked,
                  },
                )
              }
            >
              {el?.locked
                ? '🔓 ロック解除'
                : '🔒 ロック'}
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.remove(
                  el.id,
                )
              }
            >
              🗑 削除
            </button>
          </div>

          {el && (
            <Slider
              label="透明度"
              min={0.1}
              max={1}
              step={0.05}
              value={
                el.opacity
              }
              onChange={(opacity) =>
                s.update(
                  el.id,
                  { opacity },
                )
              }
            />
          )}
        </>
      )}

      {sub === '切り抜き' && (
        el?.type === 'image' ? (
          <>
            <button
              className="big-btn light"
              disabled={busy}
              onClick={() =>
                setCropOpen(true)
              }
            >
              ✂ 写真をトリミング
            </button>

            <button
              className="big-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);

                try {
                  s.update(
                    el.id,
                    {
                      src:
                        await removeBg(
                          el.src,
                        ),
                    },
                  );
                } catch {
                  alert(
                    '背景削除に失敗しました',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? '背景を消しています…'
                : '✂️ 背景を消す'}
            </button>

            <p className="hint-s">
              写真の切り抜き範囲を調整できます。
            </p>
          </>
        ) : (
          <p className="hint-s">
            写真を選ぶと使えるよ
          </p>
        )
      )}

      {sub === '色' && (
        el?.type === 'image' ? (
          <div className="row">
            {FILTERS.map(
              (filter) => (
                <button
                  key={
                    filter.id
                  }
                  className={`chip ${
                    el.filter ===
                    filter.id
                      ? 'on'
                      : ''
                  }`}
                  onClick={() =>
                    s.update(
                      el.id,
                      {
                        filter:
                          filter.id,
                      },
                    )
                  }
                >
                  {filter.label}
                </button>
              ),
            )}
          </div>
        ) : (
          <p className="hint-s">
            写真を選ぶと使えるよ
          </p>
        )
      )}

      {sub === 'キャンバス' && (
        <>
          <div className="label">
            キャンバスのサイズ
          </div>

          <div className="row">
            {CANVAS_PRESETS.map(
              (preset) => (
                <button
                  key={
                    preset.id
                  }
                  className={`chip ${
                    s.canvasPreset ===
                    preset.id
                      ? 'on'
                      : ''
                  }`}
                  onClick={() =>
                    changeCanvas(
                      preset.id,
                    )
                  }
                >
                  {preset.label}
                </button>
              ),
            )}
          </div>

          <p className="hint-s">
            現在のサイズ：
            {s.canvasWidth} ×
            {s.canvasHeight}
          </p>

          <p className="hint-s">
            「写真に合わせる」は、選択中の写真、
            または最初の写真の縦横比を使います。
          </p>

          <button
            className="big-btn light"
            onClick={() =>
              setCanvasCropOpen(
                true,
              )
            }
          >
            ✂ キャンバス全体をトリミング
          </button>

          <div className="label">
            背景色
          </div>

          <Dots
            value={s.bgColor}
            colors={BG}
            onPick={
              s.setBg
            }
          />

          <p className="hint-s">
            サイズを変更しても写真や文字は消えません。
            キャンバスからはみ出した部分は
            保存画像には入りません。
          </p>
        </>
      )}

      {canvasCropOpen &&
        createPortal(
          <CanvasCropModal
            onClose={() =>
              setCanvasCropOpen(
                false,
              )
            }
          />,
          document.body,
        )}

      {cropOpen &&
        el?.type === 'image' &&
        createPortal(
          <PhotoCropModal
            el={el}
            onClose={() =>
              setCropOpen(
                false,
              )
            }
          />,
          document.body,
        )}
    </>
  );
}

// レイヤー名
function layerName(
  el: CanvasEl,
) {
  if (el.type === 'text') {
    return el.text || '文字';
  }

  if (el.type === 'sticker') {
    return el.label || 'スタンプ';
  }

  if (el.type === 'line') {
    return 'ペン';
  }

  return '写真';
}

// レイヤータブ
function LayerTab() {
  const {
    elements,
    selectedId,
    select,
    update,
    move,
  } = useEditor();

  if (!elements.length) {
    return (
      <p className="hint-s">
        まだ何もないよ
      </p>
    );
  }

  return (
    <>
      {[...elements]
        .reverse()
        .map((el) => {
          const thumbSrc =
            el.type === 'image'
              ? el.src
              : el.type === 'sticker'
                ? el.src
                : undefined;

          return (
            <div
              key={el.id}
              className={`layer ${
                selectedId === el.id
                  ? 'on'
                  : ''
              }`}
              onClick={() =>
                select(el.id)
              }
            >
              <div
                className="thumb"
                style={
                  thumbSrc
                    ? {
                        backgroundImage:
                          `url("${thumbSrc}")`,
                        backgroundSize:
                          'contain',
                        backgroundPosition:
                          'center',
                        backgroundRepeat:
                          'no-repeat',
                      }
                    : undefined
                }
              >
                {!thumbSrc &&
                  (el.type === 'sticker'
                    ? el.emoji
                    : el.type === 'text'
                      ? '🔤'
                      : el.type === 'line'
                        ? '✏️'
                        : '')}
              </div>

              <span className="name">
                {layerName(el)}
              </span>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  move(el.id, 'up');
                }}
              >
                ↑
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  move(el.id, 'down');
                }}
              >
                ↓
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  update(el.id, {
                    hidden:
                      !el.hidden,
                  });
                }}
              >
                {el.hidden
                  ? '🙈'
                  : '👁'}
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  update(el.id, {
                    locked:
                      !el.locked,
                  });
                }}
              >
                {el.locked
                  ? '🔒'
                  : '🔓'}
              </button>
            </div>
          );
        })}
    </>
  );
}

// パネル全体
export function Panel() {
  const {
    tab,
    elements,
    selectedId,
  } = useEditor();

  const el = elements.find(
    (item) =>
      item.id === selectedId,
  );

  return (
    <section className="panel">
      <div className="grab" />

      {tab === 'image' && (
        <ImageTab />
      )}

      {tab === 'text' && (
        <TextTab
          el={
            el?.type === 'text'
              ? el
              : undefined
          }
        />
      )}

      {tab === 'pen' && (
        <PenTab />
      )}

      {tab === 'stamp' && (
        <StampTab />
      )}

      {tab === 'glasses' && (
        <>
          <div className="grid">
            {GLASSES.map((glasses) => (
              <button
                key={glasses}
                className="cell"
                onClick={() =>
                  addSticker(
                    glasses,
                  )
                }
              >
                {glasses}
              </button>
            ))}
          </div>

          <Soon em="🕶">
            形・色・レンズを自分でカスタマイズ＆顔に自動でかける
          </Soon>
        </>
      )}

      {tab === 'mosaic' && (
        <Soon em="▦">
          タイル・ぼかし・顔を自動でかくす
        </Soon>
      )}

      {tab === 'beauty' && (
        <Soon em="💄">
          肌・メイク・小顔・あごシャープ
        </Soon>
      )}

      {tab === 'edit' && (
        <EditTab
          key={
            selectedId ?? 'none'
          }
          el={el}
        />
      )}

      {tab === 'frame' && (
        <Soon em="🖼">
          雑誌風・卒アル風・ポラロイド・夜景
        </Soon>
      )}

      {tab === 'layer' && (
        <LayerTab />
      )}
    </section>
  );
}
