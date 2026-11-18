/**
 * Local AI "magic eraser" backed by MI-GAN (Picsart AI Research, MIT).
 * Uses the ORIGINAL 28 MB migan_pipeline_v2 ONNX pipeline and ONNX Runtime Web.
 * No photos, masks or image content leave the device. Assets are served from
 * this app's own origin and bundled into the iOS Capacitor app.
 *
 * Unlike the old exemplar fill, this actually performs neural inpainting.
 * The 512 model has limitations: the result can still be wrong on large,
 * complex, semantic regions. Offer the user Undo and a fast non-AI option.
 */

type ProgressCallback = (message: string) => void;
const MODEL = 'migan_pipeline_v2.onnx';
const MODEL_SHA256 = '6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b';
const MODEL_BYTES = 28079181;
const MAX_LONG_EDGE = 768;
const MAX_PIXELS = 14000000;

function canvas(width: number, height: number): HTMLCanvasElement {
  const item = document.createElement('canvas');
  item.width = width;
  item.height = height;
  return item;
}

function context(item: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = item.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('画像処理用のメモリを確保できませんでした。');
  return ctx;
}

function checkSelection(
  originalImage: HTMLImageElement,
  selection: HTMLCanvasElement,
): { width: number; height: number; bbox: { x: number; y: number; w: number; h: number } } {
  const width = originalImage.naturalWidth;
  const height = originalImage.naturalHeight;
  if (!width || !height || width * height > MAX_PIXELS) {
    throw new Error('この写真は大きすぎます。サイズを縮小してから試してください。');
  }
  if (selection.width !== width || selection.height !== height) {
    throw new Error('写真と選択範囲のサイズが一致しません。');
  }

  // Only scan a reduced selection image. Full-resolution image data
  // repeatedly allocated on an iPhone can trigger a WebKit process kill.
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const small = canvas(w, h);
  const ctx = context(small);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(selection, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  let left = w, top = h, right = -1, bottom = -1, selected = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rgba[(y * w + x) * 4 + 3] < 50) continue;
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
      selected++;
    }
  }
  if (selected < 3) throw new Error('消す場所をもう少し広く指定してください。');
  if (selected >= w * h * 0.6) {
    throw new Error('選択範囲が大きすぎます。何回かに分けて消してください。');
  }
  return {
    width, height,
    bbox: {
      x: Math.max(0, Math.floor(left / scale)),
      y: Math.max(0, Math.floor(top / scale)),
      w: Math.min(width, Math.ceil((right + 1) / scale) - Math.floor(left / scale)),
      h: Math.min(height, Math.ceil((bottom + 1) / scale) - Math.floor(top / scale)),
    },
  };
}

// The ONNX pipeline already crops around the mask internally; we also crop
// the original photo to give a local, high-detail context for tiny objects.
function makeCrop(
  fullW: number, fullH: number,
  bbox: { x: number; y: number; w: number; h: number },
) {
  const longest = Math.max(bbox.w, bbox.h);
  const span = Math.max(300, longest * 3.1);
  let cropW = Math.min(fullW, Math.max(bbox.w + 32, span));
  let cropH = Math.min(fullH, Math.max(bbox.h + 32, span));
  cropW = Math.ceil(cropW);
  cropH = Math.ceil(cropH);
  const midX = bbox.x + bbox.w / 2;
  const midY = bbox.y + bbox.h / 2;
  const x = Math.round(Math.max(0, Math.min(fullW - cropW, midX - cropW / 2)));
  const y = Math.round(Math.max(0, Math.min(fullH - cropH, midY - cropH / 2)));
  return { x, y, w: cropW, h: cropH };
}

function dilateMaskedPixels(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8Array {
  const erase = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      erase[i] = rgba[i * 4 + 3] >= 60 ? 1 : 0;
    }
  }

  // Extend the mask by ~3 model pixels. Hair and object borders otherwise
  // remain in the "known" region and get carried into the generated result.
  const next = new Uint8Array(erase.length);
  const radius = 3;
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = 0; dx <= radius; dx++) {
        if (dx < w && erase[yy * w + dx]) count++;
      }
    }
    for (let x = 0; x < w; x++) {
      if (x > 0) {
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          if (x + radius < w && erase[yy * w + x + radius]) count++;
          if (x - radius - 1 >= 0 && erase[yy * w + x - radius - 1]) count--;
        }
      }
      next[y * w + x] = count ? 1 : 0;
    }
  }
  return next;
}

