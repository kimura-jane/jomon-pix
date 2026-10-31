import { useRef, useState, type ReactNode } from 'react';
import { useEditor } from '../store';
import { addImageFromFile, addSticker, addText } from '../lib/factory';
import { removeBg } from '../lib/removeBg';
import { FONTS, FONT_GROUPS, TEXT_PRESETS } from '../lib/fonts';
import { PENS } from '../lib/pens';
import type { CanvasEl, FilterPreset, TextEl } from '../types';

const COLORS = ['#ff4fa3', '#ff5e5e', '#ffb84d', '#ffe94d', '#5be37d', '#4dc3ff', '#a77bff', '#ffffff', '#222222'];
const BG = ['#ffffff', '#fff6fb', '#ffe4ef', '#efe6ff', '#e8f4ff', '#fdf6e3', '#e9f7ee', '#222222'];
const FILTERS: { id: FilterPreset; label: string }[] = [
  { id: 'none', label: 'なし' }, { id: 'vivid', label: 'ビビッド' }, { id: 'soft', label: 'ふんわり' },
  { id: 'cool', label: 'クール' }, { id: 'sepia', label: 'セピア' }, { id: 'mono', label: 'モノクロ' },
];
const DOGS = ['🐶', '🐕', '🐩', '🦮', '🐕‍🦺', '🐾', '🦴', '🌭'];
const EMOJI = ['💖', '✨', '🌸', '⭐', '🎀', '🍓', '🐰', '🌈', '👑', '💬', '🫶', '🔥', '🥳', '😂', '😍', '🙈', '🎉', '💯'];
const GLASSES = ['🕶', '😎', '🥽', '👓'];

