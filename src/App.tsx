import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { SidePanel } from './components/SidePanel';
import { Editor } from './components/Editor';
import { useEditor } from './store';
import './App.css';

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) s.remove(s.selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <SidePanel />
        <Editor />
      </div>
    </div>
  );
}
