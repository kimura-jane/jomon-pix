
import { useEffect, useMemo, useState } from 'react';

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

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  const share = async () => {
    try {
      await navigator.share({
        files: [file],
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        alert(
          '共有できませんでした。画像を長押しして保存してください。',
        );
      }
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
          画像を長押しして「写真に追加」でも
          保存できます
        </p>

        {canShare && (
          <button
            type="button"
            className="btn primary big"
            onClick={share}
            style={{ flexShrink: 0 }}
          >
            📷 写真に保存・共有
          </button>
        )}

        <button
          type="button"
          className="btn big"
          onClick={download}
          style={{ flexShrink: 0 }}
        >
          ⬇ ファイルに保存
        </button>

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