function Seg({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg">
      {items.map((i) => <button key={i} className={value === i ? 'on' : ''} onClick={() => onChange(i)}>{i}</button>)}
    </div>
  );
}
const Soon = ({ em, children }: { em: string; children: ReactNode }) => (
  <div className="soon"><span className="em">{em}</span>{children}<br />準備中だよ</div>
);
function Dots({ value, colors, onPick }: { value: string; colors: string[]; onPick: (c: string) => void }) {
  return (
    <div className="dots">
      {colors.map((c) => <button key={c} className={`dot ${value === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} />)}
    </div>
  );
}
function Slider({ label, min, max, step = 1, value, onChange }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">{label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function ImageTab() {
  const ref = useRef<HTMLInputElement>(null);
  const clear = useEditor((s) => s.clear);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple hidden
        onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) await addImageFromFile(f); e.target.value = ''; }} />
      <button className="big-btn" onClick={() => ref.current?.click()}>＋ 写真を追加</button>
      <button className="big-btn light" onClick={() => confirm('今の作品を消して新しく作る？') && clear()}>✨ 新しく作る</button>
      <p className="hint-s">作品は自動で保存されます。コラージュと作品一覧は準備中だよ</p>
    </>
  );
}

function TextTab({ el }: { el?: TextEl }) {
  const [sub, setSub] = useState('文字');
  const [group, setGroup] = useState<string>(FONT_GROUPS[0]);
  const update = useEditor((s) => s.update);
  const up = (p: Partial<TextEl>) => el && update(el.id, p);
  return (
    <>
      <Seg items={['文字', '吹き出し']} value={sub} onChange={setSub} />
      {sub === '吹き出し' ? <Soon em="💬">丸・ギザギザ・もくもく・LINE風の吹き出し</Soon> : (
        <>
          {!el && <button className="big-btn" onClick={() => addText()}>＋ 文字を入れる</button>}
          {el && <textarea className="input" rows={2} value={el.text} onChange={(e) => up({ text: e.target.value })} />}
          <div className="label">スタイル</div>
          <div className="row">
            {TEXT_PRESETS.map((p) => (
              <button key={p.label} className="chip" style={{ fontFamily: p.style.fontFamily }}
                onClick={() => (el ? up(p.style) : addText(p.style))}>{p.label}</button>
            ))}
          </div>
          {el && (
            <>
              <div className="label">フォント</div>
              <Seg items={FONT_GROUPS} value={group} onChange={setGroup} />
              <div className="row">
                {FONTS.filter((f) => f.group === group).map((f) => (
                  <button key={f.family} className={`chip ${el.fontFamily === f.family ? 'on' : ''}`} style={{ fontFamily: f.family }}
                    onClick={() => up({ fontFamily: f.family })}>{f.label}</button>
                ))}
              </div>
              <div className="label">色</div>
              <Dots value={el.fill} colors={COLORS} onPick={(c) => up({ fill: c })} />
              <div className="label">ふちどり</div>
              <Dots value={el.stroke} colors={['', ...COLORS]} onPick={(c) => up({ stroke: c, strokeWidth: el.strokeWidth || 6 })} />
              <div className="label">光る</div>
              <Dots value={el.glow} colors={['', '#ff2fd0', '#ffe14d', '#4dc3ff', '#39ff88', '#ffffff']} onPick={(c) => up({ glow: c })} />
              <div className="label">形</div>
              <div className="row">
                <button className={`chip ${!el.vertical ? 'on' : ''}`} onClick={() => up({ vertical: false })}>横書き</button>
                <button className={`chip ${el.vertical ? 'on' : ''}`} onClick={() => up({ vertical: true })}>縦書き</button>
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button key={a} className={`chip ${el.align === a ? 'on' : ''}`} onClick={() => up({ align: a })}>
                    {a === 'left' ? '左' : a === 'center' ? '中央' : '右'}
                  </button>
                ))}
              </div>
              <Slider label="大きさ" min={16} max={200} value={el.fontSize} onChange={(v) => up({ fontSize: v })} />
              <Slider label="字間" min={-5} max={40} value={el.letterSpacing} onChange={(v) => up({ letterSpacing: v })} />
              <button className="big-btn light" onClick={() => addText()}>＋ もう1つ文字を入れる</button>
            </>
          )}
        </>
      )}
    </>
  );
}

function PenTab() {
  const { tool, setTool, pen, setPen } = useEditor();
  return (
    <>
      <Seg items={['ペン', '消しゴム']} value={tool === 'eraser' ? '消しゴム' : 'ペン'} onChange={(v) => setTool(v === '消しゴム' ? 'eraser' : 'pen')} />
      {tool === 'eraser' ? <p className="hint-s">なぞった線を1本ずつ消せるよ</p> : (
        <>
          {(['まじめ', 'かわいい'] as const).map((g) => (
            <div key={g}>
              <div className="label">{g}</div>
              <div className="row">
                {PENS.filter((p) => p.group === g).map((p) => (
                  <button key={p.style} className={`chip ${pen.style === p.style ? 'on' : ''}`} onClick={() => setPen({ style: p.style })}>{p.label}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="label">色</div>
          <Dots value={pen.color} colors={COLORS} onPick={(c) => setPen({ color: c })} />
          <Slider label="太さ" min={2} max={40} value={pen.width} onChange={(v) => setPen({ width: v })} />
        </>
      )}
    </>
  );
}

function StampTab() {
  const [sub, setSub] = useState('犬');
  return (
    <>
      <Seg items={['マイスタンプ', '埴輪', '土偶', '犬', '絵文字']} value={sub} onChange={setSub} />
      {sub === 'マイスタンプ' && <Soon em="📷">カメラロール → 背景を自動で消す → 登録</Soon>}
      {sub === '埴輪' && <Soon em="🏺">オリジナル埴輪スタンプ</Soon>}
      {sub === '土偶' && <Soon em="🗿">オリジナル土偶スタンプ</Soon>}
      {(sub === '犬' || sub === '絵文字') && (
        <div className="grid">
          {(sub === '犬' ? DOGS : EMOJI).map((s) => <button key={s} className="cell" onClick={() => addSticker(s)}>{s}</button>)}
        </div>
      )}
    </>
  );
}

function EditTab({ el }: { el?: CanvasEl }) {
  const s = useEditor();
  const [sub, setSub] = useState(el?.type === 'image' ? '切り抜き' : el ? '配置' : 'キャンバス');
  const [busy, setBusy] = useState(false);
  const off = !el;
  return (
    <>
      <Seg items={['配置', '切り抜き', '色', 'キャンバス']} value={sub} onChange={setSub} />
      {sub === '配置' && (
        <>
          {off && <p className="hint-s">キャンバスの物をタップして選んでね</p>}
          <div className="row">
            <button className="chip" disabled={off} onClick={() => el && s.move(el.id, 'front')}>⤒ 最前面</button>
            <button className="chip" disabled={off} onClick={() => el && s.move(el.id, 'up')}>↑ 1つ前へ</button>
            <button className="chip" disabled={off} onClick={() => el && s.move(el.id, 'down')}>↓ 1つ後ろへ</button>
            <button className="chip" disabled={off} onClick={() => el && s.move(el.id, 'back')}>⤓ 最背面</button>
            <button className="chip" disabled={off} onClick={() => el && s.update(el.id, { scaleX: -el.scaleX })}>⇋ 左右反転</button>
            <button className="chip" disabled={off} onClick={() => el && s.update(el.id, { scaleY: -el.scaleY })}>⇵ 上下反転</button>
            <button className="chip" disabled={off} onClick={() => el && s.duplicate(el.id)}>⧉ 複製</button>
            <button className="chip" disabled={off} onClick={() => el && s.update(el.id, { locked: !el.locked })}>{el?.locked ? '🔓 ロック解除' : '🔒 ロック'}</button>
            <button className="chip" disabled={off} onClick={() => el && s.remove(el.id)}>🗑 削除</button>
          </div>
          {el && <Slider label="透明度" min={0.1} max={1} step={0.05} value={el.opacity} onChange={(v) => s.update(el.id, { opacity: v })} />}
        </>
      )}
      {sub === '切り抜き' && (
        el?.type === 'image' ? (
          <>
            <button className="big-btn" disabled={busy} onClick={async () => {
              setBusy(true);
              try { s.update(el.id, { src: await removeBg(el.src) }); } catch { alert('背景削除に失敗しました'); } finally { setBusy(false); }
            }}>{busy ? '背景を消しています…' : '✂️ 背景を消す'}</button>
            <p className="hint-s">トリミングは準備中だよ</p>
          </>
        ) : <p className="hint-s">写真を選ぶと使えるよ</p>
      )}
      {sub === '色' && (
        el?.type === 'image' ? (
          <div className="row">
            {FILTERS.map((f) => <button key={f.id} className={`chip ${el.filter === f.id ? 'on' : ''}`} onClick={() => s.update(el.id, { filter: f.id })}>{f.label}</button>)}
          </div>
        ) : <p className="hint-s">写真を選ぶと使えるよ</p>
      )}
      {sub === 'キャンバス' && (
        <>
          <div className="label">背景色</div>
          <Dots value={s.bgColor} colors={BG} onPick={s.setBg} />
          <p className="hint-s">サイズ変更（4:5・9:16など）は準備中だよ</p>
        </>
      )}
    </>
  );
}

function layerName(e: CanvasEl) {
  if (e.type === 'text') return e.text || '文字';
  if (e.type === 'sticker') return 'スタンプ';
  if (e.type === 'line') return 'ペン';
  return '写真';
}

function LayerTab() {
  const { elements, selectedId, select, update, move } = useEditor();
  if (!elements.length) return <p className="hint-s">まだ何もないよ</p>;
  return (
    <>
      {[...elements].reverse().map((e) => (
        <div key={e.id} className={`layer ${selectedId === e.id ? 'on' : ''}`} onClick={() => select(e.id)}>
          <div className="thumb" style={e.type === 'image' ? { backgroundImage: `url(${e.src})` } : undefined}>
            {e.type === 'sticker' ? e.emoji : e.type === 'text' ? '🔤' : e.type === 'line' ? '✏️' : ''}
          </div>
          <span className="name">{layerName(e)}</span>
          <button onClick={(ev) => { ev.stopPropagation(); move(e.id, 'up'); }}>↑</button>
          <button onClick={(ev) => { ev.stopPropagation(); move(e.id, 'down'); }}>↓</button>
          <button onClick={(ev) => { ev.stopPropagation(); update(e.id, { hidden: !e.hidden }); }}>{e.hidden ? '🙈' : '👁'}</button>
          <button onClick={(ev) => { ev.stopPropagation(); update(e.id, { locked: !e.locked }); }}>{e.locked ? '🔒' : '🔓'}</button>
        </div>
      ))}
    </>
  );
}

export function Panel() {
  const { tab, elements, selectedId } = useEditor();
  const el = elements.find((e) => e.id === selectedId);
  return (
    <section className="panel">
      <div className="grab" />
      {tab === 'image' && <ImageTab />}
      {tab === 'text' && <TextTab el={el?.type === 'text' ? el : undefined} />}
      {tab === 'pen' && <PenTab />}
      {tab === 'stamp' && <StampTab />}
      {tab === 'glasses' && (
        <>
          <div className="grid">{GLASSES.map((g) => <button key={g} className="cell" onClick={() => addSticker(g)}>{g}</button>)}</div>
          <Soon em="🕶">形・色・レンズを自分でカスタマイズ＆顔に自動でかける</Soon>
        </>
      )}
      {tab === 'mosaic' && <Soon em="▦">タイル・ぼかし・顔を自動でかくす</Soon>}
      {tab === 'beauty' && <Soon em="💄">肌・メイク・小顔・あごシャープ</Soon>}
      {tab === 'edit' && <EditTab key={selectedId ?? 'none'} el={el} />}
      {tab === 'frame' && <Soon em="🖼">雑誌風・卒アル風・ポラロイド・夜景</Soon>}
      {tab === 'layer' && <LayerTab />}
    </section>
  );
}
