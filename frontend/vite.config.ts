import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Web fonts must never move the page (CLS): fontsource ships `font-display: swap`; `optional` keeps the
// fallback on a slow first load instead of reflowing the hero when the font arrives. Rewritten in the
// emitted CSS because Vite inlines the @import-ed fontsource files into our own stylesheet.
const fontDisplayOptional = (): Plugin => ({
  name: 'font-display-optional',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const f of Object.values(bundle))
      if (f.type === 'asset' && f.fileName.endsWith('.css')) f.source = String(f.source).replace(/font-display:\s*swap/g, 'font-display:optional')
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), fontDisplayOptional()],
})
