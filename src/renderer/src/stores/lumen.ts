/**
 * Store Lumen — liseuse de cours adossee a GitHub.
 *
 * Modele : 1 promo = 1 organisation GitHub, 1 projet = 1 repo, le
 * manifest est genere automatiquement depuis l'arbre du repo. Le store cache
 * les repos, les manifests parses, les contenus de chapitres et les
 * metadonnees utilisateur (notes, lectures, connexion GitHub).
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import { chapterKey } from '@/utils/lumenDevoirLinks'
import { parseChapterContent } from '@/utils/lumenFrontmatter'
import type {
  LumenRepo,
  LumenChapter,
  LumenChapterContent,
  LumenChapterNote,
  LumenGithubStatus,
  LumenSearchResult,
  LumenRead,
} from '@/types'

export const useLumenStore = defineStore('lumen', () => {
  const { api } = useApi()

  // ── Etat ──────────────────────────────────────────────────────────────────
  const githubStatus = ref<LumenGithubStatus>({ connected: false })
  const promoOrg     = ref<string | null>(null)
  const repos        = ref<LumenRepo[]>([])
  const currentRepo  = ref<LumenRepo | null>(null)
  const currentChapterPath = ref<string | null>(null)

  const loading  = ref(false)
  const syncing  = ref(false)

  /** Signal reactif : incrementer pour demander au sidebar de focus sa recherche. */
  const searchFocusTick = ref(0)
  function requestSearchFocus() { searchFocusTick.value++ }

  /** Cache des contenus de chapitres : clef = `${repoId}::${path}`. */
  const chapterContents = ref<Map<string, LumenChapterContent>>(new Map())

  /**
   * Set des chapitres detectes comme presentations Marp (frontmatter `marp: true`).
   * Alimente lors du fetchChapterContent. Permet a la sidebar d'afficher un
   * badge "Slides" sans avoir a re-parser la frontmatter cote rendu.
   */
  const marpChapters = ref<Set<string>>(new Set())

  /** Cache des notes privees : clef = `${repoId}::${path}`. */
  const chapterNotes = ref<Map<string, LumenChapterNote | null>>(new Map())

  /** Chapitres lus par l'etudiant courant. Set de cles `${repoId}::${path}`. */
  const myReads = ref<Set<string>>(new Set())
  /** Map repoId::path -> read_at pour trier par date. */
  const myReadsAt = ref<Map<string, string>>(new Map())

  /**
   * Compteurs de lecture par prof (legacy v2.46) : Map `${repoId}::${path}` -> nb lecteurs.
   * @deprecated v2.48 — l'accuse de lecture cote etudiant est supprime, ce compteur
   * ne s'incremente plus. Le ref reste declare pour ne pas casser les imports
   * historiques mais le contenu sera toujours vide jusqu'a une eventuelle
   * suppression complete dans une migration future.
   */
  const readCounts = ref<Map<string, number>>(new Map())

  // ── Computed ─────────────────────────────────────────────────────────────
  const reposWithManifest = computed(() => repos.value.filter((r) => r.manifest != null))
  const reposWithError    = computed(() => repos.value.filter((r) => r.manifestError != null))

  const currentChapter = computed<LumenChapter | null>(() => {
    const repo = currentRepo.value
    const path = currentChapterPath.value
    if (!repo || !path) return null
    return repo.manifest?.chapters.find((c) => c.path === path) ?? null
  })

  const currentChapterContent = computed<LumenChapterContent | null>(() => {
    const repo = currentRepo.value
    const path = currentChapterPath.value
    if (!repo || !path) return null
    return chapterContents.value.get(chapterKey(repo.id, path)) ?? null
  })

  // ── Actions : auth GitHub ─────────────────────────────────────────────────

  async function fetchGithubStatus(): Promise<void> {
    const data = await api<LumenGithubStatus>(
      () => window.api.getLumenGithubStatus(),
      { silent: true },
    )
    if (data) githubStatus.value = data
  }

  async function connectGithub(token: string): Promise<{ ok: boolean; error?: string }> {
    const data = await api<{ login: string; name: string; avatarUrl: string }>(
      () => window.api.connectLumenGithub(token),
    )
    if (data?.login) {
      githubStatus.value = { connected: true, login: data.login }
      return { ok: true }
    }
    return { ok: false, error: 'Echec de la connexion GitHub' }
  }

  async function disconnectGithub(): Promise<void> {
    await api(() => window.api.disconnectLumenGithub())
    githubStatus.value = { connected: false }
  }

  // ── Actions : promo ↔ org ─────────────────────────────────────────────────

  async function fetchPromoOrg(promoId: number): Promise<void> {
    const data = await api<{ org: string | null }>(
      () => window.api.getLumenPromoOrg(promoId),
      { silent: true },
    )
    promoOrg.value = data?.org ?? null
  }

  async function setPromoOrgAction(promoId: number, org: string | null): Promise<void> {
    const data = await api<{ org: string | null }>(
      () => window.api.setLumenPromoOrg(promoId, org),
    )
    if (data) promoOrg.value = data.org
  }

  // ── Actions : repos & sync ────────────────────────────────────────────────

  async function fetchReposForPromo(promoId: number): Promise<void> {
    loading.value = true
    try {
      // Pas de silent: on veut que l'utilisateur voie l'erreur si la liste
      // de cours echoue (sinon UI stale silencieuse — antipattern useApi).
      const data = await api<{ repos: LumenRepo[]; org: string | null }>(
        () => window.api.getLumenReposForPromo(promoId),
      )
      repos.value = data?.repos ?? []
      promoOrg.value = data?.org ?? null
    } finally {
      loading.value = false
    }
  }

  /**
   * Cree un nouveau repo dans l'org GitHub de la promo + scaffold initial.
   * Le sync auto cote serveur ramene le repo dans la liste — on ecrase
   * `repos.value` avec la nouvelle liste a la reception.
   * Renvoie le LumenRepo nouvellement cree (ou null en cas d'echec).
   */
  async function createRepoFromScaffold(
    promoId: number,
    slug: string,
    blocTitle: string,
  ): Promise<LumenRepo | null> {
    syncing.value = true
    try {
      const data = await api<{
        created: { owner: string; repo: string; defaultBranch: string }
        repos: LumenRepo[]
      }>(() => window.api.createLumenRepoFromScaffold(promoId, slug, blocTitle))
      if (!data) return null
      repos.value = data.repos
      const fullName = `${data.created.owner}/${data.created.repo}`
      return repos.value.find((r) => r.fullName === fullName) ?? null
    } finally {
      syncing.value = false
    }
  }

  async function syncReposForPromo(promoId: number): Promise<{ synced: number; errors: Array<{ repo: string; error: string }> }> {
    syncing.value = true
    try {
      const data = await api<{ synced: number; errors: Array<{ repo: string; error: string }>; repos: LumenRepo[] }>(
        () => window.api.syncLumenReposForPromo(promoId),
      )
      if (data?.repos) repos.value = data.repos
      return { synced: data?.synced ?? 0, errors: data?.errors ?? [] }
    } finally {
      syncing.value = false
    }
  }

  /**
   * Recupere les repos lies a un projet Cursus identifie par son nom.
   * Resolu cote serveur avec la meme normalisation que le sync manifest
   * (case + trim + Unicode NFD).
   */
  async function fetchReposByProjectName(promoId: number, projectName: string): Promise<LumenRepo[]> {
    const data = await api<{ repos: LumenRepo[] }>(
      () => window.api.getLumenReposByProjectName(promoId, projectName),
    )
    return data?.repos ?? []
  }

  /** Liste les repos d'une promo non encore lies a un projet (picker UI teacher). */
  async function fetchUnlinkedReposForPromo(promoId: number): Promise<LumenRepo[]> {
    const data = await api<{ repos: LumenRepo[] }>(
      () => window.api.getLumenUnlinkedReposForPromo(promoId),
    )
    return data?.repos ?? []
  }

  /**
   * Associe un repo a un projet (UI fallback teacher). Refuse cote serveur
   * si le manifest declare deja un cursusProject.
   */
  async function linkRepoToProject(repoId: number, projectId: number | null): Promise<LumenRepo | null> {
    const data = await api<LumenRepo>(
      () => window.api.setLumenRepoProject(repoId, projectId),
    )
    if (data) {
      // Met a jour l'entree dans repos.value si presente
      const idx = repos.value.findIndex((r) => r.id === repoId)
      if (idx !== -1) {
        const next = [...repos.value]
        next[idx] = data
        repos.value = next
      }
    }
    return data ?? null
  }

  /**
   * Teacher/admin bascule la visibilite etudiante d'un repo. Optimistic update
   * immediat puis rollback si l'API echoue. useApi() avale les erreurs et
   * retourne null en cas d'echec — on ne peut pas se reposer sur try/catch,
   * on detecte le null pour decider du rollback (et lever explicitement pour
   * que le caller puisse afficher un toast d'erreur).
   */
  async function setRepoVisibility(repoId: number, visible: boolean): Promise<void> {
    const idx = repos.value.findIndex((r) => r.id === repoId)
    if (idx === -1) return
    const previous = repos.value[idx]
    const next = [...repos.value]
    next[idx] = { ...previous, isVisible: visible }
    repos.value = next

    const data = await api<LumenRepo>(
      () => window.api.setLumenRepoVisibility(repoId, visible),
    )

    const j = repos.value.findIndex((r) => r.id === repoId)
    if (j === -1) return

    if (data) {
      const updated = [...repos.value]
      updated[j] = data
      repos.value = updated
      return
    }

    // Echec serveur (api a renvoye null) : rollback puis throw pour que
    // le caller puisse signaler l'erreur a l'utilisateur.
    const reverted = [...repos.value]
    reverted[j] = previous
    repos.value = reverted
    throw new Error('Visibility toggle failed')
  }

  function selectRepo(repoId: number | null): void {
    if (repoId == null) {
      currentRepo.value = null
      currentChapterPath.value = null
      return
    }
    const repo = repos.value.find((r) => r.id === repoId) ?? null
    if (!repo?.manifest?.chapters.length) {
      currentRepo.value = null
      currentChapterPath.value = null
      return
    }
    currentRepo.value = repo
    currentChapterPath.value = repo.manifest.chapters[0].path
  }

  // ── Actions : chapitres ───────────────────────────────────────────────────

  async function fetchChapterContent(repoId: number, path: string): Promise<LumenChapterContent | null> {
    loading.value = true
    try {
      const data = await api<LumenChapterContent>(
        () => window.api.getLumenChapterContent(repoId, path),
      )
      if (data) {
        const key = chapterKey(repoId, path)
        chapterContents.value.set(key, data)
        chapterContents.value = new Map(chapterContents.value)
        // Detection Marp paresseuse : on parse la frontmatter une seule fois
        // au moment du fetch. La sidebar peut ensuite afficher un badge.
        if (parseChapterContent(data.content).isMarp) {
          marpChapters.value.add(key)
          marpChapters.value = new Set(marpChapters.value)
        }
        return data
      }
      return null
    } finally {
      loading.value = false
    }
  }

  function isChapterMarp(repoId: number, path: string): boolean {
    return marpChapters.value.has(chapterKey(repoId, path))
  }

  function selectChapter(path: string): void {
    currentChapterPath.value = path
  }

  // ── Actions : recherche fulltext (v2.49 / FTS5) ───────────────────────────

  /**
   * Recherche fulltext dans les chapitres de la promo. Debounce a gerer
   * cote composant (pas ici — le store est un singleton, on ne veut pas
   * que deux vues concurrentes se marchent dessus).
   * @returns liste vide si q trop court ou erreur — le composant affiche
   * un etat "aucun resultat" dans les deux cas, c'est ok.
   */
  async function searchChapters(promoId: number, q: string, limit?: number): Promise<LumenSearchResult[]> {
    if (!q || q.trim().length < 2) return []
    const data = await api<{ results: LumenSearchResult[] }>(
      () => window.api.searchLumenChapters(promoId, q.trim(), limit),
      { silent: true },
    )
    return data?.results ?? []
  }

  // ── Actions : tracking lecture ────────────────────────────────────────────
  //
  // L'accuse de lecture est supprime cote etudiant en v2.48 — pas de
  // markChapterRead, pas de fetchMyReads. Les compteurs cote teacher restent
  // techniquement disponibles via les endpoints suivants mais ne s'incrementent
  // plus. Conserves pour compatibilite descendante avec l'admin.

  async function fetchReadCountsForRepo(repoId: number): Promise<void> {
    const data = await api<{ counts: Array<{ path: string; readers: number }> }>(
      () => window.api.getLumenReadCountsForRepo(repoId),
      { silent: true },
    )
    const map = new Map(readCounts.value)
    for (const c of data?.counts ?? []) map.set(chapterKey(repoId, c.path), c.readers)
    readCounts.value = map
  }

  async function fetchReadCountsForPromo(promoId: number): Promise<void> {
    const data = await api<{ counts: Array<{ repo_id: number; path: string; readers: number }> }>(
      () => window.api.getLumenReadCountsForPromo(promoId),
      { silent: true },
    )
    const map = new Map<string, number>()
    for (const c of data?.counts ?? []) map.set(chapterKey(c.repo_id, c.path), c.readers)
    readCounts.value = map
  }

  // ── Actions : tracking lecture etudiant (reactive v2.85) ──────────────────

  async function fetchMyReads(): Promise<void> {
    const data = await api<{ reads: LumenRead[] }>(
      () => window.api.getLumenMyReads(),
      { silent: true },
    )
    const set = new Set<string>()
    const map = new Map<string, string>()
    for (const r of data?.reads ?? []) {
      const k = chapterKey(r.repo_id, r.path)
      set.add(k)
      map.set(k, r.read_at)
    }
    myReads.value = set
    myReadsAt.value = map
  }

  async function markChapterRead(repoId: number, path: string): Promise<void> {
    const k = chapterKey(repoId, path)
    if (myReads.value.has(k)) return // deja marque
    myReads.value.add(k)
    myReads.value = new Set(myReads.value)
    myReadsAt.value.set(k, new Date().toISOString())
    myReadsAt.value = new Map(myReadsAt.value)
    await api<{ ok: true }>(
      () => window.api.markLumenChapterRead(repoId, path),
      { silent: true },
    )
  }

  // ── Actions : notes privees ───────────────────────────────────────────────

  async function fetchChapterNote(repoId: number, path: string): Promise<LumenChapterNote | null> {
    const data = await api<{ note: LumenChapterNote | null }>(
      () => window.api.getLumenChapterNote(repoId, path),
      { silent: true },
    )
    const note = data?.note ?? null
    chapterNotes.value.set(chapterKey(repoId, path), note)
    chapterNotes.value = new Map(chapterNotes.value)
    return note
  }

  async function saveChapterNote(repoId: number, path: string, content: string): Promise<void> {
    const data = await api<{ note: LumenChapterNote }>(
      () => window.api.saveLumenChapterNote(repoId, path, content),
      { silent: true },
    )
    if (data?.note) {
      chapterNotes.value.set(chapterKey(repoId, path), data.note)
      chapterNotes.value = new Map(chapterNotes.value)
    }
  }

  async function deleteChapterNoteAction(repoId: number, path: string): Promise<void> {
    await api(() => window.api.deleteLumenChapterNote(repoId, path), { silent: true })
    chapterNotes.value.set(chapterKey(repoId, path), null)
    chapterNotes.value = new Map(chapterNotes.value)
  }

  // ── Reset (logout / switch promo) ─────────────────────────────────────────

  function reset(): void {
    repos.value = []
    currentRepo.value = null
    currentChapterPath.value = null
    chapterContents.value = new Map()
    chapterNotes.value = new Map()
    readCounts.value = new Map()
    myReads.value = new Set()
    myReadsAt.value = new Map()
    marpChapters.value = new Set()
    promoOrg.value = null
  }

  return {
    // state
    githubStatus,
    promoOrg,
    repos,
    currentRepo,
    currentChapterPath,
    loading,
    syncing,
    chapterContents,
    chapterNotes,
    readCounts,
    myReads,
    myReadsAt,
    marpChapters,
    // computed
    reposWithManifest,
    reposWithError,
    currentChapter,
    currentChapterContent,
    // actions
    fetchGithubStatus,
    connectGithub,
    disconnectGithub,
    fetchPromoOrg,
    setPromoOrgAction,
    fetchReposForPromo,
    syncReposForPromo,
    fetchReposByProjectName,
    fetchUnlinkedReposForPromo,
    linkRepoToProject,
    setRepoVisibility,
    createRepoFromScaffold,
    selectRepo,
    fetchChapterContent,
    isChapterMarp,
    selectChapter,
    searchChapters,
    fetchMyReads,
    markChapterRead,
    fetchReadCountsForRepo,
    fetchReadCountsForPromo,
    fetchChapterNote,
    saveChapterNote,
    deleteChapterNoteAction,
    searchFocusTick,
    requestSearchFocus,
    reset,
  }
})
