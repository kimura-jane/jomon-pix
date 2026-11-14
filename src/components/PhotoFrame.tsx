import {
  Circle,
  Group,
  Line,
  Rect,
  Text,
} from 'react-konva';
import type { ImageFrame } from '../types';

type Props = {
  width: number;
  height: number;
  frame?: ImageFrame;
};

function bars(
  w: number,
  h: number,
  top: number,
  bottom: number,
  left: number,
  right: number,
  color: string,
) {
  return (
    <>
      <Rect x={0} y={0} width={w} height={top} fill={color} />
      <Rect x={0} y={h - bottom} width={w} height={bottom} fill={color} />
      <Rect x={0} y={top} width={left} height={Math.max(0, h - top - bottom)} fill={color} />
      <Rect x={w - right} y={top} width={right} height={Math.max(0, h - top - bottom)} fill={color} />
    </>
  );
}

/**
 * 写真の内部に描く非破壊フレーム。画像のGroupの中に置くため、
 * 写真と一緒に移動・回転・拡大され、PNG出力にもそのまま含まれる。
 * 画像データと描画線は加工・書き換えない。
 */
export function PhotoFrame({ width: w, height: h, frame }: Props) {
  if (!frame || frame.style === 'none' || !(w > 0 && h > 0)) return null;

  const short = Math.min(w, h);
  const ratio = Math.max(2, Math.min(18, frame.size));
  const t = Math.max(3, short * ratio / 100);
  const color = frame.color || '#ffffff';
  const x = t / 2;
  const y = t / 2;
  const innerW = Math.max(0, w - t);
  const innerH = Math.max(0, h - t);
  const filmHoles = Math.max(2, Math.min(64, Math.floor(w / (t * 1.9))));

  return (
    <Group listening={false}>
      {frame.style === 'simple' && (
        <>
          <Rect x={x} y={y} width={innerW} height={innerH}
            stroke={color} strokeWidth={t} />
          <Rect x={t} y={t} width={Math.max(0, w - 2 * t)}
            height={Math.max(0, h - 2 * t)}
            stroke="#ffffff" opacity={0.55} strokeWidth={Math.max(1, t * 0.07)} />
        </>
      )}

      {frame.style === 'double' && (
        <>
          <Rect x={x} y={y} width={innerW} height={innerH}
            stroke={color} strokeWidth={t} />
          <Rect x={t * 1.65} y={t * 1.65}
            width={Math.max(0, w - t * 3.3)}
            height={Math.max(0, h - t * 3.3)}
            stroke={color} strokeWidth={Math.max(2, t * 0.3)} />
          <Rect x={t * 0.25} y={t * 0.25}
            width={Math.max(0, w - t * 0.5)}
            height={Math.max(0, h - t * 0.5)}
            stroke="#27202b" opacity={0.25} strokeWidth={Math.max(1, t * 0.09)} />
        </>
      )}

      {frame.style === 'polaroid' && (
        <>
          {bars(w, h, t * 1.25, t * 3.4, t, t, '#fffdf8')}
          <Rect x={t} y={t * 1.25} width={Math.max(0, w - 2 * t)}
            height={Math.max(0, h - t * 4.65)}
            stroke="#e8e0d5" strokeWidth={Math.max(1, t * 0.10)} />
          <Text x={t * 2} y={h - t * 2.25}
            width={Math.max(0, w - 4 * t)}
            text="JOMON pix" fontFamily="sans-serif"
            fontSize={Math.max(10, t * 0.85)} fill="#777070" align="center" />
        </>
      )}

      {frame.style === 'film' && (
        <>
          {bars(w, h, t * 1.75, t * 1.75, t * 0.55, t * 0.55, '#17151a')}
          {Array.from({ length: filmHoles }, (_, index) => {
            const holeW = Math.max(3, t * 0.9);
            const holeH = Math.max(2, t * 0.58);
            const holeX = (index + 0.5) * w / filmHoles - holeW / 2;
            return (
              <Group key={index}>
                <Rect x={holeX} y={t * 0.33} width={holeW} height={holeH}
                  cornerRadius={Math.max(1, t * 0.13)} fill="#fff8eb" />
                <Rect x={holeX} y={h - t * 0.91} width={holeW} height={holeH}
                  cornerRadius={Math.max(1, t * 0.13)} fill="#fff8eb" />
              </Group>
            );
          })}
        </>
      )}

      {frame.style === 'album' && (
        <>
          <Rect x={x} y={y} width={innerW} height={innerH}
            stroke="#f9eee0" strokeWidth={t} />
          {[
            { px: t, py: t, sx: 1, sy: 1 },
            { px: w - t, py: t, sx: -1, sy: 1 },
            { px: t, py: h - t, sx: 1, sy: -1 },
            { px: w - t, py: h - t, sx: -1, sy: -1 },
          ].map((p, index) => (
            <Line key={index}
              points={[
                p.px, p.py,
                p.px + p.sx * t * 2.25, p.py,
                p.px, p.py + p.sy * t * 2.25,
              ]}
              closed fill={color}
              stroke="#b4a08c" strokeWidth={Math.max(1, t * 0.07)} />
          ))}
          <Rect x={t * 1.25} y={t * 1.25}
            width={Math.max(0, w - t * 2.5)}
            height={Math.max(0, h - t * 2.5)}
            stroke={color} opacity={0.75} strokeWidth={Math.max(1, t * 0.18)} />
        </>
      )}

      {frame.style === 'neon' && (
        <>
          <Rect x={x} y={y} width={innerW} height={innerH}
            stroke={color} strokeWidth={Math.max(3, t * 0.36)}
            shadowColor={color} shadowBlur={t * 1.2}
            shadowOpacity={0.95} />
          <Rect x={t * 1.25} y={t * 1.25}
            width={Math.max(0, w - t * 2.5)}
            height={Math.max(0, h - t * 2.5)}
            stroke="#ffffff" opacity={0.65} strokeWidth={Math.max(1, t * 0.12)} />
          {[
            [t, t],
            [w - t, t],
            [t, h - t],
            [w - t, h - t],
          ].map(([cx, cy], i) => (
            <Circle key={i} x={cx} y={cy} radius={Math.max(2, t * 0.12)}
              fill="#ffffff" shadowColor={color} shadowBlur={t * 0.7} />
          ))}
        </>
      )}

      {frame.style === 'magazine' && (
        <>
          <Rect x={x} y={y} width={innerW} height={innerH}
            stroke={color} strokeWidth={Math.max(3, t * 0.5)} />
          <Rect x={t * 0.35} y={t * 0.35}
            width={Math.max(0, w - t * 0.7)} height={Math.max(0, t * 2.2)}
            fill="#18181e" opacity={0.72} />
          <Text x={t} y={t * 0.5} width={Math.max(0, w - t * 2)}
            text="JOMON PIX" fill={color}
            fontStyle="bold" fontFamily="sans-serif"
            fontSize={Math.max(12, short * 0.085)}
            align="center" />
          <Rect x={t * 0.4} y={h - t * 1.75}
            width={Math.max(0, w - t * 0.8)}
            height={t * 1.4} fill="#18181e" opacity={0.72} />
          <Text x={t} y={h - t * 1.55} width={Math.max(0, w - t * 2)}
            text="PHOTO EDITION" fill="#ffffff"
            fontFamily="sans-serif" fontSize={Math.max(9, t * 0.75)}
            align="right" />
        </>
      )}
    </Group>
  );
}
