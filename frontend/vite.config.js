import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true
  },
  build: {
    // The default CSS minifier rewrites `@media (max-width: Npx)` into the modern
    // range syntax `@media (width <= Npx)`, which pre-16.4 iOS Safari doesn't
    // understand — silently breaking every mobile-only style (e.g. the sidebar
    // never hides). Disabling CSS minification keeps the source syntax intact.
    cssMinify: false
  },
})
