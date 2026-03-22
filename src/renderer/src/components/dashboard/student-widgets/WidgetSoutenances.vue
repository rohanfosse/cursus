/**
 * WidgetSoutenances.vue — Liste des prochaines soutenances.
 */
<script setup lang="ts">
import { Mic } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'

export interface SoutenanceAction {
  id: number; title: string; deadline?: string; category?: string | null
}

const props = defineProps<{ soutenances: SoutenanceAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <div v-if="soutenances.length" class="sa-card sa-next sa-next--soutenance">
    <div class="sa-card-header">
      <Mic :size="14" class="sa-card-icon sa-icon--soutenance" />
      <span class="sa-section-label">{{ soutenances.length > 1 ? 'Prochaines soutenances' : 'Prochaine soutenance' }}</span>
    </div>
    <div class="sa-next-list">
      <div v-for="s in soutenances" :key="s.id" class="sa-next-item" role="button" tabindex="0" :aria-label="'Voir la soutenance ' + s.title" @click="emit('goToProject', s.category ?? '')" @keydown.enter="emit('goToProject', s.category ?? '')">
        <span class="sa-next-title">{{ s.title }}</span>
        <span class="deadline-badge" :class="deadlineClass(s.deadline!)">{{ deadlineLabel(s.deadline!) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sa-card {
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px 18px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-card:hover { background: rgba(255,255,255,.045); }
.sa-card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.sa-card-icon { color: var(--text-muted); flex-shrink: 0; }
.sa-section-label {
  text-transform: uppercase; letter-spacing: .08em; font-size: 10px;
  font-weight: 700; color: var(--text-muted); flex: 1;
}
.sa-next--soutenance { border-left: 3px solid var(--color-warning); }
.sa-icon--soutenance { color: var(--color-warning); }
.sa-next-list { display: flex; flex-direction: column; gap: 6px; }
.sa-next-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,.02); cursor: pointer;
  transition: background .15s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-next-item:hover { background: rgba(255,255,255,.06); }
.sa-next-title {
  flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
