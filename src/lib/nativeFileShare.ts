import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルを読み込めませんでした。'));
    reader.onload = () => {
      const data = reader.result;
      if (typeof data !== 'string' || !data.includes(',')) {
        reject(new Error('ファイルの変換に失敗しました。'));
        return;
      }
      resolve(data.slice(data.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Share a freshly generated PNG or editable JSON backup via the native iOS
 * share sheet. This exposes "Save Image" and "Save to Files" actions.
 * Capacitor's WKWebView does not reliably support <a download> for blob URLs.
 * A temporary copy lives in the app cache; no cloud upload is performed.
 */
export async function shareNativeFile(
  file: Blob,
  filename: string,
): Promise<void> {
  if (!isNativeApp()) {
    throw new Error('アプリ内でのみ利用できます。');
  }
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 110);
  const data = await toBase64(file);
  const saved = await Filesystem.writeFile({
    path: `shares/${cleanName}`,
    directory: Directory.Cache,
    data,
    recursive: true,
  });
  await Share.share({
    title: 'JOMON pix',
    files: [saved.uri],
    dialogTitle: '画像・作品を保存',
  });
}
