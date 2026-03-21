import { resolve }         from 'path'
import { builtinModules }  from 'module'
import { defineConfig } from 'electron-vite'
import vue       from '@vitejs/plugin-vue'
import commonjs  from '@rollup/plugin-commonjs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { dependencies = {} } = require('./package.json') as {
  dependencies?: Record<string, string>
}

// Modules qui doivent rester en require() natif dans le bundle Node.js —
// @rollup/plugin-commonjs ne doit PAS les envelopper dans son helper interne.
const cjsIgnore = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  ...Object.keys(dependencies),
]

export default defineConfig({
  main: {
    // commonjs({ include }) : ne traite que les fichiers locaux (db + ipc).
    // ignore : garde les require() de electron/Node/node_modules en natif.
    plugins: [
      commonjs({
        include: [/server\/db\//, /src\/main\/ipc/, /src\/main\/notifications/],
        ignore:  cjsIgnore,
      }),
    ],
    build: {
      rollupOptions: {
        external: [
          'electron',
          ...builtinModules,
          ...builtinModules.map((m) => `node:${m}`),
          ...Object.keys(dependencies),
        ],
      },
    },
  },
  preload: {
    // Ne pas externaliser socket.io-client — il doit être bundlé dans le preload
    // car le preload packagé n'a pas accès à node_modules au runtime.
    // On externalise uniquement electron et les builtins Node.
    build: {
      rollupOptions: {
        external: [
          'electron',
          ...builtinModules,
          ...builtinModules.map((m) => `node:${m}`),
        ],
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@css': resolve(__dirname, 'src/renderer/src/assets/css'),
      },
    },
    plugins: [vue()],
  },
})
