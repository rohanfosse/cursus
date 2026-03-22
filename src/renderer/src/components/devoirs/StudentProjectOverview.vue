/**
 * Aperçu par projet étudiant : grille de cartes projet avec barre de progression.
 */
<script setup lang="ts">
import { useAppStore } from '@/stores/app'

defineProps<{
  projects: { key: string; label: string; total: number; submitted: number; pending: number }[]
}>()

const appStore = useAppStore()
</script>

<template>
  <div class="student-project-overview">
    <button
      v-for="p in projects"
      :key="p.key"
      class="student-proj-card"
      @click="appStore.activeProject = p.key"
    >
      <span class="student-proj-label">{{ p.label }}</span>
      <span class="student-proj-stat">
        <span class="student-proj-submitted">{{ p.submitted }} rendu{{ p.submitted > 1 ? 's' : '' }}</span>
        <span v-if="p.pending" class="student-proj-pending"> · {{ p.pending }} à faire</span>
      </span>
      <div class="student-proj-bar">
        <div
          class="student-proj-bar-fill"
          :style="{ width: (p.total ? Math.round(p.submitted / p.total * 100) : 0) + '%' }"
        />
      </div>
    </button>
  </div>
</template>

<style scoped>
.student-project-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 4px;
}

.student-proj-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-sidebar);
  cursor: pointer;
  text-align: left;
  font-family: var(--font);
  transition: background var(--t-fast), border-color var(--t-fast);
}
.student-proj-card:hover {
  background: rgba(74,144,217,.07);
  border-color: rgba(74,144,217,.3);
}

.student-proj-label { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.student-proj-stat  { font-size: 11px; color: var(--text-muted); }
.student-proj-submitted { color: var(--color-success); }
.student-proj-pending   { color: var(--color-warning); }

.student-proj-bar {
  height: 3px;
  border-radius: 2px;
  background: rgba(255,255,255,.06);
  overflow: hidden;
}
.student-proj-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  transition: width .3s ease;
}
</style>
