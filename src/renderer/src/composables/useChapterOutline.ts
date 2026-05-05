/**
 * useChapterOutline : extraction des headings du DOM rendu + scrollspy via
 * IntersectionObserver + persistance de l'etat ouvert/ferme du panneau.
 *
 * v2.287 — enrichi avec :
 *  - numbering hierarchique automatique ("1", "1.1", "2.1.3"…)
 *  - parentChain : pour mettre en surbrillance le chemin parent du
 *    heading actif (tree-line moderne)
 *  - readingProgress : 0..1 calcule sur le scroll du body, partage avec
 *    l'outline pour afficher une mini-barre verticale dans la rail
 *
 * L'appelant doit fournir bodyRef (element qui contient le markdown rendu)
 * et appeler `rebuild()` apres chaque (re-)rendu (via enrichRender / watch).
 */
import { ref, computed, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import type { Ref } from 'vue'

export interface HeadingEntry {
  id: string
  text: string
  level: number
  /** Numerotation hierarchique calculee ("1", "1.1", "2.1.3"…). v2.287. */
  number: string
  /** Profondeur visuelle compressee (1..N) — gere les sauts de niveau. v2.287. */
  depth: number
  /** Index du heading dans la liste plate (utile pour mini-map). v2.287. */
  index: number
}

const OUTLINE_STATE_KEY = 'lumen.outlineOpen'
const OUTLINE_WIDTH_KEY = 'lumen.outlineWidth'
const OUTLINE_FOCUS_KEY = 'lumen.outlineReadingFocus'
const OUTLINE_NUMBER_KEY = 'lumen.outlineNumbered'

const MIN_OUTLINE_WIDTH = 200
const MAX_OUTLINE_WIDTH = 400
const DEFAULT_OUTLINE_WIDTH = 240

function readInitialOpen(): boolean {
  try {
    const v = localStorage.getItem(OUTLINE_STATE_KEY)
    if (v !== null) return v === '1'
    return typeof window !== 'undefined' ? window.innerWidth >= 1400 : true
  } catch {
    return true
  }
}

function readNumber<T extends number>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    const n = Number(v)
    return (Number.isFinite(n) ? n : fallback) as T
  } catch {
    return fallback
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return v === '1'
  } catch {
    return fallback
  }
}

/**
 * Numerotation hierarchique a partir de la liste des headings dans l'ordre
 * du document. Pour chaque heading de niveau L, on truncate la pile de
 * compteurs a L et on incremente le slot L. Resultat : "1", "1.1", "1.2",
 * "2", "2.1", "2.1.1", etc. Les sauts de niveau (ex. h1 -> h3) sont compresses
 * en remplissant les slots manquants avec 0 ; on les masque ensuite dans
 * l'affichage filter.
 */
function computeNumbering(headings: Omit<HeadingEntry, 'number' | 'depth' | 'index'>[]): HeadingEntry[] {
  const counters: number[] = []
  return headings.map((h, index) => {
    counters.length = h.level
    for (let i = 0; i < counters.length; i++) {
      if (counters[i] === undefined) counters[i] = 0
    }
    counters[h.level - 1] = (counters[h.level - 1] ?? 0) + 1
    const visibleParts = counters.filter((c) => c > 0)
    return {
      ...h,
      number: visibleParts.join('.'),
      depth: visibleParts.length,
      index,
    }
  })
}

/**
 * Pour chaque heading, calcule la chaine d'ancetres (ids des headings de
 * niveau superieur qui le contiennent dans la hierarchie). Permet a
 * l'outline d'allumer la "tree line" du chemin actif jusqu'a la racine.
 */
function computeParentChain(headings: HeadingEntry[]): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const stack: HeadingEntry[] = []
  for (const h of headings) {
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop()
    result.set(h.id, stack.map((s) => s.id))
    stack.push(h)
  }
  return result
}

