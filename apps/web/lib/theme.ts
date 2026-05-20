// Tiny theme controller. Two states (light / dark), persisted in
// localStorage, applied by toggling the `.dark` class on
// <html>. A pre-paint script in app/layout.tsx reads the same
// localStorage key synchronously so the page never flashes the wrong
// theme on cold load.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'dbstudio.theme';

/** Read the persisted theme, falling back to the OS preference. SSR-safe
 *  — returns 'light' during server render so React's hydration matches
 *  the pre-paint script (which also defaults to light when no value is
 *  stored and no OS pref is detectable). */
export function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Apply a theme to the document root and persist it. */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  window.localStorage.setItem(STORAGE_KEY, theme);
}

/** Inline source for the no-flash script. Mirrors `readTheme` minus the
 *  TypeScript wrapping so it can run pre-paint in <head>. */
export const NO_FLASH_SCRIPT = `
(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();
`;
