/**
 * Actions sidebar : mute de canal, menu contextuel (créer, éditer, supprimer canal).
 * Used by AppSidebar.vue
 */
import { ref, computed, watch, nextTick, type Ref } from 'vue'
import { PlusCircle, Pencil, Trash2, VolumeX, Volume2, Lock, Unlock, CheckCheck } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useToast } from '@/composables/useToast'
import { useApi }   from '@/composables/useApi'
import { useConfirm } from '@/composables/useConfirm'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { NO_CAT } from './useSidebarData'
import type { Channel } from '@/types'
import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'

export interface CtxState { x: number; y: number; items: ContextMenuItem[] }

export function useSidebarActions(
  loadTeacherChannels: () => Promise<void>,
) {
  const appStore      = useAppStore()
  const modals        = useModalsStore()
  const { showToast } = useToast()
  const { api }       = useApi()
  const { confirm }   = useConfirm()

  // ── Mute (localStorage) ─────────────────────────────────────────────────
  const MUTE_KEY = computed(() => `cc_muted_${appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0}`)

  function loadMuted(): Set<number> {
    try { return new Set(JSON.parse(localStorage.getItem(MUTE_KEY.value) ?? '[]') as number[]) }
    catch { return new Set() }
  }
  function saveMuted(s: Set<number>) {
    localStorage.setItem(MUTE_KEY.value, JSON.stringify([...s]))
  }

  const mutedIds = ref<Set<number>>(loadMuted())
  watch(MUTE_KEY, () => { mutedIds.value = loadMuted() })

  function isMuted(id: number) { return mutedIds.value.has(id) }
  function toggleMute(ch: Channel) {
    const next = new Set(mutedIds.value)
    if (next.has(ch.id)) { next.delete(ch.id); showToast(`"${ch.name}" retiré de la sourdine.`) }
    else                  { next.add(ch.id);    showToast(`"${ch.name}" mis en sourdine.`) }
    mutedIds.value = next
    saveMuted(next)
  }

  // ── Renommage inline ────────────────────────────────────────────────────
  const renamingChannelId  = ref<number | null>(null)
  const renamingCategory   = ref<string | null>(null)
  const renameValue        = ref('')
  const renameInputEl      = ref<HTMLInputElement | null>(null)

  async function startRenameChannel(ch: Channel) {
    renamingCategory.value  = null
    renamingChannelId.value = ch.id
    renameValue.value       = ch.name
    await nextTick(); renameInputEl.value?.select()
  }
  async function startRenameCategory(cat: string) {
    renamingChannelId.value = null
    renamingCategory.value  = cat
    renameValue.value       = parseCategoryIcon(cat).label || cat
    await nextTick(); renameInputEl.value?.select()
  }
  function cancelRename() {
    renamingChannelId.value = null
    renamingCategory.value  = null
    renameValue.value       = ''
  }

  async function commitRenameChannel() {
    const id   = renamingChannelId.value
    const name = renameValue.value.trim()
    cancelRename()
    if (!id || !name) return
    const res = await api(() => window.api.renameChannel(id, name), 'channel')
    if (res === null) return
    await loadTeacherChannels()
    showToast('Canal renommé.', 'success')
  }

  async function commitRenameCategory() {
    const old  = renamingCategory.value
    const next = renameValue.value.trim()
    cancelRename()
    if (!old || !next || !appStore.activePromoId) return
    const iconPrefix = old.includes(' ') ? old.split(' ')[0] + ' ' : ''
    const newKey = iconPrefix + next
    const res = await api(() => window.api.renameCategory(appStore.activePromoId!, old, newKey), 'channel')
    if (res === null) return
    await loadTeacherChannels()
    showToast('Catégorie renommée.', 'success')
  }

  // ── Menu contextuel ─────────────────────────────────────────────────────
  const ctx = ref<CtxState | null>(null)

  function openCtxCategory(e: MouseEvent, group: { key: string; label: string }) {
    if (!appStore.isStaff) return
    ctx.value = {
      x: e.clientX, y: e.clientY,
      items: [
        {
          label: 'Ajouter un canal ici',
          icon:  PlusCircle,
          action: () => {
            appStore.pendingChannelCategory = group.key
            modals.createChannel = true
          },
        },
        {
          label: 'Renommer la catégorie',
          icon:  Pencil,
          action: () => startRenameCategory(group.key),
        },
        {
          label: 'Dissoudre la catégorie',
          icon:  Trash2,
          danger: true,
          separator: true,
          action: async () => {
            if (!appStore.activePromoId) return
            if (!await confirm(`Dissoudre la catégorie « ${group.key} » ? Les canaux seront déplacés hors catégorie.`, 'warning', 'Dissoudre')) return
            const res = await api(() => window.api.deleteCategory(appStore.activePromoId!, group.key), 'channel')
            if (res === null) return
            await loadTeacherChannels()
            showToast('Catégorie dissoute.', 'success')
          },
        },
      ],
    }
  }

  function openCtxChannel(e: MouseEvent, ch: Channel) {
    const items: ContextMenuItem[] = [
      {
        label:  isMuted(ch.id) ? 'Retirer la sourdine' : 'Mettre en sourdine',
        icon:   isMuted(ch.id) ? Volume2 : VolumeX,
        action: () => toggleMute(ch),
      },
      {
        label:  'Marquer comme lu',
        icon:   CheckCheck,
        action: () => appStore.markRead(ch.id),
      },
    ]

    // Staff-only actions
    if (appStore.isStaff) {
      items.unshift({
        label: 'Renommer',
        icon:  Pencil,
        action: () => startRenameChannel(ch),
      })
    }

    if (appStore.isStaff) {
      items.push(
        {
          label:  ch.is_private ? 'Rendre public' : 'Rendre privé',
          icon:   ch.is_private ? Unlock : Lock,
          action: async () => {
            const newPrivate = !ch.is_private
            const r = await api(() => window.api.updateChannelPrivacy(ch.id, newPrivate), 'channel')
            if (r === null) return
            await loadTeacherChannels()
            showToast(newPrivate ? 'Canal rendu privé.' : 'Canal rendu public.', 'success')
          },
        },
        {
          label: 'Supprimer le canal',
          icon:  Trash2,
          danger: true,
          separator: true,
          action: async () => {
            if (!await confirm(`Supprimer le canal « #${ch.name} » et tous ses messages ? Cette action est irréversible.`, 'danger', 'Supprimer')) return
            const res = await api(() => window.api.deleteChannel(ch.id), 'channel')
            if (res === null) return
            if (appStore.activeChannelId === ch.id) appStore.activeChannelId = null
            await loadTeacherChannels()
            showToast('Canal supprimé.', 'success')
          },
        },
      )
    }

    ctx.value = { x: e.clientX, y: e.clientY, items }
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────
  const draggingChannel  = ref<Channel | null>(null)
  const dragOverCategory = ref<string | null>(null)

  function onDragStart(e: DragEvent, ch: Channel) {
    draggingChannel.value = ch
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('text/plain', String(ch.id))
  }

  function onDragEnd() {
    draggingChannel.value  = null
    dragOverCategory.value = null
  }

  function onDragOver(e: DragEvent, groupKey: string) {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    dragOverCategory.value = groupKey
  }

  function onDragLeave(e: DragEvent, groupKey: string) {
    const related = e.relatedTarget as Node | null
    const target  = e.currentTarget as HTMLElement
    if (!related || !target.contains(related)) {
      if (dragOverCategory.value === groupKey) dragOverCategory.value = null
    }
  }

  async function onDrop(e: DragEvent, groupKey: string) {
    e.preventDefault()
    const ch = draggingChannel.value
    draggingChannel.value  = null
    dragOverCategory.value = null
    if (!ch) return
    const newCategory = groupKey === NO_CAT ? null : groupKey
    if ((ch.category ?? null) === newCategory) return
    const res = await api(() => window.api.updateChannelCategory(ch.id, newCategory), 'channel')
    if (res === null) return
    await loadTeacherChannels()
  }

  return {
    // Mute
    MUTE_KEY,
    mutedIds,
    isMuted,
    toggleMute,
    // Rename
    renamingChannelId,
    renamingCategory,
    renameValue,
    renameInputEl,
    startRenameChannel,
    startRenameCategory,
    cancelRename,
    commitRenameChannel,
    commitRenameCategory,
    // Context menus
    ctx,
    openCtxCategory,
    openCtxChannel,
    // Drag & drop
    draggingChannel,
    dragOverCategory,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
  }
}
