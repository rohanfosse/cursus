/**
 * Menu contextuel des devoirs : publier/dépublier, éditer, supprimer.
 * Used by DevoirsView.vue
 */
import { ref } from 'vue'
import type { Devoir, GanttRow } from '@/types'
import { useAppStore } from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

type CtxDevoir = (Devoir | GanttRow) & { is_published?: boolean | number }

export function useDevoirContextMenu(loadView: () => Promise<void>) {
  const appStore = useAppStore()
  const modals = useModalsStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const ctxMenu = ref<{ x: number; y: number; devoir: CtxDevoir | null }>({ x: 0, y: 0, devoir: null })

  function openCtxMenu(e: MouseEvent, devoir: CtxDevoir) {
    e.preventDefault()
    e.stopPropagation()
    ctxMenu.value = { x: e.clientX, y: e.clientY, devoir }
  }

  function closeCtxMenu() {
    ctxMenu.value = { x: 0, y: 0, devoir: null }
  }

  async function ctxPublishToggle() {
    const d = ctxMenu.value.devoir
    if (!d) return
    const newVal = !d.is_published
    try {
      await window.api.updateTravailPublished({ travailId: d.id, published: newVal })
      showToast(newVal ? 'Devoir publié.' : 'Devoir dépublié.', 'success')
      loadView()
    } catch (err) { console.warn('[ctxPublishToggle]', err); showToast('Erreur.', 'error') }
    closeCtxMenu()
  }

  async function ctxDuplicate() {
    const d = ctxMenu.value.devoir
    if (!d) return
    const ok = await confirm(`Dupliquer « ${d.title} » ?`, 'info', 'Dupliquer')
    if (!ok) { closeCtxMenu(); return }
    try {
      await window.api.createTravail({
        title: d.title + ' (copie)',
        description: d.description || '',
        deadline: d.deadline,
        channel_id: d.channel_id,
        promo_id: (d as CtxDevoir & { promo_id?: number }).promo_id,
        type: d.type || 'devoir',
        category: d.category || '',
        room: (d as CtxDevoir & { room?: string }).room || '',
        published: false,
      })
      showToast('Devoir dupliqué (brouillon).', 'success')
      loadView()
    } catch (err) { console.warn('[ctxDuplicate]', err); showToast('Erreur lors de la duplication.', 'error') }
    closeCtxMenu()
  }

  async function ctxDelete() {
    const d = ctxMenu.value.devoir
    if (!d) return
    const ok = await confirm(`Supprimer « ${d.title} » ? Les soumissions et notes seront perdues.`, 'danger', 'Supprimer')
    if (!ok) { closeCtxMenu(); return }
    try {
      await window.api.deleteTravail(d.id)
      showToast('Devoir supprimé.', 'success')
      loadView()
    } catch (err) { console.warn('[ctxDelete]', err); showToast('Erreur.', 'error') }
    closeCtxMenu()
  }

  function ctxOpen() {
    const d = ctxMenu.value.devoir
    if (!d) return
    closeCtxMenu()
    appStore.currentTravailId = d.id
    travauxStore.openTravail(d.id)
    modals.gestionDevoir = true
  }

  return {
    ctxMenu,
    openCtxMenu,
    closeCtxMenu,
    ctxPublishToggle,
    ctxDuplicate,
    ctxDelete,
    ctxOpen,
  }
}
