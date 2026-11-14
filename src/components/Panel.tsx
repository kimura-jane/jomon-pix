
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, type CanvasPreset } from '../store';
import {
  addImageFromFile,
  addSticker,
  addLibrarySticker,
  addText,
} from '../lib/factory';
import {
  STICKER_CATEGORIES,
  type LibrarySticker,
} from '../lib/stickers';
import { FACE_STICKERS } from '../lib/stickerPacks';
import { findAttachmentPhoto } from '../lib/photoAttachments';
import { isNativeApp } from '../lib/nativeFileShare';
import { countAutoFaceTargets, createAutoFaceSticker } from '../lib/autoFaceDeco';
import {
  REAL_HANIWA_STICKERS,
  REAL_DOGU_STICKERS,
} from '../lib/museumStickers';
import { SUNGLASSES_STICKERS } from '../lib/glassesStickers';
import { TAF_DOG_STICKERS } from '../lib/nftDogs';
import { removeBg } from '../lib/removeBg';
import { PhotoCropModal } from './PhotoCropModal';
import { CanvasCropModal } from './CanvasCropModal';
import { HistorySlider } from './HistorySlider';
import { MosaicPanel } from './MosaicPanel';
import { BeautyPanel } from './BeautyPanel';
import {
  FONTS,
  FONT_GROUPS,
  TEXT_PRESETS,
} from '../lib/fonts';
import { PENS } from '../lib/pens';
import { SCENE_PRESETS, SOCIAL_PRESETS } from '../lib/scenePresets';
import type {
  CanvasEl,
  FilterPreset,
  FrameStyle,
  ImageEl,
  StickerEl,
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

const EXTRA_EMOJI = [
  '🐰', '🫶', '🥳', '😂', '😍', '🙈',
];

// 顔デコ・TAF DOG・サングラスなどのスタンプカテゴリ
const STAMP_GROUPS: {
  label: string;
  items: LibrarySticker[];
}[] = [
  {
    label: '顔デコ',
    items: FACE_STICKERS,
  },
  {
    label: 'サングラス',
    items: SUNGLASSES_STICKERS,
  },
  ...STICKER_CATEGORIES.map((category) => {
    if (category.label === '犬') {
      // 犬はinu由来の透明NFTスタンプ20匹だけにする。
      return { label: category.label, items: TAF_DOG_STICKERS };
    }

    if (category.label === '埴輪') {
      // 実物の古墳時代の埴輪写真のみを表示。旧SVGは保存済み作品用に保持。
      return { label: category.label, items: REAL_HANIWA_STICKERS };
    }

    if (category.label === '土偶') {
      // 実物の縄文土偶写真（復元品1点を含む）のみを表示。
      return { label: category.label, items: REAL_DOGU_STICKERS };
    }

    return { label: category.label, items: category.items };
  }),
];

function Seg({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="seg">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={value === item ? 'on' : ''}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function Soon({
  em,
  children,
}: {
  em: string;
  children: ReactNode;
}) {
  return (
    <div className="soon">
      <span className="em">{em}</span>
      {children}
      <br />
      準備中だよ
    </div>
  );
}

function Dots({
  value,
  colors,
  onPick,
}: {
  value: string;
  colors: string[];
  onPick: (color: string) => void;
}) {
  return (
    <div className="dots">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`dot ${
            value === color ? 'on' : ''
          }`}
          style={{ background: color }}
          onClick={() => onPick(color)}
          aria-label={`色 ${color}`}
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
  onChange: (value: number) => void;
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
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
      />
    </label>
  );
}


function PhotoAttachmentControls({
  el,
}: {
  el: TextEl | StickerEl;
}) {
  const s = useEditor();
  const photos = s.elements.filter(
    (item): item is ImageEl =>
      item.type === 'image' && !item.hidden && !item.locked,
  );
  const currentParent = s.elements.find(
    (item) => item.type === 'image' && item.id === el.parentImageId,
  );
  if (!photos.length && !currentParent) return null;

  return (
    <div
      style={{
        background: '#fff9fd',
        border: '1px solid #f4d3e5',
        borderRadius: 14,
        padding: 10,
        margin: '12px 0',
      }}
    >
      <div className="label" style={{ margin: '0 0 6px' }}>
        写真と一緒に動かす
      </div>
      <p className="hint-s" style={{ margin: '0 0 8px' }}>
        {el.parentImageId
          ? 'この装飾は写真に紐づいています。写真を動かすと一緒に動きます。'
          : '写真を選ぶと、今の位置をできるだけ保って紐づけます。'}
      </p>
      <div className="row" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            disabled={!!el.locked}
            onClick={() => s.attachToImage(el.id, photo.id)}
            aria-label={`写真${index + 1}に紐づける`}
            aria-pressed={el.parentImageId === photo.id}
            style={{
              flex: '0 0 auto',
              display: 'grid',
              justifyItems: 'center',
              gap: 3,
              border: el.parentImageId === photo.id
                ? '2px solid #ff4fa3' : '2px solid #f4d3e5',
              borderRadius: 10,
              padding: 4,
              background: '#fff',
            }}
          >
            <img
              src={photo.src}
              alt=""
              loading="lazy"
              draggable={false}
              style={{ width: 46, height: 46, objectFit: 'contain' }}
            />
            <span style={{ fontSize: 10 }}>
              {el.parentImageId === photo.id ? '✓ ' : ''}写真{index + 1}
            </span>
          </button>
        ))}
        {el.parentImageId && (
          <button
            type="button"
            className="chip"
            disabled={!!el.locked}
            onClick={() => s.detachFromImage(el.id)}
            style={{ flexShrink: 0, fontSize: 11 }}
          >
            紐づけ解除
          </button>
        )}
      </div>
    </div>
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
        onChange={async (event) => {
          const files = Array.from(
            event.target.files ?? [],
          );

          event.target.value = '';

          try {
            for (const file of files) {
              await addImageFromFile(file);
            }
          } catch {
            alert('写真を追加できませんでした');
          }
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
            confirm('今の作品を消して新しく作る？')
          ) {
            clear();
          }
        }}
      >
        ✨ 新しく作る
      </button>

      <p className="hint-s">
        作品は自動で保存されます。
        {!isNativeApp() && ' コラージュと作品一覧は準備中だよ'}
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
  const [group, setGroup] = useState<string>(
    FONT_GROUPS[0],
  );

  const update = useEditor((s) => s.update);

  const up = (patch: Partial<TextEl>) => {
    if (el && !el.locked) {
      update(el.id, patch);
    }
  };

  return (
    <>
      {!isNativeApp() && (
        <Seg
          items={['文字', '吹き出し']}
          value={sub}
          onChange={setSub}
        />
      )}

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
              disabled={!!el.locked}
              onChange={(event) =>
                up({
                  text: event.target.value,
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
                disabled={!!el?.locked}
                style={{
                  fontFamily:
                    preset.style.fontFamily,
                }}
                onClick={() =>
                  el
                    ? up(preset.style)
                    : addText(preset.style)
                }
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
                    disabled={!!el.locked}
                    style={{
                      fontFamily: font.family,
                    }}
                    onClick={() =>
                      up({
                        fontFamily: font.family,
                      })
                    }
                  >
                    {font.label}
                  </button>
                ))}
              </div>

              <div className="label">色</div>

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

              <HistorySlider
                label={`ふちどりの太さ ${el.strokeWidth}px`}
                min={0}
                max={30}
                step={1}
                value={el.strokeWidth}
                elementId={el.id}
                disabled={!!el.locked || !el.stroke}
                onChange={(strokeWidth) =>
                  up({ strokeWidth })
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
                    !el.vertical ? 'on' : ''
                  }`}
                  disabled={!!el.locked}
                  onClick={() =>
                    up({ vertical: false })
                  }
                >
                  横書き
                </button>

                <button
                  className={`chip ${
                    el.vertical ? 'on' : ''
                  }`}
                  disabled={!!el.locked}
                  onClick={() =>
                    up({ vertical: true })
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
                    disabled={!!el.locked}
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

              <HistorySlider
                label={`大きさ ${el.fontSize}px`}
                min={16}
                max={200}
                value={el.fontSize}
                elementId={el.id}
                disabled={!!el.locked}
                onChange={(fontSize) =>
                  up({ fontSize })
                }
              />

              <HistorySlider
                label={`字間 ${el.letterSpacing}`}
                min={-5}
                max={40}
                value={el.letterSpacing}
                elementId={el.id}
                disabled={!!el.locked}
                onChange={(letterSpacing) =>
                  up({ letterSpacing })
                }
              />

              <HistorySlider
                label={`透明度 ${Math.round(el.opacity * 100)}%`}
                min={0}
                max={100}
                step={5}
                value={Math.round(el.opacity * 100)}
                elementId={el.id}
                disabled={!!el.locked}
                onChange={(value) =>
                  up({ opacity: value / 100 })
                }
              />

              <PhotoAttachmentControls el={el} />

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

// ペン・消しゴムタブ
function PenTab() {
  const {
    tool,
    setTool,
    pen,
    setPen,
    elements,
    selectedId,
    select,
  } = useEditor();

  const photos = elements.filter(
    (el): el is ImageEl =>
      el.type === 'image' && !el.hidden && !el.locked,
  );
  const selectedPhoto = photos.find((el) => el.id === selectedId);
  const fallbackPhoto = photos[photos.length - 1];

  const opacityPercent = Math.round(
    (pen.opacity ?? 1) * 100,
  );

  return (
    <>
      <div className="label">ペンを描く写真</div>
      {photos.length === 0 ? (
        <p className="hint-s">
          先に画像タブで写真を追加してください。ペンは写真に直接紐づきます。
        </p>
      ) : (
        <>
          <div
            className="row"
            style={{
              flexWrap: 'nowrap',
              overflowX: 'auto',
              padding: '4px 2px 8px',
            }}
          >
            {[...photos].reverse().map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => select(photo.id)}
                title={'写真' + (index + 1) + 'を描画対象にする'}
                aria-label={'写真' + (index + 1) + 'を描画対象にする'}
                aria-pressed={photo.id === (selectedPhoto ?? fallbackPhoto)?.id}
                style={{
                  flex: '0 0 auto',
                  background: '#fff',
                  border: photo.id === (selectedPhoto ?? fallbackPhoto)?.id
                    ? '2px solid #ff4fa3'
                    : '2px solid #f2d7e8',
                  borderRadius: 12,
                  padding: 4,
                  display: 'grid',
                  placeItems: 'center',
                  gap: 3,
                  width: 65,
                  touchAction: 'manipulation',
                }}
              >
                <img
                  src={photo.src}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  style={{
                    display: 'block',
                    width: 50,
                    height: 50,
                    objectFit: 'contain',
                    borderRadius: 7,
                  }}
                />
                <span style={{ fontSize: 10 }}>写真{index + 1}</span>
              </button>
            ))}
          </div>
          <p className="hint-s">
            ピンク枠の写真に描きます。描いた線は写真と一緒に移動・拡大・回転します。
          </p>
        </>
      )}
      <Seg
        items={['ペン', '消しゴム']}
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
          選択した写真に描いた線をなぞると、1本ずつ消せます。
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
                      pen.style === p.style
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
              setPen({ color })
            }
          />

          <Slider
            label={`太さ ${pen.width}px`}
            min={2}
            max={40}
            value={pen.width}
            onChange={(width) =>
              setPen({ width })
            }
          />

          <Slider
            label={`透明度 ${opacityPercent}%`}
            min={0}
            max={100}
            step={5}
            value={opacityPercent}
            onChange={(value) =>
              setPen({
                opacity: value / 100,
              })
            }
          />

          <p className="hint-s">
            透明度はこれから描く線に適用されます。
            0%で透明、100%で不透明になります。
          </p>
        </>
      )}
    </>
  );
}

// スタンプのサイズをキャンバス短辺の割合で計算
function stickerPercent(
  sticker: StickerEl,
  shorterSide: number,
) {
  const actualWidth =
    sticker.size *
    Math.abs(sticker.scaleX);

  return Math.round(
    actualWidth /
      Math.max(1, shorterSide) *
      100,
  );
}

// スタンプの中心位置をできるだけ維持して拡大縮小
function resizeSticker(
  sticker: StickerEl,
  percent: number,
  shorterSide: number,
  update: (
    id: string,
    patch: Partial<StickerEl>,
  ) => void,
) {
  const target = Math.max(
    1,
    shorterSide * percent / 100,
  );

  const oldWidth =
    sticker.size *
    Math.abs(sticker.scaleX);

  if (oldWidth <= 0) return;

  const factor = target / oldWidth;

  const newScaleX =
    sticker.scaleX * factor;

  const newScaleY =
    sticker.scaleY * factor;

  const angle =
    sticker.rotation * Math.PI / 180;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const dx =
    sticker.size *
    (sticker.scaleX - newScaleX) / 2;

  const dy =
    sticker.size *
    (sticker.scaleY - newScaleY) / 2;

  update(sticker.id, {
    scaleX: newScaleX,
    scaleY: newScaleY,
    x:
      sticker.x +
      cos * dx -
      sin * dy,
    y:
      sticker.y +
      sin * dx +
      cos * dy,
  });
}

// スタンプタブ
function StampTab({
  initialSub = '顔デコ',
}: {
  initialSub?: string;
}) {
  const [sub, setSub] = useState(initialSub);
  const [autoFace, setAutoFace] = useState(true);
  const [autoBusy, setAutoBusy] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [autoMessage, setAutoMessage] = useState('');
  const [faceInfo, setFaceInfo] = useState<{
    photoId: string; src: string; count: number;
  } | null>(null);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState(0);
  const autoGuard = useRef(false);
  const s = useEditor();

  const availablePhotos = s.elements.filter(
    (item): item is ImageEl =>
      item.type === 'image' && !item.hidden && !item.locked,
  );
  const activePhoto = findAttachmentPhoto(s.elements, s.selectedId);
  const activePhotoId = activePhoto?.id;
  const activePhotoSrc = activePhoto?.src;

  // Inspect the selected photograph once when it changes. For group photos,
  // offer a clear left-to-right face selector BEFORE placing any sticker.
  useEffect(() => {
    let cancelled = false;
    setFaceInfo(null);
    setSelectedFaceIndex(0);
    if (!autoFace || sub !== '顔デコ' || !activePhotoId || !activePhotoSrc) {
      setFaceBusy(false);
      return () => { cancelled = true; };
    }

    const photo = useEditor.getState().elements.find(
      (item): item is ImageEl =>
        item.type === 'image' && item.id === activePhotoId,
    );
    if (!photo || photo.hidden || photo.locked) {
      setFaceBusy(false);
      return () => { cancelled = true; };
    }

    setFaceBusy(true);
    void countAutoFaceTargets(photo).then((count) => {
      if (cancelled) return;
      setFaceInfo({ photoId: photo.id, src: photo.src, count });
      if (!count) {
        setAutoMessage('顔を検出できませんでした。手動配置をお試しください。');
      } else {
        setAutoMessage('');
      }
    }).catch(() => {
      if (cancelled) return;
      setAutoMessage('顔認識に失敗しました。手動配置をお試しください。');
    }).finally(() => {
      if (!cancelled) setFaceBusy(false);
    });
    return () => { cancelled = true; };
  }, [activePhotoId, activePhotoSrc, sub, autoFace]);

  const autoAdd = async (sticker: LibrarySticker) => {
    if (autoGuard.current || faceBusy) return;
    const current = useEditor.getState();
    const photo = findAttachmentPhoto(current.elements, current.selectedId);
    if (!photo) {
      setAutoMessage('先に写真を追加してください。複数枚ある場合は対象の写真を選んでください。');
      return;
    }
    if (!faceInfo || faceInfo.photoId !== photo.id ||
        faceInfo.src !== photo.src || faceInfo.count < 1) {
      setAutoMessage('顔の認識が完了していません。顔を認識できない場合は手動配置を使ってください。');
      return;
    }

    autoGuard.current = true;
    setAutoBusy(true);
    setAutoMessage('選択した顔にスタンプを配置中…');
    try {
      const result = await createAutoFaceSticker(photo, sticker, selectedFaceIndex);
      const latest = useEditor.getState();
      const unchangedPhoto = latest.elements.find((item) =>
        item.id === photo.id && item.type === 'image',
      );
      if (!unchangedPhoto || unchangedPhoto.type !== 'image' ||
          unchangedPhoto.src !== photo.src ||
          unchangedPhoto.hidden || unchangedPhoto.locked) {
        throw new Error('写真が変更されたため配置を取り消しました。もう一度お試しください。');
      }
      latest.add(result.sticker);
      setAutoMessage(
        `左から${result.faceIndex + 1}人目に「${sticker.label}」を1個配置しました。移動・サイズ・回転を調整できます。`,
      );
    } catch (error) {
      setAutoMessage(
        error instanceof Error ? error.message : '顔デコの自動配置に失敗しました。',
      );
    } finally {
      autoGuard.current = false;
      setAutoBusy(false);
    }
  };

  const placedStickers = s.elements.filter(
    (item): item is StickerEl => item.type === 'sticker',
  );

  const selected = s.elements.find(
    (item) =>
      item.id === s.selectedId &&
      item.type === 'sticker',
  );

  const selectedSticker:
    StickerEl | undefined =
      selected?.type === 'sticker'
        ? selected
        : undefined;

  const parentPhoto = s.elements.find(
    (el) =>
      el.type === 'image' &&
      el.id === selectedSticker?.parentImageId,
  );
  const shorterSide =
    parentPhoto?.type === 'image'
      ? Math.min(parentPhoto.width, parentPhoto.height)
      : Math.min(s.canvasWidth, s.canvasHeight);

  const currentPercent = selectedSticker
    ? stickerPercent(
        selectedSticker,
        shorterSide,
      )
    : 42;

  const changeSize = (percent: number) => {
    if (
      !selectedSticker ||
      selectedSticker.locked ||
      selectedSticker.hidden
    ) {
      return;
    }

    const nextPercent = Math.max(
      10,
      Math.min(150, percent),
    );

    resizeSticker(
      selectedSticker,
      nextPercent,
      shorterSide,
      s.update,
    );
  };

  // スライダーを触った瞬間の状態を記録する。
  // 途中の値の変化は履歴に追加しない。
  const beginSizeChange = () => {
    if (
      selectedSticker &&
      !selectedSticker.locked &&
      !selectedSticker.hidden
    ) {
      s.beginHistoryGroup(
        selectedSticker.id,
      );
    }
  };

  // 指を離したら、操作前のサイズを履歴に1件記録
  const endSizeChange = () => {
    s.endHistoryGroup();
  };

  const group = STAMP_GROUPS.find(
    (item) => item.label === sub,
  );

  const extraEmoji = sub === '絵文字' ? EXTRA_EMOJI : [];

  const sliderKeys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ];

  return (
    <>
      {placedStickers.length > 0 && (
        <div
          style={{
            background: '#fff9fd',
            border: '1px solid #f4d3e5',
            borderRadius: 14,
            padding: 10,
            marginBottom: 12,
          }}
        >
          <div className="label" style={{ margin: '0 0 8px' }}>
            配置済みスタンプを選択
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              gap: 8,
              padding: '3px 2px',
              scrollbarWidth: 'thin',
            }}
          >
            {[...placedStickers].reverse().map((sticker, index) => {
              const selected = sticker.id === s.selectedId;
              const parent = s.elements.find(
                (item) => item.type === 'image' && item.id === sticker.parentImageId,
              );
              const hidden = !!sticker.hidden || !!parent?.hidden;

              return (
                <button
                  key={sticker.id}
                  type="button"
                  aria-label={`配置済みスタンプ${index + 1}を選択`}
                  aria-pressed={selected}
                  onClick={() => s.select(sticker.id)}
                  style={{
                    flex: '0 0 auto',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 3,
                    width: 64,
                    minHeight: 72,
                    border: selected
                      ? '2px solid #ff4fa3'
                      : '2px solid #f2d7e8',
                    borderRadius: 12,
                    padding: 5,
                    background: selected ? '#fff0f7' : '#fff',
                    opacity: hidden ? 0.5 : 1,
                    touchAction: 'manipulation',
                  }}
                >
                  {sticker.src ? (
                    <img
                      src={sticker.src}
                      alt=""
                      draggable={false}
                      loading="lazy"
                      style={{
                        width: 44,
                        height: 44,
                        objectFit: 'contain',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 30, lineHeight: '44px' }}>
                      {sticker.emoji}
                    </span>
                  )}
                  <span style={{ fontSize: 10 }}>
                    {selected ? '✓ ' : ''}{index + 1}{sticker.locked ? ' 🔒' : ''}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="hint-s" style={{ margin: '7px 0 0' }}>
            写真に重なっていても、ここから選択してサイズを調整できます。
          </p>
        </div>
      )}

      {selectedSticker && (
        <div
          style={{
            // The sticky sticker editor must not cover the auto face-deco
            // picker when the long panel scrolls on iPhone.
            position: sub === '顔デコ' ? 'relative' : 'sticky',
            top: 0,
            zIndex: sub === '顔デコ' ? 1 : 10,
            background: '#fff9fd',
            border: '1px solid #f4c7df',
            borderRadius: 16,
            padding: 12,
            marginBottom: 12,
            boxShadow:
              '0 4px 14px rgba(120,60,100,0.12)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <strong
              style={{
                fontSize: 13,
              }}
            >
              選択中のスタンプ
            </strong>

            <button
              type="button"
              className="chip"
              style={{
                padding: '6px 10px',
                fontSize: 12,
              }}
              onClick={() =>
                s.select(null)
              }
            >
              完了
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 12,
              }}
            >
              大きさ
            </span>

            <strong
              style={{
                fontSize: 14,
                color: '#ff4fa3',
              }}
            >
              {currentPercent}%
            </strong>
          </div>

          <input
            type="range"
            min={10}
            max={150}
            step={1}
            value={Math.max(
              10,
              Math.min(
                150,
                currentPercent,
              ),
            )}
            disabled={
              !!selectedSticker.locked ||
              !!selectedSticker.hidden
            }
            aria-label="スタンプの大きさ"

            // タッチ・マウス・ペン操作
            onPointerDown={beginSizeChange}
            onPointerUp={endSizeChange}
            onPointerCancel={endSizeChange}

            // iPhoneなどでのタッチ操作にも対応
            onTouchStart={beginSizeChange}
            onTouchEnd={endSizeChange}
            onTouchCancel={endSizeChange}

            // マウス操作の補助
            onMouseDown={beginSizeChange}
            onMouseUp={endSizeChange}

            // キーボード操作もまとめて記録
            onKeyDown={(event) => {
              if (
                sliderKeys.includes(
                  event.key,
                )
              ) {
                beginSizeChange();
              }
            }}
            onKeyUp={(event) => {
              if (
                sliderKeys.includes(
                  event.key,
                )
              ) {
                endSizeChange();
              }
            }}

            // スライダーから離れた場合も履歴を確定
            onBlur={endSizeChange}

            // 指を動かしている間は即座にサイズを反映
            onChange={(event) => {
              beginSizeChange();
              changeSize(
                Number(
                  event.currentTarget.value,
                ),
              );
            }}
            style={{
              width: '100%',
              accentColor: '#ff4fa3',
              height: 28,
              touchAction: 'pan-x',
            }}
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
            }}
          >
            <button
              type="button"
              className="chip"
              disabled={
                !!selectedSticker.locked ||
                !!selectedSticker.hidden
              }
              onClick={() =>
                changeSize(
                  currentPercent - 5,
                )
              }
            >
              − 小さく
            </button>

            <button
              type="button"
              className="chip"
              disabled={
                !!selectedSticker.locked ||
                !!selectedSticker.hidden
              }
              onClick={() =>
                changeSize(
                  currentPercent + 5,
                )
              }
            >
              ＋ 大きく
            </button>

            <button
              type="button"
              className="chip"
              disabled={
                !!selectedSticker.locked ||
                !!selectedSticker.hidden
              }
              onClick={() =>
                changeSize(42)
              }
            >
              標準
            </button>

            <button
              type="button"
              className="chip"
              onClick={() =>
                s.duplicate(
                  selectedSticker.id,
                )
              }
            >
              ⧉ 複製
            </button>

            <button
              type="button"
              className="chip"
              onClick={() =>
                s.remove(
                  selectedSticker.id,
                )
              }
            >
              🗑 削除
            </button>
          </div>

          <PhotoAttachmentControls el={selectedSticker} />

          <p
            className="hint-s"
            style={{
              marginBottom: 0,
            }}
          >
            スタンプを指で移動できます。
            四隅を使って拡大・縮小・回転もできます。
          </p>
        </div>
      )}

      <Seg
        items={[
          '顔デコ',
          'サングラス',
          '犬',
          '埴輪',
          '土偶',
          '絵文字',
          ...(!isNativeApp() ? ['マイスタンプ'] : []),
        ]}
        value={sub}
        onChange={setSub}
      />

      {sub === '顔デコ' && (
        <div style={{
          border: '1px solid #f4c2dc',
          background: '#fff7fb',
          borderRadius: 14,
          padding: 12,
          marginTop: 10,
          marginBottom: 12,
        }}>
          <strong style={{ display: 'block', marginBottom: 7, fontSize: 14 }}>
            顔デコを自動で付ける
          </strong>
          <div className="row" style={{ gap: 7 }}>
            <button
              type="button"
              className="chip"
              aria-pressed={autoFace}
              disabled={autoBusy}
              onClick={() => { setAutoFace(true); setAutoMessage(''); }}
              style={autoFace ? { borderColor: '#ec54a5', background: '#ffeaf6' } : {}}
            >
              自動配置
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={!autoFace}
              disabled={autoBusy}
              onClick={() => { setAutoFace(false); setAutoMessage(''); }}
              style={!autoFace ? { borderColor: '#ec54a5', background: '#ffeaf6' } : {}}
            >
              手動配置
            </button>
          </div>
          {autoFace ? (
            <>
              <p className="hint-s" style={{ margin: '8px 0' }}>
                1回タップで1個だけ。2人以上写っていても、選んだ1人にだけ自動配置します。
              </p>
              {availablePhotos.length > 1 && (
                <>
                  <p className="hint-s" style={{ margin: '5px 0' }}>
                    顔デコを付ける写真を選択
                  </p>
                  <div style={{
                    display: 'flex', gap: 8, overflowX: 'auto',
                    paddingBottom: 8,
                  }}>
                    {availablePhotos.map((photo, i) => {
                      const selectedPhoto = findAttachmentPhoto(s.elements, s.selectedId);
                      return (
                        <button type="button" key={photo.id}
                          aria-label={`写真${i + 1}を顔デコ対象にする`}
                          aria-pressed={selectedPhoto?.id === photo.id}
                          onClick={() => { s.select(photo.id); setAutoMessage(''); }}
                          style={{
                            flex: '0 0 78px', padding: 5,
                            borderRadius: 10,
                            border: selectedPhoto?.id === photo.id
                              ? '2px solid #ed55ae'
                              : '1px solid #e7d6e4',
                            background: '#ffffff',
                          }}>
                          <img src={photo.src} alt="" draggable={false}
                            style={{ width: 65, height: 54, objectFit: 'cover', borderRadius: 7 }} />
                          <span style={{ display: 'block', fontSize: 11 }}>写真{i + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {faceBusy && (
                <p role="status" className="hint-s">顔の位置を確認中…</p>
              )}
              {!faceBusy && faceInfo && faceInfo.photoId === activePhotoId &&
                faceInfo.src === activePhotoSrc && faceInfo.count > 0 && (
                <div style={{ marginBottom: 9 }}>
                  <p className="hint-s" style={{ margin: '4px 0 7px', fontWeight: 700 }}>
                    {faceInfo.count === 1
                      ? '顔を1人認識しました'
                      : `${faceInfo.count}人の顔を認識しました。付ける相手を選んでください。`}
                  </p>
                  {faceInfo.count > 1 && (
                    <div className="row" role="group" aria-label="スタンプを付ける顔を選ぶ"
                      style={{ flexWrap: 'wrap', gap: 7 }}>
                      {Array.from({ length: faceInfo.count }, (_, i) => (
                        <button type="button" className="chip" key={i}
                          aria-pressed={selectedFaceIndex === i}
                          disabled={autoBusy}
                          onClick={() => setSelectedFaceIndex(i)}
                          style={selectedFaceIndex === i
                            ? { borderColor: '#ec54a5', background: '#ffeaf6' }
                            : {}}>
                          左から{i + 1}人目
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="hint-s" style={{ margin: '4px 0 0' }}>
                下の顔デコから1種類を選んでください。押すたびに1個だけ追加します。
                追加後は移動・大きさ・回転を調整できます。
              </p>
            </>
          ) : (
            <p className="hint-s" style={{ margin: '8px 0 0' }}>
              下のスタンプを好きな場所に貼れます。顔認識できない写真にも使えます。
            </p>
          )}
          {autoBusy && (
            <p className="hint-s" role="status" style={{ margin: '8px 0 0' }}>
              顔認識を実行中…
            </p>
          )}
          {autoMessage && (
            <p role="status" className="hint-s"
              style={{
                margin: '8px 0 0', padding: 8, background: '#ffffff',
                borderRadius: 8,
              }}>{autoMessage}</p>
          )}
        </div>
      )}

      {sub === 'マイスタンプ' && (
        <Soon em="📷">
          カメラロール → 背景を自動で消す → 登録
        </Soon>
      )}

      {group && (
        <>
          {(sub === '顔デコ' || sub === 'サングラス' || sub === '犬') && (
            <p className="hint-s">
              {sub === '犬'
                ? 'TAF DOGのNFT原画から犬だけを切り抜いた20匹。背景なしで貼れます。'
                : sub === 'サングラス'
                  ? '26種類から選べます。写真の顔に重ねて位置・大きさ・角度を調整できます。'
                  : autoFace
                    ? '顔デコは顔認識で自動配置できます。配置後に指で位置・大きさ・角度を調整できます。'
                    : '手動で写真の顔に重ねて、位置や大きさを調整できます。'}
            </p>
          )}

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                'repeat(4, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {group.items.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                className="cell"
                title={sticker.label}
                aria-label={
                  sub === '顔デコ' && autoFace
                    ? `${sticker.label}を自動配置`
                    : `${sticker.label}を追加`
                }
                disabled={autoBusy || (sub === '顔デコ' && autoFace &&
                  (faceBusy || !faceInfo || faceInfo.count < 1 ||
                   faceInfo.photoId !== activePhotoId || faceInfo.src !== activePhotoSrc))}
                onClick={() => {
                  if (sub === '顔デコ' && autoFace) {
                    void autoAdd(sticker);
                  } else {
                    addLibrarySticker(sticker);
                  }
                }}
                style={{
                  minWidth: 0,
                  padding: 4,
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  touchAction: 'manipulation',
                }}
              >
                {(sticker.kind === 'svg' || sticker.kind === 'image') &&
                sticker.src ? (
                  <img
                    src={sticker.src}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    style={{
                      display: 'block',
                      width: '94%',
                      height: '94%',
                      objectFit: 'contain',
                      pointerEvents:
                        'none',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 30,
                      lineHeight: 1,
                    }}
                  >
                    {sticker.emoji}
                  </span>
                )}
              </button>
            ))}
          </div>

          {extraEmoji.length > 0 && (
            <>
              <div className="label">
                その他
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns:
                    'repeat(4, minmax(0, 1fr))',
                }}
              >
                {extraEmoji.map(
                  (emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="cell"
                      aria-label={
                        `${emoji}を追加`
                      }
                      onClick={() =>
                        addSticker(emoji)
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

// 写真加工・キャンバスタブ
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

  const [busy, setBusy] = useState(false);
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
                s.move(el.id, 'front')
              }
            >
              ⤒ 最前面
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.move(el.id, 'up')
              }
            >
              ↑ 1つ前へ
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.move(el.id, 'down')
              }
            >
              ↓ 1つ後ろへ
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.move(el.id, 'back')
              }
            >
              ⤓ 最背面
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.update(el.id, {
                  scaleX: -el.scaleX,
                })
              }
            >
              ⇋ 左右反転
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.update(el.id, {
                  scaleY: -el.scaleY,
                })
              }
            >
              ⇵ 上下反転
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.duplicate(el.id)
              }
            >
              ⧉ 複製
            </button>

            <button
              className="chip"
              disabled={off}
              onClick={() =>
                el &&
                s.update(el.id, {
                  locked: !el.locked,
                })
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
                s.remove(el.id)
              }
            >
              🗑 削除
            </button>
          </div>

          {el && (el.type === 'sticker' || el.type === 'text') && (
            <PhotoAttachmentControls el={el} />
          )}

          {el && (
            <HistorySlider
              label={`透明度 ${Math.round(el.opacity * 100)}%`}
              min={0}
              max={100}
              step={5}
              value={Math.round(el.opacity * 100)}
              elementId={el.id}
              disabled={!!el.locked}
              onChange={(value) =>
                s.update(el.id, { opacity: value / 100 })
              }
            />
          )}
        </>
      )}

      {sub === '切り抜き' &&
        (el?.type === 'image' ? (
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
                  s.update(el.id, {
                    src: await removeBg(el.src),
                  });
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
        ))}

      {sub === '色' &&
        (el?.type === 'image' ? (
          <div className="row">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`chip ${
                  el.filter === filter.id
                    ? 'on'
                    : ''
                }`}
                onClick={() =>
                  s.update(el.id, {
                    filter: filter.id,
                  })
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint-s">
            写真を選ぶと使えるよ
          </p>
        ))}

      {sub === 'キャンバス' && (
        <>
          <div className="label">
            キャンバスのサイズ
          </div>

          <div className="row">
            {CANVAS_PRESETS.map(
              (preset) => (
                <button
                  key={preset.id}
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
              setCanvasCropOpen(true)
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
            onPick={s.setBg}
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
              setCanvasCropOpen(false)
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
              setCropOpen(false)
            }
          />,
          document.body,
        )}
    </>
  );
}

// レイヤー名
function layerName(el: CanvasEl) {
  if (el.type === 'text') {
    return el.text || '文字';
  }

  if (el.type === 'sticker') {
    return 'スタンプ';
  }

  if (el.type === 'line') {
    return 'ペン';
  }

  return '写真';
}

// 写真に直接追従するフレーム。独立したレイヤーは増やさない。
const FRAME_STYLES: { id: FrameStyle; label: string; subtitle: string }[] = [
  { id: 'none', label: 'なし', subtitle: 'フレームを外す' },
  { id: 'simple', label: 'シンプル', subtitle: 'すっきりした縁取り' },
  { id: 'double', label: '二重フレーム', subtitle: '上品な二重線' },
  { id: 'polaroid', label: 'ポラロイド', subtitle: '写真プリント風' },
  { id: 'film', label: 'フィルム', subtitle: '35mmフィルム風' },
  { id: 'album', label: '卒アル風', subtitle: '角留めの記念写真風' },
  { id: 'neon', label: 'ネオン', subtitle: '光るフレーム' },
  { id: 'magazine', label: '雑誌風', subtitle: '表紙風の文字付き' },
];

const FRAME_COLORS = [
  '#ffffff', '#21212c', '#e7bf6e', '#ff6faf',
  '#a778e4', '#56c8ed', '#70cf9f', '#ff7655',
];
  
type FramePreviewGroup = 'scene' | 'social' | 'border';

// Every thumbnail is captured from JOMON pix's REAL Konva renderer with
// the same original illustrated portrait. No external image is downloaded.
function FrameReferenceImage({
  group,
  id,
  label,
}: {
  group: FramePreviewGroup;
  id: string;
  label: string;
}) {
  return (
    <img
      className="frame-reference"
      src={`${import.meta.env.BASE_URL}frame-previews/${group}-${id}.png`}
      alt={`${label}の仕上がり参考画像`}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}


function BorderFrameTab() {
  const s = useEditor();
  const photos = s.elements.filter(
    (el): el is ImageEl => el.type === 'image' && !el.hidden,
  );
  const selected = s.elements.find((el) => el.id === s.selectedId);
  const photoId =
    selected?.type === 'image' ? selected.id :
    (selected?.type === 'text' || selected?.type === 'sticker')
      ? selected.parentImageId
      : undefined;
  const photo =
    photos.find((el) => el.id === photoId) ??
    (photos.length === 1 ? photos[0] : undefined);

  const style = photo?.frame?.style ?? 'none';
  const size = photo?.frame?.size ?? 7;
  const color = photo?.frame?.color ?? '#ffffff';
  const locked = !photo || !!photo.locked;
  const apply = (next: FrameStyle) => {
    if (!photo || photo.locked) return;
    s.update(photo.id, {
      frame: next === 'none'
        ? undefined
        : { style: next, size, color },
    });
  };

  return (
    <>
      <h3 style={{ margin: '0 0 6px' }}>写真フレーム</h3>
      <p className="hint-s">
        仕上がり見本から選べます。写真に直接付き、
        写真と一緒に移動・拡大・回転します。元の写真データは変更しません。
      </p>
      {photos.length === 0 && (
        <p className="hint-s" role="status">
          見本は写真を追加する前でも確認できます。
          フレームを付ける場合は、先に「画像」から写真を追加してください。
        </p>
      )}

      {photos.length > 1 && (
        <>
          <p className="hint-s" style={{ fontWeight: 700, marginTop: 10 }}>
            フレームを付ける写真を選択
          </p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 10px' }}>
            {photos.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => s.select(item.id)}
                aria-pressed={photo?.id === item.id}
                style={{
                  flex: '0 0 82px',
                  padding: 5,
                  borderRadius: 12,
                  border: photo?.id === item.id ? '2px solid #ed66b6' : '1px solid #e6d9e4',
                  background: '#fff',
                  color: '#3a303c',
                }}
              >
                <img src={item.src} alt={`写真${index + 1}`}
                  style={{ width: '100%', height: 54, objectFit: 'cover', borderRadius: 7 }} />
                <span style={{ fontSize: 11 }}>
                  写真{index + 1}{item.locked ? ' 🔒' : ''}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {photos.length > 1 && !photo && (
        <p className="hint-s">上の一覧から写真を選んでください。</p>
      )}
      {photo?.locked && (
        <p className="hint-s">写真がロックされています。「加工 → 配置」で解除してください。</p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 9,
        marginTop: 9,
      }}>
        {FRAME_STYLES.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={locked}
            aria-pressed={style === item.id}
            onClick={() => apply(item.id)}
            style={{
              textAlign: 'left',
              padding: 7,
              borderRadius: 13,
              border: style === item.id ? '2px solid #ec59b4' : '1px solid #e6d8e4',
              background: style === item.id ? '#fff0f9' : '#fff',
              color: '#40343f',
              cursor: locked ? 'not-allowed' : 'pointer',
            }}
          >
            <FrameReferenceImage group="border" id={item.id} label={item.label} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</div>
            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 3 }}>{item.subtitle}</div>
          </button>
        ))}
      </div>

      {photo && style !== 'none' && (
        <>
          <p className="hint-s" style={{ marginTop: 14, fontWeight: 700 }}>
            フレームの太さ：{size}%
          </p>
          <HistorySlider
            label={`フレームの太さ ${size}%`}
            min={2}
            max={18}
            step={1}
            value={size}
            elementId={photo.id}
            disabled={!!photo.locked}
            onChange={(next) => s.update(photo.id, {
              frame: { style, color, size: next },
            })}
          />

          {style !== 'film' && style !== 'polaroid' && (
            <>
              <p className="hint-s" style={{ marginTop: 12, fontWeight: 700 }}>
                フレームの色
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '6px 0' }}>
                {FRAME_COLORS.map((swatch) => (
                  <button key={swatch} type="button"
                    title={swatch}
                    aria-label={`フレームの色 ${swatch}`}
                    aria-pressed={color === swatch}
                    disabled={!!photo.locked}
                    onClick={() => s.update(photo.id, {
                      frame: { style, size, color: swatch },
                    })}
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: swatch,
                      border: color === swatch ? '3px solid #e9479e' : '2px solid #c9c4cd',
                      outline: color === swatch ? '2px solid white' : 'none',
                      boxShadow: '0 0 0 1px #d6d1d8',
                    }}
                  />
                ))}
              </div>
            </>
          )}

          <button type="button" className="chip"
            disabled={!!photo.locked}
            style={{ marginTop: 10 }}
            onClick={() => apply('none')}>
            フレームを外す
          </button>
        </>
      )}
    </>
  );
}

// 観光地・プリクラ風のオリジナル背景。
function SceneFrameTab() {
  const editor = useEditor();
  const [busy, setBusy] = useState(false);
  const images = editor.elements.filter(
    (item): item is ImageEl => item.type === 'image' && !item.hidden,
  );
  const selected = editor.elements.find((item) => item.id === editor.selectedId);
  const candidateId = selected?.type === 'image'
    ? selected.id
    : (selected?.type === 'sticker' || selected?.type === 'text')
      ? selected.parentImageId
      : undefined;
  const photo = images.find((item) => item.id === candidateId)
    ?? (images.length === 1 ? images[0] : undefined);

  const separatePerson = async () => {
    if (!photo || photo.locked || busy) return;
    const originalSource = photo.src;
    setBusy(true);
    try {
      const transparentSource = await removeBg(originalSource);
      const latest = useEditor.getState().elements.find((item) => item.id === photo.id);
      if (latest?.type !== 'image' || latest.src !== originalSource) {
        throw new Error('写真が変更されました。切り抜きは適用していません。');
      }
      useEditor.getState().update(photo.id, { src: transparentSource });
    } catch (error) {
      alert(error instanceof Error ? error.message : '写真の背景を削除できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3 style={{ margin: '0 0 5px' }}>背景を選ぶ</h3>
      <p className="hint-s">
        観光地・プリクラ風の背景を参考画像で比較できます。
        実際には写真の後ろに表示されます。
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10, marginTop: 10,
      }}>
        {SCENE_PRESETS.map((item) => {
          const chosen = editor.sceneBackground === item.id;
          return (
            <button key={item.id} type="button"
              aria-pressed={chosen}
              onClick={() => editor.setSceneBackground(item.id)}
              style={{
                padding: 7, textAlign: 'left',
                border: chosen ? '2px solid #ed64b8' : '1px solid #e7d9e7',
                borderRadius: 14, background: chosen ? '#fff0fa' : '#ffffff',
                color: '#413341', cursor: 'pointer',
              }}>
              <FrameReferenceImage group="scene" id={item.id} label={item.label} />
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{item.label}</div>
              <div style={{ fontSize: 10, opacity: 0.75 }}>{item.detail}</div>
            </button>
          );
        })}
      </div>
      <p className="hint-s" style={{ marginTop: 12 }}>
        背景が写真で隠れる場合は、写真の位置やサイズを調整するか、
        被写体だけ切り抜くと背景がよく見えます。
      </p>
      {images.length > 0 && (
        <div style={{
          padding: 10, border: '1px solid #e9d9e7',
          borderRadius: 12, background: '#fff',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {images.length > 1 && (
            <p className="hint-s" style={{ margin: 0 }}>
              被写体を切り抜きたい写真を先にキャンバスで選んでください。
            </p>
          )}
          <button type="button" className="chip"
            disabled={!photo || photo.locked || busy}
            onClick={() => { void separatePerson(); }}>
            {busy ? '背景を切り抜き中…' : '選択した写真の背景を消して人物を残す'}
          </button>
          <p className="hint-s" style={{ margin: 0 }}>
            写真の背景削除は選択した写真だけに適用します。
            元の写真には「戻す」で復元できます。
          </p>
        </div>
      )}
    </>
  );
}

// 枠とは独立した、写真の上に重なるSNS・配信風の演出。
function SocialFrameTab() {
  const editor = useEditor();
  return (
    <>
      <h3 style={{ margin: '0 0 5px' }}>配信・SNSテンプレ</h3>
      <p className="hint-s">
        参考画像で仕上がりを比較してから選べます。
        実際の写真に架空の配信・投稿画面を重ねるオリジナル演出です。
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10, marginTop: 10,
      }}>
        {SOCIAL_PRESETS.map((item) => {
          const selected = editor.socialTemplate === item.id;
          return (
            <button type="button" key={item.id}
              aria-pressed={selected}
              onClick={() => editor.setSocialTemplate(item.id)}
              style={{
                padding: 7, textAlign: 'left',
                border: selected ? '2px solid #ed64b8' : '1px solid #e7d9e7',
                borderRadius: 14,
                color: selected ? '#7d205b' : '#403742',
                background: selected ? '#fff0fa' : '#ffffff',
                cursor: 'pointer',
              }}>
              <FrameReferenceImage group="social" id={item.id} label={item.label} />
              <span style={{
                display: 'block', marginBottom: 5,
                fontSize: 12, fontWeight: 800,
              }}>{item.label}</span>
              <span style={{ fontSize: 10, opacity: 0.77 }}>{item.detail}</span>
            </button>
          );
        })}
      </div>
      <div style={{
        marginTop: 12, padding: 12, borderRadius: 12,
        border: '1px solid #e3d6e5', background: '#fff',
      }}>
        <p className="hint-s" style={{ marginTop: 0 }}>
          縦動画・ライブ配信風なら縦9:16のキャンバスがおすすめ。
        </p>
        <button className="chip" type="button"
          onClick={() => editor.setCanvasPreset('9:16')}>
          キャンバスを縦9:16にする
        </button>
        <p className="hint-s" style={{ marginBottom: 0 }}>
          表示されるコメントや視聴者数は見本です。実際の配信には接続しません。
        </p>
      </div>
    </>
  );
}

function FrameTab() {
  const [section, setSection] = useState('背景');
  return (
    <>
      <Seg items={['背景', '配信・SNS', '枠']} value={section} onChange={setSection} />
      <p className="hint-s" style={{ marginTop: 2 }}>
        全22種類に仕上がり見本を表示。見本はサンプル写真です。
        タップすると自分の作品に適用できます。
      </p>
      {section === '背景' && <SceneFrameTab />}
      {section === '配信・SNS' && <SocialFrameTab />}
      {section === '枠' && <BorderFrameTab />}
    </>
  );
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
      {[...elements].reverse().map((el) => {
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
            onClick={() => select(el.id)}
          >
            <div
              className="thumb"
              style={
                thumbSrc
                  ? {
                      backgroundImage:
                        `url("${thumbSrc}")`,
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
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
                  hidden: !el.hidden,
                });
              }}
            >
              {el.hidden ? '🙈' : '👁'}
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation();
                update(el.id, {
                  locked: !el.locked,
                });
              }}
            >
              {el.locked ? '🔒' : '🔓'}
            </button>
          </div>
        );
      })}
    </>
  );
}

// メインパネル
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

      {tab === 'image' && <ImageTab />}

      {tab === 'text' && (
        <TextTab
          el={
            el?.type === 'text'
              ? el
              : undefined
          }
        />
      )}

      {tab === 'pen' && <PenTab />}

      {tab === 'stamp' && <StampTab />}

      {tab === 'glasses' && <StampTab initialSub="サングラス" />}

      {tab === 'mosaic' && <MosaicPanel />}

      {tab === 'beauty' && <BeautyPanel />}

      {tab === 'edit' && (
        <EditTab
          key={selectedId ?? 'none'}
          el={el}
        />
      )}

      {tab === 'frame' && <FrameTab />}

      {tab === 'layer' && <LayerTab />}
    </section>
  );
}
