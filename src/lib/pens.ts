import type { LineConfig } from 'konva/lib/shapes/Line';
import type { LineEl, PenStyle } from '../types';

export const PENS: { key: PenStyle; label: string; group: 'まじめ' | 'かわいい' }[] = [
  { key: 'pen', label: 'ボールペン', group: 'まじめ' },
  { key: 'marker', label: 'マーカー', group: 'まじめ' },
  { key: 'dashed', label: '点線', group: 'まじめ' },
  { key: 'neon', label: 'ネオン', group: 'かわいい' },
  { key: 'dotted', label: 'てんてん', group: 'かわいい' },
  { key: 'rainbow', label: 'レインボー', group: 'かわいい' },
  { key: 'sparkle', label: 'キラキラ', group: 'かわいい' },
];

const RAINBOW = [0, '#ff5f6d', 0.2, '#ffc371', 0.4, '#fff35c', 0.6, '#5cff8d', 0.8, '#5cc8ff', 1, '#b05cff'];

export function penProps(el: LineEl): LineConfig {
  const w = el.width;
  const base: LineConfig = {
    points: el.points,
    stroke: el.color,
    strokeWidth: w,
    lineCap: 'round',
    lineJoin: 'round',
    tension: 0.4,
    hitStrokeWidth: Math.max(20, w * 3),
    opacity: el.opacity,
  };

  switch (el.penStyle) {
    case 'marker':
      return { ...base, strokeWidth: w * 3, opacity: el.opacity * 0.45, lineCap: 'butt', tension: 0.2 };
    case 'dashed':
      return { ...base, dash: [w * 3, w * 2], lineCap: 'butt' };
    case 'neon':
      return { ...base, shadowColor: el.color, shadowBlur: w * 4, shadowOpacity: 1 };
    case 'dotted':
      return { ...base, strokeWidth: w * 1.6, dash: [0.001, w * 3] };
    case 'rainbow': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < el.points.length; i += 2) {
        minX = Math.min(minX, el.points[i]);
        maxX = Math.max(maxX, el.points[i]);
        minY = Math.min(minY, el.points[i + 1]);
        maxY = Math.max(maxY, el.points[i + 1]);
      }
      return {
        ...base,
        stroke: undefined,
        strokeWidth: w * 1.5,
        strokeLinearGradientStartPoint: { x: minX, y: minY },
        strokeLinearGradientEndPoint: { x: maxX + 1, y: maxY + 1 },
        strokeLinearGradientColorStops: RAINBOW,
      };
    }
    case 'sparkle':
      return {
        ...base,
        strokeWidth: w * 1.6,
        dash: [0.001, w * 2.5],
        shadowColor: '#fff6a8',
        shadowBlur: 14,
        shadowOpacity: 1,
      };
    default:
      return base;
  }
}
