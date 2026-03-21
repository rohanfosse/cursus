/**
 * Vue enseignant des devoirs : Gantt, liste, rendus, filtres, stats par type/promo.
 * Used by DevoirsView.vue
 */
import { ref, computed } from 'vue'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore }  from '@/stores/modals'
import { useToast }        from '@/composables/useToast'
import { deadlineClass }   from '@/utils/date'
import { isRattrapage }    from '@/utils/devoir'
import type { GanttRow }   from '@/types'

// ── Types locaux ────────────────────────────────────────────────────────────────
type UnifiedRow = GanttRow & { noted_count: number; statusLabel: string; statusCls: string }
type UnifiedFlatRow = UnifiedRow & { hasSubmission: boolean }
type GanttItem = GanttRow & { left: number; width: number; dlClass: string }

export type { UnifiedRow, UnifiedFlatRow, GanttItem }

// ── Constante ───────────────────────────────────────────────────────────────────
const TYPE_ORDER = ['cctl', 'soutenance', 'etude_de_cas', 'livrable', 'memoire', 'autre']

export function useDevoirsTeacher() {
  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const modals       = useModalsStore()
  const { showToast } = useToast()

  // ── Vue locale enseignant ─────────────────────────────────────────────────────
  const teacherView = ref<'gantt' | 'liste' | 'rendus'>('gantt')

  // ── Filtres prof ──────────────────────────────────────────────────────────────
  const filterCategory    = ref<string>('')
  const filterRendusStatus = ref<'all' | 'ungraded' | 'graded' | 'missing'>('all')
  const sortRendus        = ref<'name' | 'date'>('name')
  const teacherSearch     = ref('')
  const filterStatus      = ref<'all' | 'draft' | 'expired' | 'pending'>('all')
  const collapsedProjects = ref<Set<string>>(new Set())

  function toggleProjectCollapse(project: string) {
    if (collapsedProjects.value.has(project)) collapsedProjects.value.delete(project)
    else collapsedProjects.value.add(project)
  }

  // ── Tableau unifié prof ───────────────────────────────────────────────────────
  const unifiedGrouped = computed(() => {
    const raw = travauxStore.ganttData
    const q = teacherSearch.value.toLowerCase().trim()
    const now = Date.now()

    const filtered = raw.filter(t => {
      if (filterCategory.value && t.category?.trim() !== filterCategory.value) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (filterStatus.value === 'draft' && t.is_published) return false
      if (filterStatus.value === 'expired' && (new Date(t.deadline).getTime() > now || !t.is_published)) return false
      if (filterStatus.value === 'pending') {
        const dc = t.depots_count ?? 0
        const st = t.students_total ?? 0
        if (dc >= st && st > 0) return false // complet
      }
      return true
    })

    // Grouper par catégorie
    const groups = new Map<string, UnifiedRow[]>()
    for (const t of filtered) {
      const cat = t.category?.trim() || 'Sans projet'
      if (!groups.has(cat)) groups.set(cat, [])
      const dc = t.depots_count ?? 0
      const st = t.students_total ?? 0
      // Compter les notés depuis allRendus
      const noted = travauxStore.allRendus.filter(r => r.travail_id === t.id && r.note != null).length

      let statusLabel = 'Publié'
      let statusCls = 'status-pub'
      if (!t.is_published) { statusLabel = 'Brouillon'; statusCls = 'status-draft' }
      else if (st > 0 && dc >= st) { statusLabel = 'Complet'; statusCls = 'status-complete' }
      else if (new Date(t.deadline).getTime() < now) { statusLabel = 'Expiré'; statusCls = 'status-expired' }

      groups.get(cat)!.push({ ...t, depots_count: dc, students_total: st, noted_count: noted, statusLabel, statusCls })
    }
    // Trier par deadline dans chaque groupe
    for (const rows of groups.values()) {
      rows.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  })

  // ── Publish inline + ajout par type ───────────────────────────────────────────
  async function publishDevoir(id: number, event: Event) {
    event.stopPropagation()
    try {
      await window.api.updateTravailPublished({ travailId: id, published: true })
      showToast('Devoir publié.', 'success')
      loadView()
    } catch (err) { console.warn('[publishDevoir]', err); showToast('Erreur.', 'error') }
  }

  async function publishAllDrafts() {
    const drafts = unifiedFlat.value.filter(t => !t.is_published)
    if (!drafts.length) return
    const results = await Promise.allSettled(
      drafts.map(d => window.api.updateTravailPublished({ travailId: d.id, published: true })),
    )
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) {
      console.warn(`[publishAllDrafts] ${failed}/${drafts.length} publications échouées`)
      showToast(`${succeeded} publié${succeeded > 1 ? 's' : ''}, ${failed} erreur${failed > 1 ? 's' : ''}.`, 'error')
    } else {
      showToast(`${succeeded} devoir${succeeded > 1 ? 's' : ''} publié${succeeded > 1 ? 's' : ''}.`, 'success')
    }
    loadView()
  }

  function addDevoirOfType(type: string) {
    // Pré-sélectionner le type dans la modale
    appStore.pendingDevoirType = type
    modals.newDevoir = true
  }

  // ── Stats globales promo ──────────────────────────────────────────────────────
  const globalDrafts = computed(() =>
    (travauxStore.ganttData).filter(t => !t.is_published).length,
  )
  const globalToGrade = computed(() => {
    const all = travauxStore.allRendus
    return all.filter(r => !r.note && r.submitted_at).length
  })

  // ── Prochains événements (tous types, triés par deadline) ─────────────────────
  const upcomingDevoirs = computed(() => {
    const now = Date.now()
    return (travauxStore.ganttData)
      .filter(t => t.is_published && new Date(t.deadline).getTime() > now)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5)
  })

  // ── Helpers pour la page d'accueil projets ────────────────────────────────────
  function projectDevoirCount(cat: string): number {
    return (travauxStore.ganttData).filter(t => t.category?.trim() === cat).length
  }
  function projectNextDeadline(cat: string): string | null {
    const now = Date.now()
    const upcoming = (travauxStore.ganttData)
      .filter(t => t.category?.trim() === cat && t.is_published && new Date(t.deadline).getTime() > now)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    return upcoming[0]?.deadline ?? null
  }
  function projectTypeCounts(cat: string): { type: string; count: number }[] {
    const counts: Record<string, number> = {}
    for (const t of (travauxStore.ganttData).filter(d => d.category?.trim() === cat)) {
      counts[t.type] = (counts[t.type] ?? 0) + 1
    }
    return Object.entries(counts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
  }

  // Stats enrichies par projet (pour cartes et résumé)
  function projectStats(cat: string) {
    const devoirs = (travauxStore.ganttData)
      .filter(d => d.category?.trim() === cat)
    const totalDepots = devoirs.reduce((s, d) => s + (d.depots_count ?? 0), 0)
    const totalExpected = devoirs.reduce((s, d) => s + (d.students_total ?? 0), 0)
    const pct = totalExpected > 0 ? Math.round((totalDepots / totalExpected) * 100) : 0
    const drafts = devoirs.filter(d => !d.is_published).length
    const noted = travauxStore.allRendus.filter(r => devoirs.some(d => d.id === r.travail_id) && r.note != null).length
    const toGrade = totalDepots - noted
    return { totalDepots, totalExpected, pct, drafts, noted, toGrade }
  }

  // ── Devoirs par type (pour la vue projet sélectionné) ─────────────────────────
  const devoirsByType = computed(() => {
    const groups: Record<string, typeof unifiedFlat.value> = {}
    for (const t of unifiedFlat.value) {
      if (!groups[t.type]) groups[t.type] = []
      groups[t.type].push(t)
    }
    return TYPE_ORDER
      .filter(type => groups[type]?.length)
      .map(type => {
        const items = groups[type]
        const initiales = items.filter(t => !isRattrapage(t)).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        const rattrapages = items.filter(t => isRattrapage(t)).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        return { type, initiales, rattrapages, total: items.length }
      })
  })

  // Liste plate pour le tableau (quand on filtre par catégorie via onglets)
  const unifiedFlat = computed((): UnifiedFlatRow[] => {
    const raw = travauxStore.ganttData
    const now = Date.now()

    return raw
      .filter(t => {
        // Filtre par projet actif (prioritaire) ou par onglet catégorie
        const catFilter = appStore.activeProject || filterCategory.value
        if (catFilter && t.category?.trim() !== catFilter) return false
        if (teacherSearch.value) {
          const q = teacherSearch.value.toLowerCase().trim()
          if (!t.title.toLowerCase().includes(q)) return false
        }
        return true
      })
      .map(t => {
        const dc = t.depots_count ?? 0
        const st = t.students_total ?? 0
        const noted = travauxStore.allRendus.filter(r => r.travail_id === t.id && r.note != null).length
        const isEvent = t.type === 'soutenance' || t.type === 'cctl'

        let statusLabel = 'Publié'
        let statusCls = 'status-pub'
        if (!t.is_published) { statusLabel = 'Brouillon'; statusCls = 'status-draft' }
        else if (!isEvent && st > 0 && dc >= st) { statusLabel = 'Complet'; statusCls = 'status-complete' }
        else if (new Date(t.deadline).getTime() < now) { statusLabel = 'Passé'; statusCls = 'status-expired' }

        return {
          ...t,
          depots_count: dc,
          students_total: st,
          noted_count: noted,
          statusLabel,
          statusCls,
          hasSubmission: !isEvent,
        } as UnifiedFlatRow
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  })

  // ── Catégories disponibles pour le filtre ─────────────────────────────────────
  const teacherCategories = computed(() => {
    const cats = new Set((travauxStore.ganttData).map(t => t.category?.trim()).filter(Boolean))
    return Array.from(cats).sort() as string[]
  })

  // ── Gantt : calcul des positions ──────────────────────────────────────────────
  const now = ref(Date.now())

  const ganttItems = computed((): { items: GanttItem[]; todayPct: number } => {
    let raw = travauxStore.ganttData
    if (filterCategory.value) raw = raw.filter(t => t.category?.trim() === filterCategory.value)
    if (!raw.length) return { items: [], todayPct: 0 }

    const dates = raw.flatMap(t => [
      t.start_date ? new Date(t.start_date).getTime() : new Date(t.deadline).getTime() - 7 * 86400000,
      new Date(t.deadline).getTime(),
    ])
    const minT = Math.min(...dates)
    const maxT = Math.max(...dates)
    const span = maxT - minT || 1

    const todayPct = Math.max(0, Math.min(100, ((now.value - minT) / span) * 100))

    const items = raw.map(t => {
      const startMs = t.start_date
        ? new Date(t.start_date).getTime()
        : new Date(t.deadline).getTime() - 7 * 86400000
      const endMs   = new Date(t.deadline).getTime()
      const left    = ((startMs - minT) / span) * 100
      const width   = Math.max(((endMs - startMs) / span) * 100, 2)
      return { ...t, left, width, dlClass: deadlineClass(t.deadline) }
    })

    return { items, todayPct }
  })

  // ── Rendus : grouper par devoir avec titres + filtres ─────────────────────────
  const rendusByDevoir = computed(() => {
    const ganttMap = new Map(travauxStore.ganttData.map(t => [t.id, t]))
    const map = new Map<number, { devoir: Partial<GanttRow>; rendus: typeof travauxStore.allRendus }>()
    for (const r of travauxStore.allRendus) {
      // Filtre par catégorie
      const gt = ganttMap.get(r.travail_id)
      if (filterCategory.value && gt?.category?.trim() !== filterCategory.value) continue
      if (!map.has(r.travail_id)) {
        map.set(r.travail_id, { devoir: gt ?? { id: r.travail_id }, rendus: [] })
      }
      map.get(r.travail_id)!.rendus.push(r)
    }
    // Filtre par statut + tri
    const groups = [...map.values()]
    for (const g of groups) {
      // Filtre statut
      if (filterRendusStatus.value === 'ungraded') g.rendus = g.rendus.filter(r => !r.note)
      else if (filterRendusStatus.value === 'graded') g.rendus = g.rendus.filter(r => !!r.note)
      // Tri
      g.rendus.sort((a, b) => {
        if (sortRendus.value === 'name') return (a.student_name ?? '').localeCompare(b.student_name ?? '')
        return new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime()
      })
    }
    // Retirer les groupes vides après filtre
    return groups.filter(g => g.rendus.length > 0)
  })

  // ── Chargement des données (branche prof) ─────────────────────────────────────
  async function loadView() {
    const promoId = appStore.activePromoId
    if (!promoId) return
    await travauxStore.fetchGantt(promoId)
    if (teacherView.value === 'rendus') {
      await travauxStore.fetchRendus(promoId)
    }
    travauxStore.setView(teacherView.value === 'rendus' ? 'rendus' : 'gantt')
  }

  function setTeacherView(v: 'gantt' | 'liste' | 'rendus') {
    teacherView.value = v
    loadView()
  }

  // ── Vue prof : ouvrir un devoir ───────────────────────────────────────────────
  async function openDevoir(devoirId: number) {
    appStore.currentTravailId = devoirId
    await travauxStore.openTravail(devoirId)
    modals.gestionDevoir = true
  }

  return {
    // Refs
    teacherView,
    filterCategory,
    filterRendusStatus,
    sortRendus,
    teacherSearch,
    filterStatus,
    collapsedProjects,

    // Functions
    toggleProjectCollapse,
    publishDevoir,
    publishAllDrafts,
    addDevoirOfType,
    projectDevoirCount,
    projectNextDeadline,
    projectTypeCounts,
    projectStats,
    loadView,
    setTeacherView,
    openDevoir,

    // Computeds
    unifiedGrouped,
    globalDrafts,
    globalToGrade,
    upcomingDevoirs,
    devoirsByType,
    unifiedFlat,
    teacherCategories,
    ganttItems,
    rendusByDevoir,

    // Constants
    TYPE_ORDER,
  }
}
