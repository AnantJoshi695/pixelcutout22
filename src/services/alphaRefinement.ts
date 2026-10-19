/**
 * Edge-aware alpha-mask refinement.
 *
 * WHY THIS EXISTS
 * ---------------
 * The segmentation network always runs on a fixed 1024×1024 input, so the mask
 * it produces is bilinearly enlarged to the full image size before it reaches
 * us. That enlargement is the dominant reason cut-outs look soft, jagged and
 * fuzzy around hair: the mask carries no detail beyond what fits in 1024×1024.
 *
 * The photograph itself *does* contain that detail. This module transfers the
 * edge structure of the full-resolution image into the alpha channel with a
 * guided filter (He, Sun & Tang — "Guided Image Filtering", ECCV 2010), the
 * standard refinement step in production matting pipelines.
 *
 * Why the guided filter is the right tool here:
 *   - it is edge-aware: alpha is sharpened where the image has an edge, and flat
 *     regions are left alone;
 *   - it preserves the local mean, so it neither erodes nor dilates the subject;
 *   - it never thresholds: partial coverage (hair, fur, motion blur, glass)
 *     stays partial;
 *   - it is O(N) per pass regardless of radius, so it runs at full resolution.
 *
 * Deliberately NOT done here:
 *   - no unsharp mask / sharpen filter (that would fake detail, not recover it);
 *   - no global levels adjustment or thresholding of the mask to binary;
 *   - no arbitrary dilation/erosion (those change the subject's silhouette).
 *
 * The mask's overall shape therefore remains the model's prediction; only its
 * alignment to real image edges is improved.
 *
 * LIMITATION
 * ----------
 * This re-aligns an edge the model has *already* placed; it does not invent
 * coverage the model missed. A feature narrower than the guided filter's window
 * — a 3px strand against a 17px window at 2048px — is averaged by the filter
 * rather than concentrated, so its alpha is preserved but not recovered:
 * measured in `_e2e/refine-verify.mjs` as 0.263 -> 0.227 against a true 0.440.
 * Recovering that needs alpha matting (solving for a per-pixel foreground and
 * background colour), which is a different algorithm and deliberately not
 * attempted here.
 */

/** One guided-filter pass: a window radius and a regularisation strength. */
export interface RefinementPass {
  /**
   * Window radius as a multiple of the model's blur width — see `blurWidthFor`.
   * Expressing it as a ratio rather than a pixel count is what makes the same
   * profile work on a 1200px photo and a 6000px one: the coarse mask's soft
   * ramp is always about `longestEdge / 1024` pixels wide, so the filter window
   * has to be a multiple of *that*, not a fixed number of pixels.
   */
  radiusScale: number;
  /**
   * Regularisation on a 0..1 intensity scale. Larger keeps more of the coarse
   * mask (safer, softer); smaller trusts subtle image structure more (crisper
   * hair/fur, but more sensitive to sensor noise). This is the main trade-off.
   */
  epsilon: number;
}

export interface RefinementOutcome {
  /** Refined alpha, 0..255, same dimensions as the input. */
  alpha: Uint8Array;
  /** False when the refinement was skipped; `alpha` is then the coarse mask. */
  applied: boolean;
  /** Why the refinement was skipped. */
  reason?: string;
  /** Passes actually run. */
  passes: number;
  /** Resolved window radii in pixels, one per pass. */
  radii: number[];
  /** Approximate peak transient allocation, in bytes. */
  peakBytes: number;
}

/**
 * Soft-ramp width of the model's mask, in pixels.
 *
 * The network always runs at 1024×1024, so its mask is enlarged by roughly
 * `longestEdge / 1024` in each direction; the bilinear enlargement spreads each
 * model edge over about that many pixels. Clamped so pathological aspect ratios
 * cannot produce a nonsensical window.
 */
export function blurWidthFor(width: number, height: number): number {
  const longest = Math.max(width, height);
  return Math.min(8, Math.max(1, longest / 1024));
}

/** Upper bound on a resolved radius, so a huge photo cannot blow up the window. */
const MAX_RADIUS = 64;

/**
 * Half-width of the "unknown" band, in pixels, around the coarse mask's
 * boundary. Inside this band the mask is re-aligned to the image; outside it the
 * model's confident 0/1 decision is kept verbatim.
 *
 * This confines the refinement to the boundary so it cannot damage areas the
 * model already got right. Without it, the guided filter's `a·I + b` fit also
 * applies where the image has texture but the mask does not — grain in a flat
 * background, an internal edge inside the subject — and quietly pulls alpha away
 * from 0 or 1.
 *
 * Note that this is a guard against *damage*, not a claim that refinement is
 * unnecessary at native resolution: measured in `_e2e/refine-native.mjs`, a
 * realistically soft or slightly misaligned 1:1 mask still improves 24-69% at
 * 1024px, so the stage runs at every size. Only a mask that is already at the
 * theoretical optimum (which no real model produces) does not benefit.
 */
