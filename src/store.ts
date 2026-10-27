import { create } from 'zustand';
import type { CanvasEl, PenStyle, Tool } from './types';

export type PenSettings = { style: PenStyle; color: string; width: number };

type EditorState = {
  elements: CanvasEl[];
  selectedId: string | null;
  bgColor: string;
  tool: Tool;
  pen: PenSettings;
  past: CanvasEl[][];
  future: CanvasEl[][];
  add: (el: CanvasEl, selectAfter?: boolean) => void;
  update: (id: string, patch: Partial<CanvasEl>) => void;
  remove: (id: string) => void;
  bringToFront: (id: string) => void;
  select: (id: string | null) => void;
  setBgColor: (c: string) => void;
  setTool: (t: Tool) => void;
  setPen: (p: Partial<PenSettings>) => void;
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
    tool: 'select',
    pen: { style: 'pen', color: '#ff4fa3', width: 6 },
    past: [],
    future: [],

    add: (el, selectAfter = true) => {
      commit((els) => [...els, el]);
      if (selectAfter) set({ selectedId: el.id });
    },
    update: (id, patch) =>
      commit((els) =>
        els.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasEl) : e)),
      ),
    remove: (id) => {
      commit((els) => els.filter((e) => e.id !== id));
      set((s) => ({ selectedId: s.selectedId === id ? null : s.selectedId }));
    },
    bringToFront: (id) =>
      commit((els) => {
        const t = els.find((e) => e.id === id);
        return t ? [...els.filter((e) => e.id !== id), t] : els;
      }),
    select: (id) => set({ selectedId: id }),
    setBgColor: (c) => set({ bgColor: c }),
    setTool: (t) => set((s) => ({ tool: t, selectedId: t === 'select' ? s.selectedId : null })),
    setPen: (p) => set((s) => ({ pen: { ...s.pen, ...p } })),

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
