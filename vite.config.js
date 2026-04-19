import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: './',
  server: {
    port: 5181,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssMinify: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) return 'react-dom'
          if (id.includes('node_modules/react/') || id.includes('node_modules\\react\\'))
            return 'react'
          if (
            id.includes('marked') ||
            id.includes('dompurify') ||
            id.includes('turndown')
          )
            return 'markdown'
          if (id.includes('jszip')) return 'jszip'
        },
      },
    },
  },
  esbuild: {
    drop: command === 'build' ? ['debugger'] : [],
  },
}))
