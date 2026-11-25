
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import type { CanvasEl, Patch, PenStyle, Tab, Tool } from './types';
import { isPhotoAttachment, toCanvasWorld, toPhotoLocal } from './lib/photoAttachments';
import { isHairSticker } from './lib/hairStickers';
import type { SceneId, SocialId } from './lib/scenePresets';

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

// Keep 'photo' for previously saved projects and JSON backups, but it is
// no longer offered in the canvas-size picker.
export type CanvasPreset = 'square' | '4:5' | '9:16' | '16:9' | 'photo' | 'custom';

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
  '16:9': { width: 1600, height: 900 },
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
  setBeautyGlasses: (photoId: string, indices: number[], stickers: import('./types').StickerEl[]) => void;
  setHairSticker: (sticker: import('./types').StickerEl) => boolean;
  update: (id: string, patch: Patch) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  attachToImage: (id: string, photoId: string) => boolean;
  detachFromImage: (id: string) => boolean;
  move: (id: string, dir: Dir) => void;
  reorderLayer: (id: string, targetId: string) => void;
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

// Heavy photos are stored in IndexedDB, not localStorage's small (~5 MiB)
// quota. Keep existing JSON backups compatible and never delete a legacy
// localStorage save during migration.
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

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

function markSaving() {
  if (storageReadFailed) return;
  const current = useAutosaveStatus.getState();
  if (current.status !== 'saving') {
    useAutosaveStatus.setState({ status: 'saving', errorMessage: null });
  }
}

function markSaved() {
  if (storageReadFailed) return;
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
      ? '端末の保存容量またはアプリの保存上限に達しました。変更内容を自動保存できませんでした。'
      : '自動保存に失敗しました。変更内容が端末に保存されていない可能性があります。';

  const previous = useAutosaveStatus.getState();
  if (previous.status !== 'failed' || previous.errorMessage !== message) {
    useAutosaveStatus.setState({ status: 'failed', errorMessage: message });
    console.warn('[JOMON PIX] ' + message, error);
  }
}

// An unreadable existing project must never be replaced by an empty project.
let storageReadFailed = false;
const DB_NAME = 'jomon-pix-projects-v1';
const DB_STORE = 'work';
const SAVE_DELAY_MS = 180;

// IndexedDB is supported both by Safari and by Capacitor's WKWebView.
// Use a single database connection and resolve writes at transaction COMPLETE
// (not request success) to avoid reporting a save before it commits.
let databasePromise: Promise<IDBDatabase> | null = null;
function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable on this device'));
        return;
      }
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, 1);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab may upgrade/delete this database. The old connection
        // becomes unusable and must not be reused for later saves.
        db.onversionchange = () => {
          db.close();
          databasePromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB was blocked by another tab'));
    }).catch((error: unknown) => {
      // Never cache a rejected connection attempt; later saves can retry.
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function readFromDatabase(key: string): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(key);
    let result: unknown;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => {
      if (result === undefined) resolve(null);
      else if (typeof result === 'string') resolve(result);
      else reject(new Error('Saved project has an unexpected data type'));
    };
    tx.onerror = () => reject(tx.error ?? new Error('Cannot read saved project'));
    tx.onabort = () => reject(tx.error ?? new Error('Reading saved project aborted'));
  });
}

async function writeToDatabase(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Cannot save project'));
    tx.onabort = () => reject(tx.error ?? new Error('Saving project aborted'));
  });
}

type PersistedWork = Snapshot & { savedAt: number };
type StoredWork = StorageValue<PersistedWork>;
let pendingWork: { key: string; value: StoredWork; revision: number } | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let currentRevision = 0;
let lastPersistedWork: StoredWork['state'] | null = null;

function sameSavedWork(a: StoredWork['state'], b: StoredWork['state']): boolean {
  return a.elements === b.elements &&
    a.bgColor === b.bgColor &&
    a.sceneBackground === b.sceneBackground &&
    a.socialTemplate === b.socialTemplate &&
    a.canvasPreset === b.canvasPreset &&
    a.canvasWidth === b.canvasWidth &&
    a.canvasHeight === b.canvasHeight &&
    a.savedAt === b.savedAt;
}

