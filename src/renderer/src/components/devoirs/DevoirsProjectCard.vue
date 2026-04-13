/**
 * Carte projet partagee entre les vues d'accueil prof et etudiant.
 * Affiche : nom de projet, pills de types, barre de progression, prochaine echeance.
 *
 * Migre vers UiCard en v2.56.0 (cf. design-system/cursus/MASTER.md §7).
 */
<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Clock, FolderOpen, Award } from 'lucide-vue-next'
import { deadlineClass, deadlineLabel } from '@/utils/date'
import { typeLabel } from '@/utils/devoir'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import UiCard from '@/components/ui/UiCard.vue'

const props = defineProps<{
  name: string
  typeCounts: { type: string; count: number }[]
  submitted: number
  total: number
  pct: number
  toGrade?: number
  drafts?: number
  devoirCount: number
  nextDeadline?: string | null
  gradedCount?: number
  bestGrade?: string | null
}>()

const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()

const parsed = computed(() => parseCategoryIcon(props.name))
</script>

<template>
  <UiCard interactive padding="md" @click="(ev) => emit('click', ev)">
    <div class="dpc-header">
      <component :is="parsed.icon" v-if="parsed.icon" :size="16" class="dpc-icon" />
      <FolderOpen v-else :size="16" class="dpc-icon" />
      <span class="dpc-name">{{ parsed.label }}</span>
      <ChevronRight :size="14" class="dpc-chevron" />
    </div>

    <!-- Types de devoirs dans ce projet -->
    <div class="dpc-types">
      <span v-for="tl in typeCounts" :key="tl.type" class="devoir-type-badge" :class="`type-${tl.type}`">
        {{ tl.count }} {{ typeLabel(tl.type) }}
      </span>
    </div>

    <!-- Stats -->
    <div class="dpc-stats">
      <template v-if="total > 0">
        <span>{{ submitted }}/{{ total }} soumis</span>
        <span v-if="toGrade && toGrade > 0" class="dpc-stat-warn">{{ toGrade }} à noter</span>
      </template>
      <span v-else class="dpc-stat-info">Aucun dépôt attendu</span>
    </div>

    <!-- Barre de progression -->
    <div v-if="total > 0" class="dv-progress dpc-progress">
      <div class="dv-progress-fill" :style="{ width: pct + '%' }" />
    </div>

    <!-- Footer -->
    <div class="dpc-footer">
      <span class="dpc-total">{{ devoirCount }} devoir{{ devoirCount > 1 ? 's' : '' }}</span>
      <span v-if="drafts && drafts > 0" class="dpc-drafts">{{ drafts }} brouillon{{ drafts > 1 ? 's' : '' }}</span>
      <span v-if="nextDeadline" class="dpc-next deadline-badge" :class="deadlineClass(nextDeadline)">
        <Clock :size="10" /> {{ deadlineLabel(nextDeadline) }}
      </span>
    </div>
  </UiCard>
</template>

<style scoped>
.dpc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}
.dpc-icon { color: var(--text-muted); flex-shrink: 0; }
.dpc-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dpc-chevron {
  color: var(--text-muted);
  opacity: .4;
  transition: opacity var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
:deep(.ui-card--interactive:hover) .dpc-chevron {
  opacity: 1;
  color: var(--accent);
}

.dpc-types {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
}

.dpc-stats {
  display: flex;
  gap: var(--space-sm);
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}
.dpc-stat-warn { color: var(--color-warning); font-weight: 600; }
.dpc-stat-info { color: var(--text-muted); font-style: italic; font-size: 11px; }

.dpc-progress { margin-bottom: var(--space-md); }

.dpc-footer {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);
}
.dpc-total { font-weight: 600; }
.dpc-drafts { color: var(--text-muted); font-style: italic; }
.dpc-next { font-size: 10px; margin-left: auto; }
</style>
