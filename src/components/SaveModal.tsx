import { useEffect, useMemo, useState } from 'react';

type Props = { blob: Blob; onClose: () => void };

export function SaveModal({ blob, onClose }: Props) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const file = useMemo(
    () => new File([blob], `jomon-pix-${Date.now()}.png`, { type: 'image/png' }),
    [blob],
  );

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  const share = async () => {
    try {
      // iPhone は画像と文字を一緒に送ると失敗しやすいので、画像だけ
      await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        alert('共有できませんでした。画像を長押しして保存してください。');
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
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>できあがり！</h3>
        {url && <img className="preview" src={url} alt="完成画像" />}
        <p className="hint">画像を長押しして「"写真"に追加」でも保存できます</p>
        {canShare && (
          <button className="btn primary big" onClick={share}>
            📷 写真に保存・共有
          </button>
        )}
        <button className="btn big" onClick={download}>
          ⬇ ファイルに保存
        </button>
        <button className="btn big ghost" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
