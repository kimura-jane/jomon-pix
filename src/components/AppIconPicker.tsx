import { useEffect, useState } from 'react';
import { canChangeAppIcon, getCurrentIcon, iconChoices, iconPreviewUrl, switchAppIcon, type IconChoice } from '../lib/appIcon';
import type { UiLanguage } from '../lib/uiLanguage';

interface Props { onClose: () => void; language: UiLanguage }

export function AppIconPicker({ onClose, language }: Props) {
  const en = language === 'en';
  const supported = canChangeAppIcon();
  const [current, setCurrent] = useState<IconChoice>('default');
  const [loading, setLoading] = useState(supported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    if (!supported) return;
    void getCurrentIcon().then((icon) => {
      if (live) setCurrent(icon);
    }).catch((reason: unknown) => {
      if (live) setError(en ? 'Could not read your current icon.' : '現在のアイコンを確認できませんでした。');
      console.warn('[JOMON PIX] Icon state unavailable', reason);
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [supported, en]);

  const apply = async (choice: IconChoice) => {
    if (busy || loading || !supported || choice === current) return;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const icon = await switchAppIcon(choice);
      setCurrent(icon);
      setMessage(en ? 'Icon updated. The home screen may take a moment to refresh.' : '変更しました。ホーム画面の反映には少し時間がかかる場合があります。');
    } catch (reason) {
      console.warn('[JOMON PIX] Icon change failed', reason);
      setError(en ? 'Could not change the icon. Please try again.' : 'アイコンを変更できませんでした。もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" role="presentation" onClick={() => { if (!busy) onClose(); }}>
      <div className="modal icon-picker-modal" role="dialog" aria-modal="true"
        aria-label={en ? 'Choose App Icon' : 'アイコン設定'} onClick={(event) => event.stopPropagation()}>
        <div className="icon-picker-heading">
          <h3>{en ? 'App Icon' : 'アイコン設定'}</h3>
          <button type="button" className="icon-picker-close" aria-label={en ? 'Close' : '閉じる'}
            onClick={onClose} disabled={busy}>×</button>
        </div>
        {!supported && <p className="icon-picker-notice" role="status">
          {en ? 'Changing the Home Screen icon is available in the installed iOS / Android app only.' :
            'ホーム画面のアイコン変更は、インストールしたiPhone・Androidアプリで利用できます。'}
        </p>}
        {loading && <p role="status">{en ? 'Checking your icon…' : '現在のアイコンを確認中…'}</p>}
        <div className="icon-picker-grid">
          {iconChoices.map((choice) => (
            <button type="button" key={choice.id} className={`icon-picker-choice ${!loading && current === choice.id ? 'selected' : ''}`}
              disabled={!supported || loading || busy}
              aria-pressed={!loading && current === choice.id}
              onClick={() => void apply(choice.id)}>
              <img src={iconPreviewUrl(choice.id)} alt="" width="72" height="72" loading="lazy" />
              <span>{en ? choice.labelEn : choice.labelJa}</span>
              {!loading && current === choice.id && <span className="icon-picker-selected" aria-label={en ? 'Selected' : '選択中'}>✓</span>}
            </button>
          ))}
        </div>
        {error && <p className="icon-picker-error" role="alert">{error}</p>}
        {message && <p className="icon-picker-success" role="status">{message}</p>}
        <button type="button" className="btn big ghost" onClick={onClose} disabled={busy}>
          {en ? 'Close' : '閉じる'}
        </button>
      </div>
    </div>
  );
}
