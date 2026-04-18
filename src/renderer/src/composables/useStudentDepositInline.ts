/**
 * useStudentDepositInline : depot inline d'un devoir (fichier ou lien) depuis
 * la fiche projet etudiant, avec support drag & drop.
 *
 * Le composable gere :
 *   - l'id du devoir en cours de depot (un seul a la fois)
 *   - mode file/link
 *   - fichier uploade (url + displayName)
 *   - drag over visual state
 *   - soumission (appelle travauxStore.addDepot + refresh)
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useToast } from '@/composables/useToast'
import type { Devoir } from '@/types'

export type DepositMode = 'file' | 'link'

export function displayDepotName(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl.split('/').pop()?.replace(/^\d+_[a-f0-9]+_/, '') ?? pathOrUrl
  }
  return pathOrUrl.split(/[\\/]/).pop() ?? pathOrUrl
}

export function useStudentDepositInline(isExpired: (deadline: string) => boolean) {
  const appStore = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  const depositingDevoirId = ref<number | null>(null)
  const mode = ref<DepositMode>('file')
  const link = ref('')
  const file = ref<string | null>(null)
  const fileName = ref<string | null>(null)
  const depositing = ref(false)
  const dragOver = ref(false)

  function start(t: Devoir) {
    depositingDevoirId.value = t.id
    mode.value = 'file'
    link.value = ''
    file.value = null
    fileName.value = null
    dragOver.value = false
  }

  function cancel() {
    depositingDevoirId.value = null
    dragOver.value = false
  }

  async function pickFile() {
    const res = await window.api.openFileDialog()
    if (!res?.ok || !res.data) return
    const paths = res.data as string[]
    const localPath = paths[0]
    if (!localPath) return
    const localName = displayDepotName(localPath)
    const uploadRes = await window.api.uploadFile(localPath)
    if (uploadRes?.ok && uploadRes.data) {
      file.value = uploadRes.data.url
      fileName.value = localName
    } else {
      showToast('Erreur lors du chargement du fichier.', 'error')
    }
  }

  function clearFile() {
    file.value = null
    fileName.value = null
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    if (mode.value === 'file') dragOver.value = true
  }

  function onDragLeave() { dragOver.value = false }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragOver.value = false
    if (mode.value !== 'file') return
    const dropped = e.dataTransfer?.files?.[0]
    if (!dropped) return
    const filePath = (dropped as File & { path?: string }).path
    if (!filePath) return
    const uploadRes = await window.api.uploadFile(filePath)
    if (uploadRes?.ok && uploadRes.data) {
      file.value = uploadRes.data.url
      fileName.value = dropped.name
    } else {
      showToast('Erreur lors du chargement du fichier.', 'error')
    }
  }

  async function submit(devoir: Devoir) {
    if (depositing.value || !appStore.currentUser) return
    if (mode.value === 'file' && !file.value) return
    if (mode.value === 'link' && !link.value.trim()) return
    if (isExpired(devoir.deadline)) return
    depositing.value = true
    try {
      const ok = await travauxStore.addDepot({
        travail_id: devoir.id,
        student_id: appStore.currentUser.id,
        type:       mode.value,
        content:    mode.value === 'file' ? file.value! : link.value.trim(),
        file_name:  mode.value === 'file' ? fileName.value : null,
      })
      if (ok) {
        showToast('Depot enregistre.', 'success')
        cancel()
        await travauxStore.fetchStudentDevoirs()
      } else {
        showToast('Erreur lors du depot.', 'error')
      }
    } finally {
      depositing.value = false
    }
  }

  return {
    depositingDevoirId, mode, link, file, fileName, depositing, dragOver,
    start, cancel, pickFile, clearFile,
    onDragOver, onDragLeave, onDrop, submit,
  }
}