function bandRadiusFor(width: number, height: number): number {
  return Math.max(2, Math.round(blurWidthFor(width, height)));
}

/**
 * Slope of the band's soft edge, applied to the uncertainty measure
 * `2·min(m, 1-m)` of the locally-averaged mask so the band reaches full strength
 * in the middle of the boundary and fades out over the band rather than stopping
 * at a hard ring.
 */
const WEIGHT_GAIN = 2;

/**
 * Coarse alpha, after local averaging, at or below this (and at or above
 * `1 - WEIGHT_FLOOR`) counts as a confident decision and is left untouched.
 *
 * The band is keyed on the coarse mask's *values*, deliberately not on a
 * binarisation of them. Binarising first — the obvious trimap construction —
 * classifies a wispy strand the model rendered at 0.26 as background, which
 * freezes exactly the fine features this stage exists to recover, and makes the
 * weighting jump discontinuously mid-feature at alpha 0.5, so one segment of a
 * strand is sharpened while the next is left soft. Measured on the synthetic
 * strand in `_e2e/refine-verify.mjs`, the hard threshold gave that strand
 * literally zero change.
 *
 * The value itself is from the sweep in `_e2e/refine-sweep.mjs`. Edge accuracy
 * is flat across 0.1-0.2, but raising it measurably reduces two harms: the
 * guided filter erodes a feature *thinner than its window* (a 3px strand came
 * back 0.220 at 0.1 vs 0.227 at 0.2, against a coarse 0.263), and it disturbs an
 * already-exact mask (edge MAE on an ideal 1:1 mask 0.0136 vs 0.0130).
 */
const WEIGHT_FLOOR = 0.2;

export function resolveRadii(
  passes: RefinementPass[],
  width: number,
  height: number,
): number[] {
  const blurWidth = blurWidthFor(width, height);
  return passes.map((pass) =>
    Math.min(MAX_RADIUS, Math.max(1, Math.round(pass.radiusScale * blurWidth))),
  );
}

/**
 * Images larger than this are left unrefined rather than risk the tab being
 * killed by the browser. The app already refuses uploads above 60 MP, so in
 * practice this only guards against a future change to that limit.
 */
export const MAX_REFINE_PIXELS = 60_000_000;

/**
 * Per-band working-set target, in pixels. The guided filter is run over
 * horizontal bands so peak memory stays bounded no matter how large the photo
 * is — a 4000×3000 photo would otherwise need ~300 MB of scratch buffers.
 */
const TARGET_BAND_PIXELS = 2_000_000;

export function canRefine(width: number, height: number): boolean {
  const n = width * height;
  return n > 0 && n <= MAX_REFINE_PIXELS;
}

/* ------------------------------------------------------------------ */
/* Separable box filter                                                */
/* ------------------------------------------------------------------ */

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Box filter with a square window of radius `r`, O(1) per pixel.
 *
 * `src`, `dst` and `mid` must be distinct arrays of length `w*h`; `line` must
 * hold at least `max(w, h)` floats and `acc` at least `w`. Edges are handled by
 * replicating the border pixel.
 */
export function boxFilter(
  src: Float32Array,
  dst: Float32Array,
  mid: Float32Array,
  w: number,
  h: number,
  r: number,
  line: Float32Array,
  acc: Float32Array,
): void {
  const norm = 1 / (2 * r + 1);
  const wm1 = w - 1;
  const hm1 = h - 1;

  // Horizontal pass: src -> dst, one row at a time.
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[row + clampInt(k, 0, wm1)];
    for (let x = 0; x < w; x++) {
      line[x] = sum * norm;
      sum += src[row + clampInt(x + r + 1, 0, wm1)] - src[row + clampInt(x - r, 0, wm1)];
    }
    dst.set(line.subarray(0, w), row);
  }

  // Vertical pass: dst -> mid, accumulating one running sum per column so the
  // inner loop stays row-major and cache friendly.
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += dst[clampInt(k, 0, hm1) * w + x];
    acc[x] = sum;
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) line[x] = acc[x] * norm;
    mid.set(line.subarray(0, w), row);

    const addRow = clampInt(y + r + 1, 0, hm1) * w;
    const subRow = clampInt(y - r, 0, hm1) * w;
    if (addRow !== subRow) {
      for (let x = 0; x < w; x++) acc[x] += dst[addRow + x] - dst[subRow + x];
    }
  }

  dst.set(mid);
}

