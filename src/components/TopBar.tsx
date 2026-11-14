
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAutosaveStatus, useEditor, type CanvasPreset } from '../store';
import { exportBlob } from '../lib/stageRef';
import { SaveModal } from './SaveModal';
import type { CanvasEl, Tab } from '../types';

const TABS: { id: Tab; ic: string; label: string }[] = [
  { id: 'text', ic: '🔤', label: '文字' },
  { id: 'pen', ic: '✏️', label: 'ペン' },
  { id: 'stamp', ic: '🐶', label: 'スタンプ' },
  { id: 'mosaic', ic: '▦', label: 'モザイク' },
  { id: 'beauty', ic: '💄', label: 'ビューティー' },
  { id: 'edit', ic: '🎨', label: '加工' },
  { id: 'frame', ic: '🖼', label: 'フレーム' },
  { id: 'layer', ic: '📚', label: 'レイヤー' },
];

type Artwork = {
  elements: CanvasEl[];
  bgColor: string;
  canvasPreset: CanvasPreset;
  canvasWidth: number;
  canvasHeight: number;
};

type Backup = {
  app: 'JOMON pix';
  formatVersion: 1;
  exportedAt: string;
  artwork: Artwork;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isImageSource(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (/^data:image\//i.test(value) || /^https?:\/\//i.test(value))
  );
}

function isCanvasElement(value: unknown): value is CanvasEl {
  if (!isRecord(value)) return false;

  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 200 ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.rotation) ||
    !isFiniteNumber(value.scaleX) ||
    !isFiniteNumber(value.scaleY) ||
    !isFiniteNumber(value.opacity) ||
    value.opacity < 0 ||
    value.opacity > 1 ||
    (value.hidden !== undefined && typeof value.hidden !== 'boolean') ||
    (value.locked !== undefined && typeof value.locked !== 'boolean')
  ) {
    return false;
  }

  switch (value.type) {
    case 'image':
      return (
        isImageSource(value.src) &&
        isFiniteNumber(value.width) && value.width > 0 &&
        isFiniteNumber(value.height) && value.height > 0 &&
        ['none', 'vivid', 'mono', 'sepia', 'soft', 'cool'].includes(
          String(value.filter),
        )
      );

    case 'text':
      return (
        typeof value.text === 'string' &&
        typeof value.fontFamily === 'string' &&
        isFiniteNumber(value.fontSize) && value.fontSize > 0 &&
        typeof value.fill === 'string' &&
        typeof value.stroke === 'string' &&
        isFiniteNumber(value.strokeWidth) &&
        typeof value.glow === 'string' &&
        isFiniteNumber(value.letterSpacing) &&
        typeof value.vertical === 'boolean' &&
        ['left', 'center', 'right'].includes(String(value.align))
      );

    case 'sticker':
      return (
        typeof value.emoji === 'string' &&
        isFiniteNumber(value.size) && value.size > 0 &&
        (value.src === undefined || isImageSource(value.src)) &&
        (value.label === undefined || typeof value.label === 'string')
      );

    case 'line':
      return (
        Array.isArray(value.points) &&
        value.points.length >= 4 &&
        value.points.length % 2 === 0 &&
        value.points.every(isFiniteNumber) &&
        typeof value.color === 'string' &&
        isFiniteNumber(value.width) && value.width > 0 &&
        ['pen', 'marker', 'dashed', 'neon', 'dotted', 'rainbow', 'sparkle']
          .includes(String(value.penStyle))
      );

    default:
      return false;
  }
}

