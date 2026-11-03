/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new version waits until the user agrees to reload (#12): an
      // automatic reload could wipe a half-filled form. Registration is done
      // in src/pwa/registerServiceWorker.ts, not injected.
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        // Everything the app needs is precached at install, fonts included,
        // so it opens fully offline from the second visit on. Data never
        // comes from the network, so there is no runtime caching.
        // The manifest is added by the plugin itself.
        globPatterns: ['**/*.{html,js,css,woff2,svg,png,ico}'],
        // Any navigation is answered with the cached app shell. Routes live
        // in the hash, so this mainly covers reloads while offline.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      // globPatterns already precaches every icon; listing them here too
      // would add each one to the precache twice.
      includeManifestIcons: false,
      manifest: {
        id: './',
        name: 'Daftar · دفتر خرج‌وخرج',
        short_name: 'Daftar',
        description: 'Offline-first expense tracker with Jalali dates and Toman amounts.',
        lang: 'fa',
        dir: 'rtl',
        // Relative, so the app installs correctly under any base path,
        // including /daftar/ on GitHub Pages.
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f7f7fb',
        background_color: '#f7f7fb',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
