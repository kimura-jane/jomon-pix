
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CanvasEl,
  Patch,
  PenStyle,
  Tab,
  Tool,
} from './types';

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) +
      Date.now().toString(36);

export type CanvasPreset =
  | 'square'
  | '4:5'
  | '9:16'
  | 'photo'
  | 'custom';

export type CanvasCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CANVAS_SIZES = {
  square: { width: 800, height: 800 },
  '4:5': { width: 800, height: 1000 },
  '9:16': { width: 900, height: 1600 },
};

type Pen = {
  style: PenStyle;
  color: string;
  width: number;
};

type Dir = 'front' | 'back' | 'up' | 'down';

type Snapshot = {
  elements: CanvasEl[];
  bgColor: string;
  canvasPreset: CanvasPreset;
  canvasWidth: number;
  canvasHeight: number;
};

type S = Snapshot & {
  selectedId: string | null;
  tab: Tab;
  tool: Tool;
  pen: Pen;
  past: Snapshot[];
  future: Snapshot[];
  savedAt: number;

  add: (el: CanvasEl) => void;
  update: (id: string, patch: Patch) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  move: (id: string, dir: Dir) => void;
  select: (id: string | null) => void;

  setBg: (c: string) => void;
  setCanvasPreset: (preset: CanvasPreset) => boolean;
  cropCanvas: (rect: CanvasCrop) => boolean;

  setTab: (t: Tab) => void;
  setTool: (t: Tool) => void;
  setPen: (p: Partial<Pen>) => void;

  undo: () => void;
  redo: () => void;
  clear: () => void;
};

// 編集履歴には要素とキャンバスの情報をまとめて記録する
function snapshot(s: Snapshot): Snapshot {
  return {
    elements: s.elements,
    bgColor: s.bgColor,
    canvasPreset: s.canvasPreset,
    canvasWidth: s.canvasWidth,
    canvasHeight: s.canvasHeight,
  };
}

// iPhoneで保存容量を超えてもアプリを止めない
const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) =>
    localStorage.getItem(k),

  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      console.warn('自動保存の容量オーバー');
    }
  },

  removeItem: (k: string) =>
    localStorage.removeItem(k),
}));

