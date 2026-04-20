<script setup lang="ts">
  import { computed, onMounted, toRef } from 'vue'
  import { AlertTriangle, Clock, User, MessageSquare, Copy } from 'lucide-vue-next'
  import { useAtRiskStudents, type EngagementScore } from '@/composables/useAtRiskStudents'
  import { useAppStore } from '@/stores/app'
  import { useToast } from '@/composables/useToast'
  import { useContextMenu } from '@/composables/useContextMenu'
  import { avatarColor, initials } from '@/utils/format'
  import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
  import EmptyState from '@/components/ui/EmptyState.vue'
  import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

  const appStore = useAppStore()
  const { atRiskStudents, atRiskCount, loading, daysSinceActivity, load } =
    useAtRiskStudents(toRef(appStore, 'activePromoId'))

  const emit = defineEmits<{ openStudent: [studentId: number] }>()

  onMounted(() => load())

  const { showToast } = useToast()
  const { ctx, open: openCtx, close: closeCtx } = useContextMenu<EngagementScore>()
  const ctxItems = computed<ContextMenuItem[]>(() => {
    const s = ctx.value?.target
    if (!s) return []
    return [
      { label: 'Voir le profil', icon: User, action: () => emit('openStudent', s.studentId) },
      { label: 'Envoyer un message', icon: MessageSquare, action: () => {
        const pid = appStore.activePromoId
        if (!pid) return
        appStore.openDm(s.studentId, pid, s.name)
      } },
      { label: 'Copier le nom', icon: Copy, separator: true, action: async () => {
        await navigator.clipboard.writeText(s.name)
        showToast('Nom copié.', 'success')
      } },
      { label: `Copier le score (${s.score})`, icon: Copy, action: async () => {
        await navigator.clipboard.writeText(String(s.score))
        showToast('Score copié.', 'success')
      } },
    ]
  })
</script>

<template>
  <UiWidgetCard
    :icon="AlertTriangle"
    label="Etudiants a risque"
    tone="danger"
    aria-label="Liste des etudiants a risque"
  >
    <template v-if="atRiskCount > 0" #header-extra>
      <span class="war-count">{{ atRiskCount }}</span>
    </template>

    <div v-if="loading" class="war-loading">Chargement...</div>

    <EmptyState v-else-if="atRiskStudents.length === 0" size="sm" tone="muted" title="Aucun étudiant à risque" />

    <div v-else class="war-list">
      <button
        v-for="s in atRiskStudents.slice(0, 5)"
        :key="s.studentId"
        class="war-student"
        @click="emit('openStudent', s.studentId)"
        @contextmenu="openCtx($event, s, true)"
      >
        <div class="avatar" :style="{ background: avatarColor(s.name), width: '28px', height: '28px', fontSize: '10px', borderRadius: '50%' }">
          {{ initials(s.name) }}
        </div>
        <div class="war-student-info">
          <span class="war-student-name">{{ s.name }}</span>
          <span class="war-student-meta">
            {{ s.missing }} manquant{{ s.missing > 1 ? 's' : '' }}
            <template v-if="s.lastActivity">
              · <Clock :size="9" /> {{ daysSinceActivity(s.lastActivity) ?? '?' }}j
            </template>
            <template v-else> · inactif</template>
          </span>
        </div>
        <span class="war-score" :class="s.score < 30 ? 'war-score--critical' : 'war-score--warn'">
          {{ s.score }}
        </span>
      </button>
    </div>

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
.war-count {
  background: var(--color-danger);
  color: #fff;
  font-size: var(--text-2xs);
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius);
}

.war-loading {
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-md) 0;
}

.war-list { display: flex; flex-direction: column; gap: 2px; }

.war-student {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background var(--motion-fast) var(--ease-out);
}

.war-student:hover { background: var(--bg-hover); }

.war-student:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.war-student-info { flex: 1; min-width: 0; }

.war-student-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.war-student-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}

.war-score {
  font-size: var(--text-sm);
  font-weight: 700;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.war-score--critical { background: rgba(var(--color-danger-rgb), .12);  color: var(--color-danger); }
.war-score--warn     { background: rgba(var(--color-warning-rgb), .12); color: var(--color-warning); }
</style>
