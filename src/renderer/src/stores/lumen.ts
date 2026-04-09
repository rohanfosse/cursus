/** Store Lumen — cours markdown publies par les enseignants. */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import type { LumenCourse, LumenSnapshotTree } from '@/types'

export const useLumenStore = defineStore('lumen', () => {
  const { api } = useApi()

  // ── Etat ──────────────────────────────────────────────────────────────────
  const courses       = ref<LumenCourse[]>([])
  const currentCourse = ref<LumenCourse | null>(null)
  const loading       = ref(false)

  // Cours publies non lus par l'etudiant courant pour la promo active.
  // Alimente le badge rail Lumen et le widget dashboard "Nouveaux cours".
  const unreadCourses = ref<LumenCourse[]>([])
  const unreadCount   = ref(0)

  // ── Computed ─────────────────────────────────────────────────────────────
  const publishedCourses = computed(() => courses.value.filter(c => c.status === 'published'))
  const draftCourses     = computed(() => courses.value.filter(c => c.status === 'draft'))

  // ── Actions ──────────────────────────────────────────────────────────────

  async function fetchCoursesForPromo(promoId: number): Promise<void> {
    loading.value = true
    try {
      const data = await api<LumenCourse[]>(
        () => window.api.getLumenCoursesForPromo(promoId),
        { silent: true },
      )
      courses.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function fetchCourse(id: number): Promise<LumenCourse | null> {
    loading.value = true
    try {
      const data = await api<LumenCourse>(() => window.api.getLumenCourse(id))
      if (data) currentCourse.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function createCourse(payload: { promoId: number; projectId?: number | null; title: string; summary?: string; content?: string; repoUrl?: string | null }): Promise<LumenCourse | null> {
    loading.value = true
    try {
      const data = await api<LumenCourse>(() => window.api.createLumenCourse(payload))
      if (data) {
        courses.value = [data, ...courses.value]
        currentCourse.value = data
      }
      return data
    } finally {
      loading.value = false
    }
  }

  async function updateCourse(id: number, payload: { title?: string; summary?: string; content?: string; projectId?: number | null; repoUrl?: string | null }): Promise<LumenCourse | null> {
    const data = await api<LumenCourse>(() => window.api.updateLumenCourse(id, payload))
    if (data) {
      const idx = courses.value.findIndex(c => c.id === id)
      if (idx !== -1) courses.value = [...courses.value.slice(0, idx), data, ...courses.value.slice(idx + 1)]
      if (currentCourse.value?.id === id) currentCourse.value = data
    }
    return data
  }

  async function publishCourse(id: number): Promise<boolean> {
    const data = await api<LumenCourse>(() => window.api.publishLumenCourse(id))
    if (data) {
      const idx = courses.value.findIndex(c => c.id === id)
      if (idx !== -1) courses.value = [...courses.value.slice(0, idx), data, ...courses.value.slice(idx + 1)]
      if (currentCourse.value?.id === id) currentCourse.value = data
      return true
    }
    return false
  }

  async function unpublishCourse(id: number): Promise<boolean> {
    const data = await api<LumenCourse>(() => window.api.unpublishLumenCourse(id))
    if (data) {
      const idx = courses.value.findIndex(c => c.id === id)
      if (idx !== -1) courses.value = [...courses.value.slice(0, idx), data, ...courses.value.slice(idx + 1)]
      if (currentCourse.value?.id === id) currentCourse.value = data
      return true
    }
    return false
  }

  async function deleteCourse(id: number): Promise<boolean> {
    const data = await api<{ id: number; deleted: boolean; soft?: boolean }>(() => window.api.deleteLumenCourse(id))
    if (data?.deleted) {
      // Soft delete : retirer de la liste visible mais garder en cache
      // pour pouvoir restaurer sans refetch.
      courses.value = courses.value.filter(c => c.id !== id)
      if (currentCourse.value?.id === id) currentCourse.value = null
      return true
    }
    return false
  }

  // ── Corbeille (soft delete) ────────────────────────────────────────────

  const trashedCourses = ref<LumenCourse[]>([])

  async function fetchTrash(): Promise<void> {
    const data = await api<LumenCourse[]>(
      () => window.api.getLumenTrash(),
      { silent: true },
    )
    trashedCourses.value = data ?? []
  }

  async function restoreCourse(id: number): Promise<boolean> {
    const data = await api<{ id: number; restored: boolean; course: LumenCourse }>(
      () => window.api.restoreLumenCourse(id),
      { silent: true },
    )
    if (data?.restored && data.course) {
      trashedCourses.value = trashedCourses.value.filter(c => c.id !== id)
      // Re-inject dans la liste principale
      const exists = courses.value.find(c => c.id === id)
      if (!exists) courses.value = [data.course, ...courses.value]
      return true
    }
    return false
  }

  async function purgeCourse(id: number): Promise<boolean> {
    const data = await api<{ id: number; purged: boolean }>(
      () => window.api.purgeLumenCourse(id),
      { silent: true },
    )
    if (data?.purged) {
      trashedCourses.value = trashedCourses.value.filter(c => c.id !== id)
      return true
    }
    return false
  }

  function clearCurrentCourse() {
    currentCourse.value = null
  }

  // ── Tracking lecture etudiant ────────────────────────────────────────────

  /** Charge les cours publies non lus de l'etudiant pour une promo. */
  async function fetchUnread(promoId: number): Promise<void> {
    const data = await api<{ count: number; courses: LumenCourse[] }>(
      () => window.api.getLumenUnreadForPromo(promoId),
      { silent: true },
    )
    if (data) {
      unreadCourses.value = data.courses
      unreadCount.value   = data.count
    }
  }

  /**
   * Marque un cours comme lu (best-effort, fire-and-forget cote UX).
   * Mise a jour optimiste : retire le cours de la liste non-lus immediatement.
   * Idempotent : appeler plusieurs fois ne casse rien.
   */
  async function markAsRead(courseId: number): Promise<void> {
    const wasUnread = unreadCourses.value.some(c => c.id === courseId)
    if (wasUnread) {
      unreadCourses.value = unreadCourses.value.filter(c => c.id !== courseId)
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
    try {
      await api(() => window.api.markLumenCourseRead(courseId), { silent: true })
    } catch {
      // Echec silencieux : le prochain fetchUnread resynchronisera l'etat.
    }
  }

  /**
   * Reset complet : utilise au logout ou changement de promo pour eviter
   * de mixer les compteurs entre promos.
   */
  function resetUnread() {
    unreadCourses.value = []
    unreadCount.value = 0
  }

  /**
   * Marque tous les cours publies d'une promo comme lus pour l'etudiant
   * courant. Mise a jour optimiste : vide la liste unreadCourses
   * immediatement, puis appelle le backend. Le backend retourne le nombre
   * reellement marque (en cas d'incoherence cache, on resynchronise).
   */
  async function markAllAsRead(promoId: number): Promise<number> {
    const before = unreadCount.value
    unreadCourses.value = []
    unreadCount.value = 0
    const data = await api<{ marked: number }>(
      () => window.api.markAllLumenCoursesRead(promoId),
      { silent: true },
    )
    if (!data) {
      // Rollback : refetch le vrai etat serveur
      await fetchUnread(promoId)
      return 0
    }
    return data.marked ?? before
  }

  // Compteurs de lecture par cours (pour le dashboard prof — anonymises)
  const readCounts = ref<Map<number, number>>(new Map())
  async function fetchReadCounts(promoId: number): Promise<void> {
    const data = await api<Record<number, number>>(
      () => window.api.getLumenReadCountsForPromo(promoId),
      { silent: true },
    )
    if (!data) return
    const next = new Map<number, number>()
    for (const [k, v] of Object.entries(data)) next.set(Number(k), v)
    readCounts.value = next
  }

  /**
   * Handler socket : un cours vient d'etre publie sur la promo active.
   * Recharge la liste des cours et le compteur de non-lus.
   */
  async function onCoursePublished(promoId: number, activePromoId: number | null) {
    if (activePromoId !== promoId) return
    await Promise.all([
      fetchCoursesForPromo(promoId),
      fetchUnread(promoId),
    ])
  }

  // ── Snapshot repo git d'exemple ──────────────────────────────────────────

  // Arborescence courante du projet d'exemple affiche dans le reader.
  // Indexe par id de cours pour supporter un switch rapide entre cours.
  const snapshotTrees = ref<Map<number, LumenSnapshotTree>>(new Map())

  // Cache du contenu decode (utf-8) des fichiers deja ouverts.
  // Cle : `${courseId}:${path}`. Evite de refetch + redecoder a chaque clic.
  const fileContentCache = ref<Map<string, { text: string; size: number; binary: boolean }>>(new Map())

  async function fetchSnapshotTree(courseId: number): Promise<LumenSnapshotTree | null> {
    const existing = snapshotTrees.value.get(courseId)
    if (existing) return existing
    const data = await api<LumenSnapshotTree>(
      () => window.api.getLumenSnapshotTree(courseId),
      { silent: true },
    )
    if (data) {
      const next = new Map(snapshotTrees.value)
      next.set(courseId, data)
      snapshotTrees.value = next
    }
    return data
  }

  // Extensions traitees comme binaires (affichage direct impossible — on
  // invite l'etudiant a telecharger le zip pour les recuperer).
  const BINARY_EXTS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff',
    'pdf', 'zip', 'tar', 'gz', '7z', 'rar',
    'ttf', 'otf', 'woff', 'woff2',
    'mp3', 'mp4', 'wav', 'ogg', 'mov', 'avi',
    'exe', 'dll', 'so', 'dylib', 'bin',
  ])

  function isBinaryByExtension(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    return BINARY_EXTS.has(ext)
  }

  async function fetchFileContent(courseId: number, path: string): Promise<{ text: string; size: number; binary: boolean } | null> {
    const key = `${courseId}:${path}`
    const cached = fileContentCache.value.get(key)
    if (cached) return cached

    if (isBinaryByExtension(path)) {
      const entry = { text: '', size: 0, binary: true }
      const next = new Map(fileContentCache.value)
      next.set(key, entry)
      fileContentCache.value = next
      return entry
    }

    const data = await api<{ path: string; size: number; content_base64: string }>(
      () => window.api.getLumenSnapshotFile(courseId, path),
      { silent: true },
    )
    if (!data) return null

    // Decode base64 → texte UTF-8. Si le decode produit un caractere
    // remplacement (\uFFFD) dans les premiers Ko, c'est probablement un
    // binaire que l'extension n'a pas detecte : on le marque binaire.
    let text = ''
    let binary = false
    try {
      const bin = atob(data.content_base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      if (text.slice(0, 2048).includes('\uFFFD')) {
        binary = true
        text = ''
      }
    } catch {
      binary = true
    }

    const entry = { text, size: data.size, binary }
    const next = new Map(fileContentCache.value)
    next.set(key, entry)
    fileContentCache.value = next
    return entry
  }

  /**
   * Vide le cache d'un cours donne (ou tout le cache si aucun id).
   * A appeler apres un refresh de snapshot pour que les etudiants voient
   * la nouvelle version.
   */
  function invalidateSnapshotCache(courseId?: number) {
    if (courseId == null) {
      snapshotTrees.value = new Map()
      fileContentCache.value = new Map()
      return
    }
    const trees = new Map(snapshotTrees.value)
    trees.delete(courseId)
    snapshotTrees.value = trees

    const files = new Map(fileContentCache.value)
    const prefix = `${courseId}:`
    for (const key of files.keys()) {
      if (key.startsWith(prefix)) files.delete(key)
    }
    fileContentCache.value = files
  }

  /**
   * Demande au backend de refetcher le repo git et de remplacer le snapshot.
   * Met a jour les metadonnees du cours courant et invalide le cache local.
   */
  async function refreshSnapshot(courseId: number): Promise<{ changed: boolean; commit_sha: string | null } | null> {
    const data = await api<{
      commit_sha: string | null
      default_branch: string
      file_count: number
      total_size: number
      fetched_at: string
      changed: boolean
    }>(() => window.api.refreshLumenSnapshot(courseId))
    if (!data) return null

    invalidateSnapshotCache(courseId)

    // Patch local des metadonnees sur le cours pour que l'UI re-render
    // sans avoir a refetch le cours entier.
    const patch = {
      repo_commit_sha: data.commit_sha,
      repo_default_branch: data.default_branch,
      repo_snapshot_at: data.fetched_at,
    }
    const idx = courses.value.findIndex(c => c.id === courseId)
    if (idx !== -1) {
      courses.value = [
        ...courses.value.slice(0, idx),
        { ...courses.value[idx], ...patch },
        ...courses.value.slice(idx + 1),
      ]
    }
    if (currentCourse.value?.id === courseId) {
      currentCourse.value = { ...currentCourse.value, ...patch }
    }
    return { changed: data.changed, commit_sha: data.commit_sha }
  }

  // ── Notes privees etudiant ───────────────────────────────────────────────

  interface LumenNote {
    student_id: number
    course_id: number
    content: string
    created_at: string
    updated_at: string
  }

  // Cache des notes par cours (pour eviter le refetch a l'ouverture repetee).
  const notesCache = ref<Map<number, LumenNote | null>>(new Map())
  // Set des course IDs ayant une note non vide pour l'etudiant courant.
  // Utilise pour afficher un badge "note" sur les course cards sans charger
  // le contenu des notes (qui reste prive).
  const notedCourseIds = ref<Set<number>>(new Set())

  async function fetchNotedCourseIds(): Promise<void> {
    const data = await api<{ course_ids: number[] }>(
      () => window.api.getLumenNotedCourses(),
      { silent: true },
    )
    notedCourseIds.value = new Set(data?.course_ids ?? [])
  }

  async function fetchCourseNote(courseId: number): Promise<LumenNote | null> {
    if (notesCache.value.has(courseId)) {
      return notesCache.value.get(courseId) ?? null
    }
    const data = await api<LumenNote | null>(
      () => window.api.getLumenCourseNote(courseId),
      { silent: true },
    )
    const next = new Map(notesCache.value)
    next.set(courseId, data ?? null)
    notesCache.value = next
    return data ?? null
  }

  async function saveCourseNote(courseId: number, content: string): Promise<LumenNote | null> {
    const data = await api<LumenNote>(
      () => window.api.saveLumenCourseNote(courseId, content),
      { silent: true },
    )
    if (data) {
      const next = new Map(notesCache.value)
      next.set(courseId, data)
      notesCache.value = next
      // Maintient le Set d'indicateur a jour : ajoute si contenu non vide,
      // retire sinon (l'etudiant a vide la note sans cliquer sur "supprimer").
      const nextIds = new Set(notedCourseIds.value)
      if (content.trim().length > 0) nextIds.add(courseId)
      else nextIds.delete(courseId)
      notedCourseIds.value = nextIds
    }
    return data ?? null
  }

  async function deleteCourseNote(courseId: number): Promise<boolean> {
    const data = await api<{ ok: true; courseId: number }>(
      () => window.api.deleteLumenCourseNote(courseId),
      { silent: true },
    )
    if (data?.ok) {
      const next = new Map(notesCache.value)
      next.set(courseId, null)
      notesCache.value = next
      const nextIds = new Set(notedCourseIds.value)
      nextIds.delete(courseId)
      notedCourseIds.value = nextIds
      return true
    }
    return false
  }

  return {
    courses, currentCourse, loading,
    unreadCourses, unreadCount, readCounts,
    trashedCourses,
    snapshotTrees, fileContentCache, notesCache, notedCourseIds,
    publishedCourses, draftCourses,
    fetchCoursesForPromo, fetchCourse,
    createCourse, updateCourse,
    publishCourse, unpublishCourse, deleteCourse,
    fetchTrash, restoreCourse, purgeCourse,
    clearCurrentCourse,
    fetchUnread, markAsRead, markAllAsRead, resetUnread, onCoursePublished,
    fetchReadCounts,
    fetchSnapshotTree, fetchFileContent, refreshSnapshot, invalidateSnapshotCache,
    fetchCourseNote, saveCourseNote, deleteCourseNote, fetchNotedCourseIds,
  }
})
