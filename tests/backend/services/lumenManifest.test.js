/**
 * Tests du parser de manifest cursus.yaml (Lumen).
 * Verifie l'acceptation des formats valides et le rejet clair des formats
 * invalides, pour que l'UI puisse afficher des messages actionnables.
 */
const { parseManifest, inferRepoKind, KIND_VALUES } = require('../../../server/services/lumenManifest')

describe('parseManifest : entrees valides', () => {
  it('manifest minimal (project + chapters)', () => {
    const yaml = `
project: "Projet 01 Python"
chapters:
  - title: Intro
    path: cours/01-intro.md
`
    const r = parseManifest(yaml)
    expect(r.ok).toBe(true)
    expect(r.manifest.project).toBe('Projet 01 Python')
    expect(r.manifest.chapters).toHaveLength(1)
    expect(r.manifest.chapters[0].path).toBe('cours/01-intro.md')
  })

  it('manifest complet avec metadata et ressources', () => {
    const yaml = `
project: "Projet avance"
module: "Fondamentaux"
author: "Rohan Fosse"
summary: "Cours d introduction"
chapters:
  - title: Intro
    path: cours/01.md
    duration: 30
    prerequis: []
  - title: Variables
    path: cours/02.md
    duration: 45
    prerequis: ["01-intro"]
resources:
  - path: ressources/cheat.pdf
    kind: pdf
    title: Cheatsheet
`
    const r = parseManifest(yaml)
    expect(r.ok).toBe(true)
    expect(r.manifest.module).toBe('Fondamentaux')
    expect(r.manifest.author).toBe('Rohan Fosse')
    expect(r.manifest.chapters).toHaveLength(2)
    expect(r.manifest.chapters[1].duration).toBe(45)
    expect(r.manifest.resources).toHaveLength(1)
  })
})

describe('parseManifest : entrees invalides', () => {
  it('rejette une chaine vide', () => {
    const r = parseManifest('')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/vide/i)
  })

  it('rejette un YAML mal forme', () => {
    const r = parseManifest('project:\n  [unbalanced')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/YAML invalide/i)
  })

  it('rejette l absence de project', () => {
    const r = parseManifest(`
chapters:
  - title: Intro
    path: c1.md
`)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/project/i)
  })

  it('rejette l absence de chapters', () => {
    const r = parseManifest(`project: X`)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/chapters/i)
  })

  it('rejette un chapitre sans .md', () => {
    const r = parseManifest(`
project: X
chapters:
  - title: Intro
    path: cours/01.txt
`)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/md/i)
  })

  it('rejette un chapitre sans titre', () => {
    const r = parseManifest(`
project: X
chapters:
  - path: cours/01.md
`)
    expect(r.ok).toBe(false)
  })

  it('rejette des champs inconnus dans chapter (strict)', () => {
    const r = parseManifest(`
project: X
chapters:
  - title: Intro
    path: cours/01.md
    fakeField: oops
`)
    expect(r.ok).toBe(false)
  })

  it('rejette des chapters de type non-array', () => {
    const r = parseManifest(`
project: X
chapters: not-an-array
`)
    expect(r.ok).toBe(false)
  })
})

describe('parseManifest : champ cursusProject optionnel', () => {
  it('accepte un manifest sans cursusProject', () => {
    const r = parseManifest(`
project: Projet Test
chapters:
  - title: Intro
    path: cours/01.md
`)
    expect(r.ok).toBe(true)
    expect(r.manifest.cursusProject).toBeUndefined()
  })

  it('accepte un manifest avec cursusProject', () => {
    const r = parseManifest(`
project: Cours Python
cursusProject: "API Meteo en Python"
chapters:
  - title: Intro
    path: cours/01.md
`)
    expect(r.ok).toBe(true)
    expect(r.manifest.cursusProject).toBe('API Meteo en Python')
  })

  it('rejette un cursusProject non-string', () => {
    const r = parseManifest(`
project: Cours
cursusProject: 42
chapters:
  - title: Intro
    path: cours/01.md
`)
    expect(r.ok).toBe(false)
  })

  it('rejette un cursusProject trop long (> 200 chars)', () => {
    const longName = 'x'.repeat(201)
    const r = parseManifest(`
project: Cours
cursusProject: "${longName}"
chapters:
  - title: Intro
    path: cours/01.md
`)
    expect(r.ok).toBe(false)
  })
})

// ── Categorisation v2.63 (kind / audience / groupName) ────────────────────

