import { useState } from 'react';
import { useEditor } from '../store';
import { addImageFromFile } from '../lib/factory';
import { exportBlob } from '../lib/stageRef';
import { removeBg } from '../lib/removeBg';
import { SaveModal } from './SaveModal';
import type { Tool } from '../types';

const TOOLS: { key: Tool; label: string }[] = [
  { key: 'select', label: '👆 選択' },
  { key: 'pen', label: '✏️ ペン' },
  { key: 'eraser', label: '🧽 消しゴム' },
];

export function Toolbar() {
  const elements = useEditor((s) => s.elements);
  const selectedId = useEditor((s) => s.selectedId);
  const tool = useEditor((s) => s.tool);
  const { setTool, update, remove, bringToFront, undo, redo } = useEditor.getState();
  const selected = elements.find((e) => e.id === selectedId);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveBlob, setSaveBlob] = useState<Blob | null>(null);

  const onRemoveBg = async () => {
    if (!selected || selected.type !== 'image') return;
    setBusy(true);
    try {
      const src = await removeBg(selected.src);
      update(selected.id, { src });
    } catch (e) {
      console.error(e);
      alert('背景削除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      setSaveBlob(await exportBlob());
    } catch (e) {
      console.error(e);
      alert('画像の作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="toolbar">
      <span className="logo">
        JOMON <small>pix</small>
      </span>

      {TOOLS.map((t) => (
        <button key={t.key} className={'btn' + (tool === t.key ? ' active' : '')} onClick={() => setTool(t.key)}>
          {t.label}
        </button>
      ))}
      <span className="divider" />

      <label className="btn primary">
        ＋画像
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            Array.from(e.target.files ?? []).forEach(addImageFromFile);
            e.target.value = '';
          }}
        />
      </label>
      <button className="btn" disabled={selected?.type !== 'image' || busy} onClick={onRemoveBg}>
        {busy ? '切り抜き中…' : '✂ 背景を消す'}
      </button>
      <button className="btn" disabled={!selected} onClick={() => selected && bringToFront(selected.id)}>
        最前面
      </button>
      <button className="btn" disabled={!selected} onClick={() => selected && remove(selected.id)}>
        削除
      </button>
      <button className="btn" onClick={undo}>↶</button>
      <button className="btn" onClick={redo}>↷</button>
      <button className="btn primary" disabled={saving} onClick={onSave}>
        {saving ? '作成中…' : '保存'}
      </button>

      {saveBlob && <SaveModal blob={saveBlob} onClose={() => setSaveBlob(null)} />}
    </header>
  );
}
