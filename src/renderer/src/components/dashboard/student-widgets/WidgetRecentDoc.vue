/**
 * WidgetRecentDoc.vue - Affiche le document le plus récent de la promo.
 */
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { FileText, Link2, Image, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'

const router = useRouter()
const appStore = useAppStore()
const docsStore = useDocumentsStore()

onMounted(async () => {
  const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
  if (promoId) {
    await docsStore.fetchDocuments(promoId)
  }
})

const recentDoc = computed(() => {
  if (!docsStore.documents.length) return null
  const sorted = [...docsStore.documents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  return sorted[0]
})

const typeIcon = computed(() => {
  if (!recentDoc.value) return FileText
  const t = recentDoc.value.type
  if (t === 'link') return Link2
  // Check file extension for images
  const name = recentDoc.value.name?.toLowerCase() ?? ''
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(name)) return Image
  return FileText
})

const relativeDate = computed(() => {
  if (!recentDoc.value) return ''
  const diff = Date.now() - new Date(recentDoc.value.created_at).getTime()
  const hours = diff / (3600 * 1000)
  if (hours < 1) return "Il y a moins d'1h"
  if (hours < 24) return `Il y a ${Math.floor(hours)}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days}j`
  return `Il y a ${Math.floor(days / 7)} sem.`
})

function navigateToDocuments() {
  router.push('/documents')
}
</script>

<template>
  <div
    v-if="recentDoc"
    class="dashboard-card sa-card sa-recent-doc"
    role="button"
    tabindex="0"
    aria-label="Voir les documents"
    @click="navigateToDocuments"
    @keydown.enter="navigateToDocuments"
  >
    <div class="sa-card-header">
      <component :is="typeIcon" :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Document recent</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </div>
    <div class="sa-doc-row">
      <span class="sa-doc-name">{{ recentDoc.name }}</span>
      <span class="sa-doc-date sa-mono">{{ relativeDate }}</span>
    </div>
  </div>

  <div v-else class="dashboard-card sa-card sa-recent-doc sa-recent-doc--empty">
    <div class="sa-card-header">
      <FileText :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Document recent</span>
    </div>
    <p class="sa-doc-empty">Aucun document partage</p>
  </div>
</template>

<style scoped>
/* Base card: .dashboard-card from dashboard-shared.css + .sa-card from devoirs-shared.css */
.sa-mono { font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace; font-size: 12px; }

.sa-recent-doc { cursor: pointer; }
.sa-recent-doc--empty { cursor: default; }

.sa-doc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sa-doc-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.sa-doc-date {
  color: var(--text-muted);
  flex-shrink: 0;
}

.sa-doc-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
  opacity: .7;
}
</style>
