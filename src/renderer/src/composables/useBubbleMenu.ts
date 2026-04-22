/**
 * Menu contextuel, lightbox, couleur d'avatar et rendu HTML d'un message.
 * Used by ChatBubble.vue
 */
import { ref, computed } from 'vue'
import { Pin, PinOff, Copy, Trash2, Pencil, Reply, AlertTriangle, Bookmark, BookmarkCheck, Link2, MessageCircle, Hash } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useToast }         from '@/composables/useToast'
import { avatarColor }      from '@/utils/format'
import { renderMessageContent } from '@/utils/html'
import type { ContextMenuItem, ContextMenuQuickEmoji } from '@/components/ui/ContextMenu.vue'
import type { Message } from '@/types'

export interface MenuReactType { type: string; emoji: string }

interface MenuDeps {
  isMine:   () => boolean
  isPinned: () => boolean
  canEdit:  () => boolean
  canDelete: () => boolean
  onReply:      () => void
  copyMessage:  () => void | Promise<void>
  startEdit:    () => void | Promise<void>
  togglePin:    () => void
  deleteMessage: () => void
  reportingMsg: { value: boolean }
  /** Set de reactions rapides (aligne sur le hover pill : meme types/emojis).
   *  Fonction pour rester reactif aux changements de favoris utilisateur. */
  quickReactTypes?: () => readonly MenuReactType[]
  reactWithType?: (type: string) => void
  bookmark?: {
    isBookmarked: () => boolean
    toggle:       () => void
  }
}

/**
 * Context menu, lightbox, couleur, contenu rendu.
 */
export function useBubbleMenu(
  msg: () => Message,
  searchTerm: () => string,
  deps: MenuDeps,
) {
  const appStore = useAppStore()
  const { showToast } = useToast()

  // ── Lightbox
  const lightboxUrl = ref<string | null>(null)

  // ── Menu ···
  const showMenu = ref(false)

  // ── Context menu (clic droit)
  const ctxVisible = ref(false)
  const ctxX       = ref(0)
  const ctxY       = ref(0)

  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    ctxX.value = e.clientX
    ctxY.value = e.clientY
    ctxVisible.value = true
  }

  async function copyPermalink() {
    const m = msg()
    const href = m.channel_id
      ? `cursus://channel/${m.channel_id}/message/${m.id}`
      : `cursus://dm/${m.dm_student_id ?? 0}/message/${m.id}`
    await navigator.clipboard.writeText(href)
    showToast('Lien du message copié.', 'success')
  }
  async function copyId() {
    await navigator.clipboard.writeText(String(msg().id))
    showToast('ID copié.', 'success')
  }
  async function copyAuthor() {
    await navigator.clipboard.writeText(msg().author_name)
    showToast('Nom copié.', 'success')
  }
  function openDmWithAuthor() {
    const authorId = msg().author_id
    const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (authorId == null || !pid) return
    appStore.openDm(authorId, pid, msg().author_name)
  }

  const ctxItems = computed<ContextMenuItem[]>(() => {
    const bookmark = deps.bookmark
    const isBookmarked = bookmark?.isBookmarked() ?? false
    const mine = deps.isMine()
    const items: ContextMenuItem[] = [
      { label: 'Répondre',         icon: Reply, action: () => { deps.onReply(); showMenu.value = false } },
      { label: 'Copier le texte',  icon: Copy,  action: () => { deps.copyMessage(); showMenu.value = false } },
      { label: 'Copier le lien',   icon: Link2, action: () => copyPermalink() },
      { label: 'Copier l\'ID',     icon: Hash,  action: () => copyId() },
      { label: 'Copier l\'auteur', icon: Copy,  action: () => copyAuthor() },
    ]
    if (bookmark) {
      items.push({
        label: isBookmarked ? 'Retirer le signet' : 'Mettre en signet',
        icon: isBookmarked ? BookmarkCheck : Bookmark,
        separator: true,
        action: () => { bookmark.toggle(); showMenu.value = false },
      })
    }
    if (!mine && msg().author_id != null) {
      items.push({
        label: 'Envoyer un message à l\'auteur',
        icon: MessageCircle,
        separator: true,
        action: () => { openDmWithAuthor(); showMenu.value = false },
      })
    }
    if (deps.canEdit()) {
      items.push({ label: 'Modifier', icon: Pencil, separator: true, action: () => { deps.startEdit(); showMenu.value = false } })
    }
    if (appStore.isTeacher) {
      items.push({
        label: deps.isPinned() ? 'Désépingler' : 'Épingler',
        icon: deps.isPinned() ? PinOff : Pin,
        separator: true,
        action: () => { deps.togglePin(); showMenu.value = false },
      })
    }
    if (!mine) {
      items.push({ label: 'Signaler', icon: AlertTriangle, separator: true, action: () => { deps.reportingMsg.value = true } })
    }
    if (deps.canDelete()) {
      items.push({ label: 'Supprimer', icon: Trash2, danger: true, separator: mine, action: () => { deps.deleteMessage(); showMenu.value = false } })
    }
    return items
  })

  // ── Computed: contenu rendu + couleur avatar
  const content = computed(() =>
    renderMessageContent(msg().content, searchTerm(), appStore.currentUser?.name ?? ''),
  )

  const color = computed(() => {
    if (deps.isMine() && appStore.currentUser) {
      const t = appStore.currentUser.type
      if (t === 'teacher') return 'var(--accent)'
      if (t === 'ta')      return 'var(--color-ta)'
    }
    return avatarColor(msg().author_name)
  })

  // ── Image preview
  const imagePreviewUrl = computed<string | null>(() => {
    const m = msg().content.match(
      /(https?:\/\/[^\s"<>]+\.(?:png|jpg|jpeg|gif|webp|svg))(?:\s|$)/i,
    )
    return m ? m[1] : null
  })

  // ── Close all
  function closeAll(showPicker: { value: boolean }, confirmingDelete: { value: boolean }) {
    showMenu.value = false
    showPicker.value = false
    confirmingDelete.value = false
  }

  const ctxQuickEmojiItems = computed<ContextMenuQuickEmoji[]>(() => {
    const types = deps.quickReactTypes?.() ?? []
    if (!deps.reactWithType || types.length === 0) return []
    return types.map(r => ({
      emoji: r.emoji,
      label: `Réagir avec ${r.emoji}`,
      action: () => { deps.reactWithType!(r.type) },
    }))
  })

  return {
    lightboxUrl, showMenu,
    ctxVisible, ctxX, ctxY, onContextMenu, ctxItems, ctxQuickEmojiItems,
    content, color, imagePreviewUrl,
    closeAll,
    // Actions aussi exposees a la pill d'actions (MessageActionPill) pour
    // eviter la duplication avec le menu contextuel clic-droit.
    copyPermalink, openDmWithAuthor,
  }
}
