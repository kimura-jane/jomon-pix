import { useEditor } from '../store';
import { addSticker, addText } from '../lib/factory';
import type { FilterPreset } from '../types';

const STICKERS = ['💖', '✨', '🌸', '⭐', '🎀', '🍓', '🐰', '🌈', '👑', '💬', '🫶', '🔥'];

const TEXT_STYLES = [
  { label: 'ポップ', fontFamily: 'Dela Gothic One', fill: '#ff4fa3', stroke: '#ffffff' },
  { label: 'まるもじ', fontFamily: 'Zen Maru Gothic', fill: '#ffffff', stroke: '#7a5cff' },
  { label: '手書き風', fontFamily: 'Yusei Magic', fill: '#333333' },
  { label: 'シンプル', fontFamily: 'sans-serif', fill: '#111111' },
];

const FILTERS: { key: FilterPreset; label: string }[] = [
  { key: 'none', label: 'なし' },
  { key: 'vivid', label: 'ビビッド' },
  { key: 'soft', label: 'ふんわり' },
  { key: 'cool', label: 'クール' },
  { key: 'sepia', label: 'セピア' },
  { key: 'mono', label: 'モノクロ' },
];

const BG_COLORS = ['#ffffff', '#fff6fb', '#ffe4ef', '#e8f4ff', '#fdf6e3', '#222222'];

export function SidePanel() {
  const { elements, selectedId, update, bgColor, setBgColor } = useEditor();
  const selected = elements.find((e) => e.id === selectedId);

  return (
    <aside className="panel">
      <h3>スタンプ</h3>
      <div className="grid">
        {STICKERS.map((s) => (
          <button key={s} className="sticker" onClick={() => addSticker(s)}>{s}</button>
        ))}
      </div>

      <h3>文字</h3>
      {TEXT_STYLES.map((t) => (
        <button
          key={t.label}
          className="text-style"
          style={{ fontFamily: t.fontFamily, color: t.fill, WebkitTextStroke: t.stroke ? `1px ${t.stroke}` : undefined }}
          onClick={() => addText(t)}
        >
          {t.label}
        </button>
      ))}

      {selected?.type === 'image' && (
        <>
          <h3>フィルター</h3>
          <div className="grid">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={'chip' + (selected.filter === f.key ? ' active' : '')}
                onClick={() => update(selected.id, { filter: f.key })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      <h3>背景色</h3>
      <div className="grid">
        {BG_COLORS.map((c) => (
          <button
            key={c}
            className={'swatch' + (bgColor === c ? ' active' : '')}
            style={{ background: c }}
            onClick={() => setBgColor(c)}
          />
        ))}
      </div>
    </aside>
  );
}
