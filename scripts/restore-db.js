#!/usr/bin/env node
/**
 * Restauration manuelle de la base SQLite depuis un backup.
 *
 * Usage :
 *   node scripts/restore-db.js                    # restaure le backup le plus recent
 *   node scripts/restore-db.js <filename>         # restaure un backup specifique
 *   node scripts/restore-db.js --list             # liste les backups disponibles
 *   node scripts/restore-db.js --help             # aide
 *
 * Variables d'environnement :
 *   DB_PATH     chemin du fichier DB cible (defaut: cursus.db a la racine)
 *   BACKUP_DIR  dossier des backups     (defaut: <racine>/backups)
 *
 * Securite :
 * - Le fichier DB actuel est deplace en .corrupted-<timestamp> avant
 *   remplacement, pour pouvoir revenir en arriere si la restauration
 *   echoue.
 * - Ce script NE doit PAS etre execute pendant que le serveur tourne.
 *   Arreter PM2/Electron au prealable (voir docs/BACKUP.md).
 */
const fs   = require('fs')
const path = require('path')

const ROOT       = path.join(__dirname, '..')
const DB_PATH    = process.env.DB_PATH    || path.join(ROOT, 'cursus.db')
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'backups')

function printHelp() {
  console.log(`Cursus — Restauration manuelle de la DB

Usage:
  node scripts/restore-db.js                 Restaure le backup le plus recent
  node scripts/restore-db.js <filename>      Restaure un backup specifique
  node scripts/restore-db.js --list          Liste les backups disponibles
  node scripts/restore-db.js --help          Affiche cette aide

Environnement:
  DB_PATH     = ${DB_PATH}
  BACKUP_DIR  = ${BACKUP_DIR}

ATTENTION: arreter le serveur (pm2 stop cursus-server) avant toute restauration.`)
}

function listBackupsOrExit() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`Aucun dossier de backup trouve: ${BACKUP_DIR}`)
    process.exit(1)
  }
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('cursus-') && f.endsWith('.db'))
    .sort()
  if (!files.length) {
    console.error(`Aucun backup cursus-*.db trouve dans ${BACKUP_DIR}`)
    process.exit(1)
  }
  return files
}

function cmdList() {
  const files = listBackupsOrExit()
  console.log(`Backups disponibles (${BACKUP_DIR}):`)
  for (const f of files) {
    const stat = fs.statSync(path.join(BACKUP_DIR, f))
    const sizeKb = (stat.size / 1024).toFixed(1)
    console.log(`  ${f}  (${sizeKb} KB, ${stat.mtime.toISOString()})`)
  }
}

function cmdRestore(targetFilename) {
  const files = listBackupsOrExit()
  const chosen = targetFilename || files[files.length - 1]

  if (!files.includes(chosen)) {
    console.error(`Backup introuvable: ${chosen}`)
    console.error(`Utilisez --list pour voir les backups disponibles.`)
    process.exit(1)
  }

  const backupPath = path.join(BACKUP_DIR, chosen)
  console.log(`Restauration depuis: ${backupPath}`)
  console.log(`Vers:                ${DB_PATH}`)

  // Sauvegarder le fichier actuel sous .corrupted-<timestamp> pour rollback
  if (fs.existsSync(DB_PATH)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    for (const ext of ['', '-wal', '-shm']) {
      const src = DB_PATH + ext
      if (fs.existsSync(src)) {
        const dst = `${DB_PATH}.corrupted-${stamp}${ext}`
        fs.renameSync(src, dst)
        console.log(`  ${path.basename(src)} -> ${path.basename(dst)}`)
      }
    }
  }

  fs.copyFileSync(backupPath, DB_PATH)
  console.log(`OK. DB restauree. Relancer le serveur : pm2 start cursus-server`)
}

const arg = process.argv[2]
if (arg === '--help' || arg === '-h') {
  printHelp()
  process.exit(0)
} else if (arg === '--list' || arg === '-l') {
  cmdList()
  process.exit(0)
} else {
  cmdRestore(arg)
}
