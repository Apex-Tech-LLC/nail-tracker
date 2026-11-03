import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates PNG icons from public/icon.svg: pnpm generate-icons
// The SVG has rounded corners for "any" icons; maskable and Apple icons are
// filled edge to edge with the brand color so the OS can apply its own shape.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#534ab7' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#534ab7' } },
  },
  images: ['public/icon.svg'],
})
