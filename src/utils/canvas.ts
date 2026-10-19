import type { BackgroundSettings } from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface BrushStroke {
  tool: 'remove' | 'recover' | 'eraser';
  /** Diameter in *image* pixels. */
  size: number;
  /** 0 = fully soft, 1 = hard edge. */
  hardness: number;
  points: Point[];
}

/**
 * Maximum edge length used for the interactive (editing) canvases. Images
 * larger than this are painted at a reduced resolution so brush strokes stay
 * responsive; the final export is always rebuilt from the full-resolution
 * source, so no quality is lost in the downloaded file.
 */
const WORK_MAX = 3000;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('Could not acquire a 2D canvas context');
  return ctx;
}

/**
 * Layered compositor for the editor.
 *
 * The subject is always produced from *separate* layers rather than by
 * mutating a single bitmap:
 *
 *     original
 *       ∩ aiMask        → background removed by the model
 *       ∪ (original ∩ recoverMask)   → pixels the user restored
 *       ∖ removeMask    → pixels the user removed
 *
 * Because the user masks are stored independently, Recover always has access
 * to the untouched original pixels and undo/redo can simply replay strokes.
 */
export class CanvasManager {
  private display: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;

  private original: HTMLImageElement | null = null;
  private aiMask: HTMLImageElement | null = null;

  private imageWidth = 0;
  private imageHeight = 0;

  /** Scale factor between image pixels and the interactive working canvas. */
  private workScale = 1;
  private workWidth = 0;
  private workHeight = 0;

  private originalWork: HTMLCanvasElement | null = null;
  private aiMaskWork: HTMLCanvasElement | null = null;

  private removeMask: HTMLCanvasElement | null = null;
  private recoverMask: HTMLCanvasElement | null = null;
  private subjectWork: HTMLCanvasElement | null = null;
  private scratch: HTMLCanvasElement | null = null;

  private background: BackgroundSettings = { type: 'transparent' };
  private backgroundImage: HTMLImageElement | null = null;

  private zoom = 1;
  private pan: Point = { x: 0, y: 0 };

  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  private activeStroke: BrushStroke | null = null;
  /** Stroke operations performed since the mask was last rebuilt. */
  private recoverDirty = false;

  constructor(displayCanvas: HTMLCanvasElement) {
    this.display = displayCanvas;
    this.displayCtx = ctx2d(displayCanvas);
  }

  /* ---------------------------------------------------------------- */
  /* Setup                                                             */
  /* ---------------------------------------------------------------- */

  setImages(original: HTMLImageElement, aiMask: HTMLImageElement | null): void {
    this.original = original;
    this.aiMask = aiMask;

    this.imageWidth = original.naturalWidth || original.width;
    this.imageHeight = original.naturalHeight || original.height;

    this.workScale = Math.min(1, WORK_MAX / Math.max(this.imageWidth, this.imageHeight));
    this.workWidth = Math.max(1, Math.round(this.imageWidth * this.workScale));
    this.workHeight = Math.max(1, Math.round(this.imageHeight * this.workScale));

    this.originalWork = createCanvas(this.workWidth, this.workHeight);
    const owCtx = ctx2d(this.originalWork);
    owCtx.imageSmoothingQuality = 'high';
    owCtx.drawImage(original, 0, 0, this.workWidth, this.workHeight);

    this.aiMaskWork = createCanvas(this.workWidth, this.workHeight);
    if (aiMask) {
      const amCtx = ctx2d(this.aiMaskWork);
      amCtx.imageSmoothingQuality = 'high';
      amCtx.drawImage(aiMask, 0, 0, this.workWidth, this.workHeight);
    }

    this.removeMask = createCanvas(this.workWidth, this.workHeight);
    this.recoverMask = createCanvas(this.workWidth, this.workHeight);
    this.subjectWork = createCanvas(this.workWidth, this.workHeight);
    this.scratch = createCanvas(this.workWidth, this.workHeight);

    this.rebuildSubject();
  }

  getImageSize(): { width: number; height: number } {
    return { width: this.imageWidth, height: this.imageHeight };
  }

