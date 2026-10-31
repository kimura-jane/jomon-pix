import type Konva from 'konva';
import type { LineEl, PenStyle } from '../types';

export const PENS: { style: PenStyle; label: string; group: 'まじめ' | 'かわいい' }[] = [
  { style: 'pen', label: 'ボールペン', group: 'まじめ' },
  { style: 'marker', label: 'マーカー', group: 'まじめ' },
  { style: 'dashed', label: '点線', group: 'まじめ' },
  { style: 'neon', label: 'ネオン', group: 'かわいい' },
  { style: 'dotted', label: 'てんてん', group: 'かわいい' },
  { style: 'rainbow', label: 'レインボー', group: 'かわいい' },
  { style: 'sparkle', label: 'キラキラ', group: 'かわいい' },
];

const RAINBOW = [0, '#ff5e7e', 0.2, '#ffb84d', 0.4, '#ffe94d', 0.6, '#5be37d', 0.8, '#4dc3ff', 1, '#b47bff'];

type P = Pick<LineEl, 'points' | 'color' | 'width' | 'penStyle'>;

export function penProps(el: P): Konva.LineConfig {
  const common: Konva.LineConfig = {
    points: el.points, stroke: el.color, strokeWidth: el.width,
    lineCap: 'round', lineJoin: 'round', tension: 0.4,
  };
  switch (el.penStyle) {
    case 'marker':
      return { ...common, strokeWidth: el.width * 3, opacity: 0.45, lineCap: 'square' };
    case 'dashed':
      return { ...common, dash: [el.width * 3, el.width * 2] };
    case 'neon':
      return { ...common, stroke: '#ffffff', shadowColor: el.color, shadowBlur: 18, shadowOpacity: 1 };
    case 'dotted':
      return { ...common, dash: [0.1, el.width * 2.2] };
    case 'rainbow': {
      const xs = el.points.filter((_, i) => i % 2 === 0);
      const ys = el.points.filter((_, i) => i % 2 === 1);
      return {
        ...common,
        stroke: undefined,
        strokeLinearGradientStartPoint: { x: Math.min(...xs), y: Math.min(...ys) },
        strokeLinearGradientEndPoint: { x: Math.max(...xs) + 1, y: Math.max(...ys) + 1 },
        strokeLinearGradientColorStops: RAINBOW,
      };
    }
    case 'sparkle':
      return { ...common, dash: [0.1, el.width * 2.5], strokeWidth: el.width * 1.4, shadowColor: '#fff6a8', shadowBlur: 12, shadowOpacity: 1 };
    default:
      return common;
  }
}
