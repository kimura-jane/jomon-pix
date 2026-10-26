import { create } from 'zustand';
import type { CanvasEl } from './types';

type EditorState = {
  elements: CanvasEl[];
  selectedId: string | null;
  bgColor: string;
  past: CanvasEl[][];
  future: CanvasEl[][];
  add: (el: CanvasEl) => void;
  update: (id: string, patch: Partial<CanvasEl>) => void;
  remove: (id: string) => void;
  bringToFront: (id: string) => void;
  select: (id: string | null) => void;
  setBgColor: (c: string) => void;
  undo: () => void;
  redo: () => void;
};

export const useEditor = create<EditorState>()((set) => {
  const commit = (fn: (els: CanvasEl[]) => CanvasEl[]) =>
    set((s) => ({
      past: [...s.past, s.elements].slice(-50),
      future: [],
      elements: fn(s.elements),
    }));

  return {
    elements: [],
    selectedId: null,
    bgColor: '#fff6fb',
    past: [],
    future: [],

    add: (el) => {
      commit((els) => [...els, el]);
      set({ selectedId: el.id });
    },
    update: (id, patch) =>
      commit((els) =>
        els.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasEl) : e)),
      ),
    remove: (id) => {
      commit((els) => els.filter((e) => e.id !== id));
      set({ selectedId: null });
    },
    bringToFront: (id) =>
      commit((els) => {
        const t = els.find((e) => e.id === id);
        return t ? [...els.filter((e) => e.id !== id), t] : els;
      }),
    select: (id) => set({ selectedId: id }),
    setBgColor: (c) => set({ bgColor: c }),

    undo: () =>
      set((s) => {
        if (s.past.length === 0) return s;
        return {
          past: s.past.slice(0, -1),
          future: [s.elements, ...s.future],
          elements: s.past[s.past.length - 1],
          selectedId: null,
        };
      }),
    redo: () =>
      set((s) => {
        if (s.future.length === 0) return s;
        return {
          past: [...s.past, s.elements],
          future: s.future.slice(1),
          elements: s.future[0],
          selectedId: null,
        };
      }),
  };
});
