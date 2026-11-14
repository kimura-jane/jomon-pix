import { create } from 'zustand';

export type BeautyRunState = 'idle' | 'processing' | 'ready' | 'no-face' | 'error';
export type BeautyResult = {
  state: BeautyRunState;
  message: string;
};

type BeautyStatusStore = {
  byImage: Record<string, BeautyResult>;
  setResult: (id: string, result: BeautyResult) => void;
};

export const useBeautyStatus = create<BeautyStatusStore>((set) => ({
  byImage: {},
  setResult: (id, result) => set((state) => {
    const old = state.byImage[id];
    if (old && old.state === result.state && old.message === result.message) return state;
    return {
      byImage: { ...state.byImage, [id]: result },
    };
  }),
}));
