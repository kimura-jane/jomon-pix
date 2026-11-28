import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function isNativeIOS(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

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

/** Write and verify each local file before exposing it to another app. */
async function writeLocalFile(file: Blob, path: string, directory: Directory): Promise<string> {
  if (file.size === 0) throw new Error('空のファイルは保存できません。');
  let uri: string | null = null;
  try {
    for (let offset = 0; offset < file.size; offset += NATIVE_CHUNK_BYTES) {
      const chunk = file.slice(offset, Math.min(file.size, offset + NATIVE_CHUNK_BYTES));
      const data = await toBase64(chunk);
      if (offset === 0) {
        const saved = await Filesystem.writeFile({
          path, directory, data, recursive: true,
        });
        uri = saved.uri;
      } else {
        await Filesystem.appendFile({ path, directory, data });
      }
    }
    if (!uri) throw new Error('ファイルを作成できませんでした。');
    const stat = await Filesystem.stat({ path, directory });
    if (stat.size !== file.size) {
      throw new Error('保存したファイルのサイズが一致しません。');
    }
    return uri;
  } catch (error) {
    // A failed first write can also leave a partial file.
    try { await Filesystem.deleteFile({ path, directory }); }
    catch { /* preserve original error */ }
    throw error;
  }
}

/** Save an editable backup directly to Files > On My iPhone > JOMON PIX.
 * The Documents directory is exposed by the existing iOS Info.plist settings.
 * Never depend on the share sheet to create a persistent backup.
 */
export async function saveNativeProjectBackup(file: Blob): Promise<string> {
  if (!isNativeIOS()) throw new Error('iOS専用の保存機能です。');
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('作品ファイルが大きすぎます（上限100MB）。');
  }
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  const filename = 'jomon-pix-work-' + id + '.json';
  const path = 'backups/' + filename;
  const temp = path + '.partial';
  try {
    await writeLocalFile(file, temp, Directory.Documents);
    await Filesystem.rename({ from: temp, to: path, directory: Directory.Documents });
    return filename;
  } catch (error) {
    try { await Filesystem.deleteFile({ path: temp, directory: Directory.Documents }); }
    catch { /* preserve original error */ }
    throw error;
  }
}

/** Share a freshly generated file via the native system share sheet. */
export async function shareNativeFile(file: Blob, filename: string): Promise<string | undefined> {
  if (!isNativeApp()) throw new Error('アプリ内でのみ利用できます。');
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 110);
  const path = `shares/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanName}`;
  const uri = await writeLocalFile(file, path, Directory.Cache);
  try {
    const result = await Share.share({
      title: 'JOMON PIX',
      files: [uri],
      dialogTitle: '画像・作品を保存',
    });
    return result.activityType;
  } catch (error) {
    try { await Filesystem.deleteFile({ path, directory: Directory.Cache }); }
    catch { /* preserve original error */ }
    throw error;
  }
}
