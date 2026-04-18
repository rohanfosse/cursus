/**
 * useStudentProjetDevoirs : vue etudiant sur les devoirs d'un projet.
 *
 * Filtre les devoirs par projectKey, expose les listes submitted/pending/event,
 * calcule les stats (moyenne, overdue, %) et la prochaine echeance proche
 * (< 3 jours). Une horloge interne (30s) maintient `now` a jour pour que
 * les classifications expired/overdue/soon restent reactives.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import { useTravauxStore } from '@/stores/travaux'
import type { Devoir } from '@/types'

const CLOCK_TICK_MS = 30_000
const SOON_THRESHOLD_MS = 3 * 86_400_000

function isEventType(type: string): boolean {
  return type === 'soutenance' || type === 'cctl'
}

export function useStudentProjetDevoirs(
  projectKey: Ref<string>,
  docsCount: Ref<number>,
  channelsCount: Ref<number>,
) {
  const travauxStore = useTravauxStore()
  const now = ref(Date.now())
  let clockInterval: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    clockInterval = setInterval(() => { now.value = Date.now() }, CLOCK_TICK_MS)
  })
  onBeforeUnmount(() => {
    if (clockInterval) clearInterval(clockInterval)
  })

  const devoirs = computed<Devoir[]>(() =>
    travauxStore.devoirs
      .filter((t) => t.category === projectKey.value)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
  )

  const devoirsSubmitted = computed(() => devoirs.value.filter((t) => t.depot_id != null))
  const devoirsPending = computed(() =>
    devoirs.value.filter((t) => t.depot_id == null && !isEventType(t.type)),
  )
  const devoirsEvent = computed(() => devoirs.value.filter((t) => isEventType(t.type)))

  function isExpired(deadline: string): boolean {
    return now.value >= new Date(deadline).getTime()
  }
  function isOverdue(t: Devoir): boolean {
    return t.depot_id == null && !isEventType(t.type) && isExpired(t.deadline)
  }

  const stats = computed(() => {
    const graded = devoirs.value.filter((t) => t.note != null)
    const grades = graded.map((t) => parseFloat(t.note ?? '')).filter((n) => !isNaN(n))
    const avg = grades.length
      ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10
      : null
    const overdue = devoirs.value.filter((t) => isOverdue(t)).length
    const pct = devoirs.value.length
      ? Math.round((devoirsSubmitted.value.length / devoirs.value.length) * 100)
      : 0
    return {
      total:     devoirs.value.length,
      submitted: devoirsSubmitted.value.length,
      pending:   devoirsPending.value.length,
      overdue,
      graded:    graded.length,
      avg,
      pct,
      docs:      docsCount.value,
      channels:  channelsCount.value,
    }
  })

  /** Prochaine echeance non depassee dans les 3 prochains jours. */
  const nextDeadlineSoon = computed(() => {
    const upcoming = devoirsPending.value
      .filter((t) => !isExpired(t.deadline))
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    if (!upcoming.length) return null
    const first = upcoming[0]
    const diff = new Date(first.deadline).getTime() - now.value
    if (diff > SOON_THRESHOLD_MS) return null
    const days = Math.ceil(diff / 86_400_000)
    const label = days <= 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`
    return { title: first.title, deadline: first.deadline, label }
  })

  return {
    now, devoirs, devoirsSubmitted, devoirsPending, devoirsEvent,
    stats, nextDeadlineSoon,
    isExpired, isOverdue, isEventType,
  }
}