export function useChapterOutline(bodyRef: Ref<HTMLElement | null>) {
  const headings = ref<HeadingEntry[]>([])
  const activeHeadingId = ref<string | null>(null)
  const open = ref<boolean>(readInitialOpen())
  const width = ref<number>(readNumber(OUTLINE_WIDTH_KEY, DEFAULT_OUTLINE_WIDTH))
  const readingFocus = ref<boolean>(readBool(OUTLINE_FOCUS_KEY, false))
  const numbered = ref<boolean>(readBool(OUTLINE_NUMBER_KEY, true))
  const readingProgress = ref<number>(0)

  // Chemin parent du heading courant (utile pour la tree line active).
  const parentChainMap = computed(() => computeParentChain(headings.value))
  const activePath = computed<Set<string>>(() => {
    const id = activeHeadingId.value
    if (!id) return new Set()
    const parents = parentChainMap.value.get(id) ?? []
    return new Set([...parents, id])
  })

  watch(open, (v) => {
    try { localStorage.setItem(OUTLINE_STATE_KEY, v ? '1' : '0') } catch { /* noop */ }
  })
  watch(width, (v) => {
    try { localStorage.setItem(OUTLINE_WIDTH_KEY, String(v)) } catch { /* noop */ }
  })
  watch(readingFocus, (v) => {
    try { localStorage.setItem(OUTLINE_FOCUS_KEY, v ? '1' : '0') } catch { /* noop */ }
  })
  watch(numbered, (v) => {
    try { localStorage.setItem(OUTLINE_NUMBER_KEY, v ? '1' : '0') } catch { /* noop */ }
  })

  let observer: IntersectionObserver | null = null
  let scrollHandler: (() => void) | null = null

  function disconnect() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (scrollHandler && bodyRef.value) {
      bodyRef.value.removeEventListener('scroll', scrollHandler)
      scrollHandler = null
    }
  }

  function setupScrollSpy() {
    disconnect()
    if (!bodyRef.value || headings.value.length === 0) return
    const nodes = bodyRef.value.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
    if (!nodes.length) return

    const visible = new Set<string>()
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (!id) continue
          if (entry.isIntersecting) visible.add(id)
          else visible.delete(id)
        }
        for (const h of headings.value) {
          if (visible.has(h.id)) {
            activeHeadingId.value = h.id
            return
          }
        }
      },
      {
        root: bodyRef.value,
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      },
    )
    nodes.forEach((el) => observer?.observe(el))

    // Suivi de la progression de scroll pour la mini-rail.
    scrollHandler = () => {
      const el = bodyRef.value
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      readingProgress.value = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0
    }
    bodyRef.value.addEventListener('scroll', scrollHandler, { passive: true })
    scrollHandler()
  }

  function extractHeadings(root: HTMLElement): HeadingEntry[] {
    const nodes = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
    const raw: Omit<HeadingEntry, 'number' | 'depth' | 'index'>[] = []
    nodes.forEach((el) => {
      if (!el.id) return
      if (el.closest('.lumen-admonition')) return
      raw.push({
        id: el.id,
        text: el.textContent?.trim() ?? '',
        level: Number(el.tagName.slice(1)),
      })
    })
    return computeNumbering(raw)
  }

  function rebuild(noBody = false) {
    if (noBody || !bodyRef.value) {
      headings.value = []
      activeHeadingId.value = null
      readingProgress.value = 0
      disconnect()
      return
    }
    headings.value = extractHeadings(bodyRef.value)
    nextTick(() => setupScrollSpy())
  }

  function scrollToHeading(id: string) {
    const el = bodyRef.value?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /**
   * Position relative du heading actif dans la liste : 0..1, utile pour
   * afficher un curseur dans la mini-rail quand l'outline est replie.
   */
  const activeIndex = computed<number>(() => {
    const id = activeHeadingId.value
    if (!id) return -1
    return headings.value.findIndex((h) => h.id === id)
  })

  function setWidth(px: number) {
    width.value = Math.max(MIN_OUTLINE_WIDTH, Math.min(MAX_OUTLINE_WIDTH, px))
  }

  onMounted(() => {
    // Si l'utilisateur a une largeur custom hors limites (changement de
    // bornes apres une mise a jour), on la ramene dans la plage.
    setWidth(width.value)
  })

  onBeforeUnmount(disconnect)

  return {
    headings,
    activeHeadingId,
    activeIndex,
    activePath,
    open,
    width,
    readingFocus,
    numbered,
    readingProgress,
    rebuild,
    scrollToHeading,
    setWidth,
    MIN_OUTLINE_WIDTH,
    MAX_OUTLINE_WIDTH,
  }
}
