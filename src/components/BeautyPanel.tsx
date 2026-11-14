import { useEditor } from '../store';
import type { ImageEl, BeautySettings } from '../types';
import { BEAUTY_FIELDS, DEFAULT_BEAUTY } from '../lib/beautyProcessor';
import { useBeautyStatus } from '../lib/beautyStatus';
import { HistorySlider } from './HistorySlider';

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
  const status = useBeautyStatus((store) => photo ? store.byImage[photo.id] : undefined);
  const comparing = useBeautyStatus((store) => store.comparingId === photo?.id);
  const setComparing = useBeautyStatus((store) => store.setComparing);
  const hasValue = BEAUTY_FIELDS.some((key) => beauty[key] > 0);

  const change = (field: keyof BeautySettings, value: number) => {
    if (!photo || photo.locked) return;
    editor.update(photo.id, {
      beauty: { ...beauty, [field]: value },
    });
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
                  写真{i + 1}{item.locked ? ' 🔒' : ''}
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
                    {beauty[control.key]}%
                  </span>
                </div>
                <HistorySlider
                  label={control.label}
                  min={0}
                  max={100}
                  step={1}
                  value={beauty[control.key]}
                  elementId={photo.id}
                  disabled={photo.locked}
                  onChange={(value) => change(control.key, value)}
                />
              </div>
            ))}
          </div>
          <button type="button" className="big-btn light"
            disabled={!hasValue || photo.locked}
            onClick={() => editor.update(photo.id, { beauty: undefined })}>
            加工をリセット
          </button>
        </>
      )}
    </>
  );
}
