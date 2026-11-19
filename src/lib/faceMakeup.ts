import type { MakeupStyleId } from '../types';

// Local Canvas2D cosmetics anchored to MediaPipe's 468+ face landmarks.
// Assets and face geometry never leave the device. This draws color and
// texture ABOVE the original features without erasing the real eyebrows.
type Landmark = { x: number; y: number };
type Vec = { x: number; y: number };
type Palette = {
  shadow: [number, number, number];
  liner: [number, number, number];
  brow: [number, number, number];
  cheek: [number, number, number];
  lips: [number, number, number];
  shadowAlpha: number;
  browAlpha: number;
  linerAlpha: number;
  wing: number;
  wingRise: number;
  lashes: number;
  lashLength: number;
  bag: number;
  shimmer: boolean;
  gloss: boolean;
};

const COLORS: Record<MakeupStyleId, Palette> = {
  natural: { shadow: [165, 111, 85], liner: [77, 53, 47], brow: [91, 67, 57],
    cheek: [230, 128, 111], lips: [191, 97, 105], shadowAlpha: .25,
    browAlpha: .23, linerAlpha: .40, wing: .06, wingRise: .02,
    lashes: 3, lashLength: .06, bag: .12, shimmer: false, gloss: false },
  idol: { shadow: [236, 88, 153], liner: [75, 44, 63], brow: [116, 74, 79],
    cheek: [247, 95, 146], lips: [223, 75, 134], shadowAlpha: .47,
    browAlpha: .42, linerAlpha: .75, wing: .15, wingRise: .08,
    lashes: 6, lashLength: .15, bag: .58, shimmer: true, gloss: true },
  gyaru: { shadow: [123, 63, 45], liner: [30, 20, 24], brow: [81, 47, 38],
    cheek: [201, 92, 72], lips: [181, 107, 92], shadowAlpha: .64,
    browAlpha: .64, linerAlpha: .94, wing: .30, wingRise: .19,
    lashes: 9, lashLength: .23, bag: .24, shimmer: false, gloss: true },
  pien: { shadow: [210, 55, 94], liner: [85, 45, 67], brow: [118, 68, 80],
    cheek: [241, 63, 114], lips: [209, 74, 126], shadowAlpha: .54,
    browAlpha: .40, linerAlpha: .69, wing: .15, wingRise: -.17,
    lashes: 6, lashLength: .13, bag: .91, shimmer: true, gloss: true },
  korean: { shadow: [184, 120, 102], liner: [71, 52, 52], brow: [98, 81, 75],
    cheek: [223, 120, 113], lips: [205, 55, 90], shadowAlpha: .37,
    browAlpha: .46, linerAlpha: .60, wing: .14, wingRise: .03,
    lashes: 5, lashLength: .10, bag: .43, shimmer: false, gloss: true },
  y2k: { shadow: [146, 102, 230], liner: [61, 45, 116], brow: [113, 76, 109],
    cheek: [216, 100, 194], lips: [174, 68, 157], shadowAlpha: .66,
    browAlpha: .44, linerAlpha: .83, wing: .28, wingRise: .16,
    lashes: 7, lashLength: .17, bag: .34, shimmer: true, gloss: true },
};

const rgba = ([r, g, b]: [number, number, number], a: number) =>
  `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a))})`;

function locate(face: Landmark[], id: number, w: number, h: number): Vec {
  return { x: face[id].x * w, y: face[id].y * h };
}

