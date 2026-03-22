/** StudentProjetStats.vue — Stats chips, progress bar, and deadline banner */
<script setup lang="ts">
import { CheckCircle2, AlertTriangle, Award, FolderOpen, Hash } from 'lucide-vue-next'

defineProps<{
  stats: {
    total: number; submitted: number; pending: number; overdue: number
    graded: number; avg: number | null; pct: number; docs: number; channels: number
  }
  nextDeadlineSoon: { title: string; deadline: string; label: string } | null
}>()
</script>

<template>
  <!-- Chips stats -->
  <div class="spf-stats-row">
    <span class="spf-stat-chip" :class="stats.overdue > 0 ? 'spf-chip-red' : stats.pending > 0 ? 'spf-chip-orange' : 'spf-chip-green'">
      <CheckCircle2 :size="11" />
      {{ stats.submitted }}/{{ stats.total }} rendus
      <span v-if="stats.total" class="spf-chip-pct">({{ stats.pct }}%)</span>
    </span>
    <span v-if="stats.overdue" class="spf-stat-chip spf-chip-red">
      <AlertTriangle :size="11" /> {{ stats.overdue }} en retard
    </span>
    <span v-if="stats.avg != null" class="spf-stat-chip spf-chip-blue">
      <Award :size="11" /> Moy. {{ stats.avg }}/20
    </span>
    <span v-if="stats.docs" class="spf-stat-chip spf-chip-muted">
      <FolderOpen :size="11" /> {{ stats.docs }} docs
    </span>
    <span v-if="stats.channels" class="spf-stat-chip spf-chip-muted">
      <Hash :size="11" /> {{ stats.channels }} canal{{ stats.channels > 1 ? 'ux' : '' }}
    </span>
  </div>

  <!-- Barre de progression globale -->
  <div v-if="stats.total > 0" class="spf-global-progress">
    <div class="spf-global-bar">
      <div
        class="spf-global-fill"
        :class="stats.pct === 100 ? 'fill-complete' : stats.pct > 50 ? 'fill-good' : ''"
        :style="{ width: stats.pct + '%' }"
      />
    </div>
  </div>

  <!-- Prochaine echeance banner -->
  <div v-if="nextDeadlineSoon" class="spf-deadline-banner">
    <AlertTriangle :size="14" />
    <span><strong>Prochaine echeance :</strong> {{ nextDeadlineSoon.title }} &mdash; {{ nextDeadlineSoon.label }}</span>
  </div>
</template>
