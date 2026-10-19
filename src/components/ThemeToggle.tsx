import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../types';

const THEMES: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
      role="group"
      aria-label="Theme"
    >
      {THEMES.map((t) => {
        const active = theme === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-gray-600 transition-all dark:text-gray-300 ${
              active
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'hover:bg-white/60 dark:hover:bg-gray-700/60'
            }`}
            aria-label={`${t.label} theme`}
            title={`${t.label} theme`}
          >
            <t.icon size={18} />
            <span className="hidden text-sm font-medium sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
