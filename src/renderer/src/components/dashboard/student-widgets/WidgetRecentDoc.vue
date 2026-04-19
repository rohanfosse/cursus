<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { FileText, Link2, Image, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { relativeTime } from '@/utils/date'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

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
  <UiWidgetCard
    v-if="recentDoc"
    :icon="typeIcon"
    label="Document récent"
    interactive
    aria-label="Voir les documents"
    @click="navigateToDocuments"
  >
    <template #header-extra>
      <ChevronRight :size="13" class="wrd-chevron" />
    </template>
    <div class="wrd-row">
      <span class="wrd-pill">{{ recentDoc.type === 'link' ? 'Lien' : (recentDoc.name?.split('.').pop()?.toUpperCase() ?? 'Fichier') }}</span>
      <span class="wrd-name">{{ recentDoc.name }}</span>
      <span class="wrd-date">{{ relativeDate }}</span>
    </div>
  </UiWidgetCard>

  <UiWidgetCard
    v-else
    :icon="FileText"
    label="Document récent"
  >
    <EmptyState size="sm" tone="muted" title="Aucun document partagé" />
  </UiWidgetCard>
</template>

<style scoped>
.wrd-chevron { color: var(--text-muted); }

.wrd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.wrd-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.wrd-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: rgba(var(--accent-rgb), .12);
  color: var(--accent);
  text-transform: uppercase;
  flex-shrink: 0;
}

.wrd-date {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
  flex-shrink: 0;
}

</style>
