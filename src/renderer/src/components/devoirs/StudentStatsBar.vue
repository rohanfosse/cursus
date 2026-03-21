/**
 * Barre de statistiques étudiant : total, à rendre, urgent, rendus.
 */
<script setup lang="ts">
defineProps<{
  stats: { total: number; pending: number; urgent: number; submitted: number }
}>()
</script>

<template>
  <div class="student-stats-bar">
    <div class="stat-chip stat-chip-neutral">
      <span class="stat-dot dot-neutral" />
      <strong>{{ stats.total }}</strong>&nbsp;total
    </div>
    <div class="stat-chip stat-chip-blue">
      <span class="stat-dot dot-blue" />
      <strong>{{ stats.pending }}</strong>&nbsp;à rendre
    </div>
    <div class="stat-chip stat-chip-red">
      <span class="stat-dot dot-red" />
      <strong>{{ stats.urgent }}</strong>&nbsp;urgent
    </div>
    <div class="stat-chip stat-chip-green">
      <span class="stat-dot dot-green" />
      <strong>{{ stats.submitted }}</strong>&nbsp;rendu{{ stats.submitted > 1 ? 's' : '' }}
    </div>
  </div>
</template>

<style scoped>
.student-stats-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;
}
.stat-chip strong { font-weight: 700; }

.stat-chip-neutral { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.08); color: var(--text-secondary); }
.stat-chip-blue    { background: rgba(74, 144, 217, 0.12);  border-color: rgba(74, 144, 217, 0.2);   color: var(--accent-light); }
.stat-chip-red     { background: rgba(231, 76, 60, 0.12);   border-color: rgba(231, 76, 60, 0.2);    color: #ff7b6b; }
.stat-chip-green   { background: rgba(39, 174, 96, 0.12);   border-color: rgba(39, 174, 96, 0.2);    color: #5dd08a; }

.stat-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-neutral { background: var(--text-muted); }
.dot-blue    { background: var(--accent); }
.dot-red     { background: var(--color-danger); }
.dot-green   { background: var(--color-success); }
</style>
