#!/usr/bin/env node
// ─── Vérification des dépendances runtime avant le build ─────────────────────
// Usage : node scripts/check-runtime-deps.js
// Échoue avec exit(1) si un module nécessaire au processus main est manquant.

const path = require('path')
const fs   = require('fs')

// Modules réellement requis par le processus main Electron au runtime
// (tout le reste est bundlé par Vite dans out/renderer/)
const RUNTIME_DEPS = [
  'better-sqlite3',
  'bcryptjs',
  'bindings',
  'file-uri-to-path',
]

let ok = true

for (const dep of RUNTIME_DEPS) {
  const depPath = path.join(__dirname, '..', 'node_modules', dep)
  if (!fs.existsSync(depPath)) {
    console.error(`[check-runtime-deps] MANQUANT : ${dep}`)
    console.error(`  → Lancez : npm install ${dep}`)
    ok = false
  } else {
    const pkg = JSON.parse(fs.readFileSync(path.join(depPath, 'package.json'), 'utf8'))
    console.log(`[check-runtime-deps] OK  ${dep}@${pkg.version}`)
  }
}

// Vérifier que le binaire natif de better-sqlite3 existe
const nativePath = path.join(
  __dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release'
)
if (!fs.existsSync(nativePath)) {
  console.error('[check-runtime-deps] MANQUANT : better-sqlite3 natif (build/Release/)')
  console.error('  → Lancez : npm run rebuild')
  ok = false
} else {
  const natives = fs.readdirSync(nativePath).filter(f => f.endsWith('.node'))
  if (natives.length === 0) {
    console.error('[check-runtime-deps] MANQUANT : aucun .node dans better-sqlite3/build/Release/')
    ok = false
  } else {
    console.log(`[check-runtime-deps] OK  better-sqlite3 natif (${natives[0]})`)
  }
}

if (!ok) {
  process.exit(1)
} else {
  console.log('[check-runtime-deps] Toutes les dépendances runtime sont présentes.')
}
