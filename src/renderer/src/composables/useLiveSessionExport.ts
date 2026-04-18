/**
 * useLiveSessionExport : export CSV des resultats de la session Live courante.
 */
import { ref } from 'vue'
import { useLiveStore } from '@/stores/live'

export function useLiveSessionExport() {
  const liveStore = useLiveStore()
  const exporting = ref(false)

  async function exportCsv() {
    if (!liveStore.currentSession) return
    exporting.value = true
    try {
      const csv = await liveStore.exportCsv(liveStore.currentSession.id)
      if (!csv) return
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `live-${liveStore.currentSession.title.replace(/\s+/g, '-')}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportCsv }
}
