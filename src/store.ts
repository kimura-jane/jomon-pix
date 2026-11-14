
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CanvasEl, Patch, PenStyle, Tab, Tool } from './types';
import { isPhotoAttachment, toCanvasWorld, toPhotoLocal } from './lib/photoAttachments';
import type { SceneId, SocialId } from './lib/scenePresets';

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export type CanvasPreset = 'square' | '4:5' | '9:16' | 'photo' | 'custom';

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
  opacity: number;
};

type Dir = 'front' | 'back' | 'up' | 'down';

type Snapshot = {
  elements: CanvasEl[];
  bgColor: string;
  sceneBackground: SceneId;
  socialTemplate: SocialId;
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
  addMany: (items: CanvasEl[]) => void;
  update: (id: string, patch: Patch) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  attachToImage: (id: string, photoId: string) => boolean;
  detachFromImage: (id: string) => boolean;
  move: (id: string, dir: Dir) => void;
  select: (id: string | null) => void;

  setBg: (color: string) => void;
  setSceneBackground: (scene: SceneId) => void;
  setSocialTemplate: (template: SocialId) => void;
  setCanvasPreset: (preset: CanvasPreset) => boolean;
  cropCanvas: (rect: CanvasCrop) => boolean;

  setTab: (tab: Tab) => void;
  setTool: (tool: Tool) => void;
  setPen: (patch: Partial<Pen>) => void;

  beginHistoryGroup: (id: string) => void;
  endHistoryGroup: () => void;

  undo: () => void;
  redo: () => void;
  clear: () => void;
};

// 自動保存の結果は作品とは別に管理する。
// このストア自体は永続化しないため、保存失敗時も再帰的に保存しない。
export type AutosaveStatus = 'idle' | 'saved' | 'failed';

type AutosaveState = {
  status: AutosaveStatus;
  lastSavedAt: number;
  errorMessage: string | null;
};

export const useAutosaveStatus = create<AutosaveState>(() => ({
  status: 'idle',
  lastSavedAt: 0,
  errorMessage: null,
}));

function markSaved() {
  useAutosaveStatus.setState({
    status: 'saved',
    lastSavedAt: Date.now(),
    errorMessage: null,
  });
}

function markSaveFailed(error: unknown, reading: boolean) {
  const name = error instanceof Error ? error.name : '';
  const isQuota =
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED';

  const message = reading
    ? '保存済みの作品を読み込めませんでした。既存データを保護するため、自動保存を停止しています。'
    : isQuota
      ? '保存容量が不足しています。変更内容を自動保存できませんでした。'
      : '自動保存に失敗しました。変更内容がブラウザに保存されていない可能性があります。';

  const previous = useAutosaveStatus.getState();
  if (previous.status !== 'failed' || previous.errorMessage !== message) {
    useAutosaveStatus.setState({
      status: 'failed',
      errorMessage: message,
    });
    console.warn('[JOMON pix] ' + message, error);
  }
}

// 保存データを正常に読み込めないセッションでは上書きを禁止する。
// 破損・読み取りエラー時に既存の作品を上書きしないための保護策。
let storageReadFailed = false;

const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      storageReadFailed = true;
      markSaveFailed(error, true);
      return null;
    }
  },

  setItem: (key: string, value: string) => {
    if (storageReadFailed) return;

    try {
      localStorage.setItem(key, value);
      markSaved();
    } catch (error) {
      markSaveFailed(error, false);
    }
  },

  removeItem: (key: string) => {
    if (storageReadFailed) return;

    try {
      localStorage.removeItem(key);
      useAutosaveStatus.setState({
        status: 'idle',
        lastSavedAt: 0,
        errorMessage: null,
      });
    } catch (error) {
      markSaveFailed(error, false);
    }
  },
}));

function snapshot(state: Snapshot): Snapshot {
  return {
    elements: state.elements,
    bgColor: state.bgColor,
    sceneBackground: state.sceneBackground,
    socialTemplate: state.socialTemplate,
    canvasPreset: state.canvasPreset,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
  };
}

type HistoryGroup = {
  id: string;
  before: Snapshot;
  changed: boolean;
};

