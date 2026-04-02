import { describe, it, expect } from 'vitest'
import { validateFile } from '@/utils/fileValidation'

// ─── Constantes de référence ──────────────────────────────────────────────────
const MAX_SIZE = 50 * 1024 * 1024 // 50 Mo en octets

// ─── Taille du fichier ────────────────────────────────────────────────────────
describe('validateFile — taille', () => {
  it('accepte un fichier dont la taille est exactement 50 Mo', () => {
    const result = validateFile({ name: 'rapport.pdf', size: MAX_SIZE })
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepte un fichier de taille nulle', () => {
    const result = validateFile({ name: 'vide.txt', size: 0 })
    expect(result.valid).toBe(true)
  })

  it('accepte un fichier de taille normale (1 Mo)', () => {
    const result = validateFile({ name: 'image.png', size: 1024 * 1024 })
    expect(result.valid).toBe(true)
  })

  it('refuse un fichier dépassant 50 Mo', () => {
    const result = validateFile({ name: 'lourd.zip', size: MAX_SIZE + 1 })
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('affiche un message d\'erreur en français pour un fichier trop lourd', () => {
    const result = validateFile({ name: 'lourd.zip', size: MAX_SIZE + 1 })
    expect(result.error).toMatch(/50\s*Mo/i)
  })

  it('refuse un fichier bien plus grand que la limite (1 Go)', () => {
    const result = validateFile({ name: 'archive.zip', size: 1024 * 1024 * 1024 })
    expect(result.valid).toBe(false)
  })

  // Valeur limite juste en dessous : doit passer
  it('accepte un fichier de 50 Mo - 1 octet', () => {
    const result = validateFile({ name: 'presque.pdf', size: MAX_SIZE - 1 })
    expect(result.valid).toBe(true)
  })
})

// ─── Extension bloquée ────────────────────────────────────────────────────────
describe('validateFile — extensions bloquées', () => {
  const blockedExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.msi', '.dll',
    '.scr', '.pif', '.vbs', '.wsf', '.jar', '.apk', '.ps1', '.sh',
  ]

  for (const ext of blockedExtensions) {
    it(`refuse l'extension ${ext}`, () => {
      const result = validateFile({ name: `malware${ext}`, size: 1000 })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  }

  it('affiche un message d\'erreur en français pour une extension bloquée', () => {
    const result = validateFile({ name: 'virus.exe', size: 1000 })
    expect(result.error).toMatch(/type de fichier|extension/i)
  })

  it('refuse une extension bloquée en majuscules (.EXE)', () => {
    const result = validateFile({ name: 'virus.EXE', size: 1000 })
    expect(result.valid).toBe(false)
  })

  it('refuse une extension bloquée avec casse mixte (.Exe)', () => {
    const result = validateFile({ name: 'virus.Exe', size: 1000 })
    expect(result.valid).toBe(false)
  })

  it('accepte une extension autorisée (.pdf)', () => {
    const result = validateFile({ name: 'rendu.pdf', size: 1000 })
    expect(result.valid).toBe(true)
  })

  it('accepte une extension autorisée (.docx)', () => {
    const result = validateFile({ name: 'rapport.docx', size: 1000 })
    expect(result.valid).toBe(true)
  })

  it('accepte une extension autorisée (.zip)', () => {
    const result = validateFile({ name: 'projet.zip', size: 1000 })
    expect(result.valid).toBe(true)
  })

  it('accepte une extension autorisée (.png)', () => {
    const result = validateFile({ name: 'capture.png', size: 1000 })
    expect(result.valid).toBe(true)
  })

  it('accepte un fichier sans extension', () => {
    const result = validateFile({ name: 'README', size: 500 })
    expect(result.valid).toBe(true)
  })
})

// ─── Nom de fichier — traversée de chemin ─────────────────────────────────────
describe('validateFile — traversée de chemin (..)', () => {
  it('refuse un nom contenant ..', () => {
    const result = validateFile({ name: '../../etc/passwd', size: 100 })
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('affiche un message d\'erreur en français pour la traversée de chemin', () => {
    const result = validateFile({ name: '../secret.pdf', size: 100 })
    expect(result.error).toMatch(/nom de fichier|invalide/i)
  })

  it('refuse un nom contenant .. en milieu de chaîne', () => {
    const result = validateFile({ name: 'dossier/../secret.pdf', size: 100 })
    expect(result.valid).toBe(false)
  })

  it('accepte un nom normal avec un seul point (.gitignore style)', () => {
    const result = validateFile({ name: '.gitignore', size: 100 })
    expect(result.valid).toBe(true)
  })

  it('accepte un nom avec un point en fin (fichier.)', () => {
    const result = validateFile({ name: 'rapport.', size: 100 })
    expect(result.valid).toBe(true)
  })

  it('accepte un nom contenant un seul point isolé (rapport.final.pdf)', () => {
    const result = validateFile({ name: 'rapport.final.pdf', size: 100 })
    expect(result.valid).toBe(true)
  })

  it('refuse un nom contenant un slash (/)', () => {
    const result = validateFile({ name: 'path/to/file.pdf', size: 100 })
    expect(result.valid).toBe(false)
  })

  it('refuse un nom contenant un backslash (\\)', () => {
    const result = validateFile({ name: 'path\\to\\file.pdf', size: 100 })
    expect(result.valid).toBe(false)
  })
})

// ─── Combinaisons de règles ────────────────────────────────────────────────────
describe('validateFile — combinaisons', () => {
  it('refuse un fichier trop lourd ET avec extension bloquée', () => {
    const result = validateFile({ name: 'gros_virus.exe', size: MAX_SIZE + 1 })
    expect(result.valid).toBe(false)
    // Un seul message d'erreur est suffisant (première règle déclenchée)
    expect(result.error).toBeDefined()
  })

  it('refuse path traversal ET extension bloquée', () => {
    const result = validateFile({ name: '../virus.exe', size: 100 })
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('accepte un fichier parfaitement valide (pdf, 2 Mo, nom propre)', () => {
    const result = validateFile({ name: 'rendu_final_2026.pdf', size: 2 * 1024 * 1024 })
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })
})