function queueDatabaseWrite(): Promise<void> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const pending = pendingWork;
  if (!pending || storageReadFailed) return writeChain;
  pendingWork = null;
  // Serial writes prevent an older slider/drag update from overwriting a newer
  // edit when asynchronous IndexedDB transactions complete out of order.
  writeChain = writeChain.then(async () => {
    if (storageReadFailed) return;
    try {
      await writeToDatabase(pending.key, JSON.stringify(pending.value));
      lastPersistedWork = pending.value.state;
      if (!pendingWork && currentRevision === pending.revision) markSaved();
    } catch (error) {
      markSaveFailed(error, false);
    }
  });
  return writeChain;
}

function scheduleDatabaseWrite() {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void queueDatabaseWrite();
  }, SAVE_DELAY_MS);
}

// Wait for the ACTUAL IndexedDB transaction to finish, for example when
// importing an editable artwork file. A setState call alone is not a save.
export async function flushAutosave(): Promise<boolean> {
  if (storageReadFailed) return false;
  do {
    if (pendingWork) queueDatabaseWrite();
    await writeChain;
  } while (pendingWork && !storageReadFailed);
  return !storageReadFailed && useAutosaveStatus.getState().status === 'saved';
}

const workStorage: PersistStorage<PersistedWork> = {
  getItem: async (key) => {
    try {
      const current = await readFromDatabase(key);
      if (current !== null) {
        const parsed = JSON.parse(current) as StoredWork;
        if (!parsed || !parsed.state || !Array.isArray(parsed.state.elements)) {
          throw new Error('Saved IndexedDB project is invalid');
        }
        lastPersistedWork = parsed.state;
        markSaved();
        return parsed;
      }

      // Existing browser/iPhone installations used localStorage. Migrate the
      // FULL original value before displaying the editor; retain legacy data
      // untouched as a safety copy even after successful migration.
      const old = localStorage.getItem(key);
      if (old === null) return null;
      const parsed = JSON.parse(old) as StoredWork;
      if (!parsed || !parsed.state || !Array.isArray(parsed.state.elements)) {
        throw new Error('Legacy project data is invalid');
      }
      try {
        await writeToDatabase(key, old);
        lastPersistedWork = parsed.state;
        markSaved();
      } catch (error) {
        // Show the recoverable old project but NEVER allow it to be overwritten.
        storageReadFailed = true;
        markSaveFailed(error, false);
      }
      return parsed;
    } catch (error) {
      storageReadFailed = true;
      markSaveFailed(error, true);
      // When IndexedDB itself becomes unavailable, show a readable legacy
      // recovery copy if one exists. Never auto-save that older copy over a
      // possibly newer IndexedDB project.
      try {
        const recovery = localStorage.getItem(key);
        if (recovery) {
          const parsed = JSON.parse(recovery) as StoredWork;
          if (parsed?.state && Array.isArray(parsed.state.elements)) {
            useAutosaveStatus.setState({
              status: 'failed',
              errorMessage: '最新の作品を読み込めませんでした。以前のバックアップを表示中です。データ保護のため自動保存は停止しています。',
            });
            return parsed;
          }
        }
      } catch {
        // Original data stays untouched even if the recovery copy is corrupt.
      }
      return null;
    }
  },

  setItem: (key, value) => {
    if (storageReadFailed) return;
    if (lastPersistedWork && !pendingWork &&
        sameSavedWork(lastPersistedWork, value.state)) return;
    pendingWork = { key, value, revision: ++currentRevision };
    markSaving();
    scheduleDatabaseWrite();
  },

  removeItem: async (key) => {
    if (storageReadFailed) return;
    await writeChain;
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Cannot delete project'));
      tx.onabort = () => reject(tx.error ?? new Error('Project deletion aborted'));
    });
    // Deliberately do not delete the original localStorage safety copy.
    useAutosaveStatus.setState({ status: 'idle', lastSavedAt: 0, errorMessage: null });
  },
};

// Request final writes when the iPhone app moves into the background. This
// reduces loss of the very last drag without claiming guaranteed persistence.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flushAutosave(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushAutosave();
  });
}

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

// Bound the memory consumed by distinct embedded image data across undo/redo.
// Lightweight operations retain up to 50 steps, while repeated photo edits
// cannot keep 50 full-size data URLs alive in the iPhone WebView.
const HISTORY_LIMIT = 50;
const HISTORY_INLINE_DATA_LIMIT = 24 * 1024 * 1024;