export const useEditor = create<S>()(
  persist(
    (set, get) => {
      let historyGroup: HistoryGroup | null = null;

      const finishHistoryGroup = () => {
        const group = historyGroup;
        historyGroup = null;
        if (!group || !group.changed) return;

        set((state) => ({
          past: [...state.past, group.before].slice(-50),
          future: [],
          savedAt: Date.now(),
        }));
      };

      const commit = (changes: Partial<Snapshot>, groupId?: string) => {
        const grouped = !!groupId && historyGroup?.id === groupId;
        if (!grouped) finishHistoryGroup();

        set((state) => {
          if (grouped) {
            if (historyGroup) historyGroup.changed = true;
            return {
              ...changes,
              future: [],
              savedAt: Date.now(),
            };
          }

          return {
            ...changes,
            past: [...state.past, snapshot(state)].slice(-50),
            future: [],
            savedAt: Date.now(),
          };
        });
      };

      return {
        elements: [],
        selectedId: null,
        bgColor: '#fff6fb',
        sceneBackground: 'none',
        socialTemplate: 'none',
        canvasPreset: 'square',
        canvasWidth: 800,
        canvasHeight: 800,
        tab: 'image',
        tool: 'select',
        pen: {
          style: 'pen',
          color: '#ff4fa3',
          width: 6,
          opacity: 1,
        },
        past: [],
        future: [],
        savedAt: 0,

        beginHistoryGroup: (id) => {
          if (historyGroup?.id === id) return;
          finishHistoryGroup();

          const state = get();
          if (!state.elements.some((el) => el.id === id)) return;

          historyGroup = {
            id,
            before: snapshot(state),
            changed: false,
          };
        },

        endHistoryGroup: () => {
          finishHistoryGroup();
        },

        add: (el) => {
          commit({ elements: [...get().elements, el] });
          if (el.type !== 'line') set({ selectedId: el.id });
        },

        // One face-deco operation may add several stickers (or several faces).
        // Keep it as ONE undo step and never replace existing photo elements.
        addMany: (items) => {
          if (!items.length) return;
          commit({ elements: [...get().elements, ...items] });
          const last = items[items.length - 1];
          if (last.type !== 'line') set({ selectedId: last.id });
        },

        update: (id, patch) => {
          const current = get().elements;
          const original = current.find((el) => el.id === id);
          if (!original) return;

          // 写真を切り抜いた場合、子の座標も1回のUndoで移動する。
          // 通常の移動・拡大・回転は親Groupの変形に任せる。
          const isCrop = original.type === 'image' &&
            typeof patch.x === 'number' &&
            typeof patch.y === 'number' &&
            typeof patch.width === 'number' &&
            typeof patch.height === 'number' &&
            (patch.width !== original.width || patch.height !== original.height);

          let childOffsetX = 0;
          let childOffsetY = 0;
          if (isCrop && original.type === 'image') {
            const dx = (patch.x as number) - original.x;
            const dy = (patch.y as number) - original.y;
            const rad = original.rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            childOffsetX = (cos * dx + sin * dy) /
              (Math.abs(original.scaleX) > 0.0001 ? original.scaleX : 1);
            childOffsetY = (-sin * dx + cos * dy) /
              (Math.abs(original.scaleY) > 0.0001 ? original.scaleY : 1);
          }

          commit(
            {
              elements: current.map((el) => {
                if (el.id === id) return { ...el, ...patch } as CanvasEl;
                if (isCrop && isPhotoAttachment(el) && el.parentImageId === id) {
                  return { ...el, x: el.x - childOffsetX, y: el.y - childOffsetY };
                }
                return el;
              }),
            },
            id,
          );
        },

        remove: (id) => {
          const current = get();
          const target = current.elements.find((el) => el.id === id);
          if (!target) return;

          // 写真を消す場合、紐づく文字・スタンプも同時に消す。
          // Undoではすべて一括で復元する。
          const removed = new Set([id]);
          if (target.type === 'image') {
            current.elements.forEach((el) => {
              if (isPhotoAttachment(el) && el.parentImageId === id) {
                removed.add(el.id);
              }
            });
          }
          commit({
            elements: current.elements.filter((el) => !removed.has(el.id)),
          });
          if (current.selectedId && removed.has(current.selectedId)) {
            set({ selectedId: null });
          }
        },

        duplicate: (id) => {
          const elements = get().elements;
          const el = elements.find((item) => item.id === id);
          if (!el) return;

          const copy = {
            ...el,
            id: newId(),
            x: el.x + 30,
            y: el.y + 30,
            locked: false,
          } as CanvasEl;

          const children = el.type === 'image'
            ? elements
                .filter((item) =>
                  isPhotoAttachment(item) && item.parentImageId === el.id,
                )
                .map((item) => ({
                  ...item,
                  id: newId(),
                  parentImageId: copy.id,
                  locked: false,
                }) as CanvasEl)
            : [];

          commit({ elements: [...elements, copy, ...children] });
          set({ selectedId: copy.id });
        },

        attachToImage: (id, photoId) => {
          const elements = get().elements;
          const child = elements.find((el) => el.id === id);
          const photo = elements.find((el) => el.id === photoId);
          if (!child || !isPhotoAttachment(child) ||
              !photo || photo.type !== 'image' || photo.hidden || photo.locked ||
              child.locked || child.parentImageId === photo.id) {
            return false;
          }

          // 既に別の写真に属する場合、一度世界座標へ戻す。
          const old = elements.find((el) => el.id === child.parentImageId);
          const globalChild = old?.type === 'image'
            ? toCanvasWorld(child, old)
            : { ...child, parentImageId: undefined };
          const attached = toPhotoLocal(globalChild, photo);

          commit({
            elements: elements.map((el) => el.id === id ? attached : el),
          });
          return true;
        },

        detachFromImage: (id) => {
          const elements = get().elements;
          const child = elements.find((el) => el.id === id);
          if (!child || !isPhotoAttachment(child) ||
              !child.parentImageId || child.locked) {
            return false;
          }

          const photo = elements.find((el) => el.id === child.parentImageId);
          const detached = photo?.type === 'image'
            ? toCanvasWorld(child, photo)
            : { ...child, parentImageId: undefined };

          commit({
            elements: elements.map((el) => el.id === id ? detached : el),
          });
          return true;
        },

        move: (id, dir) => {
          const arr = [...get().elements];
          const index = arr.findIndex((el) => el.id === id);
          if (index < 0) return;

          const [el] = arr.splice(index, 1);
          if (dir === 'front') {
            arr.push(el);
          } else if (dir === 'back') {
            arr.unshift(el);
          } else if (dir === 'up') {
            arr.splice(Math.min(index + 1, arr.length), 0, el);
          } else {
            arr.splice(Math.max(index - 1, 0), 0, el);
          }

          commit({ elements: arr });
        },

        select: (id) => {
          finishHistoryGroup();
          set({ selectedId: id });
        },

        setBg: (color) => {
          if (get().bgColor === color) return;
          commit({ bgColor: color });
        },

        setSceneBackground: (scene) => {
          if (get().sceneBackground === scene) return;
          commit({ sceneBackground: scene });
        },

        setSocialTemplate: (template) => {
          if (get().socialTemplate === template) return;
          commit({ socialTemplate: template });
        },

        setCanvasPreset: (preset) => {
          if (preset === 'custom') return false;

          let width: number;
          let height: number;

          if (preset === 'photo') {
            const state = get();
            const selected = state.elements.find(
              (el) => el.id === state.selectedId && el.type === 'image',
            );
            const photo =
              selected ?? state.elements.find((el) => el.type === 'image');

            if (
              !photo ||
              photo.type !== 'image' ||
              photo.width <= 0 ||
              photo.height <= 0
            ) {
              return false;
            }

            width = 800;
            height = Math.round(width * photo.height / photo.width);
            height = Math.max(200, Math.min(3200, height));
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

        cropCanvas: (rect) => {
          const state = get();
          const values = [rect.x, rect.y, rect.width, rect.height];
          if (!values.every(Number.isFinite)) return false;

          const x = Math.round(rect.x);
          const y = Math.round(rect.y);
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);

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

          const elements = state.elements.map((el) =>
            isPhotoAttachment(el) && el.parentImageId
              ? el
              : ({ ...el, x: el.x - x, y: el.y - y } as CanvasEl),
          );

          commit({
            elements,
            canvasPreset: 'custom',
            canvasWidth: width,
            canvasHeight: height,
          });
          set({ selectedId: null });
          return true;
        },

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

        setTool: (tool) => {
          finishHistoryGroup();
          set({ tool });
        },

        setPen: (patch) => {
          set({ pen: { ...get().pen, ...patch } });
        },

        undo: () => {
          finishHistoryGroup();
          const state = get();
          if (!state.past.length) return;

          const previous = state.past[state.past.length - 1];
          set({
            ...previous,
            past: state.past.slice(0, -1),
            future: [snapshot(state), ...state.future].slice(0, 50),
            selectedId: null,
            savedAt: Date.now(),
          });
        },

        redo: () => {
          finishHistoryGroup();
          const state = get();
          if (!state.future.length) return;

          const next = state.future[0];
          set({
            ...next,
            past: [...state.past, snapshot(state)].slice(-50),
            future: state.future.slice(1),
            selectedId: null,
            savedAt: Date.now(),
          });
        },

        clear: () => {
          commit({
            elements: [],
            bgColor: '#fff6fb',
            sceneBackground: 'none',
            socialTemplate: 'none',
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
      partialize: (state) => ({
        elements: state.elements,
        bgColor: state.bgColor,
        sceneBackground: state.sceneBackground,
        socialTemplate: state.socialTemplate,
        canvasPreset: state.canvasPreset,
        canvasWidth: state.canvasWidth,
        canvasHeight: state.canvasHeight,
        savedAt: state.savedAt,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          storageReadFailed = true;
          markSaveFailed(error, true);
        }
      },
    },
  ),
);
