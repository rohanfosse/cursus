<script setup lang="ts">
/**
 * DocumentCard : card d'un document unique, supporte 3 modes visuels :
 *  - 'grid'  : card verticale avec description, meta, action menu (par defaut)
 *  - 'list'  : ligne horizontale compacte avec colonnes
 *  - 'dense' : card minimale avec juste icone + nom + date
 *
 * Les styles vivent dans DocumentsView (.doc-card--list, --dense, etc.).
 * v2.166.3 : actions deplacees dans un menu "..." (ContextMenu) pour
 * desencombrer la card. L'ancien overlay hover satures est supprime.
 */
import { ref, computed, type Component } from 'vue'
import {
  Star, Copy, Eye, ExternalLink, Download, Pencil, Trash2, File, BookMarked, MoreVertical,
} from 'lucide-vue-next'
import { formatDate } from '@/utils/date'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import type { AppDocument } from '@/types'
import type { DocumentsViewMode } from '@/composables/useDocumentsViewMode'

interface Props {
  doc: AppDocument
  viewMode: DocumentsViewMode
  selectionMode: boolean
  selected: boolean
  iconColor: string
  iconLabel: string
  iconKey: string
  iconComponent?: Component
  /** "Nouveau" badge (added in last 24h) */
  isRecent: boolean
  fileSize: string | null
}

interface Emits {
  (e: 'open'): void
  (e: 'toggle-select'): void
  (e: 'copy-link'): void
  (e: 'download'): void
  (e: 'edit'): void
  (e: 'delete'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const appStore = useAppStore()
const docStore = useDocumentsStore()

const isDense = props.viewMode === 'dense'
const isList = props.viewMode === 'list'
const iconSize = isDense ? 18 : (isList ? 20 : 24)
const iconBg = props.iconColor + '1A'

function onCardClick() {
  if (props.selectionMode) emit('toggle-select')
  else emit('open')
}

// ── Menu "..." ─────────────────────────────────────────────────────────────
const menuPos = ref<{ x: number; y: number } | null>(null)

function openMenu(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  // Ouvre le menu sous le bouton, aligne a droite.
  menuPos.value = { x: rect.right, y: rect.bottom + 4 }
}

function closeMenu() {
  menuPos.value = null
}

const isFav = computed(() => docStore.isFavorite(props.doc.id))

const menuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [
    {
      label: isFav.value ? 'Retirer des favoris' : 'Ajouter aux favoris',
      icon: Star,
      action: () => docStore.toggleFavorite(props.doc.id),
    },
    {
      label: 'Copier le lien',
      icon: Copy,
      action: () => emit('copy-link'),
    },
    {
      label: props.doc.type === 'link' ? 'Ouvrir le lien' : 'Prévisualiser',
      icon: props.doc.type === 'file' ? Eye : ExternalLink,
      action: () => emit('open'),
    },
  ]
  if (props.doc.type === 'file') {
    items.push({
      label: 'Télécharger',
      icon: Download,
      action: () => emit('download'),
    })
  }
  if (appStore.isTeacher) {
    if (!isDense) {
      items.push({
        label: 'Modifier',
        icon: Pencil,
        separator: true,
        action: () => emit('edit'),
      })
      items.push({
        label: 'Supprimer',
        icon: Trash2,
        danger: true,
        action: () => emit('delete'),
      })
    } else {
      items.push({
        label: 'Supprimer',
        icon: Trash2,
        danger: true,
        separator: true,
        action: () => emit('delete'),
      })
    }
  }
  return items
})
</script>

<template>
  <div
    class="doc-card"
    :class="{
      'doc-card--dense': isDense,
      'doc-card--list': isList,
      'doc-card--fav': isFav,
      'doc-card--selected': selected,
      'doc-card--menu-open': menuPos !== null,
    }"
    :title="doc.description ?? doc.name"
    @click="onCardClick"
  >
    <input
      v-if="selectionMode"
      type="checkbox"
      class="doc-select-cb"
      :checked="selected"
      @click.stop="emit('toggle-select')"
    />
    <button
      v-else
      class="doc-card-fav"
      :class="{
        'doc-card-fav--dense': isDense,
        'doc-card-fav--active': isFav,
      }"
      :title="isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'"
      :aria-label="isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'"
      @click.stop="docStore.toggleFavorite(doc.id)"
    >
      <Star :size="isDense ? 10 : 13" />
    </button>

    <button
      class="doc-card-menu-btn"
      :class="{ 'doc-card-menu-btn--dense': isDense }"
      title="Plus d'actions"
      aria-label="Plus d'actions"
      @click.stop="openMenu"
    >
      <MoreVertical :size="isDense ? 14 : 16" />
    </button>

    <div
      :class="isDense ? 'doc-dense-icon' : 'doc-card-icon'"
      :style="{ background: iconBg, color: iconColor }"
    >
      <component :is="iconComponent ?? File" :size="iconSize" />
    </div>

    <template v-if="!isDense">
      <p class="doc-card-name">
        {{ doc.name }}
        <span v-if="isRecent" class="doc-new-badge">Nouveau</span>
      </p>

      <p v-if="doc.description" class="doc-card-desc">{{ doc.description }}</p>

      <span v-if="doc.travail_title" class="doc-devoir-badge">
        <BookMarked :size="10" />
        {{ doc.travail_title }}
      </span>

      <p class="doc-card-meta">
        <span class="doc-card-type" :style="{ color: iconColor }">{{ iconLabel }}</span>
        <span class="doc-card-meta-sep" aria-hidden="true">·</span>
        <span class="doc-card-date">{{ formatDate(doc.created_at) }}</span>
        <span v-if="isList && fileSize" class="doc-card-size">{{ fileSize }}</span>
        <span v-if="isList && !appStore.activeChannelId && doc.channel_name" class="doc-card-channel">#{{ doc.channel_name }}</span>
      </p>
    </template>

    <template v-else>
      <p class="doc-dense-name">{{ doc.name }}</p>
      <span class="doc-dense-meta">
        {{ formatDate(doc.created_at) }}
        <span v-if="fileSize" class="doc-dense-size">{{ fileSize }}</span>
      </span>
    </template>

    <ContextMenu
      v-if="menuPos"
      :x="menuPos.x"
      :y="menuPos.y"
      :items="menuItems"
      @close="closeMenu"
    />
  </div>
</template>
