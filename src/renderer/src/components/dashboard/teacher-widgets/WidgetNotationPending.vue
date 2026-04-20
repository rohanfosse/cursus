<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Edit3, ChevronRight, FileText, Copy, ListChecks } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useTravauxStore } from '@/stores/travaux'
import { useAppStore } from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useToast } from '@/composables/useToast'
import { useContextMenu } from '@/composables/useContextMenu'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

const router = useRouter()
const travauxStore = useTravauxStore()
const appStore = useAppStore()
const modals = useModalsStore()

onMounted(async () => {
  const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
  if (!promoId) return
  if (travauxStore.allRendus.length === 0) {
    await travauxStore.fetchRendus(promoId)
  }
})

interface Pending {
  travailId: number
  title: string
  waitingCount: number
  totalCount: number
}

const topPending = computed<Pending[]>(() => {
  const byTravail = new Map<number, { title: string; waiting: number; total: number }>()
  for (const d of travauxStore.allRendus) {
    const key = d.travail_id
    if (key == null) continue
    const entry = byTravail.get(key) ?? { title: d.travail_title ?? 'Devoir', waiting: 0, total: 0 }
    entry.total++
    if (d.submitted_at && d.note == null) entry.waiting++
    byTravail.set(key, entry)
  }
  return Array.from(byTravail.entries())
    .map(([travailId, v]) => ({ travailId, title: v.title, waitingCount: v.waiting, totalCount: v.total }))
    .filter(p => p.waitingCount > 0)
    .sort((a, b) => b.waitingCount - a.waitingCount)
    .slice(0, 3)
})

const totalWaiting = computed(() => topPending.value.reduce((acc, p) => acc + p.waitingCount, 0))

async function openDevoir(travailId: number) {
  await travauxStore.openTravail(travailId)
  modals.depots = true
}

function goToDevoirs() { router.push('/assignments') }

const { showToast } = useToast()
const { ctx, open: openCtx, close: closeCtx } = useContextMenu<Pending>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const p = ctx.value?.target
  if (!p) return []
  return [
    { label: 'Ouvrir les rendus', icon: ListChecks, action: () => openDevoir(p.travailId) },
    { label: 'Ouvrir le devoir', icon: FileText, action: async () => {
      await travauxStore.openTravail(p.travailId)
      modals.gestionDevoir = true
    } },
    { label: 'Copier le titre', icon: Copy, separator: true, action: async () => {
      await navigator.clipboard.writeText(p.title)
      showToast('Titre copié.', 'success')
    } },
  ]
})
</script>

<template>
  <UiWidgetCard
    v-if="topPending.length > 0"
    :icon="Edit3"
    label="À noter"
    interactive
    aria-label="Voir les rendus en attente de note"
    @click="goToDevoirs"
  >
    <template #header-extra>
      <span class="wnp-total">{{ totalWaiting }}</span>
      <ChevronRight :size="13" class="wnp-chevron" />
    </template>

    <ul class="wnp-list">
      <li
        v-for="p in topPending"
        :key="p.travailId"
        class="wnp-item"
        tabindex="0"
        role="button"
        @click.stop="openDevoir(p.travailId)"
        @keydown.enter.stop="openDevoir(p.travailId)"
        @keydown.space.prevent.stop="openDevoir(p.travailId)"
        @contextmenu="openCtx($event, p, true)"
      >
        <span class="wnp-title">{{ p.title }}</span>
        <span class="wnp-ratio">
          <strong>{{ p.waitingCount }}</strong> / {{ p.totalCount }}
        </span>
      </li>
    </ul>
    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </UiWidgetCard>
</template>

<style scoped>
.wnp-total {
  font-size: var(--text-2xs);
  font-weight: 800;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-xl);
  background: var(--color-danger);
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.wnp-chevron { color: var(--text-muted); }

.wnp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
.wnp-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 9px;
  background: var(--bg-input);
  border-radius: 3px;
  border-left: 2px solid var(--color-danger);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out);
}
.wnp-item:hover { background: var(--bg-hover); }
.wnp-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wnp-title {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.wnp-ratio {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.wnp-ratio strong {
  color: var(--color-danger);
  font-weight: 800;
}
</style>
