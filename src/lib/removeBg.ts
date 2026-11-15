import { Capacitor } from '@capacitor/core';

// Run AI on the device. iOS builds bundle model + WASM at build time.
// Web keeps the existing IMG.LY CDN path until separately audited for PWA use.
export async function removeBg(src: string): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');
  const config = Capacitor.isNativePlatform()
    ? {
        publicPath: new URL(
          `${import.meta.env.BASE_URL}offline-background/`,
          window.location.origin,
        ).href,
        model: 'isnet_fp16' as const,
      }
    : undefined;
  let blob: Blob;
  try {
    blob = await removeBackground(src, config);
  } catch (error) {
    if (Capacitor.isNativePlatform()) {
      throw new Error('端末内のAI背景削除に失敗しました。空きメモリを確認して再試行してください。');
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
