import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, Expand, Download, RotateCw } from 'lucide-react';
import { downloadImage } from '../utils/image';
import type { ExportFormat } from '../types';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  /** Builds a fresh, full-resolution composite from the current editor state. */
  buildCanvas: () => HTMLCanvasElement | null;
  fileName: string;
  format: ExportFormat;
  /** Bump to force the preview to rebuild (e.g. after an edit). */
  version: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

export function PreviewModal({
  open,
  onClose,
  buildCanvas,
  fileName,
  format,
  version,
}: PreviewModalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const applyCanvasSize = useCallback((nextScale: number, deg: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const swap = deg % 180 !== 0;
    const w = (swap ? canvas.height : canvas.width) * nextScale;
    const h = (swap ? canvas.width : canvas.height) * nextScale;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.display = 'block';
  }, []);

  const computeFit = useCallback(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return 1;
    const swap = rotation % 180 !== 0;
    const cw = swap ? canvas.height : canvas.width;
    const ch = swap ? canvas.width : canvas.height;
    if (!cw || !ch) return 1;
    const availableW = Math.max(32, host.clientWidth - 48);
    const availableH = Math.max(32, host.clientHeight - 48);
    return Math.min(availableW / cw, availableH / ch, 1) || 1;
  }, [rotation]);

  const fitToScreen = useCallback(() => {
    const next = computeFit();
    setScale(next);
    applyCanvasSize(next, rotation);
  }, [applyCanvasSize, computeFit, rotation]);

  // Rebuild the preview image whenever it is opened or the edit changes.
  useLayoutEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;

    const canvas = buildCanvas();
    canvasRef.current = canvas;
    stage.replaceChildren();

    if (canvas) {
      canvas.style.maxWidth = 'none';
      stage.appendChild(canvas);
    }

    // Fit once the canvas is in the DOM so client sizes are measurable.
    const id = window.setTimeout(() => {
      const next = computeFit();
      setScale(next);
      applyCanvasSize(next, rotation);
    }, 0);
    return () => window.clearTimeout(id);
    // `buildCanvas` is a fresh closure each render; `version` signals changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, version]);

  useEffect(() => {
    applyCanvasSize(scale, rotation);
  }, [scale, rotation, applyCanvasSize]);

  useEffect(() => {
    if (!open) return;
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = rotation % 360 !== 0 ? rotateCanvas(canvas, rotation) : canvas;
    const base = fileName.replace(/\.[^/.]+$/, '');
    downloadImage(out, `${base}-edited`, format, 0.95);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (modalRef.current) {
        await modalRef.current.requestFullscreen();
      }
    } catch {
      /* Fullscreen may be blocked by the browser; ignore. */
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Preview"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative flex h-full w-full flex-col bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            Preview
            <span className="hidden text-xs font-normal text-gray-500 dark:text-gray-400 sm:inline">
              final result
            </span>
          </h2>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.25))}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={20} />
            </button>
            <span className="min-w-[56px] text-center text-sm text-gray-600 dark:text-gray-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.25))}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={20} />
            </button>
            <button
              type="button"
              onClick={fitToScreen}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              title="Fit to screen"
              aria-label="Fit to screen"
            >
              <Maximize size={20} />
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              title="Rotate 90°"
              aria-label="Rotate"
            >
              <RotateCw size={20} />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label="Toggle fullscreen"
            >
              <Expand size={20} />
            </button>

            <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-700" />

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              title="Close"
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview surface */}
        <div ref={hostRef} className="relative flex-1 overflow-auto">
          <div className="flex min-h-full min-w-full items-center justify-center p-4">
            <div
              ref={stageRef}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 150ms ease-out',
              }}
            >
              {/* The composited canvas is appended here imperatively. */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function rotateCanvas(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const rad = (degrees * Math.PI) / 180;
  const out = document.createElement('canvas');
  const swap = degrees % 180 !== 0;
  out.width = swap ? source.height : source.width;
  out.height = swap ? source.width : source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}