function tracePolygon(
  ctx: CanvasRenderingContext2D, face: Landmark[], ids: readonly number[], w: number, h: number,
): void {
  ctx.beginPath();
  ids.forEach((id, n) => {
    const p = locate(face, id, w, h);
    if (n === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

function drawEye(
  ctx: CanvasRenderingContext2D, face: Landmark[],
  w: number, h: number, ids: { inner: number; outer: number; upper: number; brow: number },
  p: Palette,
): void {
  const inner = locate(face, ids.inner, w, h);
  const outer = locate(face, ids.outer, w, h);
  const upper = locate(face, ids.upper, w, h);
  const brow = locate(face, ids.brow, w, h);
  const eyeWidth = Math.hypot(outer.x - inner.x, outer.y - inner.y);
  if (eyeWidth < 5) return;
  const ux = (outer.x - inner.x) / eyeWidth;
  const uy = (outer.y - inner.y) / eyeWidth;
  let vx = -uy;
  let vy = ux;
  const center = { x: (inner.x + outer.x) / 2, y: (inner.y + outer.y) / 2 };
  if ((upper.x - center.x) * vx + (upper.y - center.y) * vy < 0) {
    vx = -vx; vy = -vy;
  }
  const browGap = Math.abs((brow.x - center.x) * vx + (brow.y - center.y) * vy);
  // Keep eye shadow below the real eyebrow; never paint across the pupil.
  const top = Math.max(.12, Math.min(.37, browGap / eyeWidth * .68));
  ctx.save();
  ctx.transform(ux, uy, vx, vy, center.x, center.y);
  ctx.scale(eyeWidth, eyeWidth);
  const shadow = ctx.createLinearGradient(0, 0, 0, top);
  shadow.addColorStop(0, rgba(p.shadow, .11 * p.shadowAlpha));
  shadow.addColorStop(.46, rgba(p.shadow, p.shadowAlpha));
  shadow.addColorStop(1, rgba(p.shadow, 0));
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.moveTo(-.51, .012);
  ctx.bezierCurveTo(-.38, top * 1.03, .24, top * 1.18, .56, .026);
  ctx.quadraticCurveTo(.05, -.017, -.51, .012);
  ctx.closePath();
  ctx.fill();

  // Eyeliner follows the upper eye contour, then rises or droops at the wing.
  ctx.strokeStyle = rgba(p.liner, p.linerAlpha);
  ctx.lineWidth = Math.max(.018, p.linerAlpha * .044);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-.48, .016);
  ctx.bezierCurveTo(-.25, .095, .19, .09, .49, .005);
  ctx.quadraticCurveTo(.49 + p.wing * .66, p.wingRise, .50 + p.wing, p.wingRise);
  ctx.stroke();

  // Fine individual lashes, not a rectangular sticker stuck across the eye.
  ctx.strokeStyle = rgba(p.liner, Math.min(.87, p.linerAlpha * .77));
  ctx.lineWidth = .013 + p.lashLength * .019;
  for (let i = 0; i < p.lashes; i++) {
    const u = (i + .5) / p.lashes;
    const x = -.35 + u * .81;
    const y = .072 - .055 * Math.abs(x);
    const height = p.lashLength * (.62 + .52 * u);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + .033, y + height * .57,
      x + .035 + .064 * u, y + height);
    ctx.stroke();
  }

  if (p.bag > 0) {
    // Tear-bag highlight and its soft lower boundary; x is eye width.
    const bright = ctx.createLinearGradient(0, -.05, 0, -.25);
    bright.addColorStop(0, `rgba(255,246,245,${p.bag * .37})`);
    bright.addColorStop(1, 'rgba(255,246,245,0)');
    ctx.fillStyle = bright;
    ctx.beginPath();
    ctx.moveTo(-.38, -.06);
    ctx.quadraticCurveTo(0, -.29, .39, -.055);
    ctx.quadraticCurveTo(0, -.14, -.38, -.06);
    ctx.fill();
    ctx.strokeStyle = rgba(p.shadow, p.bag * .23);
    ctx.lineWidth = .012;
    ctx.beginPath();
    ctx.moveTo(-.34, -.19);
    ctx.quadraticCurveTo(0, -.255, .34, -.17);
    ctx.stroke();
  }

  if (p.shimmer) {
    ctx.fillStyle = 'rgba(255,247,239,.69)';
    for (const [x, y, r] of [[.32, .22, .021], [.11, .30, .012], [.49, .14, .014]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBrows(
  ctx: CanvasRenderingContext2D, face: Landmark[], w: number, h: number,
  faceWidth: number, p: Palette, style: MakeupStyleId,
): void {
  const browPaths = [
    [70, 63, 105, 66, 107],
    [336, 296, 334, 293, 300],
  ];
  ctx.save();
  ctx.strokeStyle = rgba(p.brow, p.browAlpha);
  ctx.lineWidth = Math.max(1, faceWidth * (style === 'gyaru' || style === 'y2k' ? .020 : .027));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const ids of browPaths) {
    const points = ids.map((id) => locate(face, id, w, h));
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const last = points[i - 1];
      const now = points[i];
      ctx.quadraticCurveTo(last.x, last.y, (last.x + now.x) / 2, (last.y + now.y) / 2);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCheeks(
  ctx: CanvasRenderingContext2D, face: Landmark[], w: number, h: number,
  faceWidth: number, faceHeight: number, p: Palette, style: MakeupStyleId,
): void {
  for (const ids of [[117, 101, 205], [346, 330, 425]]) {
    const pts = ids.map((id) => locate(face, id, w, h));
    const x = pts.reduce((total, t) => total + t.x, 0) / pts.length;
    const y = pts.reduce((total, t) => total + t.y, 0) / pts.length -
      faceHeight * (style === 'pien' ? .068 : style === 'idol' ? .038 : 0);
    const rx = faceWidth * (style === 'pien' ? .18 : .15);
    const ry = faceWidth * (style === 'pien' ? .13 : .11);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    gradient.addColorStop(0, rgba(p.cheek, style === 'pien' ? .31 : .18));
    gradient.addColorStop(1, rgba(p.cheek, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const LIPS = [61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91];
function drawLips(
  ctx: CanvasRenderingContext2D, face: Landmark[], w: number, h: number,
  faceWidth: number, p: Palette,
): void {
  ctx.save();
  ctx.fillStyle = rgba(p.lips, .36);
  tracePolygon(ctx, face, LIPS, w, h);
  ctx.fill();
  if (p.gloss) {
    const a = locate(face, 61, w, h);
    const b = locate(face, 291, w, h);
    const top = locate(face, 13, w, h);
    const span = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    ctx.strokeStyle = 'rgba(255,244,248,.44)';
    ctx.lineWidth = Math.max(1, Math.min(faceWidth * .013, span * .07));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(top.x - span * .24, top.y - span * .06);
    ctx.quadraticCurveTo(top.x, top.y - span * .16, top.x + span * .18, top.y - span * .06);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderFaceMakeup(
  ctx: CanvasRenderingContext2D,
  face: Landmark[],
  imageWidth: number,
  imageHeight: number,
  style: MakeupStyleId,
  faceWidth: number,
  faceHeight: number,
): void {
  if (face.length < 468 || faceWidth < 18 || faceHeight < 18) return;
  const palette = COLORS[style];
  if (!palette) return;
  ctx.save();
  drawCheeks(ctx, face, imageWidth, imageHeight, faceWidth, faceHeight, palette, style);
  drawBrows(ctx, face, imageWidth, imageHeight, faceWidth, palette, style);
  drawEye(ctx, face, imageWidth, imageHeight,
    { inner: 133, outer: 33, upper: 159, brow: 105 }, palette);
  drawEye(ctx, face, imageWidth, imageHeight,
    { inner: 362, outer: 263, upper: 386, brow: 334 }, palette);
  drawLips(ctx, face, imageWidth, imageHeight, faceWidth, palette);
  ctx.restore();
}
