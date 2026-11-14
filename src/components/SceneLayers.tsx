import { useMemo } from 'react';
import {
  Circle,
  Group,
  Image as KImage,
  Line,
  Rect,
  Text,
} from 'react-konva';
import useImage from 'use-image';
import { sceneSrc, type SceneId, type SocialId } from '../lib/scenePresets';

export function SceneBackdrop({
  scene, width, height,
}: {
  scene: SceneId;
  width: number;
  height: number;
}) {
  const src = sceneSrc(scene) ?? '';
  const [image] = useImage(src, 'anonymous');
  const layout = useMemo(() => {
    if (!image || image.naturalWidth < 1 || image.naturalHeight < 1) return null;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    return {
      x: (width - image.naturalWidth * scale) / 2,
      y: (height - image.naturalHeight * scale) / 2,
      width: image.naturalWidth * scale,
      height: image.naturalHeight * scale,
    };
  }, [image, width, height]);
  if (scene === 'none') return null;
  return (
    <Group listening={false} name="scene-background">
      {image && layout && (
        <KImage
          name="scene-art"
          image={image}
          {...layout}
        />
      )}
    </Group>
  );
}

type Layout = { w: number; h: number; s: number; m: number; small: number; normal: number };
function makeLayout(width: number, height: number): Layout {
  const s = Math.min(width, height);
  return {
    w: width, h: height, s,
    m: Math.max(15, s * 0.045),
    small: Math.max(11, s * 0.017),
    normal: Math.max(15, s * 0.025),
  };
}

function Pill({
  x, y, text, fill, width, fontSize, color = '#ffffff',
}: {
  x: number; y: number; text: string; fill: string;
  width: number; fontSize: number; color?: string;
}) {
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={width} height={fontSize * 2.05}
        cornerRadius={fontSize} fill={fill} />
      <Text x={x} y={y + fontSize * 0.44} width={width} text={text}
        align="center" fontSize={fontSize} fill={color}
        fontStyle="bold" fontFamily="Arial, sans-serif" />
    </Group>
  );
}

function Comment({
  x, y, name, message, width, scale,
}: {
  x: number; y: number; name: string; message: string; width: number; scale: number;
}) {
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={width} height={scale * 2.75}
        fill="#18172c" opacity={0.67} cornerRadius={scale * 1.2} />
      <Text x={x + scale * 0.65} y={y + scale * 0.31} width={width - scale}
        text={name} fill="#f7b8f0" fontSize={scale * 0.74}
        fontStyle="bold" />
      <Text x={x + scale * 0.65} y={y + scale * 1.27} width={width - scale}
        text={message} fill="#ffffff" fontSize={scale * 0.84} />
    </Group>
  );
}

