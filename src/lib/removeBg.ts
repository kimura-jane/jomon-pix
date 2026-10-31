// 背景削除は重いので、ボタンを押した時だけ読み込む
// 自動保存できるように dataURL で返す
export async function removeBg(src: string): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');
  const blob = await removeBackground(src);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
