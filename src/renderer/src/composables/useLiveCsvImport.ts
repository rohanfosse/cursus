/**
 * useLiveCsvImport : upload CSV + feedback utilisateur pour creer des activites.
 *
 * Encapsule la chaine picker → parseLiveCsv → confirm si erreurs → pushActivity
 * en boucle + toasts. Le parseur lui-meme reste dans useLiveCsv.ts (pur).
 */
import { ref } from 'vue'
import { useLiveStore } from '@/stores/live'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { parseLiveCsv, csvActivityToPayload } from '@/composables/useLiveCsv'

const CSV_TEMPLATE_LINES = [
  'Type;Question;Options;Extra;Temps',
  'sondage;Quelle couleur preferez-vous ?;Bleu|Rouge|Vert|Jaune;;30',
  'qcm;Capitale de la France ?;Paris|Londres|Rome|Berlin;1;20',
  'vrai_faux;La Terre est ronde;;1;15',
  'nuage;Un mot pour decrire la session ?;;2;45',
  'echelle;Notez la session sur 5;;5;30',
  'question_ouverte;Qu\'avez-vous retenu ?;;;60',
  'humeur;Votre ressenti ?;;;30',
  'priorite;Classez ces themes par interet;Securite|Performance|UX|Innovation;;45',
  'matrice;Evaluez ces criteres sur 5;Clarte|Utilite|Originalite;5;60',
]

const MAX_CSV_BYTES = 2 * 1024 * 1024

export function useLiveCsvImport() {
  const liveStore = useLiveStore()
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const inputRef = ref<HTMLInputElement | null>(null)
  const importing = ref(false)
  const helpOpen = ref(false)

  function openPicker() { inputRef.value?.click() }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + CSV_TEMPLATE_LINES.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cursus-live-modele.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || !liveStore.currentSession) return
    if (file.size > MAX_CSV_BYTES) {
      showToast('Fichier trop volumineux (max 2 Mo)', 'error')
      return
    }
    importing.value = true
    try {
      const text = await file.text()
      const { activities, errors, format } = parseLiveCsv(text)
      if (!activities.length) {
        showToast(
          'Aucune question valide trouvee dans le CSV',
          'error',
          errors.length ? `${errors.length} ligne(s) en erreur — voir la console.` : undefined,
        )
        if (errors.length) console.warn('[CSV Live] erreurs :', errors)
        return
      }
      if (errors.length) {
        const proceed = await confirm(
          `${activities.length} question(s) a importer (format ${format}), ${errors.length} ligne(s) ignoree(s). Continuer ?`,
          'warning',
          'Importer',
        )
        if (!proceed) return
      }
      const sessionId = liveStore.currentSession.id
      let imported = 0
      for (const a of activities) {
        const payload = csvActivityToPayload(a)
        const ok = await liveStore.pushActivity(sessionId, payload as Parameters<typeof liveStore.pushActivity>[1])
        if (ok) imported++
      }
      showToast(
        `${imported} question${imported > 1 ? 's' : ''} importee${imported > 1 ? 's' : ''} (${format})`,
        'success',
      )
    } catch (err) {
      console.error('[CSV Live] import error', err)
      showToast('Erreur lors de la lecture du CSV', 'error')
    } finally {
      importing.value = false
    }
  }

  return { inputRef, importing, helpOpen, openPicker, downloadTemplate, onFileSelected }
}
