// 背景削除のライブラリは重いので、ボタンを押した時にだけ読み込む
export async function removeBg(src: string): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');
  const blob = await removeBackground(src);
  return URL.createObjectURL(blob);
}
