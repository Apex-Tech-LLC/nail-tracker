/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Short commit hash of the build, shown in Settings so a bug report says
// which version is running. BUILD_ID overrides it (tests use this to make
// two builds of the same commit differ).
function buildId(): string {
  if (process.env.BUILD_ID) return process.env.BUILD_ID
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the app from /nail-tracker/. Builds and `pnpm preview`
  // always use it, so preview behaves exactly like the live site; dev
  // stays at /. (Preview runs as command 'serve', hence isPreview.)
  base: command === 'build' || isPreview ? '/nail-tracker/' : '/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new version waits until the user agrees to reload (#12): an
      // automatic reload could wipe a half-filled form. Registration is done
      // by the useRegisterSW hook in src/pwa/UpdatePrompt.tsx, not injected.
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
        name: 'Nail Tracker',
        short_name: 'Nail Tracker',
        description: 'Track your turns, tips and pay. Private, works offline, no account.',
        lang: 'en',
        dir: 'ltr',
        // Relative, so the app installs correctly under any base path,
        // including /nail-tracker/ on GitHub Pages.
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f7f4f8',
        background_color: '#f7f4f8',
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
}))
