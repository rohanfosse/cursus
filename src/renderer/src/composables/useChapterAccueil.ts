/**
 * useChapterAccueil : detecte si un chapitre est un "Accueil" (README racine
 * ou section Presentation) et calcule le sommaire des autres chapitres du
 * repo, groupes par section. Affiche en bas de la page d'accueil.
 */
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { LumenChapter, LumenRepo } from '@/types'

export interface AccueilTocSection {
  title: string
  chapters: LumenChapter[]
}

export function useChapterAccueil(repo: Ref<LumenRepo>, chapter: Ref<LumenChapter>) {
  const isAccueil = computed(() => {
    const path = chapter.value.path?.toLowerCase() ?? ''
    return path === 'readme.md'
      || path.endsWith('/readme.md')
      || chapter.value.section === 'Presentation'
      || chapter.value.title === 'Accueil'
  })

  const toc = computed<AccueilTocSection[]>(() => {
    if (!isAccueil.value) return []
    const all = repo.value.manifest?.chapters ?? []
    const others = all.filter((c) => c.path !== chapter.value.path)
    const map = new Map<string, LumenChapter[]>()
    for (const c of others) {
      const key = c.section?.trim() || 'Chapitres'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return Array.from(map.entries()).map(([title, chs]) => ({ title, chapters: chs }))
  })

  return { isAccueil, toc }
}
