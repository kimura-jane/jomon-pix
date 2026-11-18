import { useEffect, useState } from 'react';
import { useEditor } from '../store';
import { countAutoFaceTargets } from '../lib/autoFaceDeco';
import type { ImageEl, BeautySettings } from '../types';
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
  { key: 'legSlim', label: '脚を細く' },
  { key: 'legLength', label: '脚を長く' },
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
  // Saved projects from earlier versions have no leg fields.
  const beauty = { ...DEFAULT_BEAUTY, ...photo?.beauty };

  const [target, setTarget] = useState<'all' | number>('all');
  const [faceInfo, setFaceInfo] = useState<{ photoId: string; src: string; count: number } | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceError, setFaceError] = useState('');

  const photoId = photo?.id;
  const photoSrc = photo?.src;
  useEffect(() => {
    let cancelled = false;
    setFaceInfo(null);
    setTarget('all');
    setFaceError('');
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
        setFaceError('顔認識に失敗しました。');
      }
    }).finally(() => { if (!cancelled) setFaceBusy(false); });
    return () => { cancelled = true; };
  }, [photoId, photoSrc]);

  const count = faceInfo && faceInfo.photoId === photoId && faceInfo.src === photoSrc
    ? faceInfo.count : 0;
  const selectedIndex = target === 'all' ? null : target < count ? target : null;
  const override = selectedIndex === null
    ? undefined : photo?.beautyFaceOverrides?.[String(selectedIndex)];
  const visibleSettings = { ...DEFAULT_BEAUTY, ...beauty, ...override };

  const status = useBeautyStatus((store) => photo ? store.byImage[photo.id] : undefined);
  const comparing = useBeautyStatus((store) => store.comparingId === photo?.id);
  const setComparing = useBeautyStatus((store) => store.setComparing);
  const hasLeg = beauty.legSlim > 0 || beauty.legLength > 0;
  const hasFaceOverride = !!override && Object.keys(override).length > 0;
  const hasValue = target === 'all'
    ? BEAUTY_FIELDS.some((key) => beauty[key] > 0)
    : hasFaceOverride || hasLeg;

  const change = (field: keyof BeautySettings, value: number) => {
    if (!photo || photo.locked) return;
    // Legs always belong to the photo, even when editing a single face.
    if (target === 'all' || field === 'legSlim' || field === 'legLength') {
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
      if (hasFaceOverride) {
        const next = { ...photo.beautyFaceOverrides };
        delete next[String(selectedIndex)];
        editor.update(photo.id, { beautyFaceOverrides: next });
      } else if (hasLeg) {
        // Global leg sliders remain usable with a face selected. Reset only
        // the legs; do not unexpectedly clear other faces' adjustments.
        editor.update(photo.id, {
          beauty: { ...beauty, legSlim: 0, legLength: 0 },
        });
      }
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

          {faceError && <p role="status" className="hint-s">{faceError}</p>}

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
            {target === 'all' ? '全員の補正をリセット' : hasFaceOverride ? 'この顔の個別設定を解除' : '脚の補正をリセット'}
          </button>
        </>
      )}
    </>
  );
}
