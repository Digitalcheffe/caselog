import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'dark' | 'light';
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: 'dark', toggleTheme: () => undefined });

const getInitialTheme = (): Theme => {
  const stored = window.localStorage.getItem('caselog-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    window.localStorage.setItem('caselog-theme', theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')) }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
