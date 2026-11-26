import { uiMessage } from '../lib/uiLanguage';

import { useEffect, useMemo, useState } from 'react';
import { isNativeApp, shareNativeFile } from '../lib/nativeFileShare';
import { recordSuccessfulPhotoSave } from '../lib/appReview';

type Props = {
  blob: Blob;
  onClose: () => void;
};

export function SaveModal({ blob, onClose }: Props) {
  const [url, setUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const native = isNativeApp();

  useEffect(() => {
    const u = URL.createObjectURL(blob);

    setUrl(u);

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
        const activity = await shareNativeFile(blob, file.name);
        // The iOS plugin resolves only on a completed activity. Do not count
        // a canceled share, an external share, or a project-file export.
        if (activity === 'com.apple.UIKit.activity.SaveToCameraRoll') {
          void recordSuccessfulPhotoSave();
        }
      } else {
        await navigator.share({ files: [file] });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (!/abort|cancel|dismiss/i.test(message)) {
        alert(uiMessage('共有できませんでした。') +
          (native ? uiMessage('もう一度お試しください。') : uiMessage('画像を長押しして保存してください。')));
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

        {native && <p className="hint">共有画面で「画像を保存」を選択</p>}

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