function parseBackup(raw: string): Artwork {
  const parsed: unknown = JSON.parse(raw);

  if (
    !isRecord(parsed) ||
    parsed.app !== 'JOMON pix' ||
    parsed.formatVersion !== 1 ||
    !isRecord(parsed.artwork)
  ) {
    throw new Error('JOMON pixの対応する作品ファイルではありません。');
  }

  const artwork = parsed.artwork;
  const presets = ['square', '4:5', '9:16', 'photo', 'custom'];

  if (
    !Array.isArray(artwork.elements) ||
    artwork.elements.length > 2000 ||
    !artwork.elements.every(isCanvasElement) ||
    typeof artwork.bgColor !== 'string' ||
    !presets.includes(String(artwork.canvasPreset)) ||
    !isFiniteNumber(artwork.canvasWidth) ||
    !isFiniteNumber(artwork.canvasHeight) ||
    artwork.canvasWidth < 32 || artwork.canvasHeight < 32 ||
    artwork.canvasWidth > 6000 || artwork.canvasHeight > 6000 ||
    artwork.canvasWidth * artwork.canvasHeight > 10000000
  ) {
    throw new Error('作品データの形式またはサイズが正しくありません。');
  }

  const ids = (artwork.elements as CanvasEl[]).map((el) => el.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('作品データに重複した要素IDがあります。');
  }

  return artwork as Artwork;
}

function createBackupFile(): File {
  const state = useEditor.getState();
  const backup: Backup = {
    app: 'JOMON pix',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    artwork: {
      elements: state.elements,
      bgColor: state.bgColor,
      canvasPreset: state.canvasPreset,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
    },
  };

  return new File(
    [JSON.stringify(backup)],
    `jomon-pix-work-${new Date().toISOString().slice(0, 10)}.json`,
    { type: 'application/json' },
  );
}

