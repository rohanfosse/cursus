/**
 * useChapterCompanion : toggle vers le PDF / TeX / markdown compagnon d'un
 * chapitre Lumen. Ex : scrum.md + scrum.pdf, qcm.pdf + qcm.tex.
 *
 * Reset automatique au changement de chapitre. Auto-open PDF pour les
 * chapitres Marp (les etudiants preferent le PDF imprimable).
 */
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import { useToast } from '@/composables/useToast'
import type { LumenChapter, LumenRepo } from '@/types'

export type CompanionKind = 'pdf' | 'tex' | 'markdown'

export function useChapterCompanion(
  repo: Ref<LumenRepo>,
  chapter: Ref<LumenChapter>,
  chapterKind: Ref<'markdown' | 'pdf' | 'tex' | 'ipynb'>,
  isMarp: Ref<boolean>,
) {
  const { showToast } = useToast()

  const mode = ref(false)
  const content = ref<string | null>(null)
  const loading = ref(false)
  const kind = ref<CompanionKind | null>(null)

  const path = computed<string | null>(() =>
    chapter.value.companionPdf ?? chapter.value.companionTex ?? null,
  )
  const has = computed<boolean>(() => Boolean(path.value))

  const toggleLabel = computed<string>(() => {
    if (mode.value) {
      if (isMarp.value) return 'Voir les slides'
      return chapterKind.value === 'markdown' ? 'Voir le markdown' : 'Voir le rendu'
    }
    if (chapter.value.companionPdf) return 'Voir le PDF'
    if (chapter.value.companionTex) return 'Voir le source'
    return ''
  })

  async function toggle(): Promise<void> {
    if (!path.value) return
    if (mode.value) {
      mode.value = false
      return
    }
    loading.value = true
    try {
      const resp = await window.api.getLumenChapterContent(repo.value.id, path.value) as {
        ok: boolean
        data?: { content: string; sha: string; kind?: string }
        error?: string
      }
      if (!resp?.ok || !resp.data) {
        showToast(resp?.error || 'Impossible de charger le compagnon', 'error')
        return
      }
      content.value = resp.data.content
      kind.value = (resp.data.kind as CompanionKind | undefined) ?? 'markdown'
      mode.value = true
    } catch (err) {
      showToast((err as { message?: string })?.message || 'Erreur reseau', 'error')
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    mode.value = false
    content.value = null
    kind.value = null
  }

  watch(() => chapter.value.path, reset)

  watch(isMarp, (marp) => {
    if (marp && chapter.value.companionPdf && !mode.value) toggle()
  })

  const texHtml = computed<string>(() => {
    if (!mode.value || kind.value !== 'tex' || !content.value) return ''
    const fenced = '```latex\n' + content.value + '\n```'
    return renderMarkdown(fenced, { chapterPath: path.value ?? '' })
  })

  return { mode, content, loading, kind, path, has, toggleLabel, toggle, reset, texHtml }
}
