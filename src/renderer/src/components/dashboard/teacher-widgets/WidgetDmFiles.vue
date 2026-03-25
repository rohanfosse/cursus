/**
 * WidgetDmFiles.vue - Derniers fichiers reçus en DM par les étudiants.
 */
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FileBox, Download, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

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
  <div class="sa-card-header">
    <FileBox :size="14" class="sa-card-icon" />
    <span class="sa-section-label">Fichiers DM</span>
    <button class="sa-chevron-btn" title="Voir tout" @click="goToFiles">
      <ChevronRight :size="13" />
    </button>
  </div>
  <div v-if="files.length" class="wdf-list">
    <div v-for="f in files" :key="f.message_id" class="wdf-item">
      <span class="wdf-name">{{ f.file_name || 'Fichier' }}</span>
      <span class="wdf-student">{{ f.student_name }}</span>
      <span class="wdf-date">{{ relativeDate(f.created_at) }}</span>
    </div>
  </div>
  <p v-else class="wdf-empty">Aucun fichier recu</p>
</template>

<style scoped>
.sa-chevron-btn {
  margin-left: auto; background: none; border: none;
  color: var(--text-muted); cursor: pointer; display: flex;
  align-items: center; padding: 2px; border-radius: 4px;
}
.sa-chevron-btn:hover { color: var(--text-primary); background: var(--bg-hover); }

.wdf-list { display: flex; flex-direction: column; gap: 4px; }
.wdf-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; padding: 4px 0;
  border-bottom: 1px solid var(--border);
}
.wdf-item:last-child { border-bottom: none; }
.wdf-name {
  flex: 1; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wdf-student { color: var(--text-muted); font-size: 11px; flex-shrink: 0; }
.wdf-date {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: var(--text-muted); flex-shrink: 0;
}
.wdf-empty { font-size: 12px; color: var(--text-muted); margin: 0; opacity: .7; }
</style>
