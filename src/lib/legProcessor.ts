import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// Pose detection runs locally. The model is bundled by the web/iOS build
// scripts; photos never leave the device.
type Point = { x: number; y: number };
type PosePoint = Pick<NormalizedLandmark, 'x' | 'y' | 'visibility'>;
type Leg = { hip: Point; knee: Point; ankle: Point; hipGap: number };
type Body = {
  legs: Leg[]; shoulderY: number; hipY: number; ankleY: number;
  shoulderLeft?: Point; shoulderRight?: Point;
  hipLeft: Point; hipRight: Point;
};
type Segment = { a: Point; b: Point; radius: number; start: number; span: number };
export type LegBeautyResult = {
  canvas: HTMLCanvasElement;
  legCount: number;
  applied: boolean;
  slimApplied: boolean;
  lengthApplied: boolean;
};

let posePromise: Promise<import('@mediapipe/tasks-vision').PoseLandmarker> | undefined;
const cachedPoses = new WeakMap<HTMLImageElement, Promise<PosePoint[][]>>();

async function landmarker() {
  if (!posePromise) {
    posePromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const root = String(import.meta.env.BASE_URL) + 'mediapipe';
      const files = await FilesetResolver.forVisionTasks(root);
      // WKWebView needs an explicit, attached canvas for the MediaPipe GL context.
      const glCanvas = document.createElement('canvas');
      glCanvas.width = 2;
      glCanvas.height = 2;
      glCanvas.setAttribute('aria-hidden', 'true');
      glCanvas.style.cssText =
        'position:fixed;left:-100px;top:-100px;width:2px;height:2px;opacity:0;pointer-events:none';
      document.body.appendChild(glCanvas);
      try {
        return await PoseLandmarker.createFromOptions(files, {
          canvas: glCanvas,
          baseOptions: {
            modelAssetPath: root + '/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          numPoses: 4,
          outputSegmentationMasks: false,
        });
      } catch (error) {
        glCanvas.remove();
        throw error;
      }
    })().catch((error) => {
      posePromise = undefined;
      throw error;
    });
  }
  return posePromise;
}

async function detectPoses(source: HTMLImageElement): Promise<PosePoint[][]> {
  let cached = cachedPoses.get(source);
  if (!cached) {
    cached = (async () => {
      const detector = await landmarker();
      return detector.detect(source).landmarks.map((pose) => pose.map(
        ({ x, y, visibility }) => ({ x, y, visibility }),
      ));
    })().catch((error) => {
      cachedPoses.delete(source);
      throw error;
    });
    cachedPoses.set(source, cached);
  }
  return cached;
}

function valid(p?: PosePoint): p is PosePoint {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 &&
    (p.visibility === undefined || p.visibility >= 0.45);
}
function pixel(p: PosePoint, w: number, h: number): Point {
  return { x: p.x * w, y: p.y * h };
}
function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findBodies(poses: PosePoint[][], w: number, h: number): Body[] {
  const bodies: Body[] = [];
  for (const pose of poses) {
    if (!valid(pose[23]) || !valid(pose[24])) continue;
    const leftHip = pixel(pose[23], w, h);
    const rightHip = pixel(pose[24], w, h);
    const gap = dist(leftHip, rightHip);
    if (gap < 12 || gap > w * 0.70) continue;
    const legs: Leg[] = [];
    for (const [hi, ki, ai] of [[23, 25, 27], [24, 26, 28]]) {
      if (!valid(pose[hi]) || !valid(pose[ki]) || !valid(pose[ai])) continue;
      const hip = pixel(pose[hi], w, h);
      const knee = pixel(pose[ki], w, h);
      const ankle = pixel(pose[ai], w, h);
      const first = dist(hip, knee);
      const second = dist(knee, ankle);
      if (first < h * 0.045 || second < h * 0.045 ||
          ankle.y <= hip.y + h * 0.10 ||
          Math.abs(ankle.x - hip.x) > (ankle.y - hip.y) * 1.4) continue;
      legs.push({ hip, knee, ankle, hipGap: gap });
    }
    if (!legs.length) continue;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const ankleY = legs.reduce((sum, l) => sum + l.ankle.y, 0) / legs.length;
    const hasShoulders = valid(pose[11]) && valid(pose[12]);
    const shoulderLeft = hasShoulders ? pixel(pose[11], w, h) : undefined;
    const shoulderRight = hasShoulders ? pixel(pose[12], w, h) : undefined;
    const shoulderY = shoulderLeft && shoulderRight
      ? (shoulderLeft.y + shoulderRight.y) / 2 : -1;
    bodies.push({
      legs, hipY, ankleY, shoulderY,
      hipLeft: leftHip, hipRight: rightHip, shoulderLeft, shoulderRight,
    });
  }
  return bodies;
}

function canvasCopy(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('脚の画像処理に失敗しました');
  ctx.drawImage(source, 0, 0);
  return out;
}

