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

const NATIVE_CHUNK_BYTES = 1024 * 1024;

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
  if (file.size === 0) throw new Error('空のファイルは保存できません。');
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 110);
  // Separate share requests must not overwrite files referenced by an open
  // iOS share sheet. Keep each JS-to-native bridge transfer below 1.4 MB.
  const path = `shares/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanName}`;
  let uri: string | null = null;
  try {
    for (let offset = 0; offset < file.size; offset += NATIVE_CHUNK_BYTES) {
      const chunk = file.slice(offset, Math.min(file.size, offset + NATIVE_CHUNK_BYTES));
      const data = await toBase64(chunk);
      if (offset === 0) {
        const saved = await Filesystem.writeFile({
          path, directory: Directory.Cache, data, recursive: true,
        });
        uri = saved.uri;
      } else {
        // Binary chunks are individually base64-decoded by the native plugin.
        await Filesystem.appendFile({ path, directory: Directory.Cache, data });
      }
    }
    if (!uri) throw new Error('共有ファイルを作成できませんでした。');
    const stat = await Filesystem.stat({ path, directory: Directory.Cache });
    if (stat.size !== file.size) {
      throw new Error('保存したファイルのサイズが一致しません。');
    }
    await Share.share({
      title: 'JOMON pix',
      files: [uri],
      dialogTitle: '画像・作品を保存',
    });
  } catch (error) {
    if (uri) {
      // Partial files must never be offered to the user after a failed write.
      try { await Filesystem.deleteFile({ path, directory: Directory.Cache }); }
      catch { /* Do not hide the original failure. */ }
    }
    throw error;
  }
}
