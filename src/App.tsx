import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { SidePanel } from './components/SidePanel';
import { Editor } from './components/Editor';
import { useEditor } from './store';
import './App.css';

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
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
        <div className="canvas-wrap"><Editor /></div>
      </div>
    </div>
  );
}
