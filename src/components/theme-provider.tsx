'use client';

/**
 * Theme provider.
 *
 * Why an inline script rather than reading the preference in an effect: a
 * theme set after hydration produces a visible flash of the wrong surface, which
 * on this design is a full-bleed background swap from warm cream to navy. The
 * script below runs before first paint and sets `data-theme` on <html>, so the
 * correct palette is painted the first time. It is deliberately tiny and inline
 * for exactly that reason.
 *
 * Priority, in order:
 *   1. an explicit stored choice  (localStorage, set by the switcher)
 *   2. the OS preference          (prefers-color-scheme)
 *   3. the light theme            (:root default in tokens.css)
 *
 * The tokens file also carries a `prefers-color-scheme` block for the no-JS case;
 * the explicit attribute wins over it because the media query is scoped to
 * `:root:not([data-theme])`.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'aihub-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Kept as a string so it can be inlined in <head> verbatim. */
export const themeInitScript = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default matches the token file; corrected before paint by the inline script.
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light' || current === 'dark') setThemeState(current);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing or a blocked storage partition. The theme still
      // applies for this page view; it just will not persist.
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}