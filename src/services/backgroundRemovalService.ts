/**
 * Background removal service.
 *
 * The editor only ever depends on this abstraction — never on a specific
 * model or vendor. Two engines are supported:
 *
 *  1. `local-ai`   — an in-browser ONNX segmentation model
 *                    (@imgly/background-removal, ISNet). This is the default
 *                    and needs no configuration; model weights are fetched
 *                    once from a CDN and cached by the browser.
 *  2. `remote-api` — any HTTP endpoint that receives the image and returns a
 *                    cut-out PNG. Enabled by setting environment variables, so
 *                    no API credentials ever live in the source tree.
 *
 * QUALITY LEVELS
 * --------------
 * Both engines return a coarse alpha mask: the network runs at a fixed
 * 1024×1024 input, so its mask is a bilinear enlargement of a 1024² prediction.
 * Every result is therefore passed through `alphaRefinement.ts`, which realigns
 * that mask to the full-resolution image's edges. On top of that shared step,
 * the three quality levels differ in ways that genuinely change the output:
 *
 *   Fast  — 8-bit quantised weights, one light refinement pass.
 *   High  — fp16 weights, two refinement passes (default).
 *   Ultra — fp32 weights, three coarse-to-fine refinement passes.
 *
 * Model precision is a real accuracy difference (see the ISNet weights on the
 * CDN: 44 MB quint8 / 88 MB fp16 / 176 MB fp32), but it is not the whole story
 * here — the refinement is what fixes soft, jagged edges and fine hair, and it
 * runs at every level.
 *
 * Models such as `u2net` / `u2net_human_seg` / `isnet-general-use` are rembg
 * (Python) checkpoints. They are not loadable by the in-browser runtime, so
 * they are deliberately not offered rather than faked.
 *
 * Required environment variables for the remote engine (all optional — the
 * local engine is used when they are absent):
 *
 *   VITE_BACKGROUND_REMOVAL_API_URL   e.g. https://api.example.com/remove
 *   VITE_BACKGROUND_REMOVAL_API_KEY   bearer token sent in the Authorization header
 *   VITE_BACKGROUND_REMOVAL_API_FIELD form field name for the image (default: "image")
 *
 * Optional tuning:
 *
 *   VITE_BACKGROUND_REMOVAL_MODEL      force one model precision for every
 *                                      quality level: isnet | isnet_fp16 |
 *                                      isnet_quint8 (or large | medium | small)
 *   VITE_BACKGROUND_REMOVAL_PUBLIC_PATH serve the ONNX weights from your own
 *                                      host instead of the IMG.LY CDN
 */

import type { ProcessingQuality } from '../types';
import { loadImage } from '../utils/image';
import { refineAlphaMask, type RefinementOutcome, type RefinementPass } from './alphaRefinement';

export type { ProcessingQuality };

export interface RemovalProgress {
  message: string;
  /** 0..100 */
  progress: number;
}

export interface RemovalResult {
  /** RGBA PNG of the subject with the (refined) alpha already applied. */
  foreground: Blob;
  /** Greyscale/alpha PNG mask: opaque = foreground, transparent = background. */
  alphaMask: Blob;
  engine: string;
  /** Quality level that produced this cut-out. */
  quality: ProcessingQuality;
  /** Model precision actually used — may differ from the requested one after a fallback. */
  model: string;
  width: number;
  height: number;
  /** True when edge-aware alpha refinement ran. */
  refined: boolean;
  /** Why refinement was skipped, when it was. */
  refinementNote?: string;
}

export class BackgroundRemovalError extends Error {
  readonly userMessage: string;

  constructor(message: string, userMessage = message) {
    super(message);
    this.name = 'BackgroundRemovalError';
    this.userMessage = userMessage;
  }
}

/* ------------------------------------------------------------------ */
/* Quality profiles                                                    */
/* ------------------------------------------------------------------ */

type SegmentationModel = 'isnet' | 'isnet_fp16' | 'isnet_quint8';

interface QualityProfile {
  label: string;
  /** Short user-facing summary of what actually differs. */
  description: string;
  model: SegmentationModel;
  /** Coarse-to-fine guided-filter passes applied to the model's mask. */
  refinement: RefinementPass[];
}

