/**
 * useChapterOutline : extraction des headings du DOM rendu + scrollspy via
 * IntersectionObserver + persistance de l'etat ouvert/ferme du panneau.
 *
 * L'appelant doit fournir bodyRef (element qui contient le markdown rendu)
 * et appeler `rebuild()` apres chaque (re-)rendu (via enrichRender / watch).
 */
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import type { Ref } from 'vue'

export interface HeadingEntry {
  id: string
  text: string
  level: number
}

const OUTLINE_STATE_KEY = 'lumen.outlineOpen'

function readInitialOpen(): boolean {
  try {
    const v = localStorage.getItem(OUTLINE_STATE_KEY)
    if (v !== null) return v === '1'
    return typeof window !== 'undefined' ? window.innerWidth >= 1400 : true
  } catch {
    return true
  }
}

export function useChapterOutline(bodyRef: Ref<HTMLElement | null>) {
  const headings = ref<HeadingEntry[]>([])
  const activeHeadingId = ref<string | null>(null)
  const open = ref<boolean>(readInitialOpen())

  watch(open, (v) => {
    try { localStorage.setItem(OUTLINE_STATE_KEY, v ? '1' : '0') } catch { /* noop */ }
  })

  let observer: IntersectionObserver | null = null

  function disconnect() {
    if (observer) {
      observer.disconnect()
      observer = null
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
  }

  function extractHeadings(root: HTMLElement): HeadingEntry[] {
    const nodes = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
    const result: HeadingEntry[] = []
    nodes.forEach((el) => {
      if (!el.id) return
      if (el.closest('.lumen-admonition')) return
      result.push({
        id: el.id,
        text: el.textContent?.trim() ?? '',
        level: Number(el.tagName.slice(1)),
      })
    })
    return result
  }

  /**
   * Reconstruit la liste des headings a partir du DOM courant et re-attache
   * le scrollspy. A appeler apres chaque rendu ou changement de chapitre.
   * Si noBody=true (pdf / marp / tex), reset a une liste vide.
   */
  function rebuild(noBody = false) {
    if (noBody || !bodyRef.value) {
      headings.value = []
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

  onBeforeUnmount(disconnect)

  return { headings, activeHeadingId, open, rebuild, scrollToHeading }
}
