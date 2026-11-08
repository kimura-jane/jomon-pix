
import { create } from 'zustand';
import {
  persist,
  createJSONStorage,
} from 'zustand/middleware';
import type {
  CanvasEl,
  Patch,
  PenStyle,
  Tab,
  Tool,
} from './types';

export const newId = () =>
  typeof crypto !== 'undefined' &&
  'randomUUID' in crypto
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
  square: {
    width: 800,
    height: 800,
  },
  '4:5': {
    width: 800,
    height: 1000,
  },
  '9:16': {
    width: 900,
    height: 1600,
  },
};

type Pen = {
  style: PenStyle;
  color: string;
  width: number;
};

type Dir =
  | 'front'
  | 'back'
  | 'up'
  | 'down';

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

  setBg: (color: string) => void;
  setCanvasPreset: (
    preset: CanvasPreset,
  ) => boolean;
  cropCanvas: (
    rect: CanvasCrop,
  ) => boolean;

  setTab: (tab: Tab) => void;
  setTool: (tool: Tool) => void;
  setPen: (patch: Partial<Pen>) => void;

  // スライダーの連続操作を
  // 1回の編集履歴にまとめる
  beginHistoryGroup: (id: string) => void;
  endHistoryGroup: () => void;

  undo: () => void;
  redo: () => void;
  clear: () => void;
};

// 編集履歴用のスナップショット
function snapshot(state: Snapshot): Snapshot {
  return {
    elements: state.elements,
    bgColor: state.bgColor,
    canvasPreset: state.canvasPreset,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
  };
}

// 自動保存
const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) =>
    localStorage.getItem(key),

  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn('自動保存の容量オーバー');
    }
  },

  removeItem: (key: string) =>
    localStorage.removeItem(key),
}));

type HistoryGroup = {
  id: string;
  before: Snapshot;
  changed: boolean;
};