const QUALITY_PROFILES: Record<ProcessingQuality, QualityProfile> = {
  fast: {
    label: 'Fast',
    description: 'Quantised model, one light refinement pass. Quickest.',
    model: 'isnet_quint8',
    refinement: [{ radiusScale: 3, epsilon: 4e-3 }],
  },
  high: {
    label: 'High',
    description: 'Mid-precision model, two-pass edge refinement. Balanced.',
    model: 'isnet_fp16',
    refinement: [
      { radiusScale: 4, epsilon: 1e-3 },
      { radiusScale: 1.5, epsilon: 3e-4 },
    ],
  },
  ultra: {
    label: 'Ultra',
    description: 'Largest model, three coarse-to-fine passes. Best hair and fur.',
    model: 'isnet',
    refinement: [
      { radiusScale: 4, epsilon: 1e-3 },
      { radiusScale: 1, epsilon: 5e-4 },
      { radiusScale: 0.35, epsilon: 2e-4 },
    ],
  },
};

export interface QualityOption {
  value: ProcessingQuality;
  label: string;
  description: string;
}

/** Options for the UI, in increasing order of effort. */
export const QUALITY_OPTIONS: QualityOption[] = (['fast', 'high', 'ultra'] as const).map((value) => ({
  value,
  label: QUALITY_PROFILES[value].label,
  description: QUALITY_PROFILES[value].description,
}));

export const DEFAULT_QUALITY: ProcessingQuality = 'high';

const MODEL_LABELS: Record<SegmentationModel, string> = {
  isnet: 'ISNet fp32',
  isnet_fp16: 'ISNet fp16',
  isnet_quint8: 'ISNet 8-bit',
};

const env = import.meta.env as Record<string, string | undefined>;

const REMOTE_URL = env.VITE_BACKGROUND_REMOVAL_API_URL;
const REMOTE_KEY = env.VITE_BACKGROUND_REMOVAL_API_KEY;
const REMOTE_FIELD = env.VITE_BACKGROUND_REMOVAL_API_FIELD || 'image';
/** Optional: serve the ONNX weights from your own host instead of the CDN. */
const PUBLIC_PATH = env.VITE_BACKGROUND_REMOVAL_PUBLIC_PATH;

/** Optional: pin every quality level to one model precision. */
const FORCED_MODEL = normaliseModel(env.VITE_BACKGROUND_REMOVAL_MODEL);

function normaliseModel(value: string | undefined): SegmentationModel | undefined {
  switch (value) {
    case 'large':
    case 'isnet':
      return 'isnet';
    case 'medium':
    case 'isnet_fp16':
      return 'isnet_fp16';
    case 'small':
    case 'isnet_quint8':
      return 'isnet_quint8';
    default:
      return undefined;
  }
}

/**
 * Model attempt order for a quality level. If the best weights cannot be
 * fetched or the session cannot be created we step down to a smaller model
 * rather than failing the whole operation.
 */
function modelChain(preferred: SegmentationModel): SegmentationModel[] {
  const pinned = FORCED_MODEL;
  if (pinned) return [pinned];
  const order: SegmentationModel[] = ['isnet', 'isnet_fp16', 'isnet_quint8'];
  const start = order.indexOf(preferred);
  return order.slice(start < 0 ? 0 : start);
}

export function profileFor(quality: ProcessingQuality): QualityProfile {
  return QUALITY_PROFILES[quality] ?? QUALITY_PROFILES[DEFAULT_QUALITY];
}

/* ------------------------------------------------------------------ */
/* Canvas helpers                                                      */
/* ------------------------------------------------------------------ */

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new BackgroundRemovalError('Canvas is not available in this browser.');
  return ctx;
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new BackgroundRemovalError('Failed to encode image.'))),
      type,
      quality,
    );
  });
}

async function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    // The image keeps its own decoded copy; revoking is safe after load.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Full-resolution pixels of the uploaded image, used as the refinement guide. */
interface SourcePixels {
  /**
   * Kept as an `ImageData` rather than a bare buffer so the refined result can
   * be pushed back to a canvas without allocating a second full-size copy.
   */
  imageData: ImageData;
  width: number;
  height: number;
}

async function decodeSource(file: Blob): Promise<SourcePixels> {
  const img = await blobToImageElement(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) throw new BackgroundRemovalError('That image could not be decoded.');

  const canvas = createCanvas(width, height);
  const ctx = ctx2d(canvas);
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { imageData, width, height };
}

/** Read the alpha channel of a cut-out, scaled to the source's dimensions. */
async function coarseAlphaFrom(cutout: Blob, width: number, height: number): Promise<Uint8Array> {
  const img = await blobToImageElement(cutout);
  const canvas = createCanvas(width, height);
  const ctx = ctx2d(canvas);
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const alpha = new Uint8Array(width * height);
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = data[p];
  return alpha;
}

/* ------------------------------------------------------------------ */
/* Shared finalisation: refine alpha, then encode outputs               */
/* ------------------------------------------------------------------ */

