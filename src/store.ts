import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CanvasEl, Patch, PenStyle, Tab, Tool } from './types';

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

type Pen = { style: PenStyle; color: string; width: number };
type Dir = 'front' | 'back' | 'up' | 'down';

type S = {
  elements: CanvasEl[];
  selectedId: string | null;
  bgColor: string;
  tab: Tab;
  tool: Tool;
  pen: Pen;
  past: CanvasEl[][];
  future: CanvasEl[][];
  savedAt: number;
  add: (el: CanvasEl) => void;
  update: (id: string, patch: Patch) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  move: (id: string, dir: Dir) => void;
  select: (id: string | null) => void;
  setBg: (c: string) => void;
  setTab: (t: Tab) => void;
  setTool: (t: Tool) => void;
  setPen: (p: Partial<Pen>) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
};

// iPhoneの保存容量を超えても落ちないようにする
const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => localStorage.getItem(k),
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      console.warn('自動保存の容量オーバー');
    }
  },
  removeItem: (k: string) => localStorage.removeItem(k),
}));

export const useEditor = create<S>()(
  persist(
    (set, get) => {
      const commit = (next: CanvasEl[]) =>
        set((s) => ({
          past: [...s.past, s.elements].slice(-50),
          future: [],
          elements: next,
          savedAt: Date.now(),
        }));

      return {
        elements: [],
        selectedId: null,
        bgColor: '#fff6fb',
        tab: 'image',
        tool: 'select',
        pen: { style: 'pen', color: '#ff4fa3', width: 6 },
        past: [],
        future: [],
        savedAt: 0,

        add: (el) => {
          commit([...get().elements, el]);
          if (el.type !== 'line') set({ selectedId: el.id });
        },
        update: (id, patch) =>
          commit(get().elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasEl) : e))),
        remove: (id) => {
          commit(get().elements.filter((e) => e.id !== id));
          if (get().selectedId === id) set({ selectedId: null });
        },
        duplicate: (id) => {
          const el = get().elements.find((e) => e.id === id);
          if (!el) return;
          const copy = { ...el, id: newId(), x: el.x + 30, y: el.y + 30, locked: false } as CanvasEl;
          commit([...get().elements, copy]);
          set({ selectedId: copy.id });
        },
        move: (id, dir) => {
          const arr = [...get().elements];
          const i = arr.findIndex((e) => e.id === id);
          if (i < 0) return;
          const [el] = arr.splice(i, 1);
          if (dir === 'front') arr.push(el);
          else if (dir === 'back') arr.unshift(el);
          else if (dir === 'up') arr.splice(Math.min(i + 1, arr.length), 0, el);
          else arr.splice(Math.max(i - 1, 0), 0, el);
          commit(arr);
        },
        select: (id) => set({ selectedId: id }),
        setBg: (c) => set({ bgColor: c, savedAt: Date.now() }),
        setTab: (t) => set({ tab: t, tool: t === 'pen' ? get().tool === 'eraser' ? 'eraser' : 'pen' : 'select' }),
        setTool: (t) => set({ tool: t }),
        setPen: (p) => set({ pen: { ...get().pen, ...p } }),
        undo: () => {
          const { past, elements, future } = get();
          if (!past.length) return;
          set({ elements: past[past.length - 1], past: past.slice(0, -1), future: [elements, ...future], selectedId: null, savedAt: Date.now() });
        },
        redo: () => {
          const { past, elements, future } = get();
          if (!future.length) return;
          set({ elements: future[0], future: future.slice(1), past: [...past, elements], selectedId: null, savedAt: Date.now() });
        },
        clear: () => {
          commit([]);
          set({ selectedId: null, bgColor: '#fff6fb' });
        },
      };
    },
    {
      name: 'jomon-pix-work',
      storage: safeStorage,
      partialize: (s) => ({ elements: s.elements, bgColor: s.bgColor, savedAt: s.savedAt }),
    },
  ),
);
