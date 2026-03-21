// ─── Composable : état et logique enseignant du Dashboard ────────────────────
import { ref, computed, watch } from 'vue'
import { useAppStore }    from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { useApi }          from '@/composables/useApi'
import { useToast }        from '@/composables/useToast'
import { useConfirm }      from '@/composables/useConfirm'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import type { Component }  from 'vue'
import type { Promotion }  from '@/types'

// ── Types locaux ──────────────────────────────────────────────────────────────
export interface GanttRow {
  id:             number
  title:          string
  deadline:       string
  start_date:     string | null
  type:           string
  published:      number
  category:       string | null
  channel_name:   string
  promo_name:     string
  promo_color:    string
  depots_count:   number
  students_total: number
}

export interface ProjectCard {
  key: string; label: string; icon: Component | null
  total: number; published: number; depots: number; expected: number; nextDeadline: string | null
}

export type Reminder = {
  id: number; promo_tag: string; date: string; title: string
  description: string; bloc: string | null; done: number; isOverdue?: boolean
}

export function useDashboardTeacher() {
  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const travauxStore = useTravauxStore()
  const { api }      = useApi()
  const { showToast } = useToast()
  const { confirm: askConfirm } = useConfirm()

  // ── État ─────────────────────────────────────────────────────────────────────
  const loadingTeacher  = ref(true)
  const aNoterCount     = ref(0)
  const brouillonsCount = ref(0)
  const promos          = ref<Promotion[]>([])
  const allStudents     = ref<{ id: number; promo_id: number; name?: string }[]>([])
  const ganttAll        = ref<GanttRow[]>([])
  const savingPromo     = ref(false)
  const deletingPromoId = ref<number | null>(null)

  // ── Rappels prof ────────────────────────────────────────────────────────────
  const allReminders = ref<Reminder[]>([])
  const showAllReminders = ref(false)

  function getWeekBounds() {
    const now = new Date()
    const day = now.getDay()
    const diffToMon = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMon)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { monday, sunday }
  }

  const thisWeekReminders = computed(() => {
    const { monday, sunday } = getWeekBounds()
    const now = Date.now()
    return allReminders.value
      .filter(r => {
        const d = new Date(r.date).getTime()
        return (d >= monday.getTime() && d <= sunday.getTime()) || (!r.done && d < now)
      })
      .map(r => ({
        ...r,
        isOverdue: !r.done && new Date(r.date).getTime() < now,
        isToday: new Date(r.date).toDateString() === new Date().toDateString(),
      }))
      .sort((a, b) => {
        if (a.done !== b.done) return a.done - b.done
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      })
  })

  const doneThisWeek  = computed(() => thisWeekReminders.value.filter(r => r.done).length)
  const totalThisWeek = computed(() => thisWeekReminders.value.length)

  async function loadReminders() {
    allReminders.value = await api<Reminder[]>(() => window.api.getTeacherReminders()) ?? []
  }

  async function toggleReminder(id: number, done: boolean) {
    const result = await api(() => window.api.toggleReminderDone(id, done))
    if (result !== null) {
      const r = allReminders.value.find(r => r.id === id)
      if (r) r.done = done ? 1 : 0
    }
  }

  // ── Promo active + données filtrées ────────────────────────────────────────
  const activePromo = computed(() =>
    promos.value.find(p => p.id === appStore.activePromoId) ?? null,
  )

  const ganttFiltered = computed(() =>
    activePromo.value
      ? ganttAll.value.filter(t => t.promo_name === activePromo.value!.name)
      : ganttAll.value,
  )

  const studentsForPromo = computed(() =>
    activePromo.value
      ? allStudents.value.filter(s => s.promo_id === activePromo.value!.id)
      : allStudents.value,
  )

  const totalStudents = computed(() => studentsForPromo.value.length)

  const urgentsCount = computed(() => {
    const now = Date.now()
    const week = now + 7 * 86_400_000
    return ganttFiltered.value.filter(t => {
      const d = new Date(t.deadline).getTime()
      return t.published && d >= now && d <= week
    }).length
  })

  // ── Renommer / Supprimer promo ─────────────────────────────────────────────
  const renamingPromoId    = ref<number | null>(null)
  const renamingPromoValue = ref('')

  async function confirmRenamePromo(p: { id: number; name: string }) {
    if (!renamingPromoValue.value.trim()) return
    savingPromo.value = true
    try {
      const result = await api(() => window.api.renamePromotion(p.id, renamingPromoValue.value.trim()), 'promo')
      if (result !== null) {
        p.name = renamingPromoValue.value.trim()
        renamingPromoId.value = null
        showToast('Promotion renommée.', 'success')
      }
    } finally { savingPromo.value = false }
  }

  async function deletePromo(id: number, name: string) {
    const ok = await askConfirm(
      `Supprimer la promotion "${name}" et tous ses canaux/devoirs ? Cette action est irréversible.`,
      'danger',
      'Supprimer',
    )
    if (!ok) return
    deletingPromoId.value = id
    try {
      const result = await api(() => window.api.deletePromotion(id), 'promo')
      if (result !== null) {
        promos.value = promos.value.filter(p => p.id !== id)
        if (appStore.activePromoId === id && promos.value.length) appStore.activePromoId = promos.value[0].id
        showToast('Promotion supprimée.', 'success')
      }
    } finally { deletingPromoId.value = null }
  }

  async function reloadPromos() {
    const [promosData, ganttData2] = await Promise.all([
      api<Promotion[]>(() => window.api.getPromotions()),
      api<GanttRow[]>(() => window.api.getGanttData(0 as number) as Promise<{ ok: boolean; data?: GanttRow[] }>),
    ])
    promos.value   = promosData ?? promos.value
    ganttAll.value = ganttData2 ?? ganttAll.value
  }

  // Recharger quand la modale de création de promo se ferme
  watch(() => modals.createPromo, (open) => {
    if (!open && appStore.isTeacher) reloadPromos()
  })

  // ── Projets prof ──────────────────────────────────────────────────────────
  const projectCards = computed((): ProjectCard[] => {
    const map = new Map<string, GanttRow[]>()
    for (const t of ganttFiltered.value) {
      if (!t.category?.trim()) continue
      if (!map.has(t.category)) map.set(t.category, [])
      map.get(t.category)!.push(t)
    }
    const cards: ProjectCard[] = []
    for (const [key, rows] of map) {
      const { icon, label } = parseCategoryIcon(key)
      const published = rows.filter(r => r.published)
      const now = Date.now()
      const upcoming = published
        .filter(r => new Date(r.deadline).getTime() >= now)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      cards.push({
        key, label, icon,
        total:        rows.length,
        published:    published.length,
        depots:       rows.reduce((s, r) => s + (r.depots_count ?? 0), 0),
        expected:     rows.reduce((s, r) => s + (r.students_total ?? 0), 0),
        nextDeadline: upcoming[0]?.deadline ?? null,
      })
    }
    return cards.sort((a, b) => {
      if (!a.nextDeadline && !b.nextDeadline) return a.label.localeCompare(b.label)
      if (!a.nextDeadline) return 1; if (!b.nextDeadline) return -1
      return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime()
    })
  })

  // ── Dernière activité (rendus récents) ──────────────────────────────────────
  const recentRendus = computed(() => {
    return travauxStore.allRendus
      .filter(r => r.submitted_at)
      .sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime())
      .slice(0, 5)
  })

  // ── Chargement initial ─────────────────────────────────────────────────────
  async function loadTeacherData(checkDevoirsResources: () => void) {
    try {
      type Schedule = { aNoter: unknown[]; brouillons: unknown[] }
      const [schedData, promosData, studData, ganttData] = await Promise.all([
        api<Schedule>(() => window.api.getTeacherSchedule() as Promise<{ ok: boolean; data?: Schedule }>),
        api<Promotion[]>(() => window.api.getPromotions()),
        api<typeof allStudents.value>(() => window.api.getAllStudents()),
        api<GanttRow[]>(() => window.api.getGanttData(0 as number) as Promise<{ ok: boolean; data?: GanttRow[] }>),
      ])
      if (schedData) {
        aNoterCount.value     = schedData.aNoter?.length     ?? 0
        brouillonsCount.value = schedData.brouillons?.length ?? 0
      }
      promos.value = promosData ?? []
      if (promos.value.length && !appStore.activePromoId) {
        appStore.activePromoId = promos.value[0].id
      }
      allStudents.value = studData ?? []
      ganttAll.value    = ganttData ?? []
      loadReminders()
      checkDevoirsResources()
      if (promos.value.length) {
        const pid = appStore.activePromoId ?? promos.value[0]?.id
        if (pid) travauxStore.fetchRendus(pid)
      }
    } finally { loadingTeacher.value = false }
  }

  return {
    // State
    loadingTeacher, aNoterCount, brouillonsCount, promos, allStudents, ganttAll,
    savingPromo, deletingPromoId,
    // Reminders
    allReminders, showAllReminders, thisWeekReminders, doneThisWeek, totalThisWeek,
    loadReminders, toggleReminder,
    // Promo
    activePromo, ganttFiltered, studentsForPromo, totalStudents, urgentsCount,
    renamingPromoId, renamingPromoValue,
    confirmRenamePromo, deletePromo, reloadPromos,
    // Projects
    projectCards, recentRendus,
    // Init
    loadTeacherData,
  }
}
