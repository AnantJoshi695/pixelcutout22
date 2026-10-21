import { useEffect, useRef, useState } from 'react';

const DOG_SRC = '/1.png';

interface BeforeAfterProps {
  className?: string;
}

export function BeforeAfter({ className }: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftReady, setLeftReady] = useState(false);
  const [rightReady, setRightReady] = useState(false);
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = DOG_SRC;
    img.onload = () => {
      imgRef.current = img;
      setLeftReady(true);
      setRightReady(true);
    };
    img.onerror = () => {
      setLeftReady(true);
      setRightReady(true);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setSplit(x * 100);
    };
    const handleUp = () => setDragging(false);
    if (dragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging]);

  // Draw the image with a white background (before side — original photo)
  const drawBefore = (canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };

  // Draw the image on a checkerboard background (after side — background removed = transparent)
  const drawAfter = (canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = img.naturalWidth;
    const h = canvas.height = img.naturalHeight;

    // White base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    // Checkerboard pattern
    const size = 20;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    // Draw the subject (full image) on top
    ctx.drawImage(img, 0, 0);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-green-900/20 dark:shadow-green-500/10 border border-frame dark:border-dark-border ${className ?? ''}`}
      style={{ minHeight: '320px' }}
    >
      {/* Left panel — original (white background) */}
      <div className="absolute inset-0">
        {leftReady && imgRef.current ? (
          <canvas
            ref={(el) => {
              if (el && imgRef.current) drawBefore(el, imgRef.current);
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={DOG_SRC}
            alt="Before"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">
          Before
        </div>
      </div>

      {/* Right panel — processed (checkerboard = transparent) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      >
        {rightReady && imgRef.current ? (
          <canvas
            ref={(el) => {
              if (el && imgRef.current) {
                el.width = imgRef.current.naturalWidth;
                el.height = imgRef.current.naturalHeight;
                drawAfter(el, imgRef.current);
              }
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={DOG_SRC}
            alt="After"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute top-3 right-3 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
          After
        </div>
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] cursor-col-resize z-10"
        style={{ left: `${split}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-700">
            <path d="M5 4L2 8l3 4M11 4l3 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
