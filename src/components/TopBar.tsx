import { useState } from 'react';
import { useEditor } from '../store';
import { exportBlob } from '../lib/stageRef';
import { SaveModal } from './SaveModal';
import type { Tab } from '../types';

const TABS: { id: Tab; ic: string; label: string }[] = [
  { id: 'text', ic: '🔤', label: '文字' },
  { id: 'pen', ic: '✏️', label: 'ペン' },
  { id: 'stamp', ic: '🐶', label: 'スタンプ' },
  { id: 'glasses', ic: '🕶', label: 'サングラス' },
  { id: 'mosaic', ic: '▦', label: 'モザイク' },
  { id: 'beauty', ic: '💄', label: 'ビューティー' },
  { id: 'edit', ic: '🎨', label: '加工' },
  { id: 'frame', ic: '🖼', label: 'フレーム' },
  { id: 'layer', ic: '📚', label: 'レイヤー' },
];

export function TopBar() {
  const { tab, setTab, undo, redo, past, future, savedAt, select } = useEditor();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    select(null);
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      setBlob(await exportBlob());
    } catch (e) {
      alert((e as Error).message || '画像の作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="top">
      <div className="brand">
        <span className="logo">JOMON pix</span>
        {savedAt > 0 && <span className="saved">✓ 保存済み</span>}
      </div>
      <div className="bar">
        <button className={`tab ${tab === 'image' ? 'on' : ''}`} onClick={() => setTab('image')}>
          <span className="ic">🖼</span>画像
        </button>
        <div className="sep" />
        <button className="icon-btn" onClick={undo} disabled={!past.length} aria-label="戻す">↶</button>
        <button className="icon-btn" onClick={redo} disabled={!future.length} aria-label="やり直す">↷</button>
        <div className="sep" />
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              <span className="ic">{t.ic}</span>
              {t.label}
            </button>
          ))}
        </div>
        <button className="save" onClick={save} disabled={busy}>{busy ? '…' : '保存'}</button>
      </div>
      {blob && <SaveModal blob={blob} onClose={() => setBlob(null)} />}
    </header>
  );
}
