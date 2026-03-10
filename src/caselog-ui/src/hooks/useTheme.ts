import { useEffect, useMemo, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'caselog-theme';

const getStoredTheme = (): Theme | null => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' ? stored : null;
};

const getPreferredTheme = (): Theme => {
  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());
  const [userOverride, setUserOverride] = useState<boolean>(() => getStoredTheme() !== null);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    if (userOverride) {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme, userOverride]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      if (!userOverride) {
        setTheme(event.matches ? 'dark' : 'light');
      }
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [userOverride]);

  return useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        setUserOverride(true);
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
      }
    }),
    [theme]
  );
};
