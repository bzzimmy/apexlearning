import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
// Import a typed MV3 manifest module
import manifest from './src/manifest'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        about: fileURLToPath(new URL('./src/about/index.html', import.meta.url)),
      },
    },
  },
})