export function TopBar() {
  const {
    tab, setTab, undo, redo, past, future, savedAt, select,
  } = useEditor();

  const autosaveStatus = useAutosaveStatus((state) => state.status);
  const autosaveError = useAutosaveStatus((state) => state.errorMessage);

  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [workBusy, setWorkBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const hasSaveError = autosaveStatus === 'failed';
  const isReadError = hasSaveError &&
    (autosaveError?.includes('読み込めませんでした') ?? false);

  const save = async () => {
    if (busy) return;
    select(null);
    setBusy(true);
    setBlob(null);

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      setBlob(await exportBlob());
    } catch (error) {
      alert(error instanceof Error ? error.message : '画像の作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  // JSONには写真やスタンプのデータも含まれる。
  // iPhoneでは共有シートを優先し、非対応環境ではダウンロードする。
  const exportWork = async () => {
    if (workBusy) return;
    setWorkBusy(true);

    try {
      const file = createBackupFile();
      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
          // 共有できない場合は通常のダウンロードに切り替える。
        }
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'バックアップを作成できませんでした。');
    } finally {
      setWorkBusy(false);
    }
  };

  const importWork = async (file: File) => {
    if (workBusy) return;
    setWorkBusy(true);

    try {
      if (file.size > 30 * 1024 * 1024) {
        throw new Error('作品ファイルが大きすぎます（上限30MB）。');
      }

      const artwork = parseBackup(await file.text());

      const confirmed = window.confirm(
        '現在の作品は読み込む作品で置き換わります。\n' +
        '現在の作品を残したい場合は、先に「作品をバックアップ」を実行してください。\n\n' +
        '読み込みを続けますか？',
      );
      if (!confirmed) return;

      // 操作途中の履歴を閉じてから復元する。
      useEditor.getState().endHistoryGroup();
      const previous = useEditor.getState();

      useEditor.setState({
        ...artwork,
        selectedId: null,
        tab: 'image',
        tool: 'select',
        past: [],
        future: [],
        savedAt: Date.now(),
      });

      if (useAutosaveStatus.getState().status === 'failed') {
        // 保存できなかった場合、編集画面を元に戻す。
        useEditor.setState({
          elements: previous.elements,
          bgColor: previous.bgColor,
          canvasPreset: previous.canvasPreset,
          canvasWidth: previous.canvasWidth,
          canvasHeight: previous.canvasHeight,
          selectedId: previous.selectedId,
          tab: previous.tab,
          tool: previous.tool,
          past: previous.past,
          future: previous.future,
          savedAt: previous.savedAt,
        });
        throw new Error('作品をブラウザ内に保存できなかったため、読み込みを取り消しました。');
      }

      setWorkOpen(false);
      alert('作品を読み込みました。写真・文字・スタンプを再編集できます。');
    } catch (error) {
      alert(error instanceof Error ? error.message : '作品を読み込めませんでした。');
    } finally {
      setWorkBusy(false);
    }
  };

  return (
    <header className="top">
      <div className="brand">
        <span className="logo">JOMON pix</span>

        {autosaveStatus === 'saved' && (
          <span className="saved" role="status" style={{
            color: '#177245', background: '#e6f8ed', fontWeight: 700,
          }}>
            ✓ 自動保存済み
          </span>
        )}

        {autosaveStatus === 'idle' && savedAt > 0 && (
          <span className="saved" style={{
            color: '#756778', background: '#f3edf3',
          }}>
            前回の作品を表示中
          </span>
        )}

        {hasSaveError && (
          <span className="saved" style={{
            color: '#b42318', background: '#ffebeb', fontWeight: 700,
          }}>
            ⚠ 保存失敗
          </span>
        )}
      </div>

      <div className="bar">
        <button type="button" className={`tab ${tab === 'image' ? 'on' : ''}`}
          onClick={() => setTab('image')}>
          <span className="ic">🖼</span>画像
        </button>

        <div className="sep" />
        <button type="button" className="icon-btn" onClick={undo}
          disabled={!past.length} aria-label="戻す">↶</button>
        <button type="button" className="icon-btn" onClick={redo}
          disabled={!future.length} aria-label="やり直す">↷</button>
        <div className="sep" />

        <div className="tabs">
          {TABS.map((item) => (
            <button key={item.id} type="button"
              className={`tab ${tab === item.id ? 'on' : ''}`}
              onClick={() => setTab(item.id)}>
              <span className="ic">{item.ic}</span>{item.label}
            </button>
          ))}
        </div>

        <button type="button" className="icon-btn"
          aria-label="作品のバックアップと復元" title="作品のバックアップと復元"
          onClick={() => setWorkOpen(true)}>
          📁
        </button>

        <button type="button" className="save" onClick={save} disabled={busy}>
          {busy ? '作成中…' : '保存'}
        </button>
      </div>

      {hasSaveError && (
        <div role="alert" style={{
          padding: '10px 12px', border: '1px solid #f6b8b5',
          borderRadius: 14, background: '#fff0ef', color: '#922c28',
          fontSize: 12, lineHeight: 1.6, overflowWrap: 'anywhere',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
            ⚠ 自動保存に失敗しました
          </div>
          <div>{autosaveError || '作品を自動保存できませんでした。'}</div>
          {isReadError ? (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              既存の作品データを保護するため、この画面では自動保存を停止しています。
              ブラウザのデータを削除したり、新しい作品を作ったりしないでください。
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              このまま画面を閉じると、変更内容が失われる可能性があります。
              上の「保存」からPNG画像を書き出すか、📁から作品をバックアップしてください。
              PNGは再編集用のバックアップではありません。
            </div>
          )}
        </div>
      )}

      {blob && <SaveModal blob={blob} onClose={() => setBlob(null)} />}

      {workOpen && createPortal(
        <div className="modal-bg" onClick={() => {
          if (!workBusy) setWorkOpen(false);
        }}>
          <div className="modal" onClick={(event) => event.stopPropagation()}
            style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
            <h3>作品のバックアップ・復元</h3>
            <p className="hint" style={{ lineHeight: 1.7 }}>
              写真・文字・スタンプ・キャンバス設定をまとめて保存します。
              PNGとは違い、読み込んだ後も編集できます。
            </p>

            <button type="button" className="btn primary big"
              disabled={workBusy} onClick={exportWork}>
              {workBusy ? '処理中…' : '作品をバックアップ（JSON）'}
            </button>

            <button type="button" className="btn big"
              disabled={workBusy} onClick={() => importRef.current?.click()}>
              バックアップから復元
            </button>

            <input type="file" ref={importRef} accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importWork(file);
              }}
            />

            <p className="hint" style={{ lineHeight: 1.7 }}>
              復元すると現在の作品を置き換え、編集履歴はリセットされます。
              先に現在の作品をバックアップしてください。
              保存したJSONには写真データも含まれるので、取り扱いに注意してください。
            </p>

            <button type="button" className="btn big ghost" disabled={workBusy}
              onClick={() => setWorkOpen(false)}>
              閉じる
            </button>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
