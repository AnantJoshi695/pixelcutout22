import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  RotateCcw,
  Eye,
  Expand,
  PanelLeft,
  PanelRight,
  ArrowLeft,
} from 'lucide-react';
import type {
  ImageData as ImageDataType,
  BrushSettings,
  BackgroundSettings,
  EditorTool,
  ExportFormat,
} from '../types';
import { CanvasManager, type Point, type BrushStroke } from '../utils/canvas';
import { useHistory } from '../hooks/useHistory';
import { downloadImage, loadImage } from '../utils/image';
import { EditorToolbar } from './EditorToolbar';
import { BackgroundPanel } from './BackgroundPanel';
import { PreviewModal } from './PreviewModal';

interface ImageEditorProps {
  imageData: ImageDataType;
  onClose: () => void;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 12;

export function ImageEditor({ imageData, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<EditorTool>('select');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 40,
    hardness: 0.8,
    opacity: 1,
  });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [background, setBackground] = useState<BackgroundSettings>({ type: 'transparent' });
  const [format, setFormat] = useState<ExportFormat>('png');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'left' | 'right' | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [imageRect, setImageRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const {
    state: strokes,
    set: setStrokes,
    reset: resetStrokes,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<BrushStroke[]>([]);

  // Refs mirroring state so native listeners / ResizeObserver read fresh values.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const backgroundRef = useRef(background);
  const toolRef = useRef(tool);
  const brushRef = useRef(brushSettings);
  const drawingRef = useRef(false);

  zoomRef.current = zoom;
  panRef.current = pan;
  backgroundRef.current = background;
  toolRef.current = tool;
  brushRef.current = brushSettings;

  /* ---------------------------------------------------------------- */
  /* Manager setup                                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageData.original) return;

    let manager: CanvasManager;
    try {
      manager = new CanvasManager(canvas);
      manager.setImages(imageData.original, imageData.aiMask ?? null);
    } catch (err) {
      console.error('Canvas initialisation failed:', err);
      setError('The editor could not be initialised in this browser.');
      return;
    }
    managerRef.current = manager;

    const applyViewport = (refit: boolean) => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      manager.setViewportSize(rect.width, rect.height, window.devicePixelRatio || 1);

      if (refit && !drawingRef.current) {
        const fit = manager.fitView(40);
        zoomRef.current = fit.zoom;
        panRef.current = fit.pan;
        setZoom(fit.zoom);
        setPan(fit.pan);
        manager.render(fit.zoom, fit.pan, backgroundRef.current);
      } else {
        manager.render(zoomRef.current, panRef.current, backgroundRef.current);
      }
    };

    // Initial fit — the whole image must be visible and centred.
    applyViewport(true);
    setReady(true);

    let raf = 0;
    const observer = new ResizeObserver(() => {
      // Re-fit on resize so the image can never end up cropped, but never
      // disturb an in-progress brush stroke.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => applyViewport(!drawingRef.current));
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      managerRef.current = null;
    };
  }, [imageData]);

  /* ---------------------------------------------------------------- */
  /* Rendering                                                         */
  /* ---------------------------------------------------------------- */

  const renderNow = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.render(zoomRef.current, panRef.current, backgroundRef.current);
  }, []);

  // View / background changes → redraw.
  useEffect(() => {
    if (!ready) return;
    const manager = managerRef.current;
    if (!manager) return;
    manager.setBackground(background, bgImageRef.current);
    manager.render(zoom, pan, background);
    setImageRect(manager.getImageScreenRect());
  }, [ready, zoom, pan, background]);

  // Any committed stroke → replay from scratch (also covers undo / redo).
  useEffect(() => {
    if (!ready) return;
    const manager = managerRef.current;
    if (!manager) return;
    manager.replayStrokes(strokes);
    manager.render(zoomRef.current, panRef.current, backgroundRef.current);
  }, [ready, strokes]);

