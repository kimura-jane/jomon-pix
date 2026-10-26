import { useState } from 'react';
import { useEditor } from '../store';
import { addImageFromFile } from '../lib/factory';
import { exportPNG } from '../lib/stageRef';
import { removeBg } from '../lib/removeBg';

export function Toolbar() {
  const { elements, selectedId, update, remove, bringToFront, undo, redo } = useEditor();
  const selected = elements.find((e) => e.id === selectedId);
  const [busy, setBusy] = useState(false);

  const onRemoveBg = async () => {
    if (selected?.type !== 'image') return;
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

  return (
    <header className="toolbar">
      <span className="logo">decopix</span>
      <label className="btn primary">
        ＋画像
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            [...(e.target.files ?? [])].forEach(addImageFromFile);
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
      <button className="btn primary" onClick={exportPNG}>保存</button>
    </header>
  );
}
