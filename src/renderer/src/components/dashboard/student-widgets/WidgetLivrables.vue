/**
 * WidgetLivrables.vue — Liste des prochains livrables à rendre.
 */
<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'

export interface LivrableAction {
  id: number; title: string; deadline?: string; category?: string | null
}

const props = defineProps<{ livrables: LivrableAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <div v-if="livrables.length" class="sa-card sa-next sa-next--livrable">
    <div class="sa-card-header">
      <FileText :size="14" class="sa-card-icon sa-icon--livrable" />
      <span class="sa-section-label">{{ livrables.length > 1 ? 'Prochains livrables' : 'Prochain livrable' }}</span>
    </div>
    <div class="sa-next-list">
      <div v-for="l in livrables" :key="l.id" class="sa-next-item" role="button" tabindex="0" :aria-label="'Voir le livrable ' + l.title" @click="emit('goToProject', l.category ?? '')" @keydown.enter="emit('goToProject', l.category ?? '')">
        <span class="sa-next-title">{{ l.title }}</span>
        <span class="deadline-badge" :class="deadlineClass(l.deadline!)">{{ deadlineLabel(l.deadline!) }}</span>
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
.sa-next--livrable { border-left: 3px solid var(--accent); }
.sa-icon--livrable { color: var(--accent); }
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
