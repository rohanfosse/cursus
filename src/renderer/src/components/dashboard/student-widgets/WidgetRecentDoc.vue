/**
 * WidgetRecentDoc.vue - Affiche le document le plus récent de la promo.
 */
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { FileText, Link2, Image, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { relativeTime } from '@/utils/date'

const router = useRouter()
const appStore = useAppStore()
const docsStore = useDocumentsStore()

onMounted(async () => {
  try {
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (promoId) {
      await docsStore.fetchDocuments(promoId)
    }
  } catch (err) {
    console.warn('[WidgetRecentDoc] Erreur chargement documents', err)
  }
})

const recentDoc = computed(() => {
  if (!docsStore.documents.length) return null
  return docsStore.documents.reduce((latest, doc) =>
    new Date(doc.created_at).getTime() > new Date(latest.created_at).getTime() ? doc : latest,
  )
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
  return recentDoc.value ? relativeTime(recentDoc.value.created_at) : ''
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
    @keydown.enter="navigateToDocuments" @keydown.space.prevent="navigateToDocuments"
  >
    <div class="sa-card-header">
      <component :is="typeIcon" :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Document récent</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </div>
    <div class="sa-doc-row">
      <span class="sa-doc-type-pill">{{ recentDoc.type === 'link' ? 'Lien' : (recentDoc.name?.split('.').pop()?.toUpperCase() ?? 'Fichier') }}</span>
      <span class="sa-doc-name">{{ recentDoc.name }}</span>
      <span class="sa-doc-date sa-mono">{{ relativeDate }}</span>
    </div>
  </div>

  <div v-else class="dashboard-card sa-card sa-recent-doc sa-recent-doc--empty">
    <div class="sa-card-header">
      <FileText :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Document récent</span>
    </div>
    <p class="sa-doc-empty">Aucun document partagé</p>
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

.sa-doc-type-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(74, 144, 217, .12);
  color: var(--accent);
  text-transform: uppercase;
  flex-shrink: 0;
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