function trimHistory(states: Snapshot[], future = false): Snapshot[] {
  const newestFirst = future ? states : [...states].reverse();
  const kept: Snapshot[] = [];
  const seen = new Set<string>();
  let inlineSize = 0;

  for (const state of newestFirst) {
    if (kept.length >= HISTORY_LIMIT) break;
    let extra = 0;
    const added: string[] = [];
    for (const element of state.elements) {
      if (element.type !== 'image' && element.type !== 'sticker') continue;
      // Include AI hair retouch buffers in the undo memory budget.
      const sources = [element.src, ...(element.type === 'sticker'
        ? [element.hairRetouch?.src] : [])];
      for (const src of sources) {
        if (!src?.startsWith('data:image/') || seen.has(src) || added.includes(src)) continue;
        added.push(src);
        extra += src.length;
      }
    }
    if (kept.length > 0 && inlineSize + extra > HISTORY_INLINE_DATA_LIMIT) break;
    for (const src of added) seen.add(src);
    inlineSize += extra;
    kept.push(state);
  }

  return future ? kept : kept.reverse();
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
          past: trimHistory([...state.past, group.before]),
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
            past: trimHistory([...state.past, snapshot(state)]),
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
        canvasPreset: '9:16',
        canvasWidth: 900,
        canvasHeight: 1600,
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

        // Add, replace or remove Beauty sunglasses for the selected faces
        // in a single Undo step. Only sunglasses created from Beauty are touched;
        // manually placed stickers and face decorations are never modified.
        setBeautyGlasses: (photoId, indices, stickers) => {
          const current = get().elements;
          const photo = current.find((el) =>
            el.id === photoId && el.type === 'image');
          if (!photo || photo.type !== 'image' || photo.hidden || photo.locked) return;
          const targets = new Set(indices.filter((index) =>
            Number.isInteger(index) && index >= 0 && index < 10));
          if (!targets.size) return;
          const matching = (el: CanvasEl) =>
            el.type === 'sticker' && el.parentImageId === photoId &&
            el.beautyGlassesFace !== undefined && targets.has(el.beautyGlassesFace);
          const kept = current.filter((el) => !matching(el));
          const additions = stickers.filter((el) => el.parentImageId === photoId &&
            el.beautyGlassesFace !== undefined && targets.has(el.beautyGlassesFace));
          if (kept.length === current.length && !additions.length) return;
          commit({ elements: [...kept, ...additions] });
          if (get().selectedId && current.some((el) => el.id === get().selectedId && matching(el))) {
            set({ selectedId: photoId });
          }
        },

        // Try-on must replace the hair of the SAME person, rather than piling
        // up image layers. One atomic history entry means one Undo restores
        // exactly the previous haircut. Other faces and photos stay untouched.
        setHairSticker: (sticker) => {
          if (!isHairSticker(sticker)) return false;
          const state = get();
          const current = state.elements;
          if (sticker.parentImageId) {
            const photo = current.find((item) =>
              item.type === 'image' && item.id === sticker.parentImageId);
            if (!photo || photo.hidden || photo.locked) return false;
          }

          const candidates = current.filter((item): item is import('./types').StickerEl =>
            item.type === 'sticker' &&
            isHairSticker(item) &&
            item.parentImageId === sticker.parentImageId,
          );
          let previous: import('./types').StickerEl | undefined;

          if (sticker.hairFaceIndex !== undefined) {
            previous = candidates.find((item) =>
              item.hairFaceIndex === sticker.hairFaceIndex);
            // Old 1.0.3 auto hair did not record face indexes. Identify
            // a nearby legacy hairstyle without affecting distant faces.
            if (!previous) {
              const nearby = candidates.filter((item) =>
                item.hairFaceIndex === undefined).map((item) => ({
                  item,
                  distance: Math.hypot(item.x - sticker.x, item.y - sticker.y),
                })).sort((a, b) => a.distance - b.distance)[0];
              if (nearby && nearby.distance < Math.max(12, sticker.size * 0.65)) {
                previous = nearby.item;
              }
            }
          } else {
            // In manual mode, tapping another style changes the selected hair.
            // Without explicit selection, reuse a manual hair on this photo
            // instead of creating a pile of trial hairstyles.
            previous = candidates.find((item) => item.id === state.selectedId)
              ?? [...candidates].reverse().find((item) => item.hairFaceIndex === undefined)
              ?? (candidates.length === 1 ? candidates[0] : undefined);
          }

          if (previous) {
            if (previous.locked || previous.hidden) return false;
            const nextBase = sticker.hairAutoPlacement;
            const oldBase = previous.hairAutoPlacement;
            const autoRetarget = nextBase !== undefined &&
              sticker.hairFaceIndex !== undefined;
            // Each haircut has a DIFFERENT painted silhouette and anchor.
            // Always recompute its face-based geometry when changing styles,
            // but keep any manual movement / size / rotation deltas.
            const edited = autoRetarget && oldBase &&
              previous.hairFaceIndex === sticker.hairFaceIndex;
            const x = autoRetarget
              ? sticker.x + (edited ? previous.x - oldBase.x : 0)
              : previous.x;
            const y = autoRetarget
              ? sticker.y + (edited ? previous.y - oldBase.y : 0)
              : previous.y;
            const size = autoRetarget
              ? sticker.size * (edited && oldBase.size > 0
                ? previous.size / oldBase.size : 1)
              : previous.size;
            const rotation = autoRetarget
              ? sticker.rotation + (edited ? previous.rotation - oldBase.rotation : 0)
              : previous.rotation;
            const replacing = {
              ...previous,
              src: sticker.src, label: sticker.label,
              x, y, size, rotation,
              hairFaceIndex: sticker.hairFaceIndex ?? previous.hairFaceIndex,
              hairAutoPlacement: autoRetarget ? nextBase : undefined,
              // Previous releases stored an AI forehead-repair patch.
              // Hair is now a normal movable sticker; never retain that patch.
              hairRetouch: undefined,
            };
            commit({ elements: current.map((item) =>
              item.id === previous.id ? replacing : item) });
            set({ selectedId: previous.id });
          } else {
            commit({ elements: [...current, sticker] });
            set({ selectedId: sticker.id });
          }
          return true;
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

        reorderLayer: (id, targetId) => {
          const arr = [...get().elements];
          const from = arr.findIndex((el) => el.id === id);
          const to = arr.findIndex((el) => el.id === targetId);
          if (from < 0 || to < 0 || from === to || arr[from].locked) return;
          // Attached decorations render within their photo; never silently detach them.
          const parent = (el: CanvasEl) => isPhotoAttachment(el) ? el.parentImageId : undefined;
          if (parent(arr[from]) !== parent(arr[to])) return;
          const [item] = arr.splice(from, 1);
          arr.splice(to, 0, item);
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
            future: trimHistory([snapshot(state), ...state.future], true),
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
            past: trimHistory([...state.past, snapshot(state)]),
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
            canvasPreset: '9:16',
            canvasWidth: 900,
            canvasHeight: 1600,
          });
          set({ selectedId: null });
        },
      };
    },
    {
      name: 'jomon-pix-work',
      storage: workStorage,
      // Old pre-canvas-preset projects saved elements/bgColor/savedAt only.
      // A missing canvas must be restored as the original 800x800 square;
      // the new 9:16 default applies ONLY when no saved project exists.
      // Keep the raw IndexedDB/localStorage records and future canvas presets
      // intact. Never rewrite legacy data until the user actually edits it.
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') return currentState;
        const saved = persistedState as Partial<PersistedWork>;
        if (!Array.isArray(saved.elements)) return currentState;
        const completeCanvas =
          saved.canvasPreset !== undefined &&
          typeof saved.canvasWidth === 'number' &&
          Number.isFinite(saved.canvasWidth) && saved.canvasWidth >= 32 &&
          typeof saved.canvasHeight === 'number' &&
          Number.isFinite(saved.canvasHeight) && saved.canvasHeight >= 32;
        const fallback: Pick<Snapshot, 'canvasPreset' | 'canvasWidth' | 'canvasHeight'> =
          completeCanvas
            ? {
                canvasPreset: saved.canvasPreset!,
                canvasWidth: saved.canvasWidth!,
                canvasHeight: saved.canvasHeight!,
              }
            : { canvasPreset: 'square', canvasWidth: 800, canvasHeight: 800 };
        return { ...currentState, ...saved, ...fallback };
      },
      // Hydrate asynchronously from IndexedDB BEFORE mounting any controls;
      // otherwise a fast tap could overwrite saved art with an empty canvas.
      skipHydration: true,
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
