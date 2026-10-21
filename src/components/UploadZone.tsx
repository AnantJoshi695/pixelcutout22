import { useRef, useState } from 'react';
import { Upload, Camera, Image as ImageIcon, Sparkles } from 'lucide-react';
import { validateImageFile } from '../utils/image';
import { QUALITY_OPTIONS } from '../services/backgroundRemovalService';
import type { ProcessingQuality } from '../types';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  onCameraClick: () => void;
  quality: ProcessingQuality;
  onQualityChange: (quality: ProcessingQuality) => void;
  disabled?: boolean;
}

export function UploadZone({
  onFileSelect,
  onCameraClick,
  quality,
  onQualityChange,
  disabled = false,
}: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeOption = QUALITY_OPTIONS.find((o) => o.value === quality) ?? QUALITY_OPTIONS[1];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const file = e.dataTransfer.files[0];
    if (file) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }
      onFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }
      onFileSelect(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    setError(null);
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const validation = validateImageFile(file);
          if (!validation.valid) {
            setError(validation.error || 'Invalid file');
            return;
          }
          onFileSelect(file);
        }
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer
          ${isDragging
            ? 'border-green-500 bg-green-50/60 dark:bg-dark-elevated scale-[1.02]'
            : 'border-frame hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50/40 dark:hover:bg-dark-elevated'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-600/20">
            <ImageIcon size={28} className="text-white" />
          </div>

          {/* Text */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-ink dark:text-green-50 mb-2">
              Drop your image here
            </h3>
            <p className="text-mute dark:text-muted">
              or choose how to add one
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all shadow-md shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/30 active:scale-[0.97]"
            >
              <Upload size={18} />
              Upload Image
            </button>
            <button
              onClick={onCameraClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all shadow-md shadow-green-700/20 hover:shadow-lg hover:shadow-green-700/30 active:scale-[0.97]"
            >
              <Camera size={18} />
              Take Photo
            </button>
          </div>

          {/* Quality level */}
          <div className="w-full max-w-md">
            <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-green-700 dark:text-muted">
              <Sparkles size={14} />
              Quality
            </div>
            <div
              role="radiogroup"
              aria-label="Processing quality"
              className="grid grid-cols-3 gap-1 rounded-lg bg-green-50 p-1 dark:bg-dark-surface border border-frame"
            >
              {QUALITY_OPTIONS.map((option) => {
                const active = option.value === quality;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQualityChange(option.value);
                    }}
                    title={option.description}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-all disabled:opacity-60 ${
                      active
                        ? 'bg-white text-green-700 shadow-sm dark:bg-green-800 dark:text-green-100'
                        : 'text-mute hover:text-ink dark:text-muted dark:hover:text-green-200'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-muted dark:text-green-500">
              {activeOption.description}
            </p>
          </div>

          {/* Supported formats */}
          <p className="text-sm font-medium text-muted dark:text-green-500">
            JPG • PNG • WEBP • HEIC
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
