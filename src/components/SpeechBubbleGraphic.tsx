import { useEffect, useState } from 'react';
import Konva from 'konva';
import { Group, Shape, Text } from 'react-konva';
import type { TextEl, SpeechBubbleStyle } from '../types';

// The whole bubble, text and tail are a single movable / resizable Konva group.
// It is drawn on the same stage as ordinary text, so PNG export and Undo match.
function roundedBubble(
  ctx: Konva.Context, w: number, h: number, radius: number,
  tail: 'left' | 'right',
) {
  const r = Math.min(radius, h / 2, w / 2);
  const start = tail === 'left' ? w * 0.24 : w * 0.76;
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  if (tail === 'right') {
    ctx.lineTo(start + 20, h);
    ctx.lineTo(start + 13, h + 27);
    ctx.lineTo(start - 8, h);
  }
  ctx.lineTo(r, h);
  if (tail === 'left') {
    ctx.lineTo(start + 8, h);
    ctx.lineTo(start - 13, h + 27);
    ctx.lineTo(start - 20, h);
  }
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

function decorativeBubble(
  ctx: Konva.Context, w: number, h: number,
  style: SpeechBubbleStyle, tail: 'left' | 'right',
  shape: Konva.Shape,
) {
  const x = tail === 'left' ? w * 0.24 : w * 0.76;
  // Draw the tail first; the filled body overlaps its top edge.
  ctx.beginPath();
  ctx.moveTo(x - 14, h * 0.87);
  ctx.lineTo(x + (tail === 'left' ? -24 : 24), h + 27);
  ctx.lineTo(x + 15, h * 0.87);
  ctx.closePath();
  ctx.fillStrokeShape(shape);

  const cx = w / 2, cy = h / 2;
  const rx = w * 0.49, ry = h * 0.48;
  ctx.beginPath();
  const steps = style === 'jagged' ? 40 : 84;
  for (let i = 0; i < steps; i++) {
    const angle = -Math.PI / 2 + 2 * Math.PI * i / steps;
    const radial = style === 'jagged'
      ? (i % 2 === 0 ? 1 : 0.84)
      : (0.91 + 0.09 * Math.cos(angle * 12));
    const px = cx + rx * radial * Math.cos(angle);
    const py = cy + ry * radial * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

export function SpeechBubbleGraphic({ el }: { el: TextEl }) {
  if (!el.bubble) return null;
  const bubble = el.bubble;
  const [, refreshFont] = useState(0);
  useEffect(() => {
    let current = true;
    // The font may load after the canvas first paints. Re-measure the
    // dialogue so bubble height follows the actual glyph metrics.
    void document.fonts?.load(
      `${el.fontSize}px "${el.fontFamily.replace(/["\\]/g, '')}"`,
      el.text || ' ',
    ).then(() => {
      if (current) refreshFont((value) => value + 1);
    }).catch(() => {
      // If a web font is unavailable, the browser's fallback remains usable.
    });
    return () => { current = false; };
  }, [el.fontFamily, el.fontSize, el.text]);
  const w = Math.max(160, Math.min(500, bubble.width));
  const paddingX = 23;
  const paddingY = 19;
  const textWidth = w - paddingX * 2;
  // Konva's own text layout calculates lines so mixed Japanese/English,
  // emoji, and explicit linebreaks use the same wrapping as the renderer.
  const measuring = new Konva.Text({
    text: el.text || ' ',
    width: textWidth,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    letterSpacing: el.letterSpacing,
    lineHeight: 1.3,
    wrap: 'char',
  });
  const bodyHeight = Math.min(980, Math.max(86, Math.ceil(measuring.height() + paddingY * 2)));
  measuring.destroy();
  const textHeight = Math.max(32, bodyHeight - paddingY * 2);

  return (
    <Group>
      <Shape
        width={w}
        height={bodyHeight + 28}
        fill={bubble.background}
        stroke={bubble.outline}
        strokeWidth={Math.max(2, w * 0.01)}
        lineJoin="round"
        shadowColor="#24162b"
        shadowOpacity={0.12}
        shadowBlur={8}
        shadowOffsetY={3}
        sceneFunc={(ctx, shape) => {
          if (bubble.style === 'round' || bubble.style === 'chat') {
            ctx.beginPath();
            roundedBubble(ctx, w, bodyHeight, bubble.style === 'chat' ? 22 : 42, bubble.tail);
            ctx.fillStrokeShape(shape);
          } else {
            decorativeBubble(ctx, w, bodyHeight, bubble.style, bubble.tail, shape);
          }
        }}
      />
      <Text
        x={paddingX}
        y={paddingY}
        width={textWidth}
        height={textHeight}
        text={el.text}
        fontFamily={el.fontFamily}
        fontSize={el.fontSize}
        fill={el.fill}
        stroke={el.stroke || undefined}
        strokeWidth={el.stroke ? el.strokeWidth : 0}
        fillAfterStrokeEnabled
        lineJoin="round"
        lineHeight={1.3}
        letterSpacing={el.letterSpacing}
        align={el.align}
        verticalAlign="middle"
        wrap="char"
        listening={false}
      />
    </Group>
  );
}
