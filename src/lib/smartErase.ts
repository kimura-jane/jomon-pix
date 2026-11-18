// Local, no-cost exemplar-based image fill.
// This is a lightweight inpainting algorithm, not Google's Magic Eraser
// or a generative AI model. Detailed backgrounds may need several attempts.

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('画像加工を開始できませんでした。');
  return ctx;
}

type Candidate = { index: number; x: number; y: number };

export async function smartErase(
  originalImage: HTMLImageElement,
  selection: HTMLCanvasElement,
): Promise<string> {
  const fullWidth = originalImage.naturalWidth;
  const fullHeight = originalImage.naturalHeight;
  if (!fullWidth || !fullHeight ||
      selection.width !== fullWidth || selection.height !== fullHeight) {
    throw new Error('写真と選択範囲のサイズが一致しません。');
  }
  const scale = Math.min(1, 560 / Math.max(fullWidth, fullHeight));
  const width = Math.max(1, Math.round(fullWidth * scale));
  const height = Math.max(1, Math.round(fullHeight * scale));
  const work = canvasOf(width, height);
  const ctx = getContext(work);
  ctx.drawImage(originalImage, 0, 0, width, height);
  const before = ctx.getImageData(0, 0, width, height);
  const pixels = new Uint8ClampedArray(before.data);
  const maskCanvas = canvasOf(width, height);
  const maskCtx = getContext(maskCanvas);
  maskCtx.drawImage(selection, 0, 0, width, height);
  const maskRgba = maskCtx.getImageData(0, 0, width, height).data;
  const total = width * height;
  const masked = new Uint8Array(total);
  const done = new Uint8Array(total);
  const sourceIndex = new Int32Array(total);
  let count = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (maskRgba[i * 4 + 3] > 50) {
        masked[i] = 1;
        count += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else {
        done[i] = 1;
        sourceIndex[i] = i;
      }
    }
  }

  if (count < 2) throw new Error('消したい部分をもう少し広く指定してください。');
  if (count > total * 0.35) {
    throw new Error('選択範囲が大きすぎます。35%未満に分けて消してください。');
  }

  // Process from the unmasked boundary toward the interior. This provides
  // a valid neighborhood for each candidate-patch comparison.
  const distance = new Int16Array(total);
  const queue = new Int32Array(count);
  let tail = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = y * width + x;
      if (!masked[i]) continue;
      if ((x > 0 && !masked[i - 1]) ||
          (x + 1 < width && !masked[i + 1]) ||
          (y > 0 && !masked[i - width]) ||
          (y + 1 < height && !masked[i + width])) {
        distance[i] = 1;
        queue[tail++] = i;
      }
    }
  }

  // Only sample original, valid pixels. Reusing synthesized pixels as donors
  // would recursively amplify their errors and create obvious artifacts.
  const candidates: Candidate[] = [];
  const searchPadding = Math.max(50, Math.floor(Math.min(width, height) * 0.27));
  for (let y = Math.max(3, minY - searchPadding);
       y <= Math.min(height - 4, maxY + searchPadding); y += 3) {
    for (let x = Math.max(3, minX - searchPadding);
         x <= Math.min(width - 4, maxX + searchPadding); x += 3) {
      const i = y * width + x;
      if (masked[i] || masked[i - 3] || masked[i + 3] ||
          masked[i - 3 * width] || masked[i + 3 * width]) continue;
      candidates.push({ index: i, x, y });
    }
  }

  if (!candidates.length) {
    throw new Error('周囲に補完用の背景がありません。消す範囲を小さくしてください。');
  }

  let head = 0;
  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    const next = distance[i] + 1;
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x + 1 < width ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y + 1 < height ? i + width : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && masked[n] && !distance[n]) {
        distance[n] = next;
        queue[tail++] = n;
      }
    }
  }

  function fit(target: number, donor: number): number {
    const x = target % width;
    const y = (target / width) | 0;
    const sx = donor % width;
    const sy = (donor / width) | 0;
    if (sx < 3 || sy < 3 || sx >= width - 3 || sy >= height - 3 ||
        masked[donor]) return Infinity;
    let sum = 0;
    let samples = 0;
    for (let dy = -3; dy <= 3; dy += 2) {
      const yy = y + dy;
      const ty = sy + dy;
      if (yy < 0 || yy >= height || ty < 0 || ty >= height) continue;
      for (let dx = -3; dx <= 3; dx += 2) {
        const xx = x + dx;
        const tx = sx + dx;
        if (xx < 0 || xx >= width || tx < 0 || tx >= width) continue;
        const ti = yy * width + xx;
        const di = ty * width + tx;
        if (!done[ti] || masked[di]) continue;
        const to = ti * 4;
        const so = di * 4;
        const dr = pixels[to] - before.data[so];
        const dg = pixels[to + 1] - before.data[so + 1];
        const db = pixels[to + 2] - before.data[so + 2];
        sum += dr * dr + dg * dg + db * db;
        samples += 1;
      }
    }
    if (!samples) return Infinity;
    const range = Math.hypot(sx - x, sy - y);
    return sum / (samples * 3) + range * 0.10;
  }

  // Yield before the CPU work so an iPhone paints the progress indicator.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  for (let q = 0; q < tail; q += 1) {
    const p = queue[q];
    const x = p % width;
    const y = (p / width) | 0;
    let best = -1;
    let score = Infinity;

    const nearby = [
      x > 0 ? p - 1 : -1,
      x + 1 < width ? p + 1 : -1,
      y > 0 ? p - width : -1,
      y + 1 < height ? p + width : -1,
    ];
    // Neighbor-guided candidate reuse preserves continuous texture.
    for (const n of nearby) {
      if (n < 0 || !done[n]) continue;
      const ni = sourceIndex[n];
      const donor = ni + (p - n);
      if (donor >= 0 && donor < total && !masked[donor]) {
        const value = fit(p, donor);
        if (value < score) { score = value; best = donor; }
      }
    }

    // Deterministic scatter sampling. It avoids loading models or making
    // network requests and is reproducible for undo / screenshots.
    let seed = (Math.imul(x + 11, 73856093) ^ Math.imul(y + 17, 19349663)) >>> 0;
    for (let k = 0; k < 20; k += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const donor = candidates[(seed >>> 0) % candidates.length].index;
      const value = fit(p, donor);
      if (value < score) { score = value; best = donor; }
    }
    if (best < 0) {
      const donor = nearby.find((n) => n >= 0 && done[n]);
      best = donor !== undefined ? sourceIndex[donor] : candidates[0].index;
    }

    const from = best * 4;
    const to = p * 4;
    pixels[to] = before.data[from];
    pixels[to + 1] = before.data[from + 1];
    pixels[to + 2] = before.data[from + 2];
    pixels[to + 3] = before.data[from + 3];
    done[p] = 1;
    sourceIndex[p] = best;
  }

  // Keep original pixels outside the user's selection at full resolution.
  before.data.set(pixels);
  ctx.putImageData(before, 0, 0);
  const filled = canvasOf(fullWidth, fullHeight);
  const filledCtx = getContext(filled);
  filledCtx.imageSmoothingEnabled = true;
  filledCtx.imageSmoothingQuality = 'high';
  filledCtx.drawImage(work, 0, 0, fullWidth, fullHeight);
  filledCtx.globalCompositeOperation = 'destination-in';
  filledCtx.drawImage(selection, 0, 0);

  const output = canvasOf(fullWidth, fullHeight);
  const outputCtx = getContext(output);
  outputCtx.drawImage(originalImage, 0, 0);
  outputCtx.drawImage(filled, 0, 0);
  return output.toDataURL('image/png');
}
