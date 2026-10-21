import { MousePointer2, Eraser as EraserIcon, PaintBucket, Undo2 } from 'lucide-react';
import type { BrushSettings, EditorTool } from '../types';

interface EditorToolbarProps {
  tool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  brushSettings: BrushSettings;
  onBrushSettingsChange: (settings: BrushSettings) => void;
}

const TOOLS: Array<{
  value: EditorTool;
  icon: typeof MousePointer2;
  label: string;
  description: string;
}> = [
  { value: 'select', icon: MousePointer2, label: 'Select', description: 'Pan & zoom the canvas' },
  { value: 'remove', icon: PaintBucket, label: 'Remove', description: 'Paint to delete areas' },
  { value: 'recover', icon: Undo2, label: 'Recover', description: 'Restore original pixels' },
  { value: 'eraser', icon: EraserIcon, label: 'Erase', description: 'Drop your own strokes' },
];

export function EditorToolbar({
  tool,
  onToolChange,
  brushSettings,
  onBrushSettingsChange,
}: EditorToolbarProps) {
  const previewSize = Math.min(96, Math.max(8, brushSettings.size));

  return (
    <div
      role="group"
      className="flex h-full w-64 flex-col overflow-y-auto border-r border-frame bg-paper p-4 text-sm dark:border-dark-border dark:bg-dark-sidebar lg:w-64"
    >
      <div className="space-y-6">
        {/* Tools */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">Tools</h3>
          <div className="space-y-2">
            {TOOLS.map((t) => {
              const active = tool === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onToolChange(t.value)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all ${
                    active
                      ? 'bg-green-100 text-green-700 shadow-sm dark:bg-dark-card dark:text-white'
                      : 'text-ink hover:bg-surface dark:text-white/80 dark:hover:bg-dark-card'
                  }`}
                  title={t.description}
                >
                  <t.icon size={20} />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs opacity-70">{t.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Brush settings */}
        {tool !== 'select' && (
          <>
            <div className="border-t border-frame pt-6 dark:border-dark-border">
              <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">
                Brush Size
              </h3>
              <div className="space-y-3">
                <input
                  type="range"
                  min={5}
                  max={200}
                  value={brushSettings.size}
                  onChange={(e) =>
                    onBrushSettingsChange({ ...brushSettings, size: Number(e.target.value) })
                  }
                  className="w-full accent-green-600"
                  aria-label="Brush size"
                />
                <div className="flex items-center justify-between text-sm text-mute dark:text-white/70">
                  <span>Small</span>
                  <span className="font-semibold text-ink dark:text-white">
                    {brushSettings.size}px
                  </span>
                  <span>Large</span>
                </div>
                <div className="flex h-28 items-center justify-center rounded-lg border border-frame bg-surface dark:border-dark-border dark:bg-dark-card">
                  <div
                    className="rounded-full bg-green-600 dark:bg-green-400"
                    style={{ width: `${previewSize}px`, height: `${previewSize}px` }}
                  />
                </div>
                <p className="text-center text-xs text-mute dark:text-white/60">
                  Size is in image pixels — the on-canvas circle matches it.
                </p>
              </div>
            </div>

            <div className="border-t border-frame pt-6 dark:border-dark-border">
              <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">Hardness</h3>
              <div className="space-y-3">
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={brushSettings.hardness}
                  onChange={(e) =>
                    onBrushSettingsChange({ ...brushSettings, hardness: Number(e.target.value) })
                  }
                  className="w-full accent-green-600"
                  aria-label="Brush hardness"
                />
                <div className="flex items-center justify-between text-sm text-mute dark:text-white/70">
                  <span>Soft</span>
                  <span className="font-semibold text-ink dark:text-white">
                    {Math.round(brushSettings.hardness * 100)}%
                  </span>
                  <span>Hard</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Shortcuts */}
        <div className="border-t border-frame pt-6 dark:border-dark-border">
          <div className="rounded-lg bg-green-50 p-4 dark:bg-dark-card">
            <h4 className="mb-2 text-sm font-semibold text-ink dark:text-white">
              💡 Tips
            </h4>
            <ul className="space-y-1 text-xs text-mute dark:text-white/70">
              <li>• Select lets you pan and zoom</li>
              <li>• Remove makes areas transparent</li>
              <li>• Recover brings back the original</li>
              <li>• Scroll to zoom, Space to pan</li>
              <li>• Ctrl+Z / Ctrl+Shift+Z undo &amp; redo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
