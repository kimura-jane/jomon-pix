import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Editor } from './components/Editor';
import { Panel } from './components/Panel';
import { useEditor } from './store';
import './App.css';

export default function App() {
  const [hydrated, setHydrated] = useState(() => useEditor.persist.hasHydrated());

  useEffect(() => {
    // The editor used to hydrate synchronously from localStorage.
    // IndexedDB requires an asynchronous read. Do not mount editable
    // controls before hydration completes, or an edit could overwrite art.
    const off = useEditor.persist.onFinishHydration(() => setHydrated(true));
    if (!useEditor.persist.hasHydrated()) {
      void useEditor.persist.rehydrate()
        .catch((error) => {
          console.error('[JOMON pix] Unable to hydrate project', error);
        })
        .finally(() => setHydrated(true));
    } else {
      setHydrated(true);
    }
    return off;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const s = useEditor.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) {
        s.remove(s.selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!hydrated) {
    return (
      <div role="status" style={{
        minHeight: '100dvh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#b94e94', fontWeight: 700, padding: 20,
      }}>
        作品を読み込み中…
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar />
      <Editor />
      <Panel />
    </div>
  );
}
