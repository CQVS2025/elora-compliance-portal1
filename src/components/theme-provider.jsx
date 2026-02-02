import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(undefined);

/**
 * Theme: "dark" | "light" | "system"
 * Follows shadcn Vite dark mode guide: class-based, stored in localStorage.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return (window.localStorage.getItem(storageKey) || defaultTheme);
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      return;
    }
    root.classList.add(theme);
  }, [theme]);

  const setTheme = (value) => {
    window.localStorage.setItem(storageKey, value);
    setThemeState(value);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }} {...props}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