interface FinalisedOutput {
  foreground: Blob;
  alphaMask: Blob;
  refined: boolean;
  refinementNote?: string;
}

/**
 * Refine the model's mask against the source image and encode both outputs at
 * the source's full resolution.
 *
 * The caller's `ImageData` is rewritten in place — it is a buffer the caller
 * owns and has already used as the refinement guide, and rebuilding it through
 * a second full-size allocation would double peak memory for no benefit.
 */
async function finaliseCutout(
  source: SourcePixels,
  coarse: Uint8Array,
  profile: QualityProfile,
  onProgress: (p: RemovalProgress) => void,
): Promise<FinalisedOutput> {
  const { imageData, width, height } = source;
  const rgba = imageData.data;
  const n = width * height;

  onProgress({ message: 'Refining edges…', progress: 88 });

  let refinement: RefinementOutcome;
  try {
    refinement = await refineAlphaMask(rgba, coarse, width, height, profile.refinement, (fraction) => {
      onProgress({ message: 'Refining edges…', progress: 88 + Math.round(fraction * 10) });
    });
  } catch (err) {
    // Refinement is an improvement, not a requirement: fall back to the raw mask.
    console.error('Alpha refinement failed, using the unrefined mask:', err);
    refinement = {
      alpha: coarse,
      applied: false,
      reason: (err as Error).message,
      passes: 0,
      radii: [],
      peakBytes: 0,
    };
  }

  const alpha = refinement.alpha;

  // Apply the mask, honouring any transparency the source already had.
  for (let i = 0, p = 3; i < n; i++, p += 4) {
    const srcAlpha = rgba[p];
    const value = srcAlpha === 255 ? alpha[i] : Math.round((alpha[i] * srcAlpha) / 255);
    rgba[p] = value;
    alpha[i] = value;
  }

  onProgress({ message: 'Encoding result…', progress: 99 });

  const canvas = createCanvas(width, height);
  const ctx = ctx2d(canvas);

  // subject = original pixels × refined alpha
  ctx.putImageData(imageData, 0, 0);
  const foreground = await canvasToBlob(canvas);

  // mask = white pixels × refined alpha (same buffer and canvas, re-filled)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    rgba[p] = 255;
    rgba[p + 1] = 255;
    rgba[p + 2] = 255;
    rgba[p + 3] = alpha[i];
  }
  ctx.putImageData(imageData, 0, 0);
  const alphaMask = await canvasToBlob(canvas);

  return {
    foreground,
    alphaMask,
    refined: refinement.applied,
    refinementNote: refinement.applied ? undefined : refinement.reason,
  };
}

/* ------------------------------------------------------------------ */
/* Engine context                                                      */
/* ------------------------------------------------------------------ */

interface EngineContext {
  file: File;
  quality: ProcessingQuality;
  onProgress?: (p: RemovalProgress) => void;
}

interface BackgroundRemovalEngine {
  readonly name: string;
  removeBackground(ctx: EngineContext): Promise<RemovalResult>;
}

/* ------------------------------------------------------------------ */
/* Engine: local in-browser AI (ISNet via @imgly/background-removal)    */
/* ------------------------------------------------------------------ */

type RemoveBackgroundFn = typeof import('@imgly/background-removal').removeBackground;

let removeBackgroundFn: RemoveBackgroundFn | null = null;

async function loadSegmentationRuntime(): Promise<RemoveBackgroundFn> {
  if (removeBackgroundFn) return removeBackgroundFn;
  try {
    const mod = await import('@imgly/background-removal');
    removeBackgroundFn = mod.removeBackground;
    return removeBackgroundFn;
  } catch (err) {
    throw new BackgroundRemovalError(
      `Failed to load the segmentation runtime: ${(err as Error).message}`,
      'The AI background remover failed to load. Please check your connection and reload the page.',
    );
  }
}

/**
 * Run the network, stepping down to a smaller model if the preferred weights
 * cannot be loaded (offline first run, CDN hiccup, session creation failure).
 */
