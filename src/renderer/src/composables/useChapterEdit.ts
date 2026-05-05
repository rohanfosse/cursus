/**
 * useChapterEdit : edition inline d'un chapitre Lumen (markdown ou tex).
 *
 * v2.283 — refonte UX :
 *  - persistance brouillon en localStorage (debounce 800ms) pour ne JAMAIS
 *    perdre du contenu meme si l'utilisateur quitte / crash / change de page.
 *    Cle = `lumen-edit-draft:v1:<repoId>:<path>`. Restoree automatiquement
 *    a la reouverture de l'edition si differente du contenu remote.
 *  - etat `saveState` granulaire (idle / dirty / saving / saved / conflict
 *    / error) pour piloter l'indicateur visuel ("Brouillon enregistre",
 *    "Publication...", "Conflit").
 *  - detection de conflit Git (HTTP 409) : rendu actionnable avec
 *    reloadFromRemote() qui rafraichit le SHA + le contenu.
 *  - exit() ne perd plus le draft : il est deja sauvegarde en local. La
 *    discardDraftAndReset() permet d'annuler explicitement.
 *
 * Le commit GitHub reste manuel (bouton Publier) — auto-commit ferait
 * exploser l'historique git. La sauvegarde locale couvre la perte de donnees.
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import { renderTex } from '@/utils/texRenderer'
import { useToast } from '@/composables/useToast'
import { useLumenStore } from '@/stores/lumen'
import type { LumenChapter, LumenRepo } from '@/types'

export type EditSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'

export interface UseChapterEditArgs {
  repo: Ref<LumenRepo>
  chapter: Ref<LumenChapter>
  content: Ref<string | null | undefined>
  contentSha: Ref<string | null | undefined>
  isTeacher: Ref<boolean>
  chapterKind: Ref<'markdown' | 'pdf' | 'tex' | 'ipynb'>
  isMarp: Ref<boolean>
}

const DRAFT_DEBOUNCE_MS = 800
const DRAFT_KEY_PREFIX = 'lumen-edit-draft:v1:'
const SAVED_FLASH_MS = 1500

function draftKey(repoId: number, path: string): string {
  return `${DRAFT_KEY_PREFIX}${repoId}:${path}`
}

export function useChapterEdit(args: UseChapterEditArgs) {
  const { showToast } = useToast()
  const lumenStore = useLumenStore()

  const editMode = ref(false)
  const draft = ref('')
  const message = ref('')
  const saving = ref(false)
  const previewOpen = ref(true)
  const lastSavedAt = ref<string | null>(null)
  const saveState = ref<EditSaveState>('idle')
  const hasRestoredDraft = ref(false)
  const showCommitMessage = ref(false)

  let draftTimer: ReturnType<typeof setTimeout> | null = null
  let savedFlashTimer: ReturnType<typeof setTimeout> | null = null

  const previewHtml = computed(() => {
    if (!previewOpen.value || !draft.value) return ''
    if (args.chapterKind.value === 'tex') return renderTex(draft.value)
    return renderMarkdown(draft.value, { chapterPath: args.chapter.value.path })
  })

  const canEdit = computed(() =>
    args.isTeacher.value
    && (args.chapterKind.value === 'markdown' || args.chapterKind.value === 'tex')
    && !args.isMarp.value
    && args.content.value != null
    && Boolean(args.contentSha.value),
  )

  const isDirty = computed(() => {
    if (!editMode.value) return false
    return draft.value !== (args.content.value ?? '')
  })

  function persistDraft(value: string): void {
    if (!editMode.value) return
    try {
      localStorage.setItem(draftKey(args.repo.value.id, args.chapter.value.path), value)
    } catch {
      // localStorage plein ou desactive : on ignore, la sauvegarde manuelle
      // reste possible.
    }
  }

  function clearDraft(): void {
    try {
      localStorage.removeItem(draftKey(args.repo.value.id, args.chapter.value.path))
    } catch {
      /* ignore */
    }
  }

  function readDraft(): string | null {
    try {
      return localStorage.getItem(draftKey(args.repo.value.id, args.chapter.value.path))
    } catch {
      return null
    }
  }

  // Persistance localStorage debouncee a chaque modification du draft.
  // saveState bascule en 'dirty' immediatement pour signaler a l'utilisateur
  // que des modifications non publiees existent.
  watch(draft, (next) => {
    if (!editMode.value) return
    if (draftTimer) clearTimeout(draftTimer)
    if (saveState.value !== 'saving' && isDirty.value) {
      saveState.value = 'dirty'
    } else if (!isDirty.value && saveState.value !== 'saved') {
      saveState.value = 'idle'
    }
    draftTimer = setTimeout(() => persistDraft(next), DRAFT_DEBOUNCE_MS)
  })

  function enter(): void {
    if (!canEdit.value) return
    if (args.content.value == null) return
    const stored = readDraft()
    const original = args.content.value
    if (stored != null && stored !== original) {
      // Brouillon precedent detecte : on l'utilise et on signale a l'UI.
      draft.value = stored
      hasRestoredDraft.value = true
      saveState.value = 'dirty'
    } else {
      draft.value = original
      hasRestoredDraft.value = false
      saveState.value = 'idle'
    }
    message.value = ''
    showCommitMessage.value = false
    editMode.value = true
  }

  function discardDraftAndReset(): void {
    clearDraft()
    if (args.content.value != null) {
      draft.value = args.content.value
    }
    hasRestoredDraft.value = false
    saveState.value = 'idle'
    showToast('Brouillon supprime, contenu d\'origine restaure', 'info')
  }

  function exit(): void {
    if (saving.value) return
    if (draftTimer) {
      clearTimeout(draftTimer)
      draftTimer = null
      // Persiste immediatement la valeur courante avant de sortir, le
      // debounce n'a peut-etre pas eu le temps de tirer.
      if (isDirty.value) persistDraft(draft.value)
    }
    if (savedFlashTimer) {
      clearTimeout(savedFlashTimer)
      savedFlashTimer = null
    }
    editMode.value = false
  }

  // Le backend lance AppError 409 avec un message prefixe "Conflit :" quand
  // le SHA git est obsolete (cf. server/routes/lumen.js writeFileWithAuth).
  // On detecte les deux signaux au cas ou le wrapper http omet le status.
  function isConflictError(resp: { error?: string; status?: number } | null | undefined): boolean {
    if (!resp) return false
    if (resp.status === 409) return true
    return /^conflit\b/i.test((resp.error ?? '').trim())
  }

  async function save(): Promise<void> {
    if (saving.value) return
    if (!isDirty.value) {
      showToast('Aucune modification a publier', 'info')
      return
    }
    if (!args.contentSha.value) {
      saveState.value = 'error'
      showToast('SHA du fichier introuvable, recharge le chapitre', 'error')
      return
    }
    saving.value = true
    saveState.value = 'saving'
    try {
      const trimmed = message.value.trim()
      const commitMessage = trimmed || `docs(${args.chapter.value.path}): edition`
      const resp = await window.api.updateLumenChapterFile(args.repo.value.id, {
        path: args.chapter.value.path,
        content: draft.value,
        sha: args.contentSha.value,
        message: commitMessage,
      }) as { ok: boolean; error?: string; status?: number }
      if (!resp?.ok) {
        if (isConflictError(resp)) {
          saveState.value = 'conflict'
          showToast('Le chapitre a change sur GitHub, recharge avant de republier', 'error')
        } else {
          saveState.value = 'error'
          showToast(resp?.error || 'Echec de la publication', 'error')
        }
        return
      }
      lastSavedAt.value = new Date().toISOString()
      hasRestoredDraft.value = false
      clearDraft()
      saveState.value = 'saved'
      showToast('Chapitre publie sur GitHub', 'success')
      message.value = ''
      showCommitMessage.value = false
      // Re-fetch pour synchroniser SHA + content. Le draft.value sera realigne
      // sur le nouveau content (sinon isDirty reste vrai et l'UI le signale).
      await lumenStore.fetchChapterContent(args.repo.value.id, args.chapter.value.path)
      if (args.content.value != null) {
        draft.value = args.content.value
      }
      if (savedFlashTimer) clearTimeout(savedFlashTimer)
      savedFlashTimer = setTimeout(() => {
        if (saveState.value === 'saved') saveState.value = 'idle'
      }, SAVED_FLASH_MS)
    } catch (err) {
      saveState.value = 'error'
      showToast((err as { message?: string })?.message || 'Erreur reseau', 'error')
    } finally {
      saving.value = false
    }
  }

  async function reloadFromRemote(): Promise<void> {
    await lumenStore.fetchChapterContent(args.repo.value.id, args.chapter.value.path)
    if (args.content.value != null) {
      draft.value = args.content.value
    }
    clearDraft()
    hasRestoredDraft.value = false
    saveState.value = 'idle'
    showToast('Chapitre rafraichi depuis GitHub', 'info')
  }

  onBeforeUnmount(() => {
    if (draftTimer) clearTimeout(draftTimer)
    if (savedFlashTimer) clearTimeout(savedFlashTimer)
  })

  return {
    editMode,
    draft,
    message,
    saving,
    previewOpen,
    previewHtml,
    canEdit,
    isDirty,
    saveState,
    hasRestoredDraft,
    lastSavedAt,
    showCommitMessage,
    enter,
    exit,
    save,
    reloadFromRemote,
    discardDraftAndReset,
  }
}
