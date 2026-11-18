import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// Pose detection runs locally. The model is bundled by the web/iOS build
// scripts; photos never leave the device.
type Point = { x: number; y: number };
type PosePoint = Pick<NormalizedLandmark, 'x' | 'y' | 'visibility'>;
type Leg = { hip: Point; knee: Point; ankle: Point; hipGap: number };
type Body = { legs: Leg[]; shoulderY: number; hipY: number; ankleY: number };
type Segment = { a: Point; b: Point; radius: number; start: number; span: number };
export type LegBeautyResult = {
  canvas: HTMLCanvasElement;
  legCount: number;
  applied: boolean;
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
    const shoulderY = valid(pose[11]) && valid(pose[12])
      ? (pose[11].y + pose[12].y) * h / 2
      : hipY - (ankleY - hipY) * 0.45;
    bodies.push({ legs, hipY, ankleY, shoulderY });
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
        const taper = Math.sin(Math.PI * progress);
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

// Keep the face region and feet fixed. Shrink the torso slightly and
// redistribute that space to the legs. The original canvas dimensions stay
// unchanged; no cropping and no extra controls are introduced.
function lengthenLegs(
  source: HTMLCanvasElement, bodies: Body[], value: number,
): HTMLCanvasElement | null {
  if (bodies.length !== 1 || bodies[0].legs.length < 1) return null;
  const body = bodies[0];
  const w = source.width, h = source.height;
  const shoulder = Math.max(0, body.shoulderY);
  const hip = body.hipY;
  const ankle = body.ankleY;
  // One reliably detected leg is sufficient when the other is partly
  // obscured or crossed. Require an upper-body landmark and enough visible
  // leg length; refuse images that only show a cropped lower body.
  if (shoulder >= hip - h * 0.045 ||
      ankle <= hip + h * 0.13 || ankle > h) {
    return null;
  }
  const extra = Math.min((ankle - hip) * 0.12, (hip - shoulder) * 0.20) *
    Math.min(1, Math.max(0, value / 100));
  if (extra < 0.5) return null;
  const newHip = hip - extra;
  const output = document.createElement('canvas');
  output.width = w;
  output.height = h;
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('脚の画像処理に失敗しました');
  ctx.drawImage(source, 0, 0, w, shoulder, 0, 0, w, shoulder);
  ctx.drawImage(source, 0, shoulder, w, hip - shoulder,
    0, shoulder, w, newHip - shoulder);
  ctx.drawImage(source, 0, hip, w, ankle - hip,
    0, newHip, w, ankle - newHip);
  ctx.drawImage(source, 0, ankle, w, h - ankle,
    0, ankle, w, h - ankle);
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
  const legCount = bodies.reduce((sum, body) => sum + body.legs.length, 0);
  let result = canvas;
  let applied = false;
  let lengthApplied = false;
  if (legCount > 0 && slim > 0) {
    result = narrowLegs(result, bodies, slim);
    applied = true;
  }
  if (length > 0) {
    const stretched = lengthenLegs(result, bodies, length);
    if (stretched) {
      result = stretched;
      applied = true;
      lengthApplied = true;
    }
  }
  return { canvas: result, legCount, applied, lengthApplied };
}
