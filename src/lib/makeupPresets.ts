import type { BeautySettings, MakeupStyleId } from '../types';

// These are on-device Beauty adjustments, not generated make-up images.
// No cloud call, new model, or change to the original photo is required.
export const MAKEUP_FIELDS = [
  'smooth', 'bright', 'warmth', 'slim',
  'chin', 'eyes', 'lip', 'blush',
] as const satisfies readonly (keyof BeautySettings)[];

export type MakeupPresetValues = Pick<BeautySettings, typeof MAKEUP_FIELDS[number]>;

export type MakeupPreset = {
  id: MakeupStyleId;
  label: string;
  tint: string;
  values: MakeupPresetValues;
};

export const MAKEUP_PRESETS: readonly MakeupPreset[] = [
  {
    id: 'natural', label: 'ナチュラル', tint: '#d6998f',
    values: { smooth: 18, bright: 12, warmth: 10, slim: 6,
      chin: 4, eyes: 8, lip: 10, blush: 8 },
  },
  {
    id: 'idol', label: 'アイドル風', tint: '#f17faf',
    values: { smooth: 28, bright: 18, warmth: 16, slim: 10,
      chin: 8, eyes: 18, lip: 18, blush: 20 },
  },
  {
    id: 'gyaru', label: 'ギャル風', tint: '#b87447',
    values: { smooth: 24, bright: 12, warmth: 18, slim: 20,
      chin: 16, eyes: 22, lip: 22, blush: 18 },
  },
  {
    id: 'pien', label: 'ぴえん系', tint: '#d67da3',
    values: { smooth: 26, bright: 16, warmth: 22, slim: 8,
      chin: 6, eyes: 20, lip: 16, blush: 24 },
  },
  {
    id: 'korean', label: '韓国風', tint: '#b995ba',
    values: { smooth: 30, bright: 20, warmth: 8, slim: 12,
      chin: 10, eyes: 12, lip: 16, blush: 10 },
  },
  {
    id: 'y2k', label: 'Y2K', tint: '#9f74cc',
    values: { smooth: 20, bright: 14, warmth: 20, slim: 10,
      chin: 8, eyes: 16, lip: 20, blush: 22 },
  },
];

// The active chip follows actual slider values; manually adjusting a field
// immediately deselects the preset instead of showing a stale "selected".
export function matchingMakeupPreset(
  settings: Pick<BeautySettings, typeof MAKEUP_FIELDS[number]>,
): MakeupPreset['id'] | null {
  return MAKEUP_PRESETS.find((preset) =>
    MAKEUP_FIELDS.every((field) => settings[field] === preset.values[field]))?.id ?? null;
}

// "All faces" must really include faces previously customized individually.
// Remove only the face-specific Beauty overrides; leg controls remain intact.
// Returning undefined clears redundant stale override keys with one Undo step.
export function clearFaceMakeupOverrides(
  overrides: Record<string, Partial<BeautySettings>> | undefined,
): Record<string, Partial<BeautySettings>> | undefined {
  if (!overrides) return undefined;
  const rest: Record<string, Partial<BeautySettings>> = {};
  for (const [face, oldPatch] of Object.entries(overrides)) {
    const patch: Partial<BeautySettings> = { ...oldPatch };
    for (const field of MAKEUP_FIELDS) delete patch[field];
    if (Object.keys(patch).length) rest[face] = patch;
  }
  return Object.keys(rest).length ? rest : undefined;
}
