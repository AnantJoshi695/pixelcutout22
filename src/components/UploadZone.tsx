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
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-105'
            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600'
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
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <ImageIcon size={36} className="text-white" />
          </div>

          {/* Text */}
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Drop your image here
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              or choose how to add one
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-lg shadow-primary-500/30"
            >
              <Upload size={20} />
              Upload Image
            </button>
            <button
              onClick={onCameraClick}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-lg shadow-purple-500/30"
            >
              <Camera size={20} />
              Take Photo
            </button>
          </div>

          {/* Quality level */}
          <div className="w-full max-w-md">
            <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Sparkles size={15} className="text-primary-600 dark:text-primary-400" />
              Quality
            </div>
            <div
              role="radiogroup"
              aria-label="Processing quality"
              className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
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
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-60 ${
                      active
                        ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-950 dark:text-primary-300'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              {activeOption.description}
            </p>
          </div>

          {/* Supported formats */}
          <p className="text-sm text-gray-500 dark:text-gray-500">
            JPG • PNG • WEBP • HEIC
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Paste hint */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-500 mt-4">
        💡 You can also paste an image directly (Ctrl+V / Cmd+V)
      </p>
    </div>
  );
}
