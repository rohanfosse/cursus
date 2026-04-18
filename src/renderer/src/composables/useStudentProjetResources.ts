/**
 * useStudentProjetResources : charge les documents projet + les canaux
 * de la categorie correspondante. Recharge quand projectKey ou promoId
 * change.
 */
import { ref, watch, onMounted } from 'vue'
import type { Ref } from 'vue'
import type { AppDocument, Channel } from '@/types'

export function useStudentProjetResources(
  projectKey: Ref<string>,
  promoId: Ref<number>,
) {
  const documents = ref<AppDocument[]>([])
  const channels = ref<Channel[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const [docsRes, chRes] = await Promise.all([
        window.api.getProjectDocuments(promoId.value, projectKey.value),
        window.api.getChannels(promoId.value),
      ])
      documents.value = docsRes?.ok ? docsRes.data : []
      const all = chRes?.ok ? (chRes.data as Channel[]) : []
      channels.value = all.filter((c) => c.category?.trim() === projectKey.value)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  watch([projectKey, promoId], load)

  return { documents, channels, loading, load }
}
