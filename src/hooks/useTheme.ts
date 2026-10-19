import { useCallback, useEffect, useState } from 'react';
import type { Theme } from '../types';

const STORAGE_KEY = 'theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* localStorage can be unavailable (private mode / blocked cookies). */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MEDIA_QUERY).matches;
}

/**
 * Applies the resolved theme to <html> so every `dark:` utility (and the
 * `color-scheme` property, which styles native scrollbars, form controls and
 * the canvas's default text colour) follows along.
 */
function applyToDocument(isDark: boolean): void {
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    readStoredTheme() === 'dark' ? 'dark' : readStoredTheme() === 'light' ? 'light' : systemPrefersDark() ? 'dark' : 'light',
  );

  // Apply + keep in sync with the OS while the user chose "System".
  useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY);

    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      applyToDocument(isDark);
      setResolvedTheme(isDark ? 'dark' : 'light');
    };

    apply();

    if (theme !== 'system') return;

    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  // Reflect changes made in another tab of the same app.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readStoredTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Persisting is best-effort; the theme still applies for this session. */
    }
    setThemeState(next);
  }, []);

  return { theme, resolvedTheme, setTheme };
}
