/**
 * WidgetActions.vue — Raccourcis rapides : devoirs et timeline.
 */
<script setup lang="ts">
import { BookOpen, Clock, ChevronRight } from 'lucide-vue-next'

const emit = defineEmits<{
  navigateDevoirs: []
  openStudentTimeline: []
}>()
</script>

<template>
  <div class="sa-actions">
    <button class="sa-action" @click="emit('navigateDevoirs')">
      <BookOpen :size="16" />
      <span>Tous mes devoirs</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </button>
    <button class="sa-action" @click="emit('openStudentTimeline')">
      <Clock :size="16" />
      <span>Ma timeline</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </button>
  </div>
</template>

<style scoped>
.sa-actions { display: flex; gap: 10px; }
.sa-action {
  flex: 1; display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-radius: 10px;
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  color: var(--text-secondary); font-size: 13px; font-weight: 600;
  cursor: pointer; font-family: var(--font);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-action:hover { background: rgba(255,255,255,.05); color: var(--text-primary); }
.sa-chevron { color: var(--text-muted); opacity: .3; margin-left: auto; transition: opacity .15s; }
.sa-action:hover .sa-chevron { opacity: .7; }
@media (max-width: 600px) { .sa-actions { flex-direction: column; } }
</style>