/* ------------------------------------------------------------------ */
/* Guided filter                                                       */
/* ------------------------------------------------------------------ */

/** Band-sized scratch buffers, allocated once and reused for every band. */
interface BandBuffers {
  guide: Float32Array;
  /** The model's mask for this band — never modified, used for the final blend. */
  coarse: Float32Array;
  /** Working copy the passes run on. */
  alpha: Float32Array;
  /** Per-pixel blend weight: 1 inside the unknown band, 0 in confident areas. */
  weight: Float32Array;
  mI: Float32Array;
  mP: Float32Array;
  t1: Float32Array;
  t2: Float32Array;
  t3: Float32Array;
  mid: Float32Array;
  line: Float32Array;
  acc: Float32Array;
}

function allocateBandBuffers(bw: number, bh: number): BandBuffers {
  const n = bw * bh;
  return {
    guide: new Float32Array(n),
    coarse: new Float32Array(n),
    alpha: new Float32Array(n),
    weight: new Float32Array(n),
    mI: new Float32Array(n),
    mP: new Float32Array(n),
    t1: new Float32Array(n),
    t2: new Float32Array(n),
    t3: new Float32Array(n),
    mid: new Float32Array(n),
    line: new Float32Array(Math.max(bw, bh)),
    acc: new Float32Array(bw),
  };
}

/**
 * A single guided-filter pass over one band, in place on `b.alpha`.
 *
 * For a guide I and input p with radius r and regularisation eps:
 *
 *   a = cov_r(I, p) / (var_r(I) + eps)
 *   b = mean_r(p) - a · mean_r(I)
 *   q = mean_r(a) · I + mean_r(b)
 *
 * Where the guide is flat (var -> 0) this reduces to q = mean(p), so nothing
 * changes; where the guide has an edge, a -> 1 and b -> 0, so q follows the
 * image and the mask edge snaps to the real edge.
 */
function guidedFilterPass(b: BandBuffers, bw: number, bh: number, r: number, eps: number): void {
  const { guide, alpha, mI, mP, t1, t2, t3, mid, line, acc } = b;
  const count = bw * bh;

  boxFilter(guide, mI, mid, bw, bh, r, line, acc);
  boxFilter(alpha, mP, mid, bw, bh, r, line, acc);

  // Variance of the guide and covariance with the mask.
  for (let i = 0; i < count; i++) t1[i] = guide[i] * guide[i];
  boxFilter(t1, t2, mid, bw, bh, r, line, acc); // t2 = mean(I²)
  for (let i = 0; i < count; i++) t1[i] = guide[i] * alpha[i];
  boxFilter(t1, t3, mid, bw, bh, r, line, acc); // t3 = mean(I·p)

  for (let i = 0; i < count; i++) {
    const meanI = mI[i];
    const meanP = mP[i];
    const varI = t2[i] - meanI * meanI;
    const covIp = t3[i] - meanI * meanP;
    const a = covIp / (varI + eps);
    t2[i] = a;
    t3[i] = meanP - a * meanI;
  }

  boxFilter(t2, mI, mid, bw, bh, r, line, acc); // mI = mean(a)
  boxFilter(t3, mP, mid, bw, bh, r, line, acc); // mP = mean(b)

  for (let i = 0; i < count; i++) {
    const q = mI[i] * guide[i] + mP[i];
    alpha[i] = q < 0 ? 0 : q > 1 ? 1 : q;
  }
}

/**
 * Build the per-pixel blend weight for a band: 1 along the mask boundary, 0 in
 * regions where the model was confident. `t2` and `mid` are used as scratch.
 */
function buildBandWeight(b: BandBuffers, bw: number, bh: number, bandRadius: number): void {
  const count = bw * bh;
  const { coarse, weight, t2, mid, line, acc } = b;

  // Average the mask itself, not a binarised copy of it — see WEIGHT_FLOOR.
  // The averaging is what gives the band spatial extent, so the guided filter's
  // window has somewhere to land instead of a one-pixel ring.
  boxFilter(coarse, t2, mid, bw, bh, bandRadius, line, acc);

  for (let i = 0; i < count; i++) {
    const mean = t2[i];
    const uncertainty = 2 * Math.min(mean, 1 - mean);
    const w = ((uncertainty - WEIGHT_FLOOR) / (1 - WEIGHT_FLOOR)) * WEIGHT_GAIN;
    weight[i] = w < 0 ? 0 : w > 1 ? 1 : w;
  }
}

