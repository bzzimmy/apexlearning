import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
// Import a typed MV3 manifest module
import manifest from './src/manifest'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest })],
})