  // Background image loading for the "Image" background type.
  useEffect(() => {
    if (background.type !== 'image' || !background.image) {
      bgImageRef.current = null;
      renderNow();
      return;
    }
    let cancelled = false;
    loadImage(background.image)
      .then((img) => {
        if (cancelled) return;
        bgImageRef.current = img;
        managerRef.current?.setBackground(background, img);
        renderNow();
      })
      .catch(() => {
        if (!cancelled) setError('That background image could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background]);

  /* ---------------------------------------------------------------- */
  /* Pointer interaction                                               */
  /* ---------------------------------------------------------------- */

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const modeRef = useRef<'none' | 'pan' | 'pinch'>('none');
  const panStart = useRef<{ x: number; y: number; pan: Point }>({ x: 0, y: 0, pan: { x: 0, y: 0 } });
  const pinchStart = useRef<{ distance: number; zoom: number; mid: Point; pan: Point } | null>(null);
  const spaceDown = useRef(false);

  const getManager = () => managerRef.current;

  const zoomAtPoint = useCallback((nextZoomRaw: number, clientX: number, clientY: number) => {
    const manager = getManager();
    const container = containerRef.current;
    if (!manager || !container) return;
    const rect = container.getBoundingClientRect();
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const imgX = (cx - currentPan.x) / currentZoom;
    const imgY = (cy - currentPan.y) / currentZoom;
    const nextPan = { x: cx - imgX * nextZoom, y: cy - imgY * nextZoom };
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;

    container.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      // Begin a pinch — cancel any in-flight stroke.
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: zoomRef.current,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        pan: { ...panRef.current },
      };
      modeRef.current = 'pinch';
      if (drawingRef.current) {
        getManager()?.endStroke();
        drawingRef.current = false;
      }
      return;
    }

    const wantsPan = toolRef.current === 'select' || e.button === 1 || spaceDown.current;
    if (wantsPan) {
      modeRef.current = 'pan';
      panStart.current = { x: e.clientX, y: e.clientY, pan: { ...panRef.current } };
      return;
    }

    const manager = getManager();
    if (!manager) return;
    const point = manager.clientToImage(e.clientX, e.clientY);
    if (!point) return;
    modeRef.current = 'none';
    drawingRef.current = true;
    manager.beginStroke(toolRef.current as BrushStroke['tool'], brushRef.current.size, brushRef.current.hardness, point);
    renderNow();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setCursorVisible(true);
    }

    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (modeRef.current === 'pinch' && pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const start = pinchStart.current;
      if (start.distance > 0) {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * (distance / start.distance)));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const ratio = nextZoom / start.zoom;
        // Keep the pinch midpoint anchored while scaling.
        const nextPan = {
          x: mid.x - (start.mid.x - start.pan.x) * ratio,
          y: mid.y - (start.mid.y - start.pan.y) * ratio,
        };
        zoomRef.current = nextZoom;
        panRef.current = nextPan;
        setZoom(nextZoom);
        setPan(nextPan);
      }
      return;
    }

    if (modeRef.current === 'pan') {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const next = { x: panStart.current.pan.x + dx, y: panStart.current.pan.y + dy };
      panRef.current = next;
      setPan(next);
      return;
    }

    if (drawingRef.current) {
      const manager = getManager();
      const point = manager?.clientToImage(e.clientX, e.clientY);
      if (manager && point) {
        manager.extendStroke(point);
        renderNow();
      }
    }
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    const manager = getManager();
    const stroke = manager?.endStroke() ?? null;
    drawingRef.current = false;
    if (stroke && stroke.points.length > 0) {
      setStrokes([...strokes, stroke]);
      setEditVersion((v) => v + 1);
    } else {
      renderNow();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    containerRef.current?.releasePointerCapture?.(e.pointerId);

    if (pointers.current.size < 2 && modeRef.current === 'pinch') {
      pinchStart.current = null;
      modeRef.current = pointers.current.size === 1 ? 'pan' : 'none';
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()];
        panStart.current = { x: p.x, y: p.y, pan: { ...panRef.current } };
      }
      return;
    }

    if (pointers.current.size === 0) {
      if (modeRef.current === 'pan') modeRef.current = 'none';
      finishStroke();
    }
  };

  const handlePointerLeave = () => setCursorVisible(false);

