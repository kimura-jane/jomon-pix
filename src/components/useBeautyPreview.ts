import { useEffect, useState } from 'react';
import type { BeautySettings } from '../types';
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
): {
  image: HTMLImageElement | HTMLCanvasElement | undefined;
  signature: string;
} {
  const signature = beautySignature(settings);
  const [ready, setReady] = useState<Preview | null>(null);
  const setResult = useBeautyStatus((state) => state.setResult);

  useEffect(() => {
    if (signature === 'none') {
      setReady(null);
      setResult(id, { state: 'idle', message: '' });
      return;
    }
    if (!original || !settings) {
      setReady(null);
      setResult(id, { state: 'processing', message: '写真を読み込み中…' });
      return;
    }
    let cancelled = false;
    setResult(id, { state: 'processing', message: '顔を解析して加工中…' });
    // Slider motions are batched and obsolete renders are discarded.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const output = await renderBeauty(original, settings);
          if (cancelled) return;
          if (!output) {
            setReady({ source, signature, image: original });
            setResult(id, {
              state: 'no-face',
              message: '顔を検出できませんでした。加工せず元の写真を表示しています。',
            });
            return;
          }
          setReady({ source, signature, image: output.canvas });
          setResult(id, {
            state: 'ready',
            message: `顔の加工を表示しています。（${output.faceCount}人の顔を検出）`,
          });
        } catch (error) {
          if (cancelled) return;
          console.error('[JOMON pix] Beauty processing failed:', error);
          setReady({ source, signature, image: original });
          setResult(id, {
            state: 'error',
            message: '顔認識を利用できません。加工せず元の写真を表示しています。',
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
  if (ready?.source === source && ready.signature === signature) {
    return { image: ready.image, signature };
  }
  // Preserve the original until all face effects have been computed;
  // the PNG export gate rejects this 'pending' marker.
  return { image: original, signature: 'pending' };
}
