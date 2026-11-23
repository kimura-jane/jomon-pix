import { Capacitor, registerPlugin } from '@capacitor/core';

export type IconChoice = 'default' | '1' | '2' | '3' | '4' | '5' | '6';

interface IconSwitcherPlugin {
  getIcon(): Promise<{ icon: IconChoice }>;
  setIcon(options: { icon: IconChoice }): Promise<{ icon: IconChoice }>;
}

const IconSwitcher = registerPlugin<IconSwitcherPlugin>('IconSwitcher');
const ICONS: ReadonlySet<string> = new Set(['default', '1', '2', '3', '4', '5', '6']);

export const iconChoices: { id: IconChoice; labelJa: string; labelEn: string }[] = [
  { id: 'default', labelJa: 'オリジナル', labelEn: 'Original' },
  { id: '1', labelJa: 'シルバー', labelEn: 'Silver' },
  { id: '2', labelJa: 'ゴールド', labelEn: 'Gold' },
  { id: '3', labelJa: 'ネオン', labelEn: 'Neon' },
  { id: '4', labelJa: 'デザイン 4', labelEn: 'Design 4' },
  { id: '5', labelJa: 'デザイン 5', labelEn: 'Design 5' },
];

export function canChangeAppIcon(): boolean {
  return Capacitor.isNativePlatform() &&
    (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android');
}

export function iconPreviewUrl(icon: IconChoice): string {
  if (icon === 'default') return `${import.meta.env.BASE_URL}icon-choices/default.png`;
  return `${import.meta.env.BASE_URL}icon-choices/${icon}.png`;
}

export async function getCurrentIcon(): Promise<IconChoice> {
  if (!canChangeAppIcon()) return 'default';
  const result = await IconSwitcher.getIcon();
  if (!ICONS.has(result.icon)) throw new Error('Unknown installed app icon');
  return result.icon;
}

export async function switchAppIcon(icon: IconChoice): Promise<IconChoice> {
  if (!canChangeAppIcon()) throw new Error('アイコン変更はiOS・Androidアプリのみ対応しています。');
  if (!ICONS.has(icon)) throw new Error('Invalid icon selection');
  const result = await IconSwitcher.setIcon({ icon });
  if (!ICONS.has(result.icon)) throw new Error('App icon could not be verified');
  return result.icon;
}
