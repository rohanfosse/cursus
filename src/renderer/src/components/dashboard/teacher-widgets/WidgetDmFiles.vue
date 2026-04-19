<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FileBox, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

interface DmFile {
  message_id: number
  student_name: string
  file_name: string
  file_url: string
  created_at: string
}

const router = useRouter()
const files = ref<DmFile[]>([])

onMounted(async () => {
  try {
    const res = await window.api.getDmFiles()
    if (res?.ok && Array.isArray(res.data)) {
      files.value = (res.data as DmFile[]).slice(0, 5)
    }
  } catch { /* ignore */ }
})

function relativeDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = diff / 3_600_000
  if (h < 1) return "< 1h"
  if (h < 24) return `${Math.floor(h)}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Hier' : `${d}j`
}

function goToFiles() { router.push('/files') }
</script>

<template>
  <UiWidgetCard :icon="FileBox" label="Fichiers DM">
    <template #header-extra>
      <button type="button" class="wdf-chevron" aria-label="Voir tout" @click="goToFiles">
        <ChevronRight :size="13" />
      </button>
    </template>

    <div v-if="files.length" class="wdf-list">
      <div v-for="f in files" :key="f.message_id" class="wdf-item">
        <span class="wdf-name">{{ f.file_name || 'Fichier' }}</span>
        <span class="wdf-student">{{ f.student_name }}</span>
        <span class="wdf-date">{{ relativeDate(f.created_at) }}</span>
      </div>
    </div>
    <EmptyState v-else size="sm" tone="muted" title="Aucun fichier reçu" />
  </UiWidgetCard>
</template>

<style scoped>
.wdf-chevron {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: var(--radius-xs);
  transition:
    color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out);
}
.wdf-chevron:hover { color: var(--text-primary); background: var(--bg-hover); }
.wdf-chevron:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wdf-list { display: flex; flex-direction: column; gap: var(--space-xs); }
.wdf-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-sm);
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--border);
}
.wdf-item:last-child { border-bottom: none; }
.wdf-name {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wdf-student {
  color: var(--text-muted);
  font-size: var(--text-xs);
  flex-shrink: 0;
}
.wdf-date {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
