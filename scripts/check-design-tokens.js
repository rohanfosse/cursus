#!/usr/bin/env node
/* eslint-disable no-console */
// ─── Garde-fou : pas de hex/rgba hardcodé dans les composants ─────────────────
// Usage :
//   node scripts/check-design-tokens.js             — check vs baseline
//   node scripts/check-design-tokens.js --snapshot  — regenere baseline
//   node scripts/check-design-tokens.js --full      — tous les patterns, pas de baseline
//
// Exit 1 si une NOUVELLE violation apparait (absente du baseline).
//
// Les tokens de couleur vivent UNIQUEMENT dans base.css.
// Partout ailleurs, passer par var(--token) / rgba(var(--token-rgb), X) / color-mix.

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src', 'renderer', 'src')
const BASELINE_FILE = path.join(__dirname, 'design-tokens-baseline.json')

const args = new Set(process.argv.slice(2))
const MODE_SNAPSHOT = args.has('--snapshot')
const MODE_FULL     = args.has('--full')

// base.css est LA source des tokens — hex/rgba autorisés
const ALLOWLIST = new Set(
  [path.join(SRC, 'assets', 'css', 'base.css')].map((p) => path.resolve(p)),
)

const PATTERNS = [
  {
    id: 'accent-rgba',
    regex: /rgba\(\s*74\s*,\s*144\s*,\s*217/gi,
    level: 'error',
    message: 'Accent rgba hardcode. Utiliser `rgba(var(--accent-rgb), X)`',
  },
  {
    id: 'warning-rgba',
    regex: /rgba\(\s*243\s*,\s*156\s*,\s*18/gi,
    level: 'error',
    message: 'Warning rgba hardcode. Utiliser `color-mix(in srgb, var(--color-warning) X%, transparent)`',
  },
  {
    id: 'danger-rgba',
    regex: /rgba\(\s*231\s*,\s*76\s*,\s*60/gi,
    level: 'error',
    message: 'Danger rgba hardcode. Utiliser `color-mix(in srgb, var(--color-danger) X%, transparent)`',
  },
  {
    id: 'success-rgba',
    regex: /rgba\(\s*39\s*,\s*174\s*,\s*96/gi,
    level: 'error',
    message: 'Success rgba hardcode. Utiliser `color-mix(in srgb, var(--color-success) X%, transparent)`',
  },
  {
    id: 'cctl-rgba',
    regex: /rgba\(\s*155\s*,\s*135\s*,\s*245/gi,
    level: 'error',
    message: 'CCTL rgba hardcode. Utiliser `color-mix(in srgb, var(--color-cctl) X%, transparent)`',
  },
  {
    id: 'token-fallback',
    regex: /var\(\s*--[a-z-]+\s*,\s*#[0-9a-fA-F]{3,6}\s*\)/g,
    level: 'warning',
    message: 'Fallback `var(--token, #hex)` redondant. Le token existe dans tous les themes.',
  },
  {
    id: 'structural-emoji',
    regex: /<span[^>]*class="[^"]*(?:prefix|icon|badge|indicator)[^"]*"[^>]*>[\s]*[📢📌📎🔇🎓⚠️✅❌📍👤📅🕐][\s]*</g,
    level: 'error',
    message: 'Emoji utilise comme icone structurelle. Utiliser un composant Lucide.',
  },
]

const SCAN_EXT = new Set(['.vue', '.css'])

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'out' || ent.name === 'dist') continue
      walk(full, acc)
    } else if (SCAN_EXT.has(path.extname(ent.name))) {
      acc.push(full)
    }
  }
  return acc
}

function scan() {
  const issues = []
  for (const file of walk(SRC)) {
    if (ALLOWLIST.has(path.resolve(file))) continue

    const lines = fs.readFileSync(file, 'utf8').split('\n')
    for (const { id, regex, level, message } of PATTERNS) {
      lines.forEach((line, idx) => {
        const test = new RegExp(regex.source, regex.flags.replace('g', ''))
        if (test.test(line)) {
          issues.push({
            id,
            file: path.relative(ROOT, file).replace(/\\/g, '/'),
            line: idx + 1,
            level,
            message,
            excerpt: line.trim().slice(0, 120),
          })
        }
      })
    }
  }
  return issues
}

function issueKey(issue) {
  // Cle stable : fichier + id du pattern (pas la ligne — evite les faux nouveaux
  // quand on ajoute/supprime des lignes au-dessus sans toucher la violation).
  return `${issue.file}::${issue.id}`
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null
  try { return new Set(JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))) }
  catch { return null }
}

function writeBaseline(issues) {
  const keys = [...new Set(issues.map(issueKey))].sort()
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(keys, null, 2) + '\n')
  console.log(`[check-design-tokens] baseline ecrit : ${keys.length} violations heritees`)
  console.log(`[check-design-tokens] -> ${path.relative(ROOT, BASELINE_FILE)}`)
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const allIssues = scan()

if (MODE_SNAPSHOT) {
  writeBaseline(allIssues)
  process.exit(0)
}

const baseline = MODE_FULL ? null : loadBaseline()
const baselineSize = baseline ? baseline.size : 0

const newIssues = baseline
  ? allIssues.filter((i) => !baseline.has(issueKey(i)))
  : allIssues

if (newIssues.length === 0) {
  const ignored = allIssues.length - newIssues.length
  console.log(`[check-design-tokens] OK — aucune nouvelle violation${ignored > 0 ? ` (${ignored} heritees ignorees via baseline)` : ''}.`)
  process.exit(0)
}

let errors = 0
let warnings = 0
for (const { file, line, level, message, excerpt } of newIssues) {
  if (level === 'error') errors++
  else warnings++
  const color = level === 'error' ? '\x1b[31m' : '\x1b[33m'
  console.log(`${color}[${level}]\x1b[0m ${file}:${line}`)
  console.log(`        ${message}`)
  console.log(`        \x1b[2m> ${excerpt}\x1b[0m`)
}

console.log('')
console.log(`[check-design-tokens] ${errors} nouvelle(s) erreur(s), ${warnings} nouvel(les) avertissement(s).`)
if (baselineSize > 0) {
  console.log(`[check-design-tokens] (${baselineSize} violations heritees tolerees via baseline)`)
}
console.log('[check-design-tokens] Voir design-system/cursus/MASTER.md §9 (anti-patterns).')

process.exit(errors > 0 ? 1 : 0)
