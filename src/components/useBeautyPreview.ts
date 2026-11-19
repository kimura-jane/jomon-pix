import { useEffect, useState } from 'react';
import type { BeautySettings, MakeupStyleId } from '../types';
import { DEFAULT_BEAUTY } from '../lib/beautyProcessor';
import { beautySignature, renderBeauty } from '../lib/beautyProcessor';
import { useBeautyStatus } from '../lib/beautyStatus';

type Preview = {
  source: string;
  signature: string;
  image: HTMLCanvasElement | HTMLImageElement;
};

export function useBeautyPreview(
  id: string,
  source: string,
  original: HTMLImageElement | undefined,
  settings?: BeautySettings,
  faceOverrides?: Record<string, Partial<BeautySettings>>,
  makeupStyle?: MakeupStyleId,
  makeupFaceStyles?: Record<string, MakeupStyleId | 'none'>,
): {
  image: HTMLImageElement | HTMLCanvasElement | undefined;
  signature: string;
} {
  const signature = beautySignature(settings, faceOverrides, makeupStyle, makeupFaceStyles);
  const [ready, setReady] = useState<Preview | null>(null);
  const setResult = useBeautyStatus((state) => state.setResult);
  const comparing = useBeautyStatus((state) => state.comparingId === id);

  useEffect(() => {
    if (signature === 'none') {
      setReady(null);
      setResult(id, { state: 'idle', message: '' });
      return;
    }
    if (!original) {
      setReady(null);
      setResult(id, { state: 'processing', message: '写真を読み込み中…' });
      return;
    }
    let cancelled = false;
    const needsLeg = (settings?.legSlim ?? 0) > 0 || (settings?.legLength ?? 0) > 0;
    setResult(id, { state: 'processing', message: needsLeg ? '写真を解析して加工中…' : '顔を解析して加工中…' });
    // Slider motions are batched and obsolete renders are discarded.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const output = await renderBeauty(original, settings ?? DEFAULT_BEAUTY, faceOverrides, makeupStyle, makeupFaceStyles);
          if (cancelled) return;
          if (!output) {
            setReady({ source, signature, image: original });
            setResult(id, {
              state: 'no-face',
              message: needsLeg ? '加工可能な顔・脚を検出できませんでした。元の写真を表示しています。'
                : '顔を検出できませんでした。加工せず元の写真を表示しています。',
            });
            return;
          }
          setReady({ source, signature, image: output.canvas });
          const needSlim = (settings?.legSlim ?? 0) > 0;
          const needLength = (settings?.legLength ?? 0) > 0;
          let message: string;
          if (output.legUnavailable) {
            message = '脚の解析に失敗しました。脚の補正は適用していません。';
          } else if (needSlim && output.legCount === 0) {
            message = '脚を検出できませんでした。脚の補正は適用していません。';
          } else if (needSlim && !output.slimApplied) {
            message = '脚の細さは、両脚を認識できる写真で調整できます。';
          } else if (needLength && !output.lengthApplied) {
            message = '脚長は、全身が写った1人の写真で調整できます。';
          } else {
            message = needsLeg
              ? 'ビューティーの加工を表示しています。'
              : `顔の加工を表示しています。（${output.faceCount}人の顔を検出）`;
          }
          setResult(id, {
            state: output.hasEffects ? 'ready' : 'no-face',
            message,
          });
        } catch (error) {
          if (cancelled) return;
          console.error('[JOMON PIX] Beauty processing failed:', error);
          setReady({ source, signature, image: original });
          setResult(id, {
            state: 'error',
            message: needsLeg ? '人物の解析を利用できません。加工せず元の写真を表示しています。'
              : '顔認識を利用できません。加工せず元の写真を表示しています。',
          });
        }
      })();
    }, 170);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id, source, original, signature, setResult]);

  if (signature === 'none') return { image: original, signature: 'none' };
  // Press-and-hold comparison shows the original immediately without
  // modifying settings or cancelling the processed image already in memory.
  // Mark the preview as pending so saving cannot export an unedited comparison.
  if (comparing) return { image: original, signature: 'pending' };
  if (ready?.source === source && ready.signature === signature) {
    return { image: ready.image, signature };
  }
  // Preserve the original until all face effects have been computed;
  // the PNG export gate rejects this 'pending' marker.
  return { image: original, signature: 'pending' };
}