export const useEditor = create<S>()(
  persist(
    (set, get) => {
      // 現在進行中の連続操作
      // 永続保存には含めない
      let historyGroup: HistoryGroup | null =
        null;

      // 連続操作を終了して履歴を確定
      const finishHistoryGroup = () => {
        const group = historyGroup;

        historyGroup = null;

        if (!group || !group.changed) {
          return;
        }

        set((state) => ({
          past: [
            ...state.past,
            group.before,
          ].slice(-50),
          future: [],
          savedAt: Date.now(),
        }));
      };

      // 通常の変更では履歴を1件追加
      // 連続操作中の同一要素では追加しない
      const commit = (
        changes: Partial<Snapshot>,
        groupId?: string,
      ) => {
        const grouped =
          !!groupId &&
          historyGroup?.id === groupId;

        if (!grouped) {
          finishHistoryGroup();
        }

        set((state) => {
          if (grouped) {
            if (historyGroup) {
              historyGroup.changed = true;
            }

            return {
              ...changes,
              future: [],
              savedAt: Date.now(),
            };
          }

          return {
            ...changes,
            past: [
              ...state.past,
              snapshot(state),
            ].slice(-50),
            future: [],
            savedAt: Date.now(),
          };
        });
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

        // 連続操作を開始
        beginHistoryGroup: (id) => {
          if (historyGroup?.id === id) {
            return;
          }

          finishHistoryGroup();

          const state = get();

          if (
            !state.elements.some(
              (el) => el.id === id,
            )
          ) {
            return;
          }

          historyGroup = {
            id,
            before: snapshot(state),
            changed: false,
          };
        },

        // 連続操作を終了
        endHistoryGroup: () => {
          finishHistoryGroup();
        },

        // 要素の追加
        add: (el) => {
          commit({
            elements: [
              ...get().elements,
              el,
            ],
          });

          if (el.type !== 'line') {
            set({
              selectedId: el.id,
            });
          }
        },

        // 要素の変更
        update: (id, patch) => {
          const current = get().elements;

          if (
            !current.some(
              (el) => el.id === id,
            )
          ) {
            return;
          }

          commit(
            {
              elements: current.map((el) =>
                el.id === id
                  ? ({
                      ...el,
                      ...patch,
                    } as CanvasEl)
                  : el,
              ),
            },
            id,
          );
        },

        // 要素の削除
        remove: (id) => {
          const current = get();

          if (
            !current.elements.some(
              (el) => el.id === id,
            )
          ) {
            return;
          }

          commit({
            elements: current.elements.filter(
              (el) => el.id !== id,
            ),
          });

          if (current.selectedId === id) {
            set({
              selectedId: null,
            });
          }
        },

        // 要素の複製
        duplicate: (id) => {
          const el = get().elements.find(
            (item) => item.id === id,
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
            elements: [
              ...get().elements,
              copy,
            ],
          });

          set({
            selectedId: copy.id,
          });
        },

        // レイヤーの前後移動
        move: (id, dir) => {
          const arr = [
            ...get().elements,
          ];

          const index = arr.findIndex(
            (el) => el.id === id,
          );

          if (index < 0) return;

          const [el] = arr.splice(
            index,
            1,
          );

          if (dir === 'front') {
            arr.push(el);
          } else if (dir === 'back') {
            arr.unshift(el);
          } else if (dir === 'up') {
            arr.splice(
              Math.min(
                index + 1,
                arr.length,
              ),
              0,
              el,
            );
          } else {
            arr.splice(
              Math.max(index - 1, 0),
              0,
              el,
            );
          }

          commit({
            elements: arr,
          });
        },

        // 要素の選択
        select: (id) => {
          finishHistoryGroup();

          set({
            selectedId: id,
          });
        },

        // 背景色
        setBg: (color) => {
          if (get().bgColor === color) {
            return;
          }

          commit({
            bgColor: color,
          });
        },

        // キャンバスサイズ変更
        setCanvasPreset: (preset) => {
          if (preset === 'custom') {
            return false;
          }

          let width: number;
          let height: number;

          if (preset === 'photo') {
            const state = get();

            const selected =
              state.elements.find(
                (el) =>
                  el.id === state.selectedId &&
                  el.type === 'image',
              );

            const photo =
              selected ??
              state.elements.find(
                (el) => el.type === 'image',
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
              width *
                photo.height /
                photo.width,
            );

            height = Math.max(
              200,
              Math.min(3200, height),
            );
          } else {
            width =
              CANVAS_SIZES[preset].width;

            height =
              CANVAS_SIZES[preset].height;
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

        // キャンバス全体の切り抜き
        cropCanvas: (rect) => {
          const state = get();

          const values = [
            rect.x,
            rect.y,
            rect.width,
            rect.height,
          ];

          if (
            !values.every(
              Number.isFinite,
            )
          ) {
            return false;
          }

          const x = Math.round(rect.x);
          const y = Math.round(rect.y);
          const width = Math.round(
            rect.width,
          );
          const height = Math.round(
            rect.height,
          );

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

          if (
            x === 0 &&
            y === 0 &&
            width === state.canvasWidth &&
            height === state.canvasHeight
          ) {
            return true;
          }

          // トリミング範囲に合わせて位置調整
          const elements =
            state.elements.map((el) => ({
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

          set({
            selectedId: null,
          });

          return true;
        },

        // タブ切り替え
        setTab: (tab) => {
          finishHistoryGroup();

          set({
            tab,
            tool:
              tab === 'pen'
                ? get().tool === 'eraser'
                  ? 'eraser'
                  : 'pen'
                : 'select',
          });
        },

        // ペン・消しゴム切り替え
        setTool: (tool) => {
          finishHistoryGroup();
          set({ tool });
        },

        // ペン設定
        setPen: (patch) => {
          set({
            pen: {
              ...get().pen,
              ...patch,
            },
          });
        },

        // 戻す
        undo: () => {
          finishHistoryGroup();

          const state = get();

          if (!state.past.length) {
            return;
          }

          const previous =
            state.past[
              state.past.length - 1
            ];

          set({
            ...previous,
            past: state.past.slice(
              0,
              -1,
            ),
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
          finishHistoryGroup();

          const state = get();

          if (!state.future.length) {
            return;
          }

          const next = state.future[0];

          set({
            ...next,
            past: [
              ...state.past,
              snapshot(state),
            ].slice(-50),
            future:
              state.future.slice(1),
            selectedId: null,
            savedAt: Date.now(),
          });
        },

        // 新しい作品
        clear: () => {
          commit({
            elements: [],
            bgColor: '#fff6fb',
            canvasPreset: 'square',
            canvasWidth: 800,
            canvasHeight: 800,
          });

          set({
            selectedId: null,
          });
        },
      };
    },
    {
      name: 'jomon-pix-work',
      storage: safeStorage,

      // 編集履歴は永続保存しない
      partialize: (state) => ({
        elements: state.elements,
        bgColor: state.bgColor,
        canvasPreset: state.canvasPreset,
        canvasWidth: state.canvasWidth,
        canvasHeight: state.canvasHeight,
        savedAt: state.savedAt,
      }),
    },
  ),
);
