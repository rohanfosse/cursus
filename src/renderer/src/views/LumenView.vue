<script setup lang="ts">
/**
 * Vue principale Lumen — liseuse de cours adossee a GitHub.
 *
 * Layout 3 colonnes : sidebar (repos + chapitres) | viewer markdown | notes privees.
 * Gere les etats : non-connecte GitHub, pas d'org configuree (prof), pas de repos,
 * repo selectionne mais chapitre non choisi, chapitre en cours de chargement.
 *
 * Design : editorial/content-first. Typo serif pour les titres du markdown, sans-serif
 * pour le chrome, fond legerement chaud pour la reading surface.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  BookOpen, RefreshCw, Settings, AlertCircle, Loader2, FolderGit2, Plus,
  PanelLeftClose, PanelLeftOpen, LayoutGrid,
} from 'lucide-vue-next'
import LumenTopBarMenu from '@/components/lumen/LumenTopBarMenu.vue'
import { useLumenStore } from '@/stores/lumen'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useLumenFocus } from '@/composables/useLumenFocus'
import { useLumenLastChapter } from '@/composables/useLumenLastChapter'
import { relativeTime } from '@/utils/date'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import LumenGithubConnect from '@/components/lumen/LumenGithubConnect.vue'
import LumenChapterViewer from '@/components/lumen/LumenChapterViewer.vue'
import LumenKeyboardHelp from '@/components/lumen/LumenKeyboardHelp.vue'
import LumenNotePanel from '@/components/lumen/LumenNotePanel.vue'
import LumenWelcome from '@/components/lumen/LumenWelcome.vue'

const lumenStore = useLumenStore()
const appStore   = useAppStore()
const route      = useRoute()
const router     = useRouter()
const { showToast } = useToast()
const { confirm } = useConfirm()
const { lumenFocusMode, toggle: toggleLumenFocus } = useLumenFocus()
const lastChapter = useLumenLastChapter()

const {
  githubStatus, promoOrg, repos, currentRepo, currentChapterPath,
  loading, syncing, chapterContents, chapterNotes,
} = storeToRefs(lumenStore)

// ── Derived ────────────────────────────────────────────────────────────────
const activePromoId = computed<number | null>(() => appStore.activePromoId ?? null)
const isTeacher     = computed<boolean>(() => appStore.currentUser?.type === 'teacher' || appStore.currentUser?.type === 'admin')

const currentChapter = computed(() => {
  if (!currentRepo.value || !currentChapterPath.value) return null
  return currentRepo.value.manifest?.chapters.find((c) => c.path === currentChapterPath.value) ?? null
})

const currentChapterIndex = computed<number>(() => {
  if (!currentRepo.value || !currentChapterPath.value) return -1
  return currentRepo.value.manifest?.chapters.findIndex((c) => c.path === currentChapterPath.value) ?? -1
})

const prevChapter = computed(() => {
  const chapters = currentRepo.value?.manifest?.chapters
  const i = currentChapterIndex.value
  return chapters && i > 0 ? chapters[i - 1] : null
})

const nextChapter = computed(() => {
  const chapters = currentRepo.value?.manifest?.chapters
  const i = currentChapterIndex.value
  return chapters && i >= 0 && i < chapters.length - 1 ? chapters[i + 1] : null
})

const currentContent = computed<string | null>(() => {
  if (!currentRepo.value || !currentChapterPath.value) return null
  const key = `${currentRepo.value.id}::${currentChapterPath.value}`
  return chapterContents.value.get(key)?.content ?? null
})

const currentContentCached = computed<boolean>(() => {
  if (!currentRepo.value || !currentChapterPath.value) return false
  const key = `${currentRepo.value.id}::${currentChapterPath.value}`
  return chapterContents.value.get(key)?.cached ?? false
})

// SHA du blob courant — necessaire pour l'edition atomique (PUT /file).
// Fourni par le serveur lors du dernier fetch et stocke avec le contenu
// dans le store. Sans ce sha, on ne peut pas envoyer un update qui
// detecte les conflits.
const currentContentSha = computed<string | null>(() => {
  if (!currentRepo.value || !currentChapterPath.value) return null
  const key = `${currentRepo.value.id}::${currentChapterPath.value}`
  return chapterContents.value.get(key)?.sha ?? null
})

const notedChaptersSet = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const [key, note] of chapterNotes.value.entries()) {
    if (note && note.content?.trim()) set.add(key)
  }
  return set
})

/** Dernier chapitre lu pour la promo courante (pour LumenWelcome). */
const lastRead = computed(() => {
  if (!activePromoId.value) return null
  return lastChapter.get(activePromoId.value)
})