export const useEditor = create<S>()(
  persist(
    (set, get) => {
      // 変更前の作品を50回分まで記録
      const commit = (changes: Partial<Snapshot>) => {
        set((s) => ({
          ...changes,
          past: [
            ...s.past,
            snapshot(s),
          ].slice(-50),
          future: [],
          savedAt: Date.now(),
        }));
      };

      return {
        elements: [],
        selectedId: null,
        bgColor: '#fff6fb',

        canvasPreset: 'square',
        canvasWidth: 800,
        canvasHeight: 800,

        tab: 'image',
        tool: 'select',

        pen: {
          style: 'pen',
          color: '#ff4fa3',
          width: 6,
        },

        past: [],
        future: [],
        savedAt: 0,

        add: (el) => {
          commit({
            elements: [...get().elements, el],
          });

          if (el.type !== 'line') {
            set({ selectedId: el.id });
          }
        },

        update: (id, patch) => {
          const current = get().elements;

          if (!current.some((e) => e.id === id)) {
            return;
          }

          commit({
            elements: current.map((e) =>
              e.id === id
                ? ({ ...e, ...patch } as CanvasEl)
                : e,
            ),
          });
        },

        remove: (id) => {
          const current = get();

          if (!current.elements.some((e) => e.id === id)) {
            return;
          }

          commit({
            elements: current.elements.filter(
              (e) => e.id !== id,
            ),
          });

          if (current.selectedId === id) {
            set({ selectedId: null });
          }
        },

        duplicate: (id) => {
          const el = get().elements.find(
            (e) => e.id === id,
          );

          if (!el) return;

          const copy = {
            ...el,
            id: newId(),
            x: el.x + 30,
            y: el.y + 30,
            locked: false,
          } as CanvasEl;

          commit({
            elements: [...get().elements, copy],
          });

          set({ selectedId: copy.id });
        },

        move: (id, dir) => {
          const arr = [...get().elements];
          const i = arr.findIndex(
            (e) => e.id === id,
          );

          if (i < 0) return;

          const [el] = arr.splice(i, 1);

          if (dir === 'front') {
            arr.push(el);
          } else if (dir === 'back') {
            arr.unshift(el);
          } else if (dir === 'up') {
            arr.splice(
              Math.min(i + 1, arr.length),
              0,
              el,
            );
          } else {
            arr.splice(
              Math.max(i - 1, 0),
              0,
              el,
            );
          }

          commit({ elements: arr });
        },

        select: (id) =>
          set({ selectedId: id }),

        setBg: (c) => {
          if (get().bgColor === c) return;
          commit({ bgColor: c });
        },

        // 正方形、4:5、9:16、写真の比率
        setCanvasPreset: (preset) => {
          if (preset === 'custom') {
            return false;
          }

          let width: number;
          let height: number;

          if (preset === 'photo') {
            const state = get();

            const selected = state.elements.find(
              (e) =>
                e.id === state.selectedId &&
                e.type === 'image',
            );

            const photo =
              selected ??
              state.elements.find(
                (e) => e.type === 'image',
              );

            if (
              !photo ||
              photo.type !== 'image' ||
              photo.width <= 0 ||
              photo.height <= 0
            ) {
              return false;
            }

            width = 800;

            height = Math.round(
              width * photo.height / photo.width,
            );

            height = Math.max(
              200,
              Math.min(3200, height),
            );
          } else {
            width = CANVAS_SIZES[preset].width;
            height = CANVAS_SIZES[preset].height;
          }

          const state = get();

          if (
            state.canvasPreset === preset &&
            state.canvasWidth === width &&
            state.canvasHeight === height
          ) {
            return true;
          }

          commit({
            canvasPreset: preset,
            canvasWidth: width,
            canvasHeight: height,
          });

          return true;
        },

        // キャンバス全体を指定範囲で切り抜く
        cropCanvas: (rect) => {
          const state = get();

          const values = [
            rect.x,
            rect.y,
            rect.width,
            rect.height,
          ];

          if (!values.every(Number.isFinite)) {
            return false;
          }

          const x = Math.round(rect.x);
          const y = Math.round(rect.y);
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);

          // 範囲が正しくない場合は変更しない
          if (
            x < 0 ||
            y < 0 ||
            width < 32 ||
            height < 32 ||
            x + width > state.canvasWidth ||
            y + height > state.canvasHeight
          ) {
            return false;
          }

          // 範囲が変わらなければ何もしない
          if (
            x === 0 &&
            y === 0 &&
            width === state.canvasWidth &&
            height === state.canvasHeight
          ) {
            return true;
          }

          // すべての要素を同じ距離だけ移動
          // 回転や拡大率、重なり順は変更しない
          const elements = state.elements.map((el) => ({
            ...el,
            x: el.x - x,
            y: el.y - y,
          })) as CanvasEl[];

          commit({
            elements,
            canvasPreset: 'custom',
            canvasWidth: width,
            canvasHeight: height,
          });

          set({ selectedId: null });

          return true;
        },

        setTab: (t) =>
          set({
            tab: t,
            tool:
              t === 'pen'
                ? get().tool === 'eraser'
                  ? 'eraser'
                  : 'pen'
                : 'select',
          }),

        setTool: (t) =>
          set({ tool: t }),

        setPen: (p) =>
          set({
            pen: {
              ...get().pen,
              ...p,
            },
          }),

        // 要素・背景・キャンバスサイズをまとめて戻す
        undo: () => {
          const state = get();

          if (!state.past.length) return;

          const previous =
            state.past[state.past.length - 1];

          set({
            ...previous,
            past: state.past.slice(0, -1),
            future: [
              snapshot(state),
              ...state.future,
            ].slice(0, 50),
            selectedId: null,
            savedAt: Date.now(),
          });
        },

        // やり直す
        redo: () => {
          const state = get();

          if (!state.future.length) return;

          const next = state.future[0];

          set({
            ...next,
            past: [
              ...state.past,
              snapshot(state),
            ].slice(-50),
            future: state.future.slice(1),
            selectedId: null,
            savedAt: Date.now(),
          });
        },

        // 新しい作品を作る
        clear: () => {
          commit({
            elements: [],
            bgColor: '#fff6fb',
            canvasPreset: 'square',
            canvasWidth: 800,
            canvasHeight: 800,
          });

          set({ selectedId: null });
        },
      };
    },
    {
      name: 'jomon-pix-work',
      storage: safeStorage,

      partialize: (s) => ({
        elements: s.elements,
        bgColor: s.bgColor,
        canvasPreset: s.canvasPreset,
        canvasWidth: s.canvasWidth,
        canvasHeight: s.canvasHeight,
        savedAt: s.savedAt,
      }),
    },
  ),
);
