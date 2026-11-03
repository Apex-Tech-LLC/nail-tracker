import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker that precaches the app. Does nothing in
 * `pnpm dev`, where vite-plugin-pwa serves no worker, so offline behavior
 * is only testable against `pnpm build && pnpm preview`.
 *
 * The update prompt (#12) replaces this with the React hook.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })
}
