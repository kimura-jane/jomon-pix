
import { useState } from 'react';
import {
  useEditor,
  useAutosaveStatus,
} from '../store';
import { exportBlob } from '../lib/stageRef';
import { SaveModal } from './SaveModal';
import type { Tab } from '../types';

const TABS: {
  id: Tab;
  ic: string;
  label: string;
}[] = [
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
  const {
    tab,
    setTab,
    undo,
    redo,
    past,
    future,
    savedAt,
    select,
  } = useEditor();

  const autosaveStatus = useAutosaveStatus(
    (state) => state.status,
  );

  const autosaveError = useAutosaveStatus(
    (state) => state.errorMessage,
  );

  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const hasSaveError = autosaveStatus === 'failed';

  const isReadError =
    hasSaveError &&
    (autosaveError?.includes('読み込めませんでした') ??
      false);

  // 完成画像のPNG書き出し。
  // 自動保存とは独立して利用できる。
  const save = async () => {
    if (busy) return;

    select(null);
    setBusy(true);
    setBlob(null);

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      const result = await exportBlob();

      setBlob(result);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : '画像の作成に失敗しました',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="top">
      <div className="brand">
        <span className="logo">
          JOMON pix
        </span>

        {autosaveStatus === 'saved' && (
          <span
            className="saved"
            role="status"
            style={{
              color: '#177245',
              background: '#e6f8ed',
              fontWeight: 700,
            }}
          >
            ✓ 自動保存済み
          </span>
        )}

        {autosaveStatus === 'idle' &&
          savedAt > 0 && (
            <span
              className="saved"
              style={{
                color: '#756778',
                background: '#f3edf3',
              }}
            >
              前回の作品を表示中
            </span>
          )}

        {hasSaveError && (
          <span
            className="saved"
            style={{
              color: '#b42318',
              background: '#ffebeb',
              fontWeight: 700,
            }}
          >
            ⚠ 保存失敗
          </span>
        )}
      </div>

      <div className="bar">
        <button
          type="button"
          className={`tab ${
            tab === 'image' ? 'on' : ''
          }`}
          onClick={() => setTab('image')}
        >
          <span className="ic">🖼</span>
          画像
        </button>

        <div className="sep" />

        <button
          type="button"
          className="icon-btn"
          onClick={undo}
          disabled={!past.length}
          aria-label="戻す"
        >
          ↶
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={redo}
          disabled={!future.length}
          aria-label="やり直す"
        >
          ↷
        </button>

        <div className="sep" />

        <div className="tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${
                tab === item.id ? 'on' : ''
              }`}
              onClick={() => setTab(item.id)}
            >
              <span className="ic">
                {item.ic}
              </span>
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="save"
          onClick={save}
          disabled={busy}
        >
          {busy ? '作成中…' : '保存'}
        </button>
      </div>

      {hasSaveError && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            border: '1px solid #f6b8b5',
            borderRadius: 14,
            background: '#fff0ef',
            color: '#922c28',
            fontSize: 12,
            lineHeight: 1.6,
            overflowWrap: 'anywhere',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            ⚠ 自動保存に失敗しました
          </div>

          <div>
            {autosaveError ||
              '作品を自動保存できませんでした。'}
          </div>

          {isReadError ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
              }}
            >
              既存の作品データを保護するため、
              この画面では自動保存を停止しています。
              ブラウザのデータを削除したり、
              新しい作品を作ったりしないでください。
            </div>
          ) : (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
              }}
            >
              このまま画面を閉じると、
              変更内容が失われる可能性があります。
              必要に応じて上の「保存」から
              PNG画像を書き出してください。
              PNGは再編集用のバックアップではありません。
            </div>
          )}
        </div>
      )}

      {blob && (
        <SaveModal
          blob={blob}
          onClose={() => setBlob(null)}
        />
      )}
    </header>
  );
}
