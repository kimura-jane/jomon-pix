import { useEditor } from '../store';
import { addSticker, addText } from '../lib/factory';
import { FONTS, FONT_GROUPS, TEXT_PRESETS } from '../lib/fonts';
import { PENS } from '../lib/pens';
import type { FilterPreset, TextEl } from '../types';

const STICKERS = ['💖', '✨', '🌸', '⭐', '🎀', '🍓', '🐰', '🌈', '👑', '💬', '🫶', '🔥'];

const FILTERS: { key: FilterPreset; label: string }[] = [
  { key: 'none', label: 'なし' },
  { key: 'vivid', label: 'ビビッド' },
  { key: 'soft', label: 'ふんわり' },
  { key: 'cool', label: 'クール' },
  { key: 'sepia', label: 'セピア' },
  { key: 'mono', label: 'モノクロ' },
];

const COLORS = ['#111111', '#ffffff', '#ff4fa3', '#ff8fab', '#e63946', '#ffb703', '#ffe14d', '#7ae582', '#4cc9f0', '#3a86ff', '#7a5cff', '#b28dff'];
const BG_COLORS = ['#ffffff', '#fff6fb', '#ffe4ef', '#e8f4ff', '#fdf6e3', '#222222'];

function ColorRow({
  value,
  onChange,
  allowNone,
}: {
  value?: string;
  onChange: (c: string | undefined) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="colors">
      {allowNone && (
        <button className={'swatch none' + (!value ? ' active' : '')} onClick={() => onChange(undefined)}>
          なし
        </button>
      )}
      {COLORS.map((c) => (
        <button key={c} className={'swatch' + (value === c ? ' active' : '')} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
      <input type="color" value={value ?? '#000000'} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PenPanel() {
  const pen = useEditor((s) => s.pen);
  const setPen = useEditor((s) => s.setPen);
  return (
    <section>
      {(['まじめ', 'かわいい'] as const).map((g) => (
        <div key={g}>
          <h3>{g}ペン</h3>
          <div className="grid2">
            {PENS.filter((p) => p.group === g).map((p) => (
              <button key={p.key} className={'chip' + (pen.style === p.key ? ' active' : '')} onClick={() => setPen({ style: p.key })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <label className="field">
        太さ {pen.width}
        <input type="range" min={1} max={40} value={pen.width} onChange={(e) => setPen({ width: Number(e.target.value) })} />
      </label>
      <h3>色</h3>
      <ColorRow value={pen.color} onChange={(c) => c && setPen({ color: c })} />
      <p className="hint">消しゴムは線をなぞると1本ずつ消えます。描いた線は「選択」で動かせます。</p>
    </section>
  );
}

function TextEditor({ el }: { el: TextEl }) {
  const update = useEditor((s) => s.update);
  return (
    <section>
      <h3>文字を編集</h3>
      <textarea className="textarea" rows={3} value={el.text} onChange={(e) => update(el.id, { text: e.target.value })} />

      {FONT_GROUPS.map((g) => (
        <div key={g}>
          <div className="field">{g}</div>
          <div className="grid2">
            {FONTS.filter((f) => f.group === g).map((f) => (
              <button
                key={f.family}
                className={'font-btn' + (el.fontFamily === f.family ? ' active' : '')}
                style={{ fontFamily: `"${f.family}"` }}
                onClick={() => update(el.id, { fontFamily: f.family })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <label className="field">
        大きさ {el.fontSize}
        <input type="range" min={16} max={200} value={el.fontSize} onChange={(e) => update(el.id, { fontSize: Number(e.target.value) })} />
      </label>
      <label className="field">
        文字の間隔 {el.letterSpacing}
        <input type="range" min={-5} max={40} value={el.letterSpacing} onChange={(e) => update(el.id, { letterSpacing: Number(e.target.value) })} />
      </label>
      <div className="field">文字の色</div>
      <ColorRow value={el.fill} onChange={(c) => c && update(el.id, { fill: c })} />
      <div className="field">ふちどり</div>
      <ColorRow allowNone value={el.stroke} onChange={(c) => update(el.id, { stroke: c })} />
      <div className="field">光る</div>
      <ColorRow allowNone value={el.glow} onChange={(c) => update(el.id, { glow: c })} />
    </section>
  );
}

export function SidePanel() {
  const tool = useEditor((s) => s.tool);
  const selected = useEditor((s) => s.elements.find((e) => e.id === s.selectedId));
  const update = useEditor((s) => s.update);
  const bgColor = useEditor((s) => s.bgColor);
  const setBgColor = useEditor((s) => s.setBgColor);

  if (tool === 'pen') {
    return (
      <aside className="panel">
        <PenPanel />
      </aside>
    );
  }

  return (
    <aside className="panel">
      {selected?.type === 'text' && <TextEditor el={selected} />}

      {selected?.type === 'image' && (
        <section>
          <h3>フィルター</h3>
          <div className="grid2">
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
        </section>
      )}

      <h3>文字を追加</h3>
      <div className="grid2">
        {TEXT_PRESETS.map((t) => (
          <button
            key={t.label}
            className="text-style"
            style={{
              fontFamily: `"${t.fontFamily}"`,
              color: t.fill,
              WebkitTextStroke: t.stroke ? `1px ${t.stroke}` : undefined,
              textShadow: t.glow ? `0 0 8px ${t.glow}` : undefined,
            }}
            onClick={() => addText(t)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <h3>スタンプ</h3>
      <div className="grid">
        {STICKERS.map((s) => (
          <button key={s} className="sticker" onClick={() => addSticker(s)}>
            {s}
          </button>
        ))}
      </div>

      <h3>背景色</h3>
      <div className="grid">
        {BG_COLORS.map((c) => (
          <button key={c} className={'bg-swatch' + (bgColor === c ? ' active' : '')} style={{ background: c }} onClick={() => setBgColor(c)} />
        ))}
      </div>
    </aside>
  );
}