describe('parseManifest : champ kind', () => {
  const KINDS = ['course', 'prosit', 'workshop', 'miniproject', 'project', 'readme', 'group', 'student']

  KINDS.forEach((kind) => {
    it(`accepte kind: ${kind}`, () => {
      const r = parseManifest(`
project: Cours
kind: ${kind}
chapters:
  - title: Intro
    path: cours/01.md
`)
      expect(r.ok).toBe(true)
      expect(r.manifest.kind).toBe(kind)
    })
  })

  it('rejette une valeur kind invalide', () => {
    const r = parseManifest(`
project: Cours
kind: invalid_kind
chapters:
  - title: Intro
    path: cours/01.md
`)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/kind/i)
  })

  it('accepte un manifest sans kind (defaut undefined)', () => {
    const r = parseManifest(`
project: Cours
chapters:
  - title: Intro
    path: cours/01.md
`)
    expect(r.ok).toBe(true)
    expect(r.manifest.kind).toBeUndefined()
  })

  it('accepte audience promo et group avec groupName', () => {
    const r = parseManifest(`
project: Rendu Equipe A
kind: group
audience: group
groupName: "Equipe A"
chapters:
  - title: README
    path: README.md
`)
    expect(r.ok).toBe(true)
    expect(r.manifest.audience).toBe('group')
    expect(r.manifest.groupName).toBe('Equipe A')
  })

  it('rejette une audience invalide', () => {
    const r = parseManifest(`
project: Cours
audience: nope
chapters:
  - title: Intro
    path: cours/01.md
`)
    expect(r.ok).toBe(false)
  })
})

describe('inferRepoKind : heuristique de classification', () => {
  it('detecte readme', () => {
    expect(inferRepoKind('promo-readme')).toBe('readme')
    expect(inferRepoKind('readme-php')).toBe('readme')
    expect(inferRepoKind('README')).toBe('readme')
    expect(inferRepoKind('.github')).toBe('readme')
  })

  it('detecte prosit', () => {
    expect(inferRepoKind('prosit-mvc')).toBe('prosit')
    expect(inferRepoKind('prosits-php')).toBe('prosit')
    expect(inferRepoKind('p1-prosit-bdd')).toBe('prosit')
  })

  it('detecte workshop / atelier', () => {
    expect(inferRepoKind('workshop-1')).toBe('workshop')
    expect(inferRepoKind('atelier-react')).toBe('workshop')
  })

  it('detecte mini-projet (toutes les variantes orthographiques)', () => {
    expect(inferRepoKind('mini-projet-bdd')).toBe('miniproject')
    expect(inferRepoKind('miniproject-1')).toBe('miniproject')
    expect(inferRepoKind('mini_projet_php')).toBe('miniproject')
    expect(inferRepoKind('mini-project-react')).toBe('miniproject')
  })

  it('detecte cours / course', () => {
    expect(inferRepoKind('cours-php')).toBe('course')
    expect(inferRepoKind('course-react')).toBe('course')
  })

  it('detecte groupe etudiant', () => {
    expect(inferRepoKind('groupe-equipe-a')).toBe('group')
    expect(inferRepoKind('team-1')).toBe('group')
    expect(inferRepoKind('group-react')).toBe('group')
    expect(inferRepoKind('rendu-equipe-b')).toBe('group')
  })

  it('detecte projet (apres group pour ne pas confondre group-project)', () => {
    expect(inferRepoKind('projet-final')).toBe('project')
    expect(inferRepoKind('project-2024')).toBe('project')
  })

  it('detecte etudiant individuel (Nom-Prenom capitalise, v2.66)', () => {
    expect(inferRepoKind('Astruc-Sebastien')).toBe('student')
    expect(inferRepoKind('Bougette-Jean')).toBe('student')
    expect(inferRepoKind('Chahbouni-Ali')).toBe('student')
    expect(inferRepoKind('Rohan-Fosse')).toBe('student')
    expect(inferRepoKind('Mekhmoukhen-Laurys')).toBe('student')
  })

  it('ne detecte PAS comme student les patterns ambigus', () => {
    // lowercase n'a pas le pattern Capitalize-Capitalize
    expect(inferRepoKind('astruc-sebastien')).toBe('course')
    // un seul mot
    expect(inferRepoKind('Sebastien')).toBe('course')
    // chiffres
    expect(inferRepoKind('Eleve-2024')).toBe('course')
  })

  it('defaut prudent : course pour les noms ambigus', () => {
    expect(inferRepoKind('random-name')).toBe('course')
    expect(inferRepoKind('truc')).toBe('course')
  })

  it('robuste aux entrees invalides', () => {
    expect(inferRepoKind(null)).toBe('course')
    expect(inferRepoKind(undefined)).toBe('course')
    expect(inferRepoKind(42)).toBe('course')
  })

  it('toutes les valeurs retournees sont dans KIND_VALUES', () => {
    const samples = ['readme', 'prosit-x', 'workshop-1', 'mini-projet', 'cours', 'groupe-a', 'project', 'rand']
    for (const s of samples) {
      expect(KIND_VALUES).toContain(inferRepoKind(s))
    }
  })
})
