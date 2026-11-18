import { useEffect, useState } from 'react';
import { useEditor } from '../store';
import { countAutoFaceTargets, createAutoFaceSticker } from '../lib/autoFaceDeco';
import { SUNGLASSES_STICKERS } from '../lib/glassesStickers';
import type { LibrarySticker } from '../lib/stickers';
import type { ImageEl, BeautySettings, StickerEl } from '../types';
import { BEAUTY_FIELDS, DEFAULT_BEAUTY } from '../lib/beautyProcessor';
import { useBeautyStatus } from '../lib/beautyStatus';
import { HistorySlider } from './HistorySlider';
import { getPhotoLabel } from '../lib/photoAttachments';

type Control = {
  key: keyof BeautySettings;
  label: string;
};
const CONTROLS: Control[] = [
  { key: 'smooth', label: '美肌' },
  { key: 'bright', label: '明るさ' },
  { key: 'warmth', label: '血色' },
  { key: 'slim', label: '小顔' },
  { key: 'chin', label: 'あごシャープ' },
  { key: 'eyes', label: '目の大きさ' },
  { key: 'lip', label: 'リップ' },
  { key: 'blush', label: 'チーク' },
];

export function BeautyPanel() {
  const editor = useEditor();
  const photos = editor.elements.filter(
    (el): el is ImageEl => el.type === 'image' && !el.hidden,
  );
  const selected = editor.elements.find((el) => el.id === editor.selectedId);
  const targetId = selected?.type === 'image'
    ? selected.id
    : selected?.type === 'text' || selected?.type === 'sticker'
      ? selected.parentImageId
      : undefined;
  const photo = photos.find((el) => el.id === targetId) ??
    (photos.length === 1 ? photos[0] : undefined);
  const beauty = photo?.beauty ?? DEFAULT_BEAUTY;

  const [target, setTarget] = useState<'all' | number>('all');
  const [faceInfo, setFaceInfo] = useState<{ photoId: string; src: string; count: number } | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [glassBusy, setGlassBusy] = useState(false);
  const [glassMessage, setGlassMessage] = useState('');

  const photoId = photo?.id;
  const photoSrc = photo?.src;
  useEffect(() => {
    let cancelled = false;
    setFaceInfo(null);
    setTarget('all');
    setGlassMessage('');
    if (!photoId || !photoSrc) { setFaceBusy(false); return; }
    setFaceBusy(true);
    const current = useEditor.getState().elements.find(
      (el): el is ImageEl => el.id === photoId && el.type === 'image');
    if (!current || current.hidden) { setFaceBusy(false); return; }
    void countAutoFaceTargets(current).then((count) => {
      if (!cancelled) setFaceInfo({ photoId, src: photoSrc, count });
    }).catch((error) => {
      if (!cancelled) {
        console.error('[JOMON PIX] Beauty face scan failed', error);
        setGlassMessage('顔認識に失敗しました。');
      }
    }).finally(() => { if (!cancelled) setFaceBusy(false); });
    return () => { cancelled = true; };
  }, [photoId, photoSrc]);

  const count = faceInfo && faceInfo.photoId === photoId && faceInfo.src === photoSrc
    ? faceInfo.count : 0;
  const selectedIndex = target === 'all' ? null : target < count ? target : null;
  const override = selectedIndex === null
    ? undefined : photo?.beautyFaceOverrides?.[String(selectedIndex)];
  const visibleSettings = { ...beauty, ...override };
  const targetIndices = target === 'all'
    ? Array.from({ length: count }, (_, index) => index)
    : selectedIndex !== null ? [selectedIndex] : [];
  const attachedGlasses = editor.elements.filter(
    (el): el is StickerEl => el.type === 'sticker' && el.parentImageId === photoId &&
      el.beautyGlassesFace !== undefined
  );

  const equip = async (style: LibrarySticker | null) => {
    if (!photo || faceBusy || glassBusy || !targetIndices.length || photo.locked) return;
    setGlassBusy(true);
    setGlassMessage('');
    try {
      const additions = style ? await Promise.all(targetIndices.map(async (index) => {
        const result = await createAutoFaceSticker(photo, style, index);
        return { ...result.sticker, beautyGlassesFace: index };
      })) : [];
      const latest = useEditor.getState();
      const current = latest.elements.find((el) => el.id === photo.id);
      if (!current || current.type !== 'image' || current.src !== photo.src ||
          current.hidden || current.locked) {
        throw new Error('写真が変更されました。もう一度お試しください。');
      }
      latest.setBeautyGlasses(photo.id, targetIndices, additions);
    } catch (error) {
      setGlassMessage(error instanceof Error ? error.message : 'サングラスを装着できませんでした。');
    } finally {
      setGlassBusy(false);
    }
  };

  const status = useBeautyStatus((store) => photo ? store.byImage[photo.id] : undefined);
  const comparing = useBeautyStatus((store) => store.comparingId === photo?.id);
  const setComparing = useBeautyStatus((store) => store.setComparing);
  const hasValue = target === 'all'
    ? BEAUTY_FIELDS.some((key) => beauty[key] > 0)
    : !!override && Object.keys(override).length > 0;

  const change = (field: keyof BeautySettings, value: number) => {
    if (!photo || photo.locked) return;
    if (target === 'all') {
      editor.update(photo.id, { beauty: { ...beauty, [field]: value } });
    } else if (selectedIndex !== null) {
      editor.update(photo.id, {
        beautyFaceOverrides: {
          ...photo.beautyFaceOverrides,
          [String(selectedIndex)]: {
            ...photo.beautyFaceOverrides?.[String(selectedIndex)],
            [field]: value,
          },
        },
      });
    }
  };

  const reset = () => {
    if (!photo || photo.locked) return;
    if (target === 'all') {
      editor.update(photo.id, { beauty: undefined });
    } else if (selectedIndex !== null) {
      const next = { ...photo.beautyFaceOverrides };
      delete next[String(selectedIndex)];
      editor.update(photo.id, { beautyFaceOverrides: next });
    }
  };

  if (!photos.length) {
    return (
      <div className="soon">
        <div style={{ fontSize: 35 }}>💄</div>
        <p>先に写真を追加してください。</p>
      </div>
    );
  }

  return (
    <>

      {photos.length > 1 && (
        <>
          <p className="hint-s" style={{ fontWeight: 700, margin: '9px 0 4px' }}>
            写真を選択
          </p>
          <div style={{
            display: 'flex', overflowX: 'auto',
            gap: 8, paddingBottom: 9,
          }}>
            {photos.map((item, i) => (
              <button type="button" key={item.id}
                onClick={() => editor.select(item.id)}
                aria-pressed={photo?.id === item.id}
                style={{
                  flex: '0 0 88px', padding: 5, borderRadius: 11,
                  border: photo?.id === item.id
                    ? '2px solid #eb55ab' : '1px solid #e7d6e2',
                  background: '#fff', color: '#302832',
                }}>
                <img src={item.src} alt=""
                  style={{
                    width: '100%', height: 59, objectFit: 'cover',
                    borderRadius: 6, display: 'block',
                  }} />
                <span style={{ fontSize: 11 }}>
                  {getPhotoLabel(editor.elements, item.id)}{item.locked ? ' 🔒' : ''}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {!photo ? (
        <p className="hint-s">写真を選択</p>
      ) : (
        <>
          {photo.locked && (
            <p className="hint-s" style={{ fontWeight: 700 }}>
              写真のロックを解除してください。
            </p>
          )}
          <div style={{
            padding: 11, background: '#fff7fb',
            border: '1px solid #f0c9df', borderRadius: 12, marginTop: 10,
          }}>
            <strong style={{ fontSize: 13 }}>加工する顔を選択</strong>
            {faceBusy && <p className="hint-s" role="status">顔の位置を確認中…</p>}
            {!faceBusy && count > 0 && (
              <>
                <p className="hint-s" role="status">{'顔を' + count + '人認識しました'}</p>
                <div role="group" aria-label="ビューティーの加工対象"
                  style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '5px 0 8px' }}>
                  <button type="button" className="chip" aria-pressed={target === 'all'}
                    onClick={() => setTarget('all')}
                    style={{ flex: '0 0 auto', ...(target === 'all'
                      ? { borderColor: '#e9519e', background: '#ffe9f5' } : {}) }}>
                    全員
                  </button>
                  {Array.from({ length: count }, (_, index) => (
                    <button type="button" key={index} className="chip"
                      aria-pressed={target === index}
                      onClick={() => setTarget(index)}
                      style={{ flex: '0 0 auto', ...(target === index
                        ? { borderColor: '#e9519e', background: '#ffe9f5' } : {}) }}>
                      左から{index + 1}人目
                    </button>
                  ))}
                </div>
              </>
            )}
            {!faceBusy && count === 0 && (
              <p className="hint-s">顔を検出できませんでした。</p>
            )}
          </div>

          <div style={{ marginTop: 12, padding: 10, background: '#fff', borderRadius: 12,
            border: '1px solid #ecdde8' }}>
            <strong style={{ fontSize: 13 }}>サングラス装備</strong>
            <p className="hint-s" style={{ margin: '4px 0 7px' }}>
              全員または選んだ顔にサングラスを装着
            </p>
            <div role="group" aria-label="サングラスの種類" style={{
              display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 7,
            }}>
              <button type="button" className="chip" disabled={!count || faceBusy || glassBusy || photo.locked}
                onClick={() => void equip(null)} style={{ flex: '0 0 72px', minHeight: 76 }}>
                なし
              </button>
              {SUNGLASSES_STICKERS.map((style) => {
                const active = targetIndices.length > 0 && targetIndices.every((index) =>
                  attachedGlasses.some((sticker) =>
                    sticker.beautyGlassesFace === index && sticker.src === style.src));
                return (
                  <button type="button" key={style.id} className="chip"
                    aria-label={style.label + 'を装着'}
                    title={style.label}
                    aria-pressed={active}
                    disabled={!count || faceBusy || glassBusy || photo.locked}
                    onClick={() => void equip(style)}
                    style={{ flex: '0 0 88px', padding: '5px 3px',
                      borderColor: active ? '#e9519e' : undefined,
                      background: active ? '#ffe9f5' : '#fff',
                      display: 'flex', flexDirection: 'column', gap: 4,
                      alignItems: 'center' }}>
                    <img src={style.src} alt="" loading="lazy" draggable={false}
                      style={{ width: 76, height: 48, objectFit: 'contain' }} />
                    <span style={{ fontSize: 10, overflow: 'hidden', maxWidth: 80,
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{style.label}</span>
                  </button>
                );
              })}
            </div>
            {glassBusy && <p className="hint-s" role="status">サングラスを装着中…</p>}
            {glassMessage && <p className="hint-s" role="status">{glassMessage}</p>}
          </div>

          {status && status.state !== 'idle' && (
            <p role="status" className="hint-s" style={{
              padding: 9, borderRadius: 9,
              background: status.state === 'error' || status.state === 'no-face'
                ? '#fff4e6' : '#f8eefb',
            }}>
              {status.message}
            </p>
          )}

          {hasValue && status?.state === 'ready' && (
            <div style={{
              margin: '10px 0', padding: 10, borderRadius: 12,
              background: '#fff4fb', border: '1px solid #f1c9e3',
            }}>
              <button
                type="button"
                className="chip"
                aria-pressed={comparing}
                style={{
                  display: 'block', width: '100%', minHeight: 44,
                  touchAction: 'none', userSelect: 'none',
                  background: comparing ? '#e9d3e5' : '#ffffff',
                  borderColor: '#e56cae', fontWeight: 700,
                }}
                onPointerDown={() => setComparing(photo.id, true)}
                onPointerUp={() => setComparing(photo.id, false)}
                onPointerCancel={() => setComparing(photo.id, false)}
                onPointerLeave={() => setComparing(photo.id, false)}
                onTouchStart={() => setComparing(photo.id, true)}
                onTouchEnd={() => setComparing(photo.id, false)}
                onTouchCancel={() => setComparing(photo.id, false)}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    setComparing(photo.id, true);
                  }
                }}
                onKeyUp={() => setComparing(photo.id, false)}
                onBlur={() => setComparing(photo.id, false)}
              >
                {comparing ? '加工前を表示中' : '長押しで比較'}
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gap: 13, margin: '12px 0' }}>
            {CONTROLS.map((control) => (
              <div key={control.key} style={{
                padding: 10, background: '#ffffff',
                border: '1px solid #ecdde8', borderRadius: 12,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 5,
                }}>
                  <strong style={{ fontSize: 13 }}>{control.label}</strong>
                  <span style={{ fontSize: 13, color: '#e34f9b' }}>
                    {visibleSettings[control.key]}%
                  </span>
                </div>
                <HistorySlider
                  label={control.label}
                  min={0}
                  max={100}
                  step={1}
                  value={visibleSettings[control.key]}
                  elementId={photo.id}
                  disabled={photo.locked}
                  onChange={(value) => change(control.key, value)}
                />
              </div>
            ))}
          </div>
          <button type="button" className="big-btn light"
            disabled={!hasValue || photo.locked}
            onClick={reset}>
            {target === 'all' ? '全員の補正をリセット' : 'この顔の個別設定を解除'}
          </button>
        </>
      )}
    </>
  );
}
