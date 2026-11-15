// 背景削除は重いので、ボタンを押した時だけ読み込む
// 自動保存できるように dataURL で返す
export async function removeBg(src: string): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');
  let blob: Blob;
  try {
    blob = await removeBackground(src);
  } catch (error) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('背景削除にはAIモデルの取得が必要です。通信に接続して再試行してください。');
    }
    throw error;
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
