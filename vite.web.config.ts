// ─── Configuration Vite pour le build web standalone ─────────────────────────
import { defineConfig } from 'vite'
import vue  from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],

  root: resolve(__dirname, 'src/web'),
  envDir: __dirname,  // Lire .env / .env.production depuis la racine du projet

  build: {
    outDir:   resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: resolve(__dirname, 'src/web/index.html'),
      output: {
        manualChunks: {
          'vue':       ['vue', 'vue-router', 'pinia'],
          'socket':    ['socket.io-client'],
          'icons':     ['lucide-vue-next'],
          'highlight': ['highlight.js'],
          'office':    ['mammoth'],
          'markdown':  ['marked'],
        },
      },
    },
  },

  resolve: {
    alias: {
      '@':    resolve(__dirname, 'src/renderer/src'),
      '@css': resolve(__dirname, 'src/renderer/src/assets/css'),
    },
  },

  // Polyfill process.platform pour les composants qui l'utilisent
  define: {
    'process.platform': '"web"',
    'process.env':      '{}',
  },

  server: {
    port: 5174,
    proxy: {
      // En dev, proxyfier les appels API vers le serveur local
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
    },
  },
})
