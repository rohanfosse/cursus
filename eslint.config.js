const js = require('@eslint/js')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const vuePlugin = require('eslint-plugin-vue')
const vueParser = require('vue-eslint-parser')
const globals = require('globals')

module.exports = [
  // Ignorer les dossiers non-source
  { ignores: ['node_modules/**', 'out/**', 'dist/**', 'server/**', 'scripts/**'] },

  // Config de base JS
  js.configs.recommended,

  // ─── Renderer (Vue + TS) : environnement navigateur complet ────────────────
  {
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.vue', 'src/preload/**/*.ts', 'src/web/**/*.ts'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        // Electron renderer : expose aussi process pour env vars en dev
        process: 'readonly',
        NodeJS: 'readonly',
        Electron: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      vue: vuePlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...vuePlugin.configs['recommended'].rules,

      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'vue/no-unused-vars': ['warn', { ignorePattern: '^_' }],
      'no-unused-vars': 'off',
      // TypeScript gere deja les identifiants non definis (types DOM: RequestInit,
      // BlobPart, EventListener, NodeJS, etc. que ESLint ne connait pas).
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],
      // Les regex patterns de sanitizing ANSI/null-byte et les escapes dans
      // char classes sont souvent legitimes — ne pas bloquer sur ces heuristiques.
      'no-control-regex': 'warn',
      'no-useless-escape': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Autoriser NBSP (U+00A0) dans les templates Vue : usage legitime pour
      // preserver des lignes vides dans les previews (ex: CreateAnnounceModal).
      'no-irregular-whitespace': ['warn', { skipStrings: true, skipTemplates: true, skipComments: true }],
    },
  },

  // ─── Main process (Electron) : environnement Node + Electron ──────────────
  {
    files: ['src/main/**/*.ts', 'src/main/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: {
        ...globals.node,
        Electron: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],
      'no-control-regex': 'warn',
      'no-useless-escape': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ─── Landing page (JS plain, browser target) ──────────────────────────────
  {
    files: ['src/landing/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ─── Service worker (web offline cache) ────────────────────────────────────
  {
    files: ['src/web/public/sw.js', 'src/**/service-worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker, ...globals.browser },
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },

  // ─── Tests ────────────────────────────────────────────────────────────────
  {
    files: ['tests/**/*.ts', 'tests/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: {
        ...globals.node,
        ...globals.browser,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        test: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
