import { useEditor } from '../store';
import type { ImageEl, BeautySettings } from '../types';
import { BEAUTY_FIELDS, DEFAULT_BEAUTY } from '../lib/beautyProcessor';
import { useBeautyStatus } from '../lib/beautyStatus';
import { HistorySlider } from './HistorySlider';

type Control = {
  key: keyof BeautySettings;
  label: string;
  desc: string;
};
const CONTROLS: Control[] = [
  { key: 'smooth', label: '美肌・毛穴ぼかし', desc: '目や唇を残して肌を自然になめらかに' },
  { key: 'bright', label: '肌の明るさ', desc: '顔まわりを明るく' },
  { key: 'warmth', label: '血色', desc: '健康的な温かい肌色に' },
  { key: 'slim', label: '小顔', desc: '頬の幅を控えめに整える' },
  { key: 'chin', label: 'あごシャープ', desc: 'あご付近の輪郭を整える' },
  { key: 'eyes', label: '目の大きさ', desc: '目元を少しだけ大きく' },
  { key: 'lip', label: 'ナチュラルリップ', desc: '唇に自然な色味をプラス' },
  { key: 'blush', label: 'チーク', desc: '頬にほんのり血色感' },
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
        <p>先に「画像」から顔が写った写真を追加してください。</p>
      </div>
    );
  }

  return (
    <>
      <h3 style={{ margin: '0 0 6px' }}>ビューティー</h3>
      <p className="hint-s">
        顔を検出して自然に加工します。元の写真はそのまま保持し、
        あとで強度を変更したり、加工をすべて外したりできます。
      </p>

      {photos.length > 1 && (
        <>
          <p className="hint-s" style={{ fontWeight: 700, margin: '9px 0 4px' }}>
            加工する写真を選択
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
        <p className="hint-s">加工する写真を選んでください。</p>
      ) : (
        <>
          {photo.locked && (
            <p className="hint-s" style={{ fontWeight: 700 }}>
              写真がロックされています。「レイヤー」から解除してください。
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
                <p className="hint-s" style={{ margin: '2px 0 8px', fontSize: 11 }}>
                  {control.desc}
                </p>
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
            ビューティーをすべて解除
          </button>
          <p className="hint-s">
            顔認識と画像加工は端末内で実行します。顔のない写真は加工されません。
            顔が小さい、横を向いている、隠れている場合は効果が出ないことがあります。
            色や輪郭が不自然になったら強度を下げてください。
          </p>
        </>
      )}
    </>
  );
}
