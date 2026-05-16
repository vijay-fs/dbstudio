/**
 * Detect whether the app is running inside the Tauri desktop shell.
 * In the browser (web SaaS or `pnpm dev:web`), this returns false and the API
 * layer falls back to HTTP fetch against the Axum server.
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}
