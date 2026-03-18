import { resolve }         from 'path'
import { builtinModules }  from 'module'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
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
        include: [/src\/db\//, /src\/main\/ipc/, /src\/main\/notifications/],
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
    plugins: [externalizeDepsPlugin()],
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
        '@css': resolve(__dirname, 'renderer/css'),
      },
    },
    plugins: [vue()],
  },
})
