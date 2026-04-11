/**
 * Helpers purs partages entre :
 *  - DevoirChapterLinksSection.vue (vue prof : chapitres lies a un devoir)
 *  - LumenChapterPickerModal.vue   (picker pour ajouter une liaison)
 *  - LumenDevoirChapterHints.vue   (vue etudiant)
 *
 * Toute la logique de presentation (extraction de titre depuis le manifest,
 * cle composite repoId::path, filtrage, tri) vit ici pour pouvoir etre
 * testee sans monter de composant Vue.
 */
import type { LumenChapter, LumenLinkedChapter, LumenRepo } from '@/types'

export interface DisplayChapter {
  repoId: number
  path: string
  title: string
  projectName: string
  key: string
}

export interface PickerEntry {
  repoId: number
  repoLabel: string
  chapter: LumenChapter
  key: string
  alreadyLinked: boolean
}

/**
 * Cle composite stable pour identifier un (repo, chapitre) dans une Set ou
 * un Map. Utilisee pour comparer les listes "deja lies" / "candidats".
 */
export function chapterKey(repoId: number, chapterPath: string): string {
  return `${repoId}::${chapterPath}`
}

/**
 * Transforme la shape `LumenLinkedChapter` (telle que retournee par
 * `getLumenChaptersForTravail`) en shape d'affichage. Le titre humain est
 * extrait du `manifest_json` si possible, sinon on tombe sur le path brut.
 * Le nom de projet utilise `manifest.project` si dispo, sinon `owner/repo`.
 *
 * Manifest invalide ou absent → fallback silencieux. Le but est qu'aucune
 * erreur d'auteur (manifest casse) ne plante la liste cote prof.
 */
export function toDisplayChapter(linked: LumenLinkedChapter): DisplayChapter {
  let title = linked.chapter_path
  let projectName = `${linked.owner}/${linked.repo}`
  if (linked.manifest_json) {
    try {
      const m = JSON.parse(linked.manifest_json) as {
        project?: string
        chapters?: Array<{ path: string; title: string }>
      }
      const ch = m.chapters?.find((x) => x.path === linked.chapter_path)
      if (ch?.title) title = ch.title
      if (m.project) projectName = m.project
    } catch {
      // Manifest casse : on garde les fallbacks ci-dessus.
    }
  }
  return {
    repoId: linked.repo_id,
    path: linked.chapter_path,
    title,
    projectName,
    key: chapterKey(linked.repo_id, linked.chapter_path),
  }
}

/**
 * Construit le Set de cles deja-liees a partir d'une liste d'affichage.
 * Utilise par le picker pour griser les chapitres deja attaches.
 */
export function buildLinkedKeys(displays: ReadonlyArray<DisplayChapter>): Set<string> {
  return new Set(displays.map((d) => d.key))
}

/**
 * Aplatit la liste des repos en entries de picker. Chaque repo expose ses
 * chapitres via `manifest.chapters`. Un chapitre marque comme `alreadyLinked`
 * sera grise dans l'UI.
 */
export function buildPickerEntries(
  repos: ReadonlyArray<LumenRepo>,
  alreadyLinkedKeys: ReadonlySet<string>,
): PickerEntry[] {
  const out: PickerEntry[] = []
  for (const repo of repos) {
    const project = repo.manifest?.project ?? repo.fullName
    const chapters = repo.manifest?.chapters ?? []
    for (const ch of chapters) {
      const key = chapterKey(repo.id, ch.path)
      out.push({
        repoId: repo.id,
        repoLabel: project,
        chapter: ch,
        key,
        alreadyLinked: alreadyLinkedKeys.has(key),
      })
    }
  }
  return out
}

/**
 * Filtre les entries du picker en fonction d'une requete texte. Recherche
 * insensible a la casse sur le titre, le chemin et le nom de projet.
 * Une requete vide renvoie l'integralite. Tres petites listes (<1000)
 * donc pas d'index inverse, juste un filter().
 */
export function filterPickerEntries(
  entries: ReadonlyArray<PickerEntry>,
  query: string,
): PickerEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries.slice()
  return entries.filter((e) =>
    e.chapter.title.toLowerCase().includes(q)
    || e.chapter.path.toLowerCase().includes(q)
    || e.repoLabel.toLowerCase().includes(q),
  )
}

/**
 * Pour le support des deep-links `?anchor=section-id` dans Lumen :
 * verifie qu'une ancre cible existe parmi les headings extraits du DOM
 * du chapitre. Renvoie l'id si match, null sinon. Permet au viewer de
 * decider entre `scrollIntoView(anchor)` et `scrollTo({top: 0})`.
 */
export function resolveAnchorTarget(
  anchor: string | null | undefined,
  headingIds: ReadonlyArray<string>,
): string | null {
  if (!anchor) return null
  return headingIds.includes(anchor) ? anchor : null
}