function Heart({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  return (
    <Line
      x={x} y={y}
      points={[
        0, size * 0.35,
        -size * 0.57, -size * 0.19,
        -size * 0.97, size * 0.16,
        -size * 0.8, size * 0.63,
        0, size * 1.22,
        size * 0.8, size * 0.63,
        size * 0.97, size * 0.16,
        size * 0.57, -size * 0.19,
      ]}
      closed fill={fill} stroke="#ffffff" strokeWidth={Math.max(1, size * 0.09)}
      lineJoin="round" listening={false}
    />
  );
}

function RoundAction({
  x, y, label, mark, size,
}: { x: number; y: number; label: string; mark: string; size: number }) {
  return (
    <Group listening={false}>
      <Circle x={x} y={y} radius={size * 0.94}
        fill="#121320" opacity={0.48} />
      <Text x={x - size} y={y - size * 0.8}
        width={size * 2} text={mark} align="center"
        fontSize={size * 1.35} fill="#ffffff"
        fontStyle="bold" />
      <Text x={x - size * 1.45} y={y + size * 1.09}
        width={size * 2.9} align="center" text={label}
        fontSize={size * 0.73} fill="#ffffff" />
    </Group>
  );
}

/**
 * Imaginary creator/social UI. Canvas-only decoration:
 * top/bottom rails are kept clear of the photo center.
 * Brand names, platform logos, and actual user statistics are not reproduced.
 */
export function SocialOverlay({
  kind, width, height,
}: { kind: SocialId; width: number; height: number }) {
  if (kind === 'none') return null;

  const l = makeLayout(width, height);
  const { w, h, s, m, small, normal } = l;
  const bottom = Math.max(m, h - Math.max(150, s * 0.31));
  const round = Math.max(18, s * 0.04);

  return (
    <Group name="social-overlay" listening={false}>
      {kind === 'live' && (
        <>
          <Rect x={0} y={0} width={w} height={s * 0.18}
            fill="#101221" opacity={0.75} />
          <Circle x={m + round * 0.7} y={m + round * 0.85}
            radius={round * 0.68} fill="#eeb0e3" stroke="#ffffff"
            strokeWidth={3} />
          <Text x={m + round * 1.7} y={m + round * 0.24}
            text="JOMON LIVE" fontStyle="bold" fontSize={normal}
            fill="#ffffff" />
          <Text x={m + round * 1.7} y={m + round * 1.05}
            text="今日の配信" fontSize={small} fill="#eee3f4" />
          <Pill x={w - m - s * 0.21} y={m} width={s * 0.21}
            text="LIVE" fill="#ef386b" fontSize={normal * 0.78} />
          <Pill x={w - m - s * 0.21} y={m + normal * 2.4}
            width={s * 0.21} text="● 1.2K"
            fill="#373041" fontSize={small} />
          <Comment x={m} y={bottom - normal * 5.4} name="sakura"
            message="こんばんは！" scale={normal} width={s * 0.62} />
          <Comment x={m} y={bottom - normal * 2.0} name="panda"
            message="すごい！" scale={normal} width={s * 0.53} />
          <Rect x={m} y={h - s * 0.095} width={w - 2 * m} height={s * 0.066}
            fill="#29273a" stroke="#ffffff" strokeWidth={1} opacity={0.86}
            cornerRadius={round} />
          <Text x={m + 17} y={h - s * 0.079} text="コメントを入力…"
            fontSize={normal * 0.82} fill="#f8f0fb" />
          <Heart x={w - m - s * 0.10} y={bottom - normal * 3.0}
            size={normal * 0.7} fill="#ff4e94" />
          <Heart x={w - m - s * 0.16} y={bottom - normal * 5.1}
            size={normal * 0.54} fill="#fcb6ed" />
        </>
      )}

      {kind === 'game' && (
        <>
          <Rect width={w} height={s * 0.15} fill="#130e34" opacity={0.85} />
          <Rect x={0} y={0} width={w} height={Math.max(5, s * 0.012)}
            fill="#a873ff" />
          <Text x={m} y={m * 0.85} text="JOMON  •  GAME STREAM"
            fill="#f0d1ff" fontSize={normal} fontStyle="bold" />
          <Pill x={w - m - s * 0.21} y={m * 0.72}
            text="LIVE" fill="#ff3b90" width={s * 0.21}
            fontSize={small} />
          <Rect x={m} y={h - s * 0.215} width={w - 2 * m}
            height={s * 0.18} fill="#181333" opacity={0.83}
            cornerRadius={round * 0.65} />
          <Rect x={m} y={h - s * 0.215} width={w - 2 * m} height={normal * 1.5}
            fill="#5832a5" cornerRadius={round * 0.4} />
          <Text x={m + normal} y={h - s * 0.21} text="STREAM CHAT"
            fontSize={normal} fontStyle="bold" fill="#ffffff" />
          <Text x={m + normal} y={h - s * 0.173}
            text="player01: GG!   ★  ナイスプレイ!"
            fontSize={normal * 0.8} fill="#e9d6ff" />
          <Text x={m + normal} y={h - s * 0.143}
            text="viewer: すごい！   ♥ ♥ ♥"
            fontSize={normal * 0.8} fill="#ffc3e7" />
          <Text x={m + normal} y={h - s * 0.105}
            text="■  GAME NIGHT   •   JOMON PIX"
            fontSize={normal * 0.8} fill="#f8f5ff" />
          <Rect x={m} y={h - s * 0.027} height={s * 0.012}
            width={w - 2 * m} fill="#a873ff" />
        </>
      )}

      {kind === 'video' && (
        <>
          <Rect width={w} height={s * 0.16} fill="#0d0d15" opacity={0.82} />
          <Text x={m} y={m * 0.9} text="JOMON  VIDEO"
            fill="#ffffff" fontSize={normal * 1.25} fontStyle="bold" />
          <Rect x={m} y={s * 0.13} width={w - 2 * m}
            height={s * 0.005} fill="#ff4f6f" />
          <Rect x={0} y={h - s * 0.21} width={w} height={s * 0.21}
            fill="#0d0d15" opacity={0.83} />
          <Text x={m} y={h - s * 0.195} width={w - 2 * m}
            text="今日のベストショット！" fill="#ffffff"
            fontSize={normal * 1.3} fontStyle="bold" />
          <Text x={m} y={h - s * 0.15} width={w - 2 * m}
            text="JOMON PIX  •  VIDEO CLIP" fill="#c4c4d4"
            fontSize={normal * 0.85} />
          <Rect x={m} y={h - s * 0.088} width={w - 2 * m}
            height={Math.max(4, s * 0.010)} fill="#86868c"
            cornerRadius={3} />
          <Rect x={m} y={h - s * 0.088} width={(w - 2 * m) * 0.37}
            height={Math.max(4, s * 0.010)} fill="#fa476b"
            cornerRadius={3} />
          <Text x={m} y={h - s * 0.058} width={w - 2 * m}
            text="▶     02:18 / 06:12          ▣   ♡   ↗"
            fill="#ffffff" fontSize={normal * 0.9} />
        </>
      )}

      {kind === 'shorts' && (
        <>
          <Rect x={0} y={0} width={w} height={s * 0.135}
            fill="#15121c" opacity={0.52} />
          <Text x={m} y={m * 1.1} text="SHORT CLIP"
            fontSize={normal * 1.1} fontStyle="bold" fill="#ffffff" />
          <Text x={m} y={m * 2.3} text="今日のワンシーン"
            fontSize={small} fill="#ffffff" />
          <RoundAction x={w - m - normal} y={h - s * 0.42}
            mark="♥" label="いいね" size={round * 0.82} />
          <RoundAction x={w - m - normal} y={h - s * 0.29}
            mark="▤" label="コメント" size={round * 0.82} />
          <RoundAction x={w - m - normal} y={h - s * 0.16}
            mark="↗" label="シェア" size={round * 0.82} />
          <Rect x={0} y={h - s * 0.12} width={w} height={s * 0.12}
            fill="#15121c" opacity={0.6} />
          <Text x={m} y={h - s * 0.102} text="@jomon_creator"
            fontSize={normal} fontStyle="bold" fill="#ffffff" />
          <Text x={m} y={h - s * 0.058} width={w - 2 * m}
            text="♪  ORIGINAL SOUND   #JOMONpix"
            fontSize={normal * 0.8} fill="#ffffff" />
          <Rect x={0} y={h - s * 0.009} width={w * 0.64}
            height={s * 0.009} fill="#ffffff" />
        </>
      )}

      {kind === 'social' && (
        <>
          <Rect width={w} height={s * 0.15} fill="#ffffff" opacity={0.97} />
          <Circle x={m + round * 0.7} y={s * 0.075}
            radius={round * 0.74} fill="#f9b5d8" stroke="#d95a9e"
            strokeWidth={Math.max(2, s * 0.008)} />
          <Text x={m + round * 1.8} y={s * 0.055}
            text="jomon.pix" fontSize={normal}
            fontStyle="bold" fill="#26212b" />
          <Text x={m + round * 1.8} y={s * 0.095}
            text="Today's photo" fontSize={small} fill="#77717a" />
          <Text x={w - m - normal * 1.3} y={s * 0.063}
            text="•••" fontSize={normal * 1.2} fill="#37313c" />
          <Rect x={0} y={h - s * 0.215} width={w}
            height={s * 0.215} fill="#ffffff" opacity={0.97} />
          <Text x={m} y={h - s * 0.19}
            text="♡    ▢    ↗                         ♧"
            fontSize={normal * 1.35} fill="#26212b" />
          <Text x={m} y={h - s * 0.125} width={w - 2 * m}
            text="今日の一枚をシェア！"
            fontSize={normal} fontStyle="bold" fill="#302933" />
          <Text x={m} y={h - s * 0.088} width={w - 2 * m}
            text="#おでかけ  #JOMONpix  #photo"
            fontSize={normal * 0.78} fill="#766975" />
          <Text x={m} y={h - s * 0.037} width={w - 2 * m}
            text="コメントを追加…" fontSize={small} fill="#9a909b" />
        </>
      )}

      {kind === 'story' && (
        <>
          <Rect width={w} height={s * 0.165}
            fill="#16151e" opacity={0.7} />
          {Array.from({ length: 5 }, (_, i) => (
            <Rect key={i} x={m + i * (w - 2 * m) / 5}
              y={Math.max(8, s * 0.025)}
              width={(w - 2 * m) / 5 - 5}
              height={Math.max(4, s * 0.008)}
              fill={i < 2 ? '#ffffff' : '#c5c0c8'}
              opacity={i < 2 ? 1 : 0.56} cornerRadius={3} />
          ))}
          <Circle x={m + round * 0.75} y={s * 0.10}
            radius={round * 0.72} fill="#cf9fec" stroke="#ffffff"
            strokeWidth={3} />
          <Text x={m + round * 1.7} y={s * 0.09}
            text="my story   ·   5分前"
            fill="#ffffff" fontSize={normal * 0.95} />
          <Text x={w - m - normal} y={s * 0.085}
            text="×" fill="#ffffff" fontSize={normal * 1.5} />
          <Rect x={m} y={h - s * 0.100}
            width={w - 2 * m - s * 0.1}
            height={s * 0.07} stroke="#ffffff" strokeWidth={Math.max(2, s * 0.004)}
            cornerRadius={round * 1.5} fill="#0f1021" opacity={0.58} />
          <Text x={m + 20} y={h - s * 0.078}
            text="メッセージを送信…" fontSize={normal * 0.88}
            fill="#ffffff" />
          <Heart x={w - m - normal} y={h - s * 0.085}
            size={normal * 0.6} fill="#ffffff" />
        </>
      )}
    </Group>
  );
}
