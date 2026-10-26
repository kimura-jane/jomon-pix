import { removeBackground } from '@imgly/background-removal';

export async function removeBg(src: string): Promise<string> {
  const blob = await removeBackground(src);
  return URL.createObjectURL(blob);
}
