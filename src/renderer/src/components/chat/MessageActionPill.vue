<script setup lang="ts">
/**
 * MessageActionPill : barre d'actions flottante au survol d'un message.
 *
 * Contenu du menu ··· : uniquement les actions qui ne sont PAS deja dans la
 * barre directe (copy/copy-link/dm/edit/report/delete). Eviter les doublons
 * Reply/Pin qui ont leur bouton direct.
 *
 * A11y :
 * - role="toolbar" sur la barre
 * - aria-haspopup + aria-expanded sur picker et menu
 * - aria-pressed sur pin et bookmark (toggle state)
 * - Menu ··· : navigation clavier (ESC, fleches, Home, End, Tab ferme)
 * - Focus restaure sur le bouton au close
 * - Click-outside ferme menu et picker
 */
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import {
  Pin, PinOff, MoreHorizontal, Copy, Link2, Trash2, Pencil,
  SmilePlus, Bookmark, BookmarkCheck, Reply, AlertTriangle, MessageCircle,
} from 'lucide-vue-next'
import EmojiPicker from '@/components/ui/EmojiPicker.vue'
import { useAppStore } from '@/stores/app'

interface QuickReact { readonly type: string; readonly emoji: string }
interface Props {
  quickReacts: readonly QuickReact[]
  isPinned: boolean
  isBookmarked: boolean
  canEdit: boolean
  canDelete: boolean
  canReport: boolean
  canDmAuthor: boolean
  showPicker: boolean
  showMenu: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:showPicker', v: boolean): void
  (e: 'update:showMenu', v: boolean): void
  (e: 'reply'): void
  (e: 'quick-react', type: string): void
  (e: 'pick-emoji', emoji: string): void
  (e: 'toggle-pin'): void
  (e: 'toggle-bookmark'): void
  (e: 'copy'): void
  (e: 'copy-link'): void
  (e: 'dm-author'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'report'): void
}>()

const appStore = useAppStore()

const menuRef = ref<HTMLElement | null>(null)
const menuBtnRef = ref<HTMLButtonElement | null>(null)

// Quand le menu s'ouvre, focus le premier item (continuite clavier).
watch(() => props.showMenu, async (open) => {
  if (open) {
    await nextTick()
    const items = menuItemEls()
    items[0]?.focus()
  }
})

function menuItemEls(): HTMLButtonElement[] {
  return Array.from(menuRef.value?.querySelectorAll<HTMLButtonElement>('.msg-menu-item') ?? [])
}

function closeMenu() {
  emit('update:showMenu', false)
  // Restaure le focus sur le bouton qui a ouvert le menu.
  menuBtnRef.value?.focus()
}

function onMenuKeydown(e: KeyboardEvent) {
  const items = menuItemEls()
  if (!items.length) return
  const active = document.activeElement as HTMLElement | null
  const currentIdx = items.findIndex(el => el === active)

  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      closeMenu()
      break
    case 'ArrowDown':
      e.preventDefault()
      items[(currentIdx + 1) % items.length].focus()
      break
    case 'ArrowUp':
      e.preventDefault()
      items[(currentIdx - 1 + items.length) % items.length].focus()
      break
    case 'Home':
      e.preventDefault()
      items[0].focus()
      break
    case 'End':
      e.preventDefault()
      items[items.length - 1].focus()
      break
    case 'Tab':
      // Tab ferme le menu et laisse le focus aller au composant suivant
      // — comportement attendu pour un menu popup (pas un trap).
      closeMenu()
      break
  }
}

// Click-outside : ferme menu ou picker quand on clique en dehors.
function onGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return
  if (props.showMenu && !target.closest('.pill-menu-wrap')) {
    emit('update:showMenu', false)
  }
  if (props.showPicker && !target.closest('.pill-picker-wrap')) {
    emit('update:showPicker', false)
  }
}

onMounted(() => {
  document.addEventListener('click', onGlobalClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onGlobalClick)
})
</script>

