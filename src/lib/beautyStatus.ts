import { create } from 'zustand';

export type BeautyRunState = 'idle' | 'processing' | 'ready' | 'no-face' | 'error';
export type BeautyResult = {
  state: BeautyRunState;
  message: string;
};

type BeautyStatusStore = {
  byImage: Record<string, BeautyResult>;
  // Transient preview comparison; never persisted to the project.
  comparingId: string | null;
  setComparing: (id: string, comparing: boolean) => void;
  setResult: (id: string, result: BeautyResult) => void;
};

export const useBeautyStatus = create<BeautyStatusStore>((set) => ({
  byImage: {},
  comparingId: null,
  setComparing: (id, comparing) => set((state) => {
    const next = comparing ? id : state.comparingId === id ? null : state.comparingId;
    return state.comparingId === next ? state : { comparingId: next };
  }),
  setResult: (id, result) => set((state) => {
    const old = state.byImage[id];
    if (old && old.state === result.state && old.message === result.message) return state;
    return {
      byImage: { ...state.byImage, [id]: result },
    };
  }),
}));
