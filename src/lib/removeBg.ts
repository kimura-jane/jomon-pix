import { Capacitor } from '@capacitor/core';

// Run AI on the device. iOS builds bundle model + WASM at build time.
// Web keeps the existing IMG.LY CDN path until separately audited for PWA use.
export async function removeBg(src: string): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');
  const config = Capacitor.isNativePlatform()
    ? {
        publicPath: new URL(
          `${import.meta.env.BASE_URL}offline-background/`,
          document.baseURI,
        ).href,
        model: 'isnet_fp16' as const,
      }
    : undefined;
  let blob: Blob;
  try {
    blob = await removeBackground(src, config);
  } catch (error) {
    if (Capacitor.isNativePlatform()) {
      // Keep detailed errors on-device, never upload logs or photos.
      console.error('[JOMON PIX] Native offline background AI failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      const code = /resource|fetch|size|404|network/i.test(message)
        ? 'BG-DATA'
        : /wasm|session|memory|allocate|abort/i.test(message)
          ? 'BG-RUNTIME'
          : 'BG-OTHER';
      throw new Error(
        `端末内AIの背景削除に失敗しました（${code}）。元の写真は変更していません。`,
      );
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Web版の背景削除にはAIモデルの取得が必要です。通信に接続して再試行してください。');
    }
    throw error;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(blob);
  });
}
