import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppReviewPlugin {
  request(): Promise<{ requested: boolean }>;
}

const AppReview = registerPlugin<AppReviewPlugin>('AppReview');
const KEY = 'jomon-pix-review-v1';
const MIN_SAVES = 3;
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
let inFlight = false;

/** Called only after a completed iOS Save Image activity; never blocks export. */
export async function recordSuccessfulPhotoSave(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios' || inFlight) return;
  inFlight = true;
  try {
    const raw = localStorage.getItem(KEY);
    const state = raw ? JSON.parse(raw) : { saves: 0, lastRequestedAt: 0 };
    if (!Number.isSafeInteger(state.saves) || state.saves < 0 ||
        !Number.isSafeInteger(state.lastRequestedAt) || state.lastRequestedAt < 0) return;
    const now = Date.now();
    state.saves = Math.min(MIN_SAVES, state.saves + 1);
    localStorage.setItem(KEY, JSON.stringify(state));
    if (state.saves < MIN_SAVES ||
        (state.lastRequestedAt !== 0 && now - state.lastRequestedAt < COOLDOWN_MS)) return;

    // Persist the cooldown before invoking native code so a storage failure
    // cannot cause repeated prompts. Restore it if no request was issued.
    const previous = state.lastRequestedAt;
    state.lastRequestedAt = now;
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      const result = await AppReview.request();
      if (result.requested) {
        state.saves = 0;
      } else {
        state.lastRequestedAt = previous;
      }
    } catch {
      state.lastRequestedAt = previous;
    }
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Review bookkeeping is optional and must never interrupt photo editing.
  } finally {
    inFlight = false;
  }
}