export async function aiSmartErase(
  originalImage: HTMLImageElement,
  selection: HTMLCanvasElement,
  progress?: ProgressCallback,
): Promise<string> {
  const { width: fullW, height: fullH, bbox } = checkSelection(originalImage, selection);
  const crop = makeCrop(fullW, fullH, bbox);
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(crop.w, crop.h));
  const w = Math.max(1, Math.round(crop.w * scale));
  const h = Math.max(1, Math.round(crop.h * scale));
  // Pipeline dynamic dimensions accept any H/W, but multiples of 8 are best
  // for the 512 encoder-decoder and avoid rounding artefacts.
  const modelW = Math.max(32, Math.ceil(w / 8) * 8);
  const modelH = Math.max(32, Math.ceil(h / 8) * 8);

  const inputCanvas = canvas(modelW, modelH);
  const inputCtx = context(inputCanvas);
  inputCtx.drawImage(
    originalImage, crop.x, crop.y, crop.w, crop.h,
    0, 0, modelW, modelH,
  );
  const maskCanvas = canvas(modelW, modelH);
  const maskCtx = context(maskCanvas);
  maskCtx.drawImage(
    selection, crop.x, crop.y, crop.w, crop.h,
    0, 0, modelW, modelH,
  );
  const pixels = inputCtx.getImageData(0, 0, modelW, modelH).data;
  const maskRgba = maskCtx.getImageData(0, 0, modelW, modelH).data;
  const erase = dilateMaskedPixels(maskRgba, modelW, modelH);
  const n = modelW * modelH;
  const rgb = new Uint8Array(n * 3);
  const known = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    rgb[i] = pixels[i * 4];
    rgb[i + n] = pixels[i * 4 + 1];
    rgb[i + n * 2] = pixels[i * 4 + 2];
    known[i] = erase[i] ? 0 : 255; // MI-GAN: black=erase, white=keep
  }

  progress?.('AIモデルを読み込み中…');
  const ort = await import('onnxruntime-web/wasm') as unknown as typeof import('onnxruntime-web');
  ort.env.wasm.numThreads = 1; // iOS WebView does not require COOP/COEP
  ort.env.wasm.proxy = false;
  const base = new URL(import.meta.env.BASE_URL + 'ai/inpaint/', document.baseURI).href;
  ort.env.wasm.wasmPaths = base;
  const modelUrl = base + MODEL;

  // Fetch the model from our own app origin, not Hugging Face/CDNs. The
  // model lives in public/ and is bundled into the signed Capacitor app.
  const response = await fetch(modelUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error('端末内AIモデルを読み込めません。アプリを更新してください。');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== MODEL_BYTES) {
    throw new Error('AIモデルのサイズが不正です。アプリを更新してください。');
  }
  // Verify against pinned SHA-256 on secure runtimes; avoid a second 28MB
  // buffer. Native/WKWebView supports crypto.subtle.
  if (crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hash = Array.from(digest, v => v.toString(16).padStart(2, '0')).join('');
    if (hash !== MODEL_SHA256) throw new Error('AIモデルの検証に失敗しました。');
  }
  progress?.('AIが背景を生成中…');
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'basic',
  });
  let data: Uint8Array;
  try {
    const imageInput = new ort.Tensor('uint8', rgb, [1, 3, modelH, modelW]);
    const maskInput = new ort.Tensor('uint8', known, [1, 1, modelH, modelW]);
    const outputs = await session.run({ image: imageInput, mask: maskInput });
    const result = outputs.result;
    if (!result || result.type !== 'uint8' ||
        result.dims.length !== 4 || result.dims[2] !== modelH ||
        result.dims[3] !== modelW || result.data.length !== n * 3) {
      throw new Error('AIの生成結果が正しくありません。');
    }
    data = new Uint8Array(result.data as Uint8Array);
  } finally {
    // Release the ONNX graph and transient tensors so iPhone RAM is free for
    // the Konva editor after an erase, not held until the next page reload.
    await session.release();
  }

  progress?.('画像を仕上げ中…');
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const resultImage = inputCtx.createImageData(modelW, modelH);
  for (let i = 0; i < n; i++) {
    resultImage.data[i * 4] = data[i];
    resultImage.data[i * 4 + 1] = data[i + n];
    resultImage.data[i * 4 + 2] = data[i + 2 * n];
    resultImage.data[i * 4 + 3] = 255;
  }
  inputCtx.putImageData(resultImage, 0, 0);

  // Reinsert only the requested region. All pixels elsewhere are drawn from
  // the ORIGINAL source, not AI. A tiny feather removes hard cutout seams.
  const patch = canvas(crop.w, crop.h);
  const patchCtx = context(patch);
  patchCtx.imageSmoothingEnabled = true;
  patchCtx.imageSmoothingQuality = 'high';
  patchCtx.drawImage(inputCanvas, 0, 0, crop.w, crop.h);
  patchCtx.globalCompositeOperation = 'destination-in';
  patchCtx.drawImage(selection, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

  const output = canvas(fullW, fullH);
  const outputCtx = context(output);
  outputCtx.drawImage(originalImage, 0, 0);
  outputCtx.drawImage(patch, crop.x, crop.y);
  return output.toDataURL('image/png');
}
