/**
 * StudentUrgentActions.vue
 * Displays the top 3 upcoming devoirs or an "all done" state
 * when the student has no pending assignments.
 */
<script setup lang="ts">
import { Clock, AlertTriangle, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-vue-next'

defineProps<{
  urgentActions: { id: number; title: string; isOverdue: boolean; urgency: string; category?: string | null; deadline?: string }[]
  hasDevoirsLoaded: boolean
}>()

const emit = defineEmits<{
  goToProject: [key: string]
  navigateDevoirs: []
}>()

function countdown(deadline?: string): string {
  if (!deadline) return ''
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff < 0) return ''
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 24) return `${hours}h`
  return `${Math.ceil(diff / 86_400_000)}j`
}
</script>

<template>
  <div v-if="urgentActions.length" class="db-urgent-list">
    <h4 class="db-urgent-title"><Clock :size="14" /> À rendre prochainement</h4>
    <div v-for="ua in urgentActions" :key="ua.id" class="db-urgent-item" :class="{ 'db-urgent-item--overdue': ua.isOverdue }" @click="emit('goToProject', ua.category ?? '')">
      <AlertTriangle v-if="ua.isOverdue" :size="14" class="db-urgent-icon--danger" />
      <Clock v-else :size="14" style="opacity:.5" />
      <span class="db-urgent-item-title">{{ ua.title }}</span>
      <span v-if="countdown(ua.deadline)" class="db-urgent-countdown">{{ countdown(ua.deadline) }}</span>
      <span class="db-urgent-item-urgency" :class="{ 'text-danger': ua.isOverdue }">{{ ua.urgency }}</span>
      <ChevronRight :size="12" style="opacity:.3" />
    </div>
    <button class="btn-ghost db-voir-tous" @click="emit('navigateDevoirs')">
      Voir tous les devoirs <ArrowRight :size="12" />
    </button>
  </div>
  <div v-else-if="hasDevoirsLoaded" class="db-all-done">
    <CheckCircle2 :size="22" class="all-done-check" />
    <span>Bravo, tout est a jour ! Aucun devoir en attente.</span>
  </div>
</template>

<style scoped>
.db-urgent-list { margin-bottom: 16px; }
.db-urgent-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px;
}
.db-urgent-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,.02); transition: background .15s;
  margin-bottom: 4px; font-size: 13px; color: var(--text-primary);
}
.db-urgent-item:hover { background: rgba(255,255,255,.06); }
.db-urgent-item--overdue { background: rgba(231,76,60,.06); }
.db-urgent-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-urgent-item-urgency { font-size: 11px; font-weight: 600; color: var(--text-muted); flex-shrink: 0; }
.db-urgent-icon--danger { color: var(--color-danger); }
.text-danger { color: var(--color-danger) !important; }

.db-all-done {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px; background: rgba(46,204,113,.08);
  border: 1px solid rgba(46,204,113,.2); border-radius: var(--radius);
  margin-bottom: 16px; font-size: 14px; font-weight: 600; color: var(--text-secondary);
}
.all-done-check { color: var(--color-success); animation: pop .4s ease; }
@keyframes pop { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
.db-urgent-countdown { font-size: 10px; font-weight: 700; color: var(--color-warning); background: rgba(243,156,18,.12); padding: 2px 6px; border-radius: 6px; flex-shrink: 0; }
.db-voir-tous { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; margin-top: 6px; }
</style>