<template>
  <div class="msg-action-pill" role="toolbar" aria-label="Actions du message">
    <button
      class="pill-btn"
      title="Répondre"
      aria-label="Répondre au message"
      @click.stop="$emit('reply')"
    >
      <Reply :size="14" aria-hidden="true" />
    </button>

    <button
      v-for="r in quickReacts"
      :key="r.type"
      class="pill-btn pill-emoji-btn"
      :title="`Réagir avec ${r.emoji}`"
      :aria-label="`Réagir avec ${r.emoji}`"
      @click.stop="$emit('quick-react', r.type)"
    >{{ r.emoji }}</button>

    <div class="pill-picker-wrap">
      <button
        class="pill-btn"
        title="Ajouter une réaction"
        aria-label="Ouvrir le sélecteur de réactions"
        aria-haspopup="dialog"
        :aria-expanded="showPicker"
        @click.stop="$emit('update:showPicker', !showPicker)"
      >
        <SmilePlus :size="14" aria-hidden="true" />
      </button>
      <div v-if="showPicker" class="full-picker-pos" @click.stop>
        <EmojiPicker @pick="(e: string) => $emit('pick-emoji', e)" />
      </div>
    </div>

    <span class="pill-sep" aria-hidden="true" />

    <button
      v-if="appStore.isTeacher"
      class="pill-btn"
      :title="isPinned ? 'Désépingler' : 'Épingler'"
      :aria-label="isPinned ? 'Désépingler le message' : 'Épingler le message'"
      :aria-pressed="isPinned"
      @click.stop="$emit('toggle-pin')"
    >
      <PinOff v-if="isPinned" :size="14" aria-hidden="true" />
      <Pin v-else :size="14" aria-hidden="true" />
    </button>

    <button
      class="pill-btn"
      :class="{ 'pill-bookmarked': isBookmarked }"
      :title="isBookmarked ? 'Retirer des signets' : 'Sauvegarder dans les signets'"
      :aria-label="isBookmarked ? 'Retirer des signets' : 'Sauvegarder dans les signets'"
      :aria-pressed="isBookmarked"
      @click.stop="$emit('toggle-bookmark')"
    >
      <BookmarkCheck v-if="isBookmarked" :size="14" aria-hidden="true" />
      <Bookmark v-else :size="14" aria-hidden="true" />
    </button>

    <div class="pill-menu-wrap">
      <button
        ref="menuBtnRef"
        class="pill-btn"
        title="Plus d'options"
        aria-label="Plus d'options"
        aria-haspopup="menu"
        :aria-expanded="showMenu"
        aria-controls="msg-menu-list"
        @click.stop="$emit('update:showMenu', !showMenu)"
      >
        <MoreHorizontal :size="14" aria-hidden="true" />
      </button>

      <div
        v-if="showMenu"
        id="msg-menu-list"
        ref="menuRef"
        class="msg-menu"
        role="menu"
        @keydown="onMenuKeydown"
      >
        <button class="msg-menu-item" role="menuitem" @click="$emit('copy')">
          <Copy :size="12" aria-hidden="true" /> Copier le texte
        </button>
        <button class="msg-menu-item" role="menuitem" @click="$emit('copy-link')">
          <Link2 :size="12" aria-hidden="true" /> Copier le lien
        </button>
        <button v-if="canDmAuthor" class="msg-menu-item" role="menuitem" @click="$emit('dm-author')">
          <MessageCircle :size="12" aria-hidden="true" /> Envoyer un message à l'auteur
        </button>
        <button v-if="canEdit" class="msg-menu-item" role="menuitem" @click="$emit('edit')">
          <Pencil :size="12" aria-hidden="true" /> Modifier
        </button>
        <button v-if="canReport" class="msg-menu-item" role="menuitem" @click="$emit('report')">
          <AlertTriangle :size="12" aria-hidden="true" /> Signaler
        </button>
        <button v-if="canDelete" class="msg-menu-item msg-menu-danger" role="menuitem" @click="$emit('delete')">
          <Trash2 :size="12" aria-hidden="true" /> Supprimer
        </button>
      </div>
    </div>
  </div>
</template>
