import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Editor } from './components/Editor';
import { Panel } from './components/Panel';
import { useEditor } from './store';
import { mountUiTranslation } from './lib/uiLanguage';
import './App.css';

export default function App() {
  const [hydrated, setHydrated] = useState(() => useEditor.persist.hasHydrated());

  useEffect(() => mountUiTranslation(), []);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersAvailable = useEditor((state) => state.elements.some((el) => el.type !== 'line'));
  useEffect(() => {
    if (!layersAvailable) setLayersOpen(false);
  }, [layersAvailable]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const active = document.activeElement;
      const editing = active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement && ['text','search','email','url','tel','number','password'].includes(active.type)) ||
        (active instanceof HTMLElement && active.isContentEditable);
      const open = !!editing && window.innerHeight - viewport.height > 100;
      setKeyboardOpen(open);
      if (open) document.documentElement.style.setProperty('--editor-viewport-height', Math.round(viewport.height) + 'px');
      else document.documentElement.style.removeProperty('--editor-viewport-height');
    };
    viewport.addEventListener('resize', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    return () => {
      viewport.removeEventListener('resize', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
      document.documentElement.style.removeProperty('--editor-viewport-height');
    };
  }, []);

  useEffect(() => {
    // The editor used to hydrate synchronously from localStorage.
    // IndexedDB requires an asynchronous read. Do not mount editable
    // controls before hydration completes, or an edit could overwrite art.
    const off = useEditor.persist.onFinishHydration(() => setHydrated(true));
    if (!useEditor.persist.hasHydrated()) {
      void useEditor.persist.rehydrate()
        .catch((error) => {
          console.error('[JOMON PIX] Unable to hydrate project', error);
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
    <div className={keyboardOpen ? "app keyboard-open" : "app"}>
      <TopBar layersOpen={layersOpen && layersAvailable} layersAvailable={layersAvailable}
        onToggleLayers={() => setLayersOpen((open) => !open)}
        onCloseLayers={() => setLayersOpen(false)} />
      <Editor layersOpen={layersOpen && layersAvailable} onCloseLayers={() => setLayersOpen(false)} />
      <Panel />
    </div>
  );
}