/** Timestamp du sync le plus recent parmi tous les repos de la promo. */
const lastSyncedAt = computed<string | null>(() => {
  let latest: string | null = null
  for (const r of repos.value) {
    if (r.lastSyncedAt && (!latest || r.lastSyncedAt > latest)) latest = r.lastSyncedAt
  }
  return latest
})

/** Duree depuis le dernier sync en ms (null si jamais synchronise). */
const staleMs = computed<number | null>(() => {
  if (!lastSyncedAt.value) return null
  return Date.now() - new Date(lastSyncedAt.value + 'Z').getTime()
})

const STALE_THRESHOLD_MS = 15 * 60 * 1000  // 15 minutes

const loadingChapter = ref(false)
let chapterFetchGen = 0  // C1: garde contre les fetches concurrents

// Modale d'aide sur les raccourcis clavier (v2.75). Ouverte via la touche ?
const keyboardHelpOpen = ref(false)

// Ancre cible quand on arrive via deep-link `?anchor=section-id` (par
// exemple depuis un devoir lie). Consume-once : remise a null des qu'elle
// est passee au viewer pour eviter de re-scroller a chaque resync ou
// switch de chapitre dans la meme session.
const pendingAnchor = ref<string | null>(null)

// ── Settings modal (teacher configure github org) ─────────────────────────
const settingsOpen = ref(false)
const orgDraft = ref('')

function openSettings() {
  orgDraft.value = promoOrg.value ?? ''
  settingsOpen.value = true
}
async function saveOrg() {
  if (!activePromoId.value) return
  const value = orgDraft.value.trim() || null
  await lumenStore.setPromoOrgAction(activePromoId.value, value)
  showToast(value ? 'Organisation enregistree' : 'Organisation retiree', 'success')
  settingsOpen.value = false
}

// ── New course modal (teacher cree un nouveau repo dans l'org) ────────────
const newCourseOpen = ref(false)
const newCourseSlug = ref('')
const newCourseTitle = ref('')
const newCourseSubmitting = ref(false)

const newCourseSlugError = computed(() => {
  const v = newCourseSlug.value.trim()
  if (!v) return ''
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(v)) {
    return 'Alphanumerique, ., _, - uniquement (ne commence pas par - ou .)'
  }
  if (v.length > 80) return 'Max 80 caracteres'
  return ''
})
const canCreateCourse = computed(() =>
  newCourseSlug.value.trim().length > 0
  && newCourseTitle.value.trim().length > 0
  && !newCourseSlugError.value
  && !newCourseSubmitting.value,
)

function openNewCourse() {
  if (!promoOrg.value) {
    showToast('Configure d\'abord une organisation GitHub', 'info')
    openSettings()
    return
  }
  newCourseSlug.value = ''
  newCourseTitle.value = ''
  newCourseOpen.value = true
}

async function submitNewCourse() {
  if (!canCreateCourse.value || !activePromoId.value) return
  newCourseSubmitting.value = true
  try {
    const repo = await lumenStore.createRepoFromScaffold(
      activePromoId.value,
      newCourseSlug.value.trim(),
      newCourseTitle.value.trim(),
    )
    if (!repo) {
      // L'erreur a deja ete affichee par useApi (toast)
      return
    }
    showToast(`Cours "${repo.repo}" cree dans ${promoOrg.value}`, 'success')
    newCourseOpen.value = false
    // Selectionne le nouveau repo dans la sidebar pour montrer le scaffold
    lumenStore.selectRepo(repo.id)
  } finally {
    newCourseSubmitting.value = false
  }
}

// ── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  const pid = activePromoId.value
  try {
    await Promise.all([
      lumenStore.fetchGithubStatus(),
      pid ? lumenStore.fetchReposForPromo(pid) : Promise.resolve(),
      lumenStore.fetchMyReads(),
    ])
  } catch {
    showToast('Impossible de charger les cours. Verifie ta connexion.', 'error')
  }
}

