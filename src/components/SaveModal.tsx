
import { useEffect, useMemo, useState } from 'react';
import { isNativeApp, shareNativeFile } from '../lib/nativeFileShare';

type Props = {
  blob: Blob;
  onClose: () => void;
};

type ImageSize = {
  width: number;
  height: number;
};

export function SaveModal({ blob, onClose }: Props) {
  const [url, setUrl] = useState<string>();
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [saving, setSaving] = useState(false);
  const native = isNativeApp();

  useEffect(() => {
    const u = URL.createObjectURL(blob);

    setUrl(u);
    setImageSize(null);

    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const file = useMemo(
    () =>
      new File(
        [blob],
        `jomon-pix-${Date.now()}.png`,
        { type: 'image/png' },
      ),
    [blob],
  );

  const canShare = native || (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );

  const share = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (native) {
        await shareNativeFile(blob, file.name);
      } else {
        await navigator.share({ files: [file] });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (!/abort|cancel|dismiss/i.test(message)) {
        alert('共有できませんでした。' +
          (native ? 'もう一度お試しください。' : '画像を長押しして保存してください。'));
      }
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;

    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="modal-bg"
      onClick={onClose}
      style={{
        overflowY: 'auto',
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: 'calc(100dvh - 32px)',
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          boxSizing: 'border-box',
          paddingBottom:
            'max(18px, env(safe-area-inset-bottom))',
        }}
      >
        <h3>できあがり！</h3>

        {url && (
          <img
            className="preview"
            src={url}
            alt="完成画像"
            onLoad={(event) => {
              const img = event.currentTarget;

              setImageSize({
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            }}
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: 'min(38dvh, 380px)',
              objectFit: 'contain',
              alignSelf: 'center',
              flexShrink: 0,
            }}
          />
        )}

        {imageSize && (
          <p className="hint">
            保存画像のサイズ：
            {imageSize.width} × {imageSize.height} px
          </p>
        )}

        <p className="hint">
          {native
            ? '「写真に保存・共有」を押し、iPhoneの共有画面から「画像を保存」または「ファイルに保存」を選んでください。'
            : '画像を長押しして「写真に追加」でも保存できます'}
        </p>

        {canShare && (
          <button
            type="button"
            className="btn primary big"
            onClick={share}
            disabled={saving}
            style={{ flexShrink: 0 }}
          >
            {saving ? '準備中…' : '📷 写真に保存・共有'}
          </button>
        )}

        {!native && (
          <button
            type="button"
            className="btn big"
            onClick={download}
            style={{ flexShrink: 0 }}
          >
            ⬇ ファイルに保存
          </button>
        )}

        <button
          type="button"
          className="btn big ghost"
          onClick={onClose}
          style={{ flexShrink: 0 }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
