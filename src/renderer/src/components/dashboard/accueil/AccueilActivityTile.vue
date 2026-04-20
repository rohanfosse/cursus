<script setup lang="ts">
/**
 * AccueilActivityTile : tuile 2x1 listant les derniers groupes de rendus
 * (top 5) avec compteur et temps relatif.
 */
import { computed } from 'vue'
import { Clock, X, Edit3, ListChecks, FileText, Copy } from 'lucide-vue-next'
import type { ActivityGroup } from '@/composables/useAccueilActivityFeed'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore } from '@/stores/modals'
import { useToast } from '@/composables/useToast'

interface Props {
  items: ActivityGroup[]
  editMode: boolean
}
defineProps<Props>()
defineEmits<{ (e: 'remove'): void }>()

const travauxStore = useTravauxStore()
const modals = useModalsStore()
const { showToast } = useToast()

const { ctx, open: openCtx, close: closeCtx } = useContextMenu<ActivityGroup>()
function parseTravailId(id: string): number | null {
  const m = id.match(/^rendus-(\d+)$/)
  return m ? Number(m[1]) : null
}
const ctxItems = computed<ContextMenuItem[]>(() => {
  const it = ctx.value?.target
  if (!it) return []
  const travailId = parseTravailId(it.id)
  const items: ContextMenuItem[] = []
  if (travailId != null) {
    items.push({ label: 'Ouvrir les rendus', icon: ListChecks, action: async () => {
      await travauxStore.openTravail(travailId)
      modals.depots = true
    } })
    items.push({ label: 'Ouvrir le devoir', icon: FileText, action: async () => {
      await travauxStore.openTravail(travailId)
      modals.gestionDevoir = true
    } })
  }
  items.push({ label: 'Copier le libellé', icon: Copy, separator: items.length > 0, action: async () => {
    await navigator.clipboard.writeText(it.label)
    showToast('Libellé copié.', 'success')
  } })
  return items
})
</script>

<template>
  <div class="dashboard-card bento-tile bento-activity" :class="{ 'bento-tile--editing': editMode }">
    <button v-if="editMode" class="bento-tile-remove" @click="$emit('remove')">
      <X :size="12" />
    </button>
    <h3 class="tile-title"><Clock :size="14" /> Derniers rendus</h3>
    <div v-if="!items.length" class="activity-empty">
      Aucune activite recente
    </div>
    <div v-else class="activity-list">
      <div v-for="item in items" :key="item.id" class="activity-item" @contextmenu="openCtx($event, item)">
        <span class="activity-icon">
          <Edit3 :size="12" />
        </span>
        <span class="activity-label">{{ item.label }}</span>
        <span class="activity-time">{{ item.timeAgo }}</span>
      </div>
    </div>

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </div>
</template>
