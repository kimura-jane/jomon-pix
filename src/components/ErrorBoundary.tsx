import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Protect the editor from an unrecoverable blank-screen render crash.
 * Never reset localStorage or IndexedDB here; saved projects belong
 * to the user, even when a rendering component throws.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[JOMON pix] Editor rendering failed:', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main role="alert" style={{
        minHeight: '100dvh', padding: 24, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, color: '#352b38', background: '#fff8fc', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>画面を表示できませんでした</h1>
        <p style={{ maxWidth: 360, lineHeight: 1.7, margin: 0 }}>
          作品データは削除していません。アプリを開き直してください。
          改善しない場合も、アプリのデータを削除せずにお問い合わせください。
        </p>
        <button type="button" onClick={() => window.location.reload()} style={{
          fontSize: 16, fontWeight: 700, padding: '12px 22px',
          borderRadius: 12, border: 0, background: '#dc4e99', color: '#fff',
        }}>
          再読み込み
        </button>
      </main>
    );
  }
}
