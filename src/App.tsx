import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Editor } from './components/Editor';
import { Panel } from './components/Panel';
import { useEditor } from './store';
import './App.css';

export default function App() {
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

  return (
    <div className="app">
      <TopBar />
      <Editor />
      <Panel />
    </div>
  );
}