onMounted(async () => {
  await boot()
  applyUrlSelection()
  // Auto-resume : si aucune query param n'a selectionne un chapitre, on
  // restaure le dernier chapitre lu dans cette promo (v2.48). Zero clic
  // pour reprendre la lecture. Le deep-link URL reste prioritaire.
  if (!currentRepo.value || !currentChapterPath.value) {
    applyAutoResume()
  }
  // Auto-sync si le cache est stale (> 15 min) ET qu'on est connecte
  // a GitHub ET qu'une org est configuree. Reveille l'utilisateur avec
  // du contenu frais sans qu'il ait a cliquer "Sync".
  if (
    githubStatus.value.connected
    && promoOrg.value
    && staleMs.value !== null
    && staleMs.value > STALE_THRESHOLD_MS
  ) {
    handleSync()
  }
  window.addEventListener('keydown', handleKeydown)
})

watch(activePromoId, async () => {
  await boot()
  applyUrlSelection()
  if (!currentRepo.value || !currentChapterPath.value) {
    applyAutoResume()
  }
})

// La sidebar navigue via router.push({ query: { repo, chapter } }).
// Ce watcher detecte le changement d'URL et applique la selection.
// Guard : ne re-applique pas si on est deja sur le bon chapitre
// (evite la boucle handleSelectChapter → router.replace → watcher).
watch(() => route.query, (q) => {
  const qRepo = typeof q.repo === 'string' ? Number(q.repo) : null
  const qChapter = typeof q.chapter === 'string' ? q.chapter : null
  if (qRepo && qChapter && (qRepo !== currentRepo.value?.id || qChapter !== currentChapterPath.value)) {
    applyUrlSelection()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// ── Actions ────────────────────────────────────────────────────────────────
async function handleSync() {
  if (!activePromoId.value || syncing.value) return
  if (!githubStatus.value.connected) {
    showToast('Connecte ton compte GitHub d\'abord', 'info')
    return
  }
  if (!promoOrg.value) {
    showToast('Aucune organisation GitHub configuree pour cette promo', 'info')
    if (isTeacher.value) openSettings()
    return
  }
  const res = await lumenStore.syncReposForPromo(activePromoId.value)
  if (res.errors.length) {
    showToast(`Sync ok (${res.synced} repos) avec ${res.errors.length} erreurs de manifest`, 'info')
  } else {
    showToast(`${res.synced} repos synchronises`, 'success')
  }
  // Apres sync, re-applique l'URL selection au cas ou le repo/chapitre
  // cible vient juste d'etre charge (premier sync post cold-start avec
  // deep link en entree).
  applyUrlSelection()
}

async function handleDisconnect() {
  if (!(await confirm('Deconnecter ton compte GitHub des cours ?', 'danger', 'Deconnecter'))) return
  await lumenStore.disconnectGithub()
  lumenStore.reset()
  showToast('Compte GitHub deconnecte', 'info')
}

async function handleSelectChapter(payload: { repoId: number; path: string }) {
  const repo = repos.value.find((r) => r.id === payload.repoId)
  if (!repo) return
  // Si l'utilisateur navigue vers un chapitre qui ne correspond pas a la
  // query URL ?repo=...&chapter=... courante, on efface le pendingAnchor
  // (l'ancre etait liee a un autre chapitre, plus pertinente ici).
  const queryRepo = route.query.repo
  const queryChapter = route.query.chapter
  if (
    typeof queryRepo !== 'string' || Number(queryRepo) !== payload.repoId
    || typeof queryChapter !== 'string' || queryChapter !== payload.path
  ) {
    pendingAnchor.value = null
  }
  currentRepo.value = repo
  currentChapterPath.value = payload.path

  // Memorise pour l'auto-resume a la prochaine session (v2.48).
  if (activePromoId.value) {
    lastChapter.set(activePromoId.value, repo.id, payload.path)
  }

  // Reflete la selection dans l'URL pour permettre le deep-link et la
  // restauration a l'ouverture. `replace` plutot que `push` pour eviter
  // de polluer l'historique de navigation avec chaque chapitre lu.
  // L'ancre est preservee uniquement si elle vient encore d'etre
  // memorisee (deep-link en cours), sinon retiree pour eviter qu'un
  // resync re-scrolle a une section qui n'est plus pertinente.
  const nextQuery: Record<string, string> = {
    ...route.query as Record<string, string>,
    repo: String(repo.id),
    chapter: payload.path,
  }
  if (!pendingAnchor.value) delete nextQuery.anchor
  router.replace({ name: 'lumen', query: nextQuery })

  const key = `${repo.id}::${payload.path}`
  const gen = ++chapterFetchGen
  if (!chapterContents.value.has(key)) {
    loadingChapter.value = true
    try {
      await lumenStore.fetchChapterContent(repo.id, payload.path)
    } finally {
      if (gen === chapterFetchGen) loadingChapter.value = false
    }
    if (gen !== chapterFetchGen) return  // navigation a change entre-temps
  }
  lumenStore.fetchChapterNote(repo.id, payload.path)
  // Tracking de lecture (v2.85) — marque le chapitre comme lu pour la
  // progression sur la page d'accueil. Fire-and-forget, ne bloque pas.
  lumenStore.markChapterRead(repo.id, payload.path)
}

/**
 * Retour a la page d'accueil Lumen (grille des cours + progression).
 * Deselectionne le chapitre courant pour afficher LumenWelcome.
 */
function handleLumenHome() {
  currentRepo.value = null
  currentChapterPath.value = null
  router.replace({ name: 'lumen' })
}

/**
 * Applique la query URL (?repo=X&chapter=Y) si elle est presente et que
 * les donnees sont chargees. Appele apres chaque boot() et chaque sync
 * pour restaurer la selection au cold-start.
 */
function applyUrlSelection() {
  const repoIdStr = route.query.repo
  const chapterPath = route.query.chapter
  if (typeof repoIdStr !== 'string' || typeof chapterPath !== 'string') return
  const repoId = Number(repoIdStr)
  if (!repoId) return
  const repo = repos.value.find((r) => r.id === repoId)
  if (!repo) return
  const chapterExists = repo.manifest?.chapters.some((c) => c.path === chapterPath)
  if (!chapterExists) return
  // Si le deep-link contient `?anchor=section-id`, on memorise pour que
  // le viewer scrolle a la section correspondante apres extraction des
  // headings (deep-link depuis un devoir vers une section precise).
  const rawAnchor = route.query.anchor
  pendingAnchor.value = typeof rawAnchor === 'string' && rawAnchor ? rawAnchor : null
  handleSelectChapter({ repoId, path: chapterPath })
}

function handleAnchorConsumed() {
  if (pendingAnchor.value === null) return
  pendingAnchor.value = null
  const { anchor: _omit, ...rest } = route.query
  router.replace({ name: 'lumen', query: rest as Record<string, string> })
}

/**
 * Restaure le dernier chapitre lu de la promo courante si aucun deep-link
 * n'a pre-selectionne un chapitre. Appele apres boot() et applyUrlSelection().
 * Si le dernier chapitre a ete supprime (renommage manifest, prune), fallback
 * silencieux : l'utilisateur tombera sur l'etat vide habituel.
 */
function applyAutoResume() {
  if (!activePromoId.value) return
  const last = lastChapter.get(activePromoId.value)
  if (!last) return // pas d'historique : on reste sur LumenWelcome
  const repo = repos.value.find((r) => r.id === last.repoId)
  if (!repo) return
  const stillExists = repo.manifest?.chapters.some((c) => c.path === last.chapterPath)
  if (!stillExists) return
  handleSelectChapter({ repoId: last.repoId, path: last.chapterPath })
}

/**
 * Raccourcis clavier pour la lecture : ArrowLeft = prev, ArrowRight =
 * next. Desactives dans les inputs/textarea pour ne pas casser
 * l'edition de notes.
 */
function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  // Ignore si l'utilisateur tape dans un champ (y compris CodeMirror wrapper)
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (target && target instanceof HTMLElement && target.closest('.cm-editor')) return
  if (e.ctrlKey || e.metaKey || e.altKey) return

  // Navigation prev/next
  if (e.key === 'ArrowLeft' && prevChapter.value) {
    e.preventDefault()
    handleNavigatePrev()
    return
  }
  if (e.key === 'ArrowRight' && nextChapter.value) {
    e.preventDefault()
    handleNavigateNext()
    return
  }
  // v2.73 : "/" focus la barre de recherche de la sidebar (pattern GitHub).
  if (e.key === '/') {
    e.preventDefault()
    lumenStore.requestSearchFocus()
    return
  }
  // v2.75 : "?" (shift+/) ouvre la modale d'aide sur les raccourcis.
  if (e.key === '?') {
    e.preventDefault()
    keyboardHelpOpen.value = true
    return
  }
  // Esc ferme la modale d'aide si elle est ouverte
  if (e.key === 'Escape' && keyboardHelpOpen.value) {
    e.preventDefault()
    keyboardHelpOpen.value = false
    return
  }
}

function handleNavigatePrev() {
  if (!currentRepo.value || !prevChapter.value) return
  handleSelectChapter({ repoId: currentRepo.value.id, path: prevChapter.value.path })
}

function handleNavigateNext() {
  if (!currentRepo.value || !nextChapter.value) return
  handleSelectChapter({ repoId: currentRepo.value.id, path: nextChapter.value.path })
}

/**
 * Lien inter-chapitre clique dans le body markdown. Le path a ete
 * resolu cote utils/markdown — on verifie juste qu'il existe dans le
 * manifest du repo courant. Sinon on affiche un toast explicite plutot
 * que de faire echouer silencieusement.
 */
function handleNavigateChapter(path: string) {
  if (!currentRepo.value) return
  const target = currentRepo.value.manifest?.chapters.find((c) => c.path === path)
  if (!target) {
    showToast(`Chapitre introuvable dans le manifest : ${path}`, 'error')
    return
  }
  handleSelectChapter({ repoId: currentRepo.value.id, path })
}

/**
 * v2.72 : navigation cross-repo via un lien `lumen://repo/path` dans un
 * chapitre markdown. On cherche le repo cible dans la promo courante
 * par son nom court (repo.repo). Si trouve, on selectionne le chapitre
 * dedie dans ce repo (meme si c'est un autre repo que celui actuel).
 */
function handleNavigateLumenLink(payload: { repoName: string; path: string }) {
  const target = repos.value.find((r) => r.repo === payload.repoName)
  if (!target) {
    showToast(`Repo "${payload.repoName}" introuvable dans cette promo`, 'error')
    return
  }
  // Verifie que le chapitre existe dans le manifest du repo cible
  const chapterExists = target.manifest?.chapters.some((c) => c.path === payload.path)
  if (!chapterExists) {
    showToast(`Chapitre "${payload.path}" introuvable dans ${payload.repoName}`, 'error')
    return
  }
  handleSelectChapter({ repoId: target.id, path: payload.path })
}
</script>

<template>
  <div class="lumen-view">
    <UiPageHeader section="lumen" class="lumen-topbar">
      <template #title>
        <div class="lumen-brand">
          <button
            type="button"
            class="lumen-btn ghost lumen-btn-icon lumen-home-btn"
            title="Accueil de la promo"
            aria-label="Accueil de la promo"
            @click="handleLumenHome"
          >
            <LayoutGrid :size="14" />
          </button>
          <BookOpen :size="18" />
          <span class="lumen-brand-name" :title="promoOrg ? `Organisation : ${promoOrg}` : undefined">Cours</span>
        </div>
      </template>
      <template #actions>
        <button
          type="button"
          class="lumen-btn ghost lumen-btn-icon"
          :title="lumenFocusMode ? 'Afficher la barre laterale Cursus' : 'Masquer la barre laterale Cursus (focus)'"
          :aria-label="lumenFocusMode ? 'Afficher la barre laterale Cursus' : 'Masquer la barre laterale Cursus'"
          :aria-pressed="lumenFocusMode"
          @click="toggleLumenFocus"
        >
          <component :is="lumenFocusMode ? PanelLeftOpen : PanelLeftClose" :size="14" />
        </button>
        <button
          v-if="githubStatus.connected"
          type="button"
          class="lumen-btn"
          :class="{ primary: staleMs !== null && staleMs > STALE_THRESHOLD_MS }"
          :disabled="syncing || !promoOrg"
          :title="promoOrg ? 'Synchroniser les cours depuis GitHub' : 'Configure d\'abord une organisation'"
          @click="handleSync"
        >
          <component :is="syncing ? Loader2 : RefreshCw" :size="14" :class="{ spin: syncing }" />
          {{ syncing ? 'Sync...' : 'Synchroniser' }}
        </button>
        <LumenTopBarMenu
          :is-teacher="isTeacher"
          :github-connected="githubStatus.connected"
          :github-login="githubStatus.login ?? null"
          :last-synced-at="lastSyncedAt"
          :syncing="syncing"
          :promo-org="promoOrg"
          @open-new-course="openNewCourse"
          @open-settings="openSettings"
          @show-keyboard-help="keyboardHelpOpen = true"
          @disconnect="handleDisconnect"
        />
      </template>
    </UiPageHeader>

    <div class="lumen-body">
      <LumenGithubConnect v-if="!githubStatus.connected" />

      <template v-else>
        <main class="lumen-main">
          <div v-if="!promoOrg" class="lumen-empty-state">
            <AlertCircle :size="32" />
            <h3>Aucune organisation GitHub</h3>
            <p v-if="isTeacher">Configure l'organisation GitHub de cette promo pour commencer.</p>
            <p v-else>Ton enseignant doit configurer l'organisation GitHub de la promo.</p>
            <button v-if="isTeacher" type="button" class="lumen-btn primary" @click="openSettings">
              <Settings :size="14" />
              Configurer
            </button>
          </div>

          <div v-else-if="!repos.length && !loading" class="lumen-empty-state">
            <FolderGit2 :size="32" />
            <h3>Pret a synchroniser</h3>
            <p>L'organisation <strong>{{ promoOrg }}</strong> est configuree mais aucun cours n'a encore ete charge.</p>
            <button type="button" class="lumen-btn primary" :disabled="syncing" @click="handleSync">
              <component :is="syncing ? Loader2 : RefreshCw" :size="14" :class="{ spin: syncing }" />
              Synchroniser depuis GitHub
            </button>
          </div>

          <LumenWelcome
            v-else-if="!currentRepo || !currentChapter"
            :repos="repos"
            :last-chapter-repo-id="lastRead?.repoId"
            :last-chapter-path="lastRead?.chapterPath"
            @open-chapter="handleSelectChapter"
          />

          <LumenChapterViewer
            v-else
            :repo="currentRepo"
            :chapter="currentChapter"
            :content="currentContent"
            :content-sha="currentContentSha"
            :loading="loadingChapter"
            :prev-chapter="prevChapter"
            :next-chapter="nextChapter"
            :cached="currentContentCached"
            :initial-anchor="pendingAnchor"
            @navigate-prev="handleNavigatePrev"
            @navigate-next="handleNavigateNext"
            @navigate-chapter="handleNavigateChapter"
            @navigate-lumen-link="handleNavigateLumenLink"
            @resync="handleSync"
            @anchor-consumed="handleAnchorConsumed"
          />
        </main>

        <LumenNotePanel
          v-if="currentRepo && currentChapterPath && !isTeacher"
          :key="`${currentRepo.id}::${currentChapterPath}`"
          :repo-id="currentRepo.id"
          :path="currentChapterPath"
        />
      </template>
    </div>

    <!-- Modale d'aide raccourcis clavier (v2.75) -->
    <LumenKeyboardHelp
      :open="keyboardHelpOpen"
      @close="keyboardHelpOpen = false"
    />

    <div v-if="newCourseOpen" class="lumen-modal-backdrop" @click.self="newCourseOpen = false">
      <div class="lumen-modal" role="dialog" aria-labelledby="lumen-newcourse-title">
        <h3 id="lumen-newcourse-title">Nouveau cours</h3>
        <p class="lumen-modal-desc">
          Cree un repo prive dans <strong>{{ promoOrg }}</strong> avec un scaffold initial
          (README, projet, daily, exemple de prosit, dossiers vides). Tu pourras editer
          le contenu directement sur GitHub ou en local.
        </p>
        <label class="lumen-modal-field">
          <span>Slug du repo</span>
          <input
            v-model="newCourseSlug"
            type="text"
            placeholder="ex: 5-Base-de-Donnees"
            autofocus
            spellcheck="false"
            @keydown.enter="submitNewCourse"
          />
          <small v-if="newCourseSlugError" class="lumen-modal-error">{{ newCourseSlugError }}</small>
        </label>
        <label class="lumen-modal-field">
          <span>Titre du bloc</span>
          <input
            v-model="newCourseTitle"
            type="text"
            placeholder="ex: Bloc 5 - Bases de donnees"
            @keydown.enter="submitNewCourse"
          />
        </label>
        <p class="lumen-modal-hint">
          Le repo sera <strong>masque aux etudiants</strong> jusqu'a ce que tu le publies
          via l'icone oeil dans la sidebar.
        </p>
        <div class="lumen-modal-actions">
          <button type="button" class="lumen-btn ghost" :disabled="newCourseSubmitting" @click="newCourseOpen = false">Annuler</button>
          <button
            type="button"
            class="lumen-btn primary"
            :disabled="!canCreateCourse"
            @click="submitNewCourse"
          >
            <Loader2 v-if="newCourseSubmitting" :size="14" class="spin" />
            <Plus v-else :size="14" />
            {{ newCourseSubmitting ? 'Creation...' : 'Creer le cours' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="settingsOpen" class="lumen-modal-backdrop" @click.self="settingsOpen = false">
      <div class="lumen-modal" role="dialog" aria-labelledby="lumen-modal-title">
        <h3 id="lumen-modal-title">Organisation GitHub de la promo</h3>
        <p class="lumen-modal-desc">
          Nom exact de l'organisation GitHub qui contient les repos de cours.
          Un repo = un projet pedagogique.
        </p>
        <label class="lumen-modal-field">
          <span>Organisation</span>
          <input
            v-model="orgDraft"
            type="text"
            placeholder="ex: cesi-2026-promoA"
            autofocus
            @keydown.enter="saveOrg"
          />
        </label>
        <div class="lumen-modal-actions">
          <button type="button" class="lumen-btn ghost" @click="settingsOpen = false">Annuler</button>
          <button type="button" class="lumen-btn primary" @click="saveOrg">Enregistrer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lumen-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.lumen-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* .lumen-topbar : conserve la classe pour des selecteurs internes (.lumen-topbar
   .lumen-brand) mais le baseline visuel vient maintenant de UiPageHeader. */

.lumen-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}
.lumen-brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.lumen-topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}


.lumen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  /* v2.273.5 : --bg-elevated (blanc en light) au lieu de --bg-primary
     (#E5E7EB gris trop fonce). */
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--t-fast) ease;
  min-height: 32px;
  font-family: inherit;
}
.lumen-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}
.lumen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.lumen-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.lumen-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
.lumen-btn.primary:hover:not(:disabled) { opacity: 0.9; }
.lumen-btn.ghost {
  background: transparent;
  border-color: transparent;
}
.lumen-btn.ghost:hover:not(:disabled) { background: var(--bg-hover); }
.lumen-btn.tiny {
  padding: 4px 9px;
  font-size: 11px;
  min-height: 26px;
}
.lumen-btn-icon {
  padding: 7px 8px;
  width: 32px;
  justify-content: center;
}
.lumen-btn-icon[aria-pressed="true"] {
  background: var(--bg-hover);
  color: var(--accent);
}
.lumen-home-btn {
  margin-right: 4px;
  color: var(--text-muted);
}
.lumen-home-btn:hover { color: var(--text-primary); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.lumen-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.lumen-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 32px;
  color: var(--text-muted);
  gap: 12px;
}
.lumen-empty-state h3 {
  margin: 8px 0 0;
  font-size: 20px;
  color: var(--text-primary);
  font-weight: 700;
}
.lumen-empty-state p {
  margin: 0;
  max-width: 420px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}
