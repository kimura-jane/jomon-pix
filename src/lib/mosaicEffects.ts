/**
 * Eight client-side mosaic styles. This module only renders to a caller-owned
 * canvas; it never uploads a photo or modifies editing history.
 */
export type MosaicEffect =
  | 'pixel' | 'blur' | 'dot' | 'hexagon'
  | 'triangle' | 'black' | 'heart' | 'brushstroke';

export const MOSAIC_EFFECT_OPTIONS: ReadonlyArray<{ id: MosaicEffect; label: string }> = [
  { id: 'pixel', label: '標準' },
  { id: 'blur', label: 'ぼかし' },
  { id: 'dot', label: 'ドット' },
  { id: 'hexagon', label: '六角形' },
  { id: 'triangle', label: '三角形' },
  { id: 'black', label: '黒塗り' },
  { id: 'heart', label: 'ハート' },
  { id: 'brushstroke', label: 'ブラシ風' },
];

function canvas(width: number, height: number): HTMLCanvasElement {
  const element = document.createElement('canvas');
  element.width = Math.max(1, Math.round(width));
  element.height = Math.max(1, Math.round(height));
  return element;
}

function pathPolygon(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/**
 * Render a style at the requested output resolution. The source is sampled
 * into coarse color blocks for geometric effects so they never expose the
 * detailed, unprocessed source between decorative shapes.
 */
export function drawMosaicEffect(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  size: number,
  effect: MosaicEffect,
): void {
  if (!width || !height) return;
  ctx.save();
  try {
    ctx.clearRect(0, 0, width, height);
    if (effect === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const tile = Math.max(4, Math.min(90, Math.round(size)));
    if (effect === 'blur') {
      // Draw from a slightly expanded source so the blurred canvas edges
      // remain covered instead of revealing a sharp unprocessed strip.
      const radius = Math.max(3, Math.min(60, Math.round(tile * 0.85)));
      ctx.filter = 'blur(' + radius + 'px)';
      ctx.drawImage(source, -radius, -radius, width + 2 * radius, height + 2 * radius);
      ctx.filter = 'none';
      return;
    }

    // Avoid hundreds of thousands of path operations on large images.
    const cell = effect === 'pixel'
      ? tile
      : Math.max(tile, Math.ceil(Math.sqrt(width * height / 45_000)));
    const cols = Math.max(1, Math.ceil(width / cell));
    const rows = Math.max(1, Math.ceil(height / cell));
    const reduced = canvas(cols, rows);
    const sampled = reduced.getContext('2d', { willReadFrequently: true });
    if (!sampled) throw new Error('この端末で画像を加工できません');
    sampled.drawImage(source, 0, 0, cols, rows);
    const pixels = sampled.getImageData(0, 0, cols, rows).data;
    const colorAt = (x: number, y: number): string => {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / width * cols)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / height * rows)));
      const index = (cy * cols + cx) * 4;
      return 'rgba(' + pixels[index] + ',' + pixels[index + 1] + ',' +
        pixels[index + 2] + ',' + (pixels[index + 3] / 255) + ')';
    };

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(reduced, 0, 0, width, height);
    if (effect === 'pixel') return;
    ctx.imageSmoothingEnabled = true;

    if (effect === 'dot') {
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.fillRect(0, 0, width, height);
      for (let y = cell / 2; y < height + cell / 2; y += cell) {
        for (let x = cell / 2; x < width + cell / 2; x += cell) {
          ctx.fillStyle = colorAt(x, y);
          ctx.beginPath();
          ctx.arc(x, y, cell * 0.34, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      return;
    }

    if (effect === 'hexagon') {
      const radius = cell * 0.58;
      const dx = Math.sqrt(3) * radius;
      const dy = 1.5 * radius;
      ctx.lineWidth = Math.max(0.5, cell * 0.035);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      for (let row = -1, y = 0; y < height + radius; row++, y += dy) {
        const offset = row % 2 === 0 ? 0 : dx / 2;
        for (let x = offset; x < width + dx; x += dx) {
          pathPolygon(ctx, Array.from({ length: 6 }, (_, n) => {
            const angle = (Math.PI / 180) * (60 * n - 30);
            return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)] as const;
          }));
          ctx.fillStyle = colorAt(x, y);
          ctx.fill();
          ctx.stroke();
        }
      }
      return;
    }

    if (effect === 'triangle') {
      ctx.lineWidth = Math.max(0.6, cell * 0.03);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          pathPolygon(ctx, [[x, y], [x + cell, y], [x, y + cell]]);
          ctx.fillStyle = colorAt(x + cell * 0.3, y + cell * 0.3);
          ctx.fill();
          ctx.stroke();
          pathPolygon(ctx, [[x + cell, y], [x + cell, y + cell], [x, y + cell]]);
          ctx.fillStyle = colorAt(x + cell * 0.7, y + cell * 0.7);
          ctx.fill();
          ctx.stroke();
        }
      }
      return;
    }

    if (effect === 'heart') {
      ctx.fillStyle = 'rgba(255,235,245,0.42)';
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = Math.max(0.7, cell * 0.045);
      ctx.strokeStyle = 'rgba(255,255,255,0.68)';
      for (let y = cell / 2; y < height + cell / 2; y += cell) {
        for (let x = cell / 2; x < width + cell / 2; x += cell) {
          ctx.save();
          ctx.translate(x, y + cell * 0.08);
          ctx.scale(cell / 2.5, cell / 2.5);
          ctx.beginPath();
          ctx.moveTo(0, 0.92);
          ctx.bezierCurveTo(-1.65, 0, -1.15, -1.05, 0, -0.39);
          ctx.bezierCurveTo(1.15, -1.05, 1.65, 0, 0, 0.92);
          ctx.closePath();
          ctx.fillStyle = colorAt(x, y);
          ctx.fill();
          ctx.restore();
        }
      }
      return;
    }

    if (effect === 'brushstroke') {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = cell * 0.64;
      for (let row = 0, y = cell / 2; y < height + cell; row++, y += cell * 0.70) {
        for (let col = 0, x = cell / 2; x < width + cell; col++, x += cell * 1.2) {
          const drift = ((row + col * 3) % 5 - 2) * cell * 0.08;
          ctx.strokeStyle = colorAt(x, y);
          ctx.beginPath();
          ctx.moveTo(x - cell * 0.54, y + drift);
          ctx.quadraticCurveTo(x + cell * 0.04, y - cell * 0.23,
            x + cell * 0.57, y + drift + cell * 0.12);
          ctx.stroke();
        }
      }
    }
  } finally {
    ctx.restore();
  }
}