// Sample an original snapshot, not previously displaced pixels. This makes
// the result stable on slider updates and avoids cumulative degradation.
function narrowLegs(
  source: HTMLCanvasElement, bodies: Body[], value: number,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const output = canvasCopy(source);
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('脚の画像処理に失敗しました');
  const original = context.getImageData(0, 0, w, h);
  const dest = context.createImageData(w, h);
  dest.data.set(original.data);
  const segments: Segment[] = [];
  for (const body of bodies) {
    for (const leg of body.legs) {
      const thigh = Math.max(9, Math.min(w * 0.10, leg.hipGap * 0.38));
      const calf = Math.max(7, Math.min(w * 0.08, leg.hipGap * 0.27));
      segments.push({ a: leg.hip, b: leg.knee, radius: thigh, start: 0, span: 0.5 });
      segments.push({ a: leg.knee, b: leg.ankle, radius: calf, start: 0.5, span: 0.5 });
    }
  }
  const strength = Math.min(1, Math.max(0, value / 100)) * 0.60;
  // The maximum offset is chosen per pixel to avoid stacking the effect
  // when a person's legs cross.
  const offsetsX = new Float32Array(w * h);
  const offsetsY = new Float32Array(w * h);
  const weights = new Float32Array(w * h);
  const knots = [
    [0, 0], [0.08, 0.60], [0.22, 1.00], [0.39, 0.55],
    [0.50, 0.30], [0.64, 0.55], [0.76, 0.58],
    [0.92, 0.18], [1, 0],
  ];
  for (const seg of segments) {
    const vx = seg.b.x - seg.a.x;
    const vy = seg.b.y - seg.a.y;
    const len = Math.hypot(vx, vy);
    if (len < 1) continue;
    const nx = -vy / len;
    const ny = vx / len;
    const margin = seg.radius * 1.55;
    const x0 = Math.max(0, Math.floor(Math.min(seg.a.x, seg.b.x) - margin));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(seg.a.x, seg.b.x) + margin));
    const y0 = Math.max(0, Math.floor(Math.min(seg.a.y, seg.b.y) - margin));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(seg.a.y, seg.b.y) + margin));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = ((x - seg.a.x) * vx + (y - seg.a.y) * vy) / (len * len);
        if (t < 0 || t > 1) continue;
        const d = (x - seg.a.x) * nx + (y - seg.a.y) * ny;
        const normalized = Math.abs(d) / margin;
        if (normalized >= 1) continue;
        const fade = (1 - normalized * normalized) ** 2;
        const progress = seg.start + t * seg.span;
        // Strongest near the upper thigh, gentle at the knee; calf tapers off
        // smoothly toward the ankle. Interpolate between stable anchors.
        let taper = 0;
        for (let k = 1; k < knots.length; k++) {
          const [end, vEnd] = knots[k];
          if (progress > end) continue;
          const [start, vStart] = knots[k - 1];
          const t2 = Math.max(0, Math.min(1, (progress - start) / (end - start)));
          const eased = t2 * t2 * (3 - 2 * t2);
          taper = vStart + (vEnd - vStart) * eased;
          break;
        }
        const displacement = d * strength * fade * taper;
        const index = y * w + x;
        if (Math.abs(displacement) <= weights[index]) continue;
        weights[index] = Math.abs(displacement);
        offsetsX[index] = displacement * nx;
        offsetsY[index] = displacement * ny;
      }
    }
  }
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] < 0.01) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    const sx = Math.max(0, Math.min(w - 1, x + offsetsX[i]));
    const sy = Math.max(0, Math.min(h - 1, y + offsetsY[i]));
    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const dx = sx - x0, dy = sy - y0;
    const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4;
    const c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4;
    for (let ch = 0; ch < 4; ch++) {
      dest.data[i * 4 + ch] =
        original.data[a + ch] * (1 - dx) * (1 - dy) +
        original.data[b + ch] * dx * (1 - dy) +
        original.data[c + ch] * (1 - dx) * dy +
        original.data[d + ch] * dx * dy;
    }
  }
  context.putImageData(dest, 0, 0);
  return output;
}