.lumen-empty-state strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 1px 5px;
  background: var(--bg-secondary);
  border-radius: 3px;
}

.lumen-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-bg, 1000);
  animation: fade-in var(--motion-fast) var(--ease-out);
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

/* Fix v2.68.1 : --bg-secondary n'existe pas dans les tokens Cursus, le
   background etait donc transparent et laissait voir le viewer derriere.
   On utilise --bg-modal + border + shadow tokenises pour aligner sur les
   autres modales de l'app. */
.lumen-modal {
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  width: min(440px, calc(100% - 32px));
  box-shadow: var(--elevation-4);
  animation: slide-up var(--motion-base) var(--ease-out);
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.lumen-modal h3 {
  margin: 0 0 8px;
  font-size: 17px;
  color: var(--text-primary);
}
.lumen-modal-desc {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.lumen-modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}
.lumen-modal-field span {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.lumen-modal-field input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
}
.lumen-modal-field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.lumen-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.lumen-modal-error {
  font-size: 11px;
  color: var(--danger, #ef4444);
  margin-top: 2px;
}
.lumen-modal-hint {
  margin: -8px 0 16px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>

<!-- Styles globaux : rendu du markdown en mode editorial. Non-scoped car le HTML est genere par marked + DOMPurify. -->
<style>
.lumen-viewer .markdown-body {
  font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
  font-size: 17px;
  line-height: 1.72;
  color: var(--text-primary);
  font-feature-settings: 'liga', 'kern';
}

.lumen-viewer .markdown-body h1,
.lumen-viewer .markdown-body h2,
.lumen-viewer .markdown-body h3,
.lumen-viewer .markdown-body h4,
.lumen-viewer .markdown-body h5,
.lumen-viewer .markdown-body h6 {
  font-family: 'Newsreader', Georgia, serif;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: var(--text-primary);
  margin: 1.8em 0 0.6em;
  scroll-margin-top: 80px;
}
.lumen-viewer .markdown-body h1 {
  font-size: 2.2em;
  margin-top: 0.2em;
  border-bottom: 2px solid var(--border);
  padding-bottom: 0.3em;
}
.lumen-viewer .markdown-body h2 {
  font-size: 1.7em;
  margin-top: 2em;
}
.lumen-viewer .markdown-body h3 { font-size: 1.35em; }
.lumen-viewer .markdown-body h4 { font-size: 1.15em; }
.lumen-viewer .markdown-body h5 { font-size: 1em; text-transform: uppercase; letter-spacing: 0.05em; }
.lumen-viewer .markdown-body h6 { font-size: 0.9em; color: var(--text-secondary); }

.lumen-viewer .markdown-body p { margin: 0 0 1em; }
.lumen-viewer .markdown-body strong { font-weight: 700; color: var(--text-primary); }
.lumen-viewer .markdown-body em { font-style: italic; }

.lumen-viewer .markdown-body a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  transition: all var(--t-fast) ease;
}
.lumen-viewer .markdown-body a:hover {
  text-decoration-thickness: 2px;
}

.lumen-viewer .markdown-body ul,
.lumen-viewer .markdown-body ol {
  margin: 0 0 1em;
  padding-left: 1.6em;
}
.lumen-viewer .markdown-body li { margin: 0.3em 0; }
.lumen-viewer .markdown-body li > p { margin: 0.2em 0; }

.lumen-viewer .markdown-body code {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: var(--bg-secondary);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.lumen-viewer .markdown-body pre.lumen-code {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px 18px;
  overflow-x: auto;
  margin: 1.4em 0;
  line-height: 1.55;
}
.lumen-viewer .markdown-body pre.lumen-code code {
  background: none;
  border: none;
  padding: 0;
  font-size: 13.5px;
  color: var(--text-primary);
}

.lumen-viewer .markdown-body blockquote {
  margin: 1.4em 0;
  padding: 0.2em 0 0.2em 1.2em;
  border-left: 3px solid var(--accent);
  color: var(--text-secondary);
  font-style: italic;
}
.lumen-viewer .markdown-body blockquote p { margin: 0.5em 0; }

.lumen-viewer .markdown-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.4em 0;
  font-size: 14px;
  font-family: var(--font-ui, -apple-system, system-ui, sans-serif);
}
.lumen-viewer .markdown-body th,
.lumen-viewer .markdown-body td {
  padding: 10px 14px;
  border: 1px solid var(--border);
  text-align: left;
}
.lumen-viewer .markdown-body th {
  background: var(--bg-secondary);
  font-weight: 700;
}

.lumen-viewer .markdown-body hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2.4em 0;
}

.lumen-viewer .markdown-body .lumen-admonition {
  margin: 1.4em 0;
  padding: 14px 18px;
  border-left: 4px solid var(--accent);
  background: var(--bg-secondary);
  border-radius: 0 6px 6px 0;
}

.lumen-viewer .markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  display: block;
  margin: 1.4em auto;
}
</style>