async function segment(
  file: File,
  models: SegmentationModel[],
  onProgress: (p: RemovalProgress) => void,
): Promise<{ cutout: Blob; model: SegmentationModel }> {
  const run = await loadSegmentationRuntime();
  let lastError: unknown;

  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[attempt];
    if (attempt > 0) {
      onProgress({
        message: `Retrying with smaller weights (${MODEL_LABELS[model]})…`,
        progress: 6,
      });
    }

    try {
      const cutout = await run(file, {
        model,
        output: { format: 'image/png' },
        // `rescale: true` (the default) makes the model enlarge its mask back to
        // the original image size, so the cut-out keeps full resolution. The
        // enlargement is what the refinement stage then re-aligns to real edges.
        ...(PUBLIC_PATH ? { publicPath: PUBLIC_PATH } : {}),
        progress: (key: string, current: number, total: number) => {
          const ratio = total > 0 ? current / total : 0;
          if (key.startsWith('fetch:')) {
            // Downloading the wasm runtime and the model weights.
            onProgress({
              message: 'Loading AI model… (first run only, then cached)',
              progress: 5 + Math.round(ratio * 65),
            });
          } else {
            onProgress({
              message: 'Segmenting subject…',
              progress: 72 + Math.round(ratio * 14),
            });
          }
        },
      });
      return { cutout, model };
    } catch (err) {
      lastError = err;
      console.warn(`Segmentation with ${MODEL_LABELS[model]} failed:`, err);
    }
  }

  throw new BackgroundRemovalError(
    `Segmentation failed: ${(lastError as Error)?.message ?? 'unknown error'}`,
    'Background removal failed. Please check your connection and try again.',
  );
}

const localAiEngine: BackgroundRemovalEngine = {
  name: 'local-ai',
  async removeBackground({ file, quality, onProgress }) {
    const profile = profileFor(quality);
    const report = (message: string, progress: number) => onProgress?.({ message, progress });

    report('Preparing image…', 2);
    const source = await decodeSource(file);

    report('Loading AI model…', 4);
    const { cutout, model } = await segment(file, modelChain(profile.model), (p) => onProgress?.(p));

    report('Building alpha mask…', 85);
    const coarse = await coarseAlphaFrom(cutout, source.width, source.height);

    const finalised = await finaliseCutout(source, coarse, profile, (p) => onProgress?.(p));

    report('Finalising…', 100);

    return {
      foreground: finalised.foreground,
      alphaMask: finalised.alphaMask,
      engine: 'local-ai',
      quality,
      model: MODEL_LABELS[model],
      width: source.width,
      height: source.height,
      refined: finalised.refined,
      refinementNote: finalised.refinementNote,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Engine: remote API (optional, configured through env vars)           */
/* ------------------------------------------------------------------ */

const remoteApiEngine: BackgroundRemovalEngine = {
  name: 'remote-api',
  async removeBackground({ file, quality, onProgress }) {
    const profile = profileFor(quality);
    const report = (message: string, progress: number) => onProgress?.({ message, progress });

    report('Reading image…', 4);
    const source = await decodeSource(file);

    report('Uploading image…', 10);

    const body = new FormData();
    body.append(REMOTE_FIELD, file, file.name);

    let response: Response;
    try {
      response = await fetch(REMOTE_URL as string, {
        method: 'POST',
        headers: REMOTE_KEY ? { Authorization: `Bearer ${REMOTE_KEY}` } : undefined,
        body,
      });
    } catch (err) {
      throw new BackgroundRemovalError(
        `Background removal request failed: ${(err as Error).message}`,
        'Could not reach the background removal service. Check your connection and try again.',
      );
    }

    if (!response.ok) {
      throw new BackgroundRemovalError(
        `Background removal service responded with ${response.status}`,
        'The background removal service rejected the request. Please try again later.',
      );
    }

    report('Processing result…', 70);
    const cutout = await response.blob();
    const coarse = await coarseAlphaFrom(cutout, source.width, source.height);

    const finalised = await finaliseCutout(source, coarse, profile, (p) => onProgress?.(p));
    report('Finalising…', 100);

    return {
      foreground: finalised.foreground,
      alphaMask: finalised.alphaMask,
      engine: 'remote-api',
      quality,
      model: 'remote service',
      width: source.width,
      height: source.height,
      refined: finalised.refined,
      refinementNote: finalised.refinementNote,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Public entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * True when a remote API is configured via environment variables.
 */
export function hasRemoteEngine(): boolean {
  return Boolean(REMOTE_URL);
}

export function activeEngineName(): string {
  return hasRemoteEngine() ? remoteApiEngine.name : localAiEngine.name;
}

/**
 * Remove the background from an image.
 *
 * Resolves with the cut-out foreground *and* the standalone alpha mask so the
 * editor can keep the original, the AI mask and the user masks as independent
 * layers. Both are produced at the source image's full resolution and the mask
 * has been refined against the source's edges.
 */
export async function removeBackground(
  file: File,
  quality: ProcessingQuality = DEFAULT_QUALITY,
  onProgress?: (p: RemovalProgress) => void,
): Promise<RemovalResult> {
  const engine = hasRemoteEngine() ? remoteApiEngine : localAiEngine;
  return engine.removeBackground({ file, quality, onProgress });
}
