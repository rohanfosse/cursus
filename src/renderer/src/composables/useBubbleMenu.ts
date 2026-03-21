/**
 * Menu contextuel, lightbox, couleur d'avatar et rendu HTML d'un message.
 * Used by ChatBubble.vue
 */
import { ref, computed } from 'vue'
import { Pin, PinOff, Copy, Trash2, Pencil, Reply, AlertTriangle } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { avatarColor }      from '@/utils/format'
import { renderMessageContent } from '@/utils/html'
import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import type { Message } from '@/types'

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

  const ctxItems = computed<ContextMenuItem[]>(() => [
    { label: 'Répondre',  icon: Reply,  action: () => { deps.onReply(); showMenu.value = false } },
    { label: 'Copier',    icon: Copy,   action: () => { deps.copyMessage(); showMenu.value = false } },
    ...(deps.canEdit()    ? [{ label: 'Modifier',   icon: Pencil, action: () => { deps.startEdit(); showMenu.value = false } }] : []),
    ...(appStore.isTeacher
      ? [{ label: deps.isPinned() ? 'Désépingler' : 'Épingler', icon: deps.isPinned() ? PinOff : Pin, action: () => { deps.togglePin(); showMenu.value = false } }]
      : []),
    ...(!deps.isMine() ? [{ label: 'Signaler', icon: AlertTriangle, separator: true, action: () => { deps.reportingMsg.value = true } }] : []),
    ...(deps.canDelete()  ? [{ label: 'Supprimer',  icon: Trash2, danger: true, separator: !deps.isMine() ? false : true, action: () => { deps.deleteMessage(); showMenu.value = false } }] : []),
  ])

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

  return {
    lightboxUrl, showMenu,
    ctxVisible, ctxX, ctxY, onContextMenu, ctxItems,
    content, color, imagePreviewUrl,
    closeAll,
  }
}