// Deform only a soft local strip around a single standing body. The face and
// feet stay fixed. This conservative warp cannot perfectly segment a person
// from a patterned background, so it is intentionally limited in strength.
function lengthenLegs(
  source: HTMLCanvasElement, body: Body, value: number,
): HTMLCanvasElement | null {
  if (!body.shoulderLeft || !body.shoulderRight || body.legs.length !== 2) {
    return null;
  }
  const w = source.width, h = source.height;
  const shoulder = body.shoulderY;
  const hip = body.hipY;
  const ankles = body.legs.map((leg) => leg.ankle);
  const ankle = body.ankleY;
  // Do not guess shoulders, accept missing/mostly cropped feet, or stretch
  // sideways/crouching subjects: the result would be misleading.
  if (shoulder <= h * 0.02 || shoulder >= hip - h * 0.08 ||
      hip >= ankle - h * 0.16 || ankle >= h * 0.97 ||
      Math.abs(ankles[0].y - ankles[1].y) > h * 0.12) {
    return null;
  }
  const extra = Math.min((ankle - hip) * 0.11, (hip - shoulder) * 0.18) *
    Math.max(0, Math.min(1, value / 100));
  if (extra < 0.5) return null;
  const newHip = hip - extra;
  const shoulderCenter = (body.shoulderLeft.x + body.shoulderRight.x) / 2;
  const hipCenter = (body.hipLeft.x + body.hipRight.x) / 2;
  const ankleCenter = (ankles[0].x + ankles[1].x) / 2;
  const shoulderSpan = Math.abs(body.shoulderLeft.x - body.shoulderRight.x);
  const hipGap = dist(body.hipLeft, body.hipRight);
  const shoulderRadius = Math.max(12, shoulderSpan * 0.60);
  const hipRadius = Math.max(12, hipGap * 0.85);
  const ankleRadius = Math.max(12, Math.max(...ankles.map((p) =>
    Math.abs(p.x - ankleCenter))) + hipGap * 0.36);
  // Refuse unusually wide or tilted silhouettes instead of warping the
  // background or an adjacent subject across a large fraction of the photo.
  if (Math.max(shoulderRadius, hipRadius, ankleRadius) > w * 0.30) return null;

  const output = canvasCopy(source);
  const ctx = output.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('脚長の画像処理に失敗しました');
  const original = ctx.getImageData(0, 0, w, h);
  const dest = ctx.createImageData(w, h);
  dest.data.set(original.data);
  const smooth = (t: number) => {
    const n = Math.max(0, Math.min(1, t));
    return n * n * (3 - 2 * n);
  };

  for (let y = Math.floor(shoulder); y <= Math.min(h - 1, Math.ceil(ankle)); y++) {
    let originalY: number;
    if (y < newHip) {
      originalY = shoulder + (y - shoulder) * (hip - shoulder) / (newHip - shoulder);
    } else {
      originalY = hip + (y - newHip) * (ankle - hip) / (ankle - newHip);
    }
    const movement = originalY - y;
    if (movement < 0.01) continue;
    const ratio = (y - shoulder) / (ankle - shoulder);
    const torso = smooth((y - shoulder) / Math.max(1, hip - shoulder));
    const legs = smooth((y - hip) / Math.max(1, ankle - hip));
    const center = y < hip
      ? shoulderCenter + (hipCenter - shoulderCenter) * torso
      : hipCenter + (ankleCenter - hipCenter) * legs;
    const radius = y < hip
      ? shoulderRadius + (hipRadius - shoulderRadius) * torso
      : hipRadius + (ankleRadius - hipRadius) * legs;
    const inner = radius * 0.66;
    const outer = radius * 1.28;
    const x0 = Math.max(0, Math.floor(center - outer));
    const x1 = Math.min(w - 1, Math.ceil(center + outer));
    // Fade out at the top and feet, and horizontally into untouched pixels.
    const vertical = smooth(Math.min(1, ratio * 15)) *
      smooth(Math.min(1, (1 - ratio) * 15));
    for (let x = x0; x <= x1; x++) {
      const dx = Math.abs(x - center);
      const mask = dx <= inner ? 1 : 1 - smooth((dx - inner) / (outer - inner));
      const fromY = Math.max(0, Math.min(h - 1, y + movement * mask * vertical));
      if (Math.abs(fromY - y) < 0.01) continue;
      const low = Math.floor(fromY);
      const high = Math.min(h - 1, low + 1);
      const blend = fromY - low;
      const to = (y * w + x) * 4;
      const a = (low * w + x) * 4;
      const b = (high * w + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        dest.data[to + ch] =
          original.data[a + ch] * (1 - blend) + original.data[b + ch] * blend;
      }
    }
  }
  ctx.putImageData(dest, 0, 0);
  return output;
}

export async function renderLegBeauty(
  source: HTMLImageElement,
  canvas: HTMLCanvasElement,
  slim: number,
  length: number,
): Promise<LegBeautyResult> {
  const poses = await detectPoses(source);
  const bodies = findBodies(poses, canvas.width, canvas.height);
  const personCount = poses.filter((pose) =>
    [11, 12, 23, 24].some((index) => valid(pose[index]))).length;
  const legCount = bodies.reduce((sum, body) => sum + body.legs.length, 0);
  let result = canvas;
  let slimApplied = false;
  let lengthApplied = false;
  // Do not leave one leg thin and the other unchanged. If an additional
  // partly visible person is detected, conservatively refuse all-body edits.
  const bothLegs = personCount > 0 && personCount === bodies.length &&
    bodies.every((body) => body.legs.length === 2);
  if (slim > 0 && bothLegs) {
    result = narrowLegs(result, bodies, slim);
    slimApplied = true;
  }
  if (length > 0 && personCount === 1 && bodies.length === 1) {
    const stretched = lengthenLegs(result, bodies[0], length);
    if (stretched) {
      result = stretched;
      lengthApplied = true;
    }
  }
  return {
    canvas: result, legCount, slimApplied, lengthApplied,
    applied: slimApplied || lengthApplied,
  };
}
