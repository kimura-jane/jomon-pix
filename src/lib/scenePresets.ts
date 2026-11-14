// Canvas-scoped original illustration backgrounds and presentation mockups.
// No logos or official platform UI are copied.
export type SceneId =
  | 'none' | 'fuji' | 'sakura' | 'coast' | 'shrine' | 'skyline' | 'dreamy';

export type SocialId =
  | 'none' | 'live' | 'game' | 'video' | 'shorts' | 'social' | 'story';

export const SCENE_PRESETS: { id: SceneId; label: string; detail: string }[] = [
  { id: 'none', label: 'なし', detail: '背景を解除' },
  { id: 'fuji', label: '富士山', detail: '桜と湖の旅景色' },
  { id: 'sakura', label: '桜の名所', detail: '春のフォトスポット' },
  { id: 'coast', label: '海辺', detail: '南国ビーチ' },
  { id: 'shrine', label: '神社', detail: '森と鳥居の参道' },
  { id: 'skyline', label: '夜景', detail: '都会の夜景' },
  { id: 'dreamy', label: 'ゆめかわ', detail: 'プリクラ風ハート' },
];

export const SOCIAL_PRESETS: { id: SocialId; label: string; detail: string }[] = [
  { id: 'none', label: 'なし', detail: '演出を解除' },
  { id: 'live', label: 'ライブ配信風', detail: 'LIVE・コメント・視聴者' },
  { id: 'game', label: 'ゲーム配信風', detail: 'ゲーム画面・チャット' },
  { id: 'video', label: '動画サイト風', detail: '動画サムネ・再生バー' },
  { id: 'shorts', label: '縦動画風', detail: 'いいね・コメント・BGM' },
  { id: 'social', label: 'SNS投稿風', detail: 'プロフィール・キャプション' },
  { id: 'story', label: 'ストーリー風', detail: 'タイムバー・返信欄' },
];

export const SCENE_IDS: SceneId[] = SCENE_PRESETS.map((item) => item.id);
export const SOCIAL_IDS: SocialId[] = SOCIAL_PRESETS.map((item) => item.id);

export function sceneSrc(id: SceneId): string | undefined {
  return id === 'none'
    ? undefined
    : `${import.meta.env.BASE_URL}backgrounds/v1/${id}.svg`;
}
