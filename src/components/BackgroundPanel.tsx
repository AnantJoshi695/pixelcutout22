import { useRef, useState } from 'react';
import { Palette, Droplet, Image as ImageIcon, Paintbrush, Waves, Loader2 } from 'lucide-react';
import type { BackgroundSettings } from '../types';

interface BackgroundPanelProps {
  background: BackgroundSettings;
  onBackgroundChange: (background: BackgroundSettings) => void;
}

const PRESET_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
];

const GRADIENTS = [
  { name: 'Sunset', colors: ['#ff6b6b', '#feca57', '#ee5a6f'] },
  { name: 'Ocean', colors: ['#667eea', '#764ba2', '#f093fb'] },
  { name: 'Forest', colors: ['#134e5e', '#71b280'] },
  { name: 'Fire', colors: ['#f12711', '#f5af19'] },
];

const TYPES: Array<{
  value: BackgroundSettings['type'];
  label: string;
  icon: typeof Palette;
}> = [
  { value: 'transparent', label: 'Transparent', icon: Palette },
  { value: 'solid', label: 'Solid', icon: Droplet },
  { value: 'gradient', label: 'Gradient', icon: Paintbrush },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'blur', label: 'Blur', icon: Waves },
];

export function BackgroundPanel({ background, onBackgroundChange }: BackgroundPanelProps) {
  const [customColor, setCustomColor] = useState(
    background.type === 'solid' && background.color ? background.color : '#ffffff',
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const handleBackgroundImage = (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.');
      return;
    }
    setLoadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLoadingImage(false);
      onBackgroundChange({ type: 'image', image: reader.result as string });
    };
    reader.onerror = () => {
      setLoadingImage(false);
      setImageError('That image could not be read.');
    };
    reader.readAsDataURL(file);
  };

  const isGradientPreset = (colors: string[]) =>
    background.gradient?.colors?.join(',') === colors.join(',');

  const previewStyle: React.CSSProperties = {};
  if (background.type === 'solid') previewStyle.backgroundColor = background.color || '#ffffff';
  if (background.type === 'gradient' && background.gradient) {
    previewStyle.background = `linear-gradient(135deg, ${background.gradient.colors.join(', ')})`;
  }
  if (background.type === 'image' && background.image) {
    previewStyle.backgroundImage = `url(${background.image})`;
    previewStyle.backgroundSize = 'cover';
    previewStyle.backgroundPosition = 'center';
  }

  return (
    <div className="flex h-full w-80 flex-col overflow-y-auto border-l border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Background</h3>

          <div className="mb-4 grid grid-cols-2 gap-2">
            {TYPES.map((t) => {
              const active = background.type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    if (t.value === 'transparent') onBackgroundChange({ type: 'transparent' });
                    else if (t.value === 'solid') onBackgroundChange({ type: 'solid', color: customColor });
                    else if (t.value === 'gradient')
                      onBackgroundChange({
                        type: 'gradient',
                        gradient: { type: 'linear', colors: GRADIENTS[0].colors },
                      });
                    else if (t.value === 'blur')
                      onBackgroundChange({ type: 'blur', blurAmount: background.blurAmount ?? 20 });
                    else if (t.value === 'image' && background.image)
                      onBackgroundChange({ type: 'image', image: background.image });
                    else bgFileRef.current?.click();
                  }}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                    active
                      ? 'bg-primary-100 text-primary-700 shadow-sm dark:bg-primary-900/30 dark:text-primary-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleBackgroundImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {imageError && (
            <p className="mb-3 text-xs text-red-600 dark:text-red-400">{imageError}</p>
          )}

          {background.type === 'solid' && (
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-xs text-gray-600 dark:text-gray-400">
                  Preset Colors
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => onBackgroundChange({ type: 'solid', color: color.value })}
                      className={`aspect-square rounded-lg border-2 transition-all ${
                        background.color === color.value
                          ? 'scale-110 border-primary-600'
                          : 'border-gray-300 hover:scale-105 dark:border-gray-700'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                      aria-label={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs text-gray-600 dark:text-gray-400">
                  Custom Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      onBackgroundChange({ type: 'solid', color: e.target.value });
                    }}
                    className="h-12 w-12 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700"
                    aria-label="Custom background color"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      onBackgroundChange({ type: 'solid', color: e.target.value });
                    }}
                    className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="#ffffff"
                    aria-label="Custom background color hex"
                  />
                </div>
              </div>
            </div>
          )}

          {background.type === 'gradient' && (
            <div className="space-y-3">
              <label className="mb-2 block text-xs text-gray-600 dark:text-gray-400">
                Preset Gradients
              </label>
              <div className="space-y-2">
                {GRADIENTS.map((gradient) => (
                  <button
                    key={gradient.name}
                    type="button"
                    onClick={() =>
                      onBackgroundChange({
                        type: 'gradient',
                        gradient: { type: background.gradient?.type ?? 'linear', colors: gradient.colors },
                      })
                    }
                    className={`flex flex-col items-center justify-center h-12 w-full rounded-lg border-2 transition-all ${
                      isGradientPreset(gradient.colors)
                        ? 'scale-105 border-primary-600'
                        : 'border-gray-300 hover:scale-105 dark:border-gray-700'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${gradient.colors.join(', ')})` }}
                    title={gradient.name}
                    aria-label={gradient.name}
                  >
                    <span className="text-xs font-semibold text-white text-shadow">{gradient.name}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-xs text-gray-600 dark:text-gray-400">
                  Gradient Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['linear', 'radial'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        onBackgroundChange({
                          type: 'gradient',
                          gradient: {
                            type,
                            colors: background.gradient?.colors ?? GRADIENTS[0].colors,
                          },
                        })
                      }
                      className={`rounded-lg px-3 py-2 text-sm capitalize transition-all ${
                        (background.gradient?.type ?? 'linear') === type
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {background.type === 'image' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => bgFileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {loadingImage ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                {background.image ? 'Replace background image' : 'Choose a background image'}
              </button>
              {background.image && (
                <div
                  className="h-20 w-full rounded-lg border border-gray-200 bg-cover bg-center dark:border-gray-700"
                  style={{ backgroundImage: `url(${background.image})` }}
                />
              )}
            </div>
          )}

          {background.type === 'blur' && (
            <div className="space-y-3">
              <label className="mb-2 block text-xs text-gray-600 dark:text-gray-400">
                Blur Amount
              </label>
              <input
                type="range"
                min={0}
                max={50}
                value={background.blurAmount ?? 20}
                onChange={(e) =>
                  onBackgroundChange({ type: 'blur', blurAmount: Number(e.target.value) })
                }
                className="w-full accent-primary-600"
                aria-label="Background blur amount"
              />
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>None</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {background.blurAmount ?? 20}px
                </span>
                <span>Max</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Blurs the original photo behind your subject.
              </p>
            </div>
          )}
        </div>

        {/* Preview swatch */}        <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
          <label className="mb-2 block text-xs text-gray-600 dark:text-gray-400">Preview</label>
          <div
            className={`h-32 w-full rounded-lg border-2 border-gray-300 dark:border-gray-700 ${
              background.type === 'transparent' ? 'checkerboard' : ''
            }`}
            style={previewStyle}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Applied when you export or open the preview.
          </p>
        </div>
      </div>
    </div>
  );
}