  /* Wheel zoom (native listener so it can be non-passive). */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint]);

  /* Spacebar temporarily turns any tool into a panning hand. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;

      if (e.code === 'Space') {
        spaceDown.current = true;
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape' && !previewOpen) {
        onClose();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [undo, redo, onClose, previewOpen]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  const handleFit = useCallback(() => {
    const manager = getManager();
    if (!manager) return;
    const fit = manager.fitView(40);
    zoomRef.current = fit.zoom;
    panRef.current = fit.pan;
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, []);

  const handleZoomIn = () => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    zoomAtPoint(zoomRef.current * 1.25, (rect?.left ?? 0) + (rect?.width ?? 0) / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2);
  };

  const handleZoomOut = () => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    zoomAtPoint(zoomRef.current / 1.25, (rect?.left ?? 0) + (rect?.width ?? 0) / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2);
  };

  const handleReset = () => {
    const manager = getManager();
    if (!manager) return;
    manager.clearMasks();
    resetStrokes([]);
    setBackground({ type: 'transparent' });
    bgImageRef.current = null;
    manager.setBackground({ type: 'transparent' }, null);
    manager.render(zoomRef.current, panRef.current, { type: 'transparent' });
    setEditVersion((v) => v + 1);
  };

  const buildExportCanvas = useCallback(
    () =>
      managerRef.current?.buildExportCanvas(backgroundRef.current, {
        flatten: format === 'jpeg',
      }) ?? null,
    [format],
  );

  const handleDownload = () => {
    const canvas = buildExportCanvas();
    if (!canvas) {
      setError('Nothing to export yet.');
      return;
    }
    const base = imageData.fileName.replace(/\.[^/.]+$/, '');
    downloadImage(canvas, `${base}-edited`, format, 0.95);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (rootRef.current) await rootRef.current.requestFullscreen();
    } catch {
      /* ignore */
    }
  };

  const brushRadiusScreen = useMemo(
    () => Math.max(2, (brushSettings.size * zoom) / 2),
    [brushSettings.size, zoom],
  );

  const showBrushCursor = cursorVisible && tool !== 'select' && Boolean(cursor);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center dark:bg-gray-950">
        <p className="max-w-md text-gray-800 dark:text-gray-200">{error}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-white hover:bg-primary-700"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100"
    >
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Back to home"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
            <span className="hidden text-sm font-medium sm:inline">Back to Home</span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel((p) => (p === 'left' ? null : 'left'))}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 lg:hidden"
            title="Tools"
            aria-label="Toggle tools panel"
          >
            <PanelLeft size={20} />
          </button>
          <h2 className="max-w-[38vw] truncate text-base font-bold text-gray-900 dark:text-white sm:max-w-xs">
            {imageData.fileName}
          </h2>
          <span className="hidden text-sm text-gray-500 dark:text-gray-400 sm:inline">
            {imageData.dimensions.width} × {imageData.dimensions.height}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo size={20} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo size={20} />
          </button>

          <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-700" />

          <button
            type="button"
            onClick={handleZoomOut}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={20} />
          </button>
          <span className="min-w-[52px] text-center text-sm text-gray-600 dark:text-gray-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            onClick={handleFit}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Fit to screen"
            aria-label="Fit to screen"
          >
            <Maximize size={20} />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Reset all edits"
            aria-label="Reset all edits"
          >
            <RotateCcw size={20} />
          </button>

          <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-700" />

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-gray-800 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            title="Preview result"
          >
            <Eye size={18} />
            <span className="hidden sm:inline">Preview</span>
          </button>

          <label className="sr-only" htmlFor="export-format">
            Export format
          </label>
          <select
            id="export-format"
            value={format}
            onChange={(e) => {
              const next = e.target.value as ExportFormat;
              setFormat(next);
              setEditVersion((v) => v + 1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            title="Export format"
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPG</option>
            <option value="webp">WEBP</option>
          </select>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-white transition-colors hover:bg-primary-700"
            title="Download"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 sm:block"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label="Toggle fullscreen"
          >
            <Expand size={20} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Close editor"
            aria-label="Close editor"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <div
          className={`
            absolute inset-y-0 left-0 z-30 lg:static lg:z-auto
            ${mobilePanel === 'left' ? 'block' : 'hidden'} lg:block
          `}
        >
          <EditorToolbar
            tool={tool}
            onToolChange={(t) => {
              setTool(t);
              setMobilePanel(null);
            }}
            brushSettings={brushSettings}
            onBrushSettingsChange={setBrushSettings}
          />
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className={`relative flex-1 touch-none select-none overflow-hidden bg-gray-200 dark:bg-gray-800 ${
            tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-none'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          {imageRect && background.type === 'transparent' && (
            <div
              className="checkerboard pointer-events-none absolute"
              style={{
                left: imageRect.left,
                top: imageRect.top,
                width: imageRect.width,
                height: imageRect.height,
              }}
            />
          )}

          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {showBrushCursor && (
            <div
              className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
              style={{
                left: cursor!.x - brushRadiusScreen,
                top: cursor!.y - brushRadiusScreen,
                width: brushRadiusScreen * 2,
                height: brushRadiusScreen * 2,
              }}
            />
          )}
        </div>

        {/* Right panel */}
        <div
          className={`
            absolute inset-y-0 right-0 z-30 lg:static lg:z-auto
            ${mobilePanel === 'right' ? 'block' : 'hidden'} lg:block
          `}
        >
          <BackgroundPanel background={background} onBackgroundChange={setBackground} />
        </div>

        <button
          type="button"
          onClick={() => setMobilePanel((p) => (p === 'right' ? null : 'right'))}
          className="absolute bottom-4 right-4 z-40 rounded-full bg-white p-3 text-gray-700 shadow-lg dark:bg-gray-800 dark:text-gray-100 lg:hidden"
          title="Background options"
          aria-label="Toggle background panel"
        >
          <PanelRight size={20} />
        </button>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        buildCanvas={buildExportCanvas}
        fileName={imageData.fileName}
        format={format}
        version={editVersion}
      />
    </div>
  );
}