/* ------------------------------------------------------------------ */
/* Driver                                                              */
/* ------------------------------------------------------------------ */

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Refine a coarse alpha mask against the full-resolution image.
 *
 * `rgba` is the source image (RGBA, length `width*height*4`) and is only read —
 * callers stay free to keep using it. `coarse` holds the model's alpha, one
 * byte per pixel; it is not mutated.
 *
 * Passes are applied coarse-to-fine inside each band: a large radius first to
 * pull whole soft edges onto the image's structure, then progressively smaller
 * radii to tighten hair-level detail. Bands are processed with a halo of the
 * largest radius, which makes the banded result identical to a whole-image run.
 */
export async function refineAlphaMask(
  rgba: Uint8ClampedArray,
  coarse: Uint8Array,
  width: number,
  height: number,
  passes: RefinementPass[],
  onProgress?: (fraction: number) => void,
): Promise<RefinementOutcome> {
  const n = width * height;

  if (passes.length === 0) {
    return {
      alpha: coarse,
      applied: false,
      reason: 'no refinement passes requested',
      passes: 0,
      radii: [],
      peakBytes: 0,
    };
  }
  if (!canRefine(width, height)) {
    return {
      alpha: coarse,
      applied: false,
      reason: `image has ${(n / 1_000_000).toFixed(1)}MP, above the ${Math.round(MAX_REFINE_PIXELS / 1_000_000)}MP refinement limit`,
      passes: 0,
      radii: [],
      peakBytes: 0,
    };
  }

  const radii = resolveRadii(passes, width, height);
  const bandRadius = bandRadiusFor(width, height);
  // The halo must cover the widest guided-filter window *and* the band-weight
  // window, so a band's output is identical to a whole-image computation.
  const halo = radii.reduce((max, r) => Math.max(max, r), Math.max(1, bandRadius));
  const bandHeight = clampInt(Math.floor(TARGET_BAND_PIXELS / width) - 2 * halo, 64, 2048);
  const allocHeight = bandHeight + 2 * halo;
  const band = allocateBandBuffers(width, allocHeight);
  const peakBytes = width * allocHeight * 4 * 12 + n * 2 + width * 12;

  // Luminance is the guide the alpha is aligned to.
  const guideU8 = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    // 0.299/0.587/0.114 scaled by 256 (coefficients sum to 256).
    guideU8[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
  }

  const alphaU8 = new Uint8Array(coarse);
  const bandCount = Math.ceil(height / bandHeight);

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex++) {
    const y0 = bandIndex * bandHeight;
    const rows = Math.min(bandHeight, height - y0);
    const activeHeight = rows + 2 * halo;

    // Fill the band (+ halo), replicating the first/last image row.
    for (let ry = 0; ry < activeHeight; ry++) {
      const srcRow = clampInt(y0 - halo + ry, 0, height - 1) * width;
      const dstRow = ry * width;
      for (let x = 0; x < width; x++) {
        const s = srcRow + x;
        band.guide[dstRow + x] = guideU8[s] * (1 / 255);
        const c = alphaU8[s] * (1 / 255);
        band.coarse[dstRow + x] = c;
        band.alpha[dstRow + x] = c;
      }
    }

    buildBandWeight(band, width, activeHeight, bandRadius);

    for (let i = 0; i < passes.length; i++) {
      guidedFilterPass(band, width, activeHeight, radii[i], passes[i].epsilon);
    }

    // Re-align only inside the unknown band; keep the model's confident
    // decisions everywhere else.
    for (let ry = 0; ry < rows; ry++) {
      const dstRow = (y0 + ry) * width;
      const srcRow = (ry + halo) * width;
      for (let x = 0; x < width; x++) {
        const i = srcRow + x;
        const w = band.weight[i];
        const value = w === 0 ? band.coarse[i] : band.coarse[i] + w * (band.alpha[i] - band.coarse[i]);
        const v = value < 0 ? 0 : value > 1 ? 1 : value;
        alphaU8[dstRow + x] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
      }
    }

    onProgress?.((bandIndex + 1) / bandCount);
    // Keep the tab responsive and let the progress overlay repaint.
    await yieldToBrowser();
  }

  return { alpha: alphaU8, applied: true, passes: passes.length, radii, peakBytes };
}
