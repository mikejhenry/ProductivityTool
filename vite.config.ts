import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.ts' },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      input: { main: './index.html', sw: './src/sw.ts' },
      output: { entryFileNames: (c) => c.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js' },
    },
  },
})