  hasImage(): boolean {
    return Boolean(this.original);
  }

  setViewportSize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    this.display.width = Math.max(1, Math.round(cssWidth * dpr));
    this.display.height = Math.max(1, Math.round(cssHeight * dpr));
  }

  getView(): { zoom: number; pan: Point } {
    return { zoom: this.zoom, pan: { ...this.pan } };
  }

  /**
   * Zoom / pan that fits the whole image inside the viewport with padding,
   * preserving aspect ratio and centering the result.
   */
  fitView(padding = 40): { zoom: number; pan: Point } {
    if (!this.cssWidth || !this.cssHeight || !this.imageWidth || !this.imageHeight) {
      return { zoom: 1, pan: { x: 0, y: 0 } };
    }
    const availableW = Math.max(1, this.cssWidth - padding * 2);
    const availableH = Math.max(1, this.cssHeight - padding * 2);
    // Never upscale past 1:1 — small images stay crisp instead of being blurred.
    const zoom = Math.min(availableW / this.imageWidth, availableH / this.imageHeight, 1);
    const pan = {
      x: (this.cssWidth - this.imageWidth * zoom) / 2,
      y: (this.cssHeight - this.imageHeight * zoom) / 2,
    };
    return { zoom, pan };
  }

  /** Convert a client (screen) point to image pixel coordinates. */
  clientToImage(clientX: number, clientY: number): Point | null {
    if (!this.original) return null;
    const rect = this.display.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.pan.x) / this.zoom,
      y: (clientY - rect.top - this.pan.y) / this.zoom,
    };
  }

  /** Screen-space rectangle currently occupied by the image. */
  getImageScreenRect(): { left: number; top: number; width: number; height: number } {
    return {
      left: this.pan.x,
      top: this.pan.y,
      width: this.imageWidth * this.zoom,
      height: this.imageHeight * this.zoom,
    };
  }

  setBackground(settings: BackgroundSettings, image: HTMLImageElement | null = null): void {
    this.background = settings;
    this.backgroundImage = image;
  }

  /* ---------------------------------------------------------------- */
  /* Compositing                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Rebuild the working subject canvas from its layers. Cheap enough to run
   * on every committed edit; the underlying ops are GPU-accelerated canvas
   * blends rather than per-pixel JavaScript.
   */
  private rebuildSubject(): void {
    if (!this.originalWork || !this.subjectWork || !this.removeMask || !this.recoverMask || !this.scratch) {
      return;
    }

    const w = this.workWidth;
    const h = this.workHeight;
    const s = ctx2d(this.subjectWork);

    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, w, h);
    s.drawImage(this.originalWork, 0, 0);

    if (this.aiMaskWork) {
      s.globalCompositeOperation = 'destination-in';
      s.drawImage(this.aiMaskWork, 0, 0);
    }

    s.globalCompositeOperation = 'source-over';
    this.drawRecoverLayer(s, w, h);
    this.cutRemoveMask(s, w, h);
    s.globalCompositeOperation = 'source-over';
    this.recoverDirty = false;
  }

  /** Restore original pixels wherever the recover mask has been painted. */
  private drawRecoverLayer(target: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.originalWork || !this.recoverMask || !this.scratch) return;

    const t = ctx2d(this.scratch);
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, w, h);
    t.drawImage(this.originalWork, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(this.recoverMask, 0, 0);
    t.globalCompositeOperation = 'source-over';

    target.globalCompositeOperation = 'source-over';
    target.drawImage(this.scratch, 0, 0);
  }

  /** Punch transparent holes wherever the remove mask has been painted. */
  private cutRemoveMask(target: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.removeMask) return;
    target.globalCompositeOperation = 'destination-out';
    target.drawImage(this.removeMask, 0, 0, w, h);
    target.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                         */
  /* ---------------------------------------------------------------- */

  render(zoom: number, pan: Point, background?: BackgroundSettings): void {
    if (background) this.background = background;

    this.zoom = zoom;
    this.pan = pan;

    const ctx = this.displayCtx;
    const dpr = this.dpr;
    const cssW = this.cssWidth;
    const cssH = this.cssHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (!this.original || !this.subjectWork) return;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    this.drawBackground(ctx, this.imageWidth, this.imageHeight);

    ctx.imageSmoothingEnabled = zoom < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.subjectWork, 0, 0, this.imageWidth, this.imageHeight);

    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const bg = this.background;

    switch (bg.type) {
      case 'solid':
        ctx.fillStyle = bg.color || '#ffffff';
        ctx.fillRect(0, 0, w, h);
        break;

      case 'gradient': {
        const colors = bg.gradient?.colors?.length ? bg.gradient.colors : ['#ffffff', '#e5e7eb'];
        const gradient =
          bg.gradient?.type === 'radial'
            ? ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2)
            : ctx.createLinearGradient(0, 0, w, h);
        colors.forEach((color, i) => {
          gradient.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), color);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case 'image':
        if (this.backgroundImage) {
          ctx.drawImage(this.backgroundImage, 0, 0, w, h);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        break;

      case 'blur':
        if (this.original) {
          ctx.save();
          ctx.filter = `blur(${Math.max(1, bg.blurAmount ?? 20)}px)`;
          ctx.drawImage(this.original, 0, 0, w, h);
          ctx.restore();
        }
        break;

      case 'transparent':
      default:
        // Nothing to draw — CSS checkerboard shows through.
        break;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Brushing                                                          */
  /* ---------------------------------------------------------------- */

  private paintDabs(
    ctx: CanvasRenderingContext2D,
    composite: GlobalCompositeOperation,
    size: number,
    hardness: number,
    from: Point,
    to: Point,
  ): void {
    const radius = Math.max(0.5, (size * this.workScale) / 2);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) * this.workScale;

    const spacing = Math.max(1, radius * 0.4);
    const steps = Math.max(1, Math.min(400, Math.ceil(distance / spacing)));

    ctx.save();
    ctx.globalCompositeOperation = composite;

    for (let i = 1; i <= steps; i++) {
      const t = steps === 1 ? 1 : i / steps;
      const x = (from.x + dx * t) * this.workScale;
      const y = (from.y + dy * t) * this.workScale;

      if (hardness >= 0.95) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Inner solid core + soft falloff keeps repeated dabs from compounding
        // into a hard edge along the stroke.
        const inner = Math.max(0, radius * hardness);
        const gradient = ctx.createRadialGradient(x, y, inner, x, y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private paintSegment(stroke: BrushStroke, from: Point, to: Point): void {
    if (!this.removeMask || !this.recoverMask) return;

    if (stroke.tool === 'remove') {
      // Remove wins over a previous recover in the same area.
      this.paintDabs(ctx2d(this.recoverMask), 'destination-out', stroke.size, stroke.hardness, from, to);
      this.paintDabs(ctx2d(this.removeMask), 'source-over', stroke.size, stroke.hardness, from, to);
      if (this.subjectWork) {
        this.paintDabs(ctx2d(this.subjectWork), 'destination-out', stroke.size, stroke.hardness, from, to);
      }
    } else if (stroke.tool === 'recover') {
      this.paintDabs(ctx2d(this.removeMask), 'destination-out', stroke.size, stroke.hardness, from, to);
      this.paintDabs(ctx2d(this.recoverMask), 'source-over', stroke.size, stroke.hardness, from, to);
      this.recoverDirty = true;
      this.rebuildSubject();
    } else {
      // Eraser: drop the user's strokes, returning to the AI result.
      this.paintDabs(ctx2d(this.removeMask), 'destination-out', stroke.size, stroke.hardness, from, to);
      this.paintDabs(ctx2d(this.recoverMask), 'destination-out', stroke.size, stroke.hardness, from, to);
      this.recoverDirty = true;
      this.rebuildSubject();
    }
  }

  beginStroke(tool: BrushStroke['tool'], size: number, hardness: number, point: Point): void {
    this.activeStroke = { tool, size, hardness, points: [point] };
    // A single click should paint a dot.
    this.paintSegment(this.activeStroke, point, point);
  }

  extendStroke(point: Point): void {
    if (!this.activeStroke) return;
    const points = this.activeStroke.points;
    const last = points[points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.75) return;
    points.push(point);
    this.paintSegment(this.activeStroke, last ?? point, point);
  }

  endStroke(): BrushStroke | null {
    const stroke = this.activeStroke;
    this.activeStroke = null;
    if (stroke && this.recoverDirty) {
      this.rebuildSubject();
    }
    return stroke;
  }

  clearMasks(): void {
    if (this.removeMask) ctx2d(this.removeMask).clearRect(0, 0, this.workWidth, this.workHeight);
    if (this.recoverMask) ctx2d(this.recoverMask).clearRect(0, 0, this.workWidth, this.workHeight);
    this.activeStroke = null;
    this.rebuildSubject();
  }

  /** Re-apply a set of strokes from scratch (used by undo / redo). */
  replayStrokes(strokes: BrushStroke[]): void {
    if (!this.removeMask || !this.recoverMask) return;
    ctx2d(this.removeMask).clearRect(0, 0, this.workWidth, this.workHeight);
    ctx2d(this.recoverMask).clearRect(0, 0, this.workWidth, this.workHeight);
    this.activeStroke = null;

    for (const stroke of strokes) {
      const pts = stroke.points;
      if (pts.length === 0) continue;
      if (pts.length === 1) {
        this.paintSegment(stroke, pts[0], pts[0]);
      } else {
        for (let i = 1; i < pts.length; i++) {
          this.paintSegment(stroke, pts[i - 1], pts[i]);
        }
      }
    }

    // Incremental remove-only ops above keep the subject in sync, but a full
    // rebuild guarantees a clean result after a replay.
    this.rebuildSubject();
  }

  /* ---------------------------------------------------------------- */
  /* Export                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Build a full-resolution composite of the current edit at the original
   * image size (not the on-screen zoom level).
   */
  buildExportCanvas(
    background: BackgroundSettings,
    opts: { flatten?: boolean; maxSize?: number } = {},
  ): HTMLCanvasElement | null {
    if (!this.original || !this.removeMask || !this.recoverMask) return null;

    let width = this.imageWidth;
    let height = this.imageHeight;
    const maxSize = opts.maxSize ?? 0;
    if (maxSize > 0 && Math.max(width, height) > maxSize) {
      const scale = maxSize / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const out = createCanvas(width, height);
    const ctx = ctx2d(out);
    ctx.imageSmoothingQuality = 'high';

    // 1. Background (flattened onto white for formats without an alpha channel)
    this.drawBackgroundInto(ctx, width, height, background, Boolean(opts.flatten));

    // 2. Subject, composed from the full-resolution layers.
    const subject = createCanvas(width, height);
    const s = ctx2d(subject);
    s.imageSmoothingQuality = 'high';

    s.globalCompositeOperation = 'source-over';
    s.drawImage(this.original, 0, 0, width, height);

    if (this.aiMask) {
      s.globalCompositeOperation = 'destination-in';
      s.drawImage(this.aiMask, 0, 0, width, height);
    }

    const recovered = createCanvas(width, height);
    const r = ctx2d(recovered);
    r.imageSmoothingQuality = 'high';
    r.drawImage(this.original, 0, 0, width, height);
    r.globalCompositeOperation = 'destination-in';
    r.drawImage(this.recoverMask, 0, 0, width, height);
    s.globalCompositeOperation = 'source-over';
    s.drawImage(recovered, 0, 0);

    s.globalCompositeOperation = 'destination-out';
    s.drawImage(this.removeMask, 0, 0, width, height);
    s.globalCompositeOperation = 'source-over';

    ctx.drawImage(subject, 0, 0);

    return out;
  }

  private drawBackgroundInto(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bg: BackgroundSettings,
    flatten: boolean,
  ): void {
    if (flatten) {
      // Opaque target (e.g. JPEG) or a fully transparent background: paint
      // white behind so transparent pixels do not turn black on export.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }

    const previous = this.background;
    const previousImage = this.backgroundImage;
    this.background = bg;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBackground(ctx, w, h);
    ctx.restore();

    this.background = previous;
    this.backgroundImage = previousImage;
  }
}

