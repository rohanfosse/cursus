#!/usr/bin/env node
/* eslint-disable no-console */
// ─── Migration mecanique : rgba(literal) → rgba(var(--token-rgb), X) ─────────
// Usage : node scripts/migrate-design-tokens.js [--all | <glob>]
// Default : migre les top offenders du baseline.
//
// Substitutions :
//   rgba(74,144,217,X)   -> rgba(var(--accent-rgb),X)
//   rgba(231,76,60,X)    -> rgba(var(--color-danger-rgb),X)
//   rgba(243,156,18,X)   -> rgba(var(--color-warning-rgb),X)
//   rgba(39,174,96,X)    -> rgba(var(--color-success-rgb),X)
//   rgba(155,135,245,X)  -> rgba(var(--color-cctl-rgb),X)
//   rgba(46,204,113,X)   -> rgba(var(--color-success-rgb),X)  (variante default)

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src', 'renderer', 'src')

// base.css reste la source des tokens — ne pas migrer
const SKIP = new Set([path.join(SRC, 'assets', 'css', 'base.css')].map((p) => path.resolve(p)))

// Top offenders identifies via `check-design-tokens.js --full`
const DEFAULT_TARGETS = [
  'components/projet/StudentProjetFiche.vue',
  'components/projet/StudentProjetDevoirsList.vue',
  'components/modals/StudentTimelineModal.vue',
  'components/modals/DepotsModal.vue',
  'components/devoirs/StudentDevoirCard.vue',
  'components/auth/LoginOverlay.vue',
  'views/DocumentsView.vue',
  'components/lumen/LumenChapterViewer.vue',
  'components/live/TeacherLiveView.vue',
  'components/devoirs/TeacherRendusView.vue',
  'components/modals/SettingsModal.vue',
  'components/devoirs/KanbanBoard.vue',
  'components/dashboard/TabSuiviEtudiants.vue',
  'assets/css/components.css',
  'components/modals/EcheancierModal.vue',
  'components/live/QuizHistoryView.vue',
  'components/live/ActivityForm.vue',
  'App.vue',
  'components/ui/UiCodeEditor.vue',
  'components/modals/TimelineModal.vue',
].map((p) => path.join(SRC, p))

const SUBSTITUTIONS = [
  // Espaces tolerees dans rgba(74, 144, 217, X) comme rgba(74,144,217,X)
  { from: /rgba\(\s*74\s*,\s*144\s*,\s*217\s*,/g, to: 'rgba(var(--accent-rgb),' },
  { from: /rgba\(\s*231\s*,\s*76\s*,\s*60\s*,/g, to: 'rgba(var(--color-danger-rgb),' },
  { from: /rgba\(\s*243\s*,\s*156\s*,\s*18\s*,/g, to: 'rgba(var(--color-warning-rgb),' },
  { from: /rgba\(\s*39\s*,\s*174\s*,\s*96\s*,/g, to: 'rgba(var(--color-success-rgb),' },
  { from: /rgba\(\s*155\s*,\s*135\s*,\s*245\s*,/g, to: 'rgba(var(--color-cctl-rgb),' },
  { from: /rgba\(\s*46\s*,\s*204\s*,\s*113\s*,/g, to: 'rgba(var(--color-success-rgb),' },
  // Fallbacks redondants var(--token, #hex) -> var(--token)
  { from: /var\(\s*(--[a-z-]+)\s*,\s*#[0-9a-fA-F]{3,6}\s*\)/g, to: 'var($1)' },
]

function migrate(file) {
  const abs = path.resolve(file)
  if (SKIP.has(abs)) return { file, skipped: true }
  if (!fs.existsSync(abs)) return { file, error: 'not-found' }

  const before = fs.readFileSync(abs, 'utf8')
  let after = before
  let hits = 0

  for (const { from, to } of SUBSTITUTIONS) {
    const matches = after.match(from)
    if (matches) {
      hits += matches.length
      after = after.replace(from, to)
    }
  }

  if (hits > 0) {
    fs.writeFileSync(abs, after)
    return { file: path.relative(ROOT, abs).replace(/\\/g, '/'), hits }
  }
  return { file: path.relative(ROOT, abs).replace(/\\/g, '/'), hits: 0 }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const targets = DEFAULT_TARGETS
let totalHits = 0
let modified = 0

for (const t of targets) {
  const r = migrate(t)
  if (r.error) {
    console.log(`\x1b[33m[skip]\x1b[0m ${r.file} : ${r.error}`)
  } else if (r.hits > 0) {
    console.log(`\x1b[32m[ok]\x1b[0m   ${r.file} : ${r.hits} remplacements`)
    totalHits += r.hits
    modified++
  } else {
    console.log(`\x1b[2m[nop]\x1b[0m  ${r.file}`)
  }
}

console.log('')
console.log(`[migrate-design-tokens] ${modified} fichiers modifies, ${totalHits} remplacements au total.`)
console.log('[migrate-design-tokens] Re-generer le baseline : npm run check:design:snapshot')
