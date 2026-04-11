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
  BookOpen, RefreshCw, Github, LogOut, Settings, AlertCircle, Loader2, FolderGit2,
} from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { relativeTime } from '@/utils/date'
import LumenGithubConnect from '@/components/lumen/LumenGithubConnect.vue'
import LumenRepoSidebar from '@/components/lumen/LumenRepoSidebar.vue'
import LumenChapterViewer from '@/components/lumen/LumenChapterViewer.vue'
import LumenNotePanel from '@/components/lumen/LumenNotePanel.vue'

const lumenStore = useLumenStore()
const appStore   = useAppStore()
const route      = useRoute()
const router     = useRouter()
const { showToast } = useToast()
const { confirm } = useConfirm()

const {
  githubStatus, promoOrg, repos, currentRepo, currentChapterPath,
  loading, syncing, chapterContents, chapterNotes, readChapters,
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

const isCurrentRead = computed<boolean>(() => {
  if (!currentRepo.value || !currentChapterPath.value) return false
  return readChapters.value.has(`${currentRepo.value.id}::${currentChapterPath.value}`)
})

const notedChaptersSet = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const [key, note] of chapterNotes.value.entries()) {
    if (note && note.content?.trim()) set.add(key)
  }
  return set
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

// ── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  const pid = activePromoId.value
  await Promise.all([
    lumenStore.fetchGithubStatus(),
    pid ? lumenStore.fetchReposForPromo(pid) : Promise.resolve(),
    pid ? lumenStore.fetchMyReads() : Promise.resolve(),
  ])
}

onMounted(async () => {
  await boot()
  applyUrlSelection()
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
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// ── Actions ────────────────────────────────────────────────────────────────
async function handleSync() {
  if (!activePromoId.value) return
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
  if (!(await confirm('Deconnecter ton compte GitHub de Lumen ?', 'danger', 'Deconnecter'))) return
  await lumenStore.disconnectGithub()
  lumenStore.reset()
  showToast('Compte GitHub deconnecte', 'info')
}

async function handleSelectChapter(payload: { repoId: number; path: string }) {
  const repo = repos.value.find((r) => r.id === payload.repoId)
  if (!repo) return
  currentRepo.value = repo
  currentChapterPath.value = payload.path

  // Reflete la selection dans l'URL pour permettre le deep-link et la
  // restauration a l'ouverture. `replace` plutot que `push` pour eviter
  // de polluer l'historique de navigation avec chaque chapitre lu.
  router.replace({
    name: 'lumen',
    query: { ...route.query, repo: String(repo.id), chapter: payload.path },
  })

  const key = `${repo.id}::${payload.path}`
  if (!chapterContents.value.has(key)) {
    loadingChapter.value = true
    try {
      await lumenStore.fetchChapterContent(repo.id, payload.path)
    } finally {
      loadingChapter.value = false
    }
  }
  lumenStore.fetchChapterNote(repo.id, payload.path)
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
  handleSelectChapter({ repoId, path: chapterPath })
}

/**
 * Raccourcis clavier pour la lecture : ArrowLeft = prev, ArrowRight =
 * next. Desactives dans les inputs/textarea pour ne pas casser
 * l'edition de notes.
 */
function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'ArrowLeft' && prevChapter.value) {
    e.preventDefault()
    handleNavigatePrev()
  } else if (e.key === 'ArrowRight' && nextChapter.value) {
    e.preventDefault()
    handleNavigateNext()
  }
}

async function handleAutoRead() {
  if (!currentRepo.value || !currentChapterPath.value) return
  await lumenStore.markChapterRead(currentRepo.value.id, currentChapterPath.value)
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
    showToast(`Chapitre introuvable dans cursus.yaml : ${path}`, 'error')
    return
  }
  handleSelectChapter({ repoId: currentRepo.value.id, path })
}
</script>

<template>
  <div class="lumen-view">
    <header class="lumen-topbar">
      <div class="lumen-brand">
        <BookOpen :size="18" />
        <span class="lumen-brand-name">Lumen</span>
        <span v-if="promoOrg" class="lumen-brand-org">
          <FolderGit2 :size="12" />
          {{ promoOrg }}
        </span>
      </div>
      <div class="lumen-topbar-actions">
        <span
          v-if="githubStatus.connected && lastSyncedAt"
          class="lumen-last-sync"
          :title="`Derniere synchronisation : ${new Date(lastSyncedAt + 'Z').toLocaleString()}`"
        >
          Maj {{ relativeTime(lastSyncedAt + 'Z') }}
        </span>
        <button
          v-if="githubStatus.connected"
          type="button"
          class="lumen-btn"
          :disabled="syncing || !promoOrg"
          :title="promoOrg ? 'Synchroniser les cours depuis GitHub' : 'Configure d\'abord une organisation'"
          @click="handleSync"
        >
          <component :is="syncing ? Loader2 : RefreshCw" :size="14" :class="{ spin: syncing }" />
          {{ syncing ? 'Sync...' : 'Synchroniser' }}
        </button>
        <button
          v-if="isTeacher"
          type="button"
          class="lumen-btn ghost"
          title="Configurer l'organisation GitHub de la promo"
          @click="openSettings"
        >
          <Settings :size="14" />
        </button>
        <div v-if="githubStatus.connected" class="lumen-user">
          <Github :size="13" />
          <span class="lumen-user-login">{{ githubStatus.login }}</span>
          <button type="button" class="lumen-user-logout" title="Se deconnecter de GitHub" @click="handleDisconnect">
            <LogOut :size="12" />
          </button>
        </div>
      </div>
    </header>

    <div class="lumen-body">
      <LumenGithubConnect v-if="!githubStatus.connected" />

      <template v-else>
        <aside class="lumen-sidebar">
          <header class="lumen-sidebar-head">
            <span class="lumen-sidebar-label">Cours</span>
            <span v-if="repos.length" class="lumen-sidebar-count">{{ repos.length }}</span>
          </header>

          <LumenRepoSidebar
            :repos="repos"
            :current-repo-id="currentRepo?.id ?? null"
            :current-chapter-path="currentChapterPath"
            :read-chapters="readChapters"
            :noted-chapters="notedChaptersSet"
            @select="handleSelectChapter"
          />

          <footer v-if="promoOrg && !repos.length && !loading" class="lumen-sidebar-footer">
            <p>Aucun cours synchronise.</p>
            <button type="button" class="lumen-btn tiny" @click="handleSync">
              <RefreshCw :size="12" />
              Lancer la synchro
            </button>
          </footer>
        </aside>

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

          <div v-else-if="!currentRepo || !currentChapter" class="lumen-empty-state">
            <BookOpen :size="32" />
            <h3>Choisis un chapitre</h3>
            <p>Selectionne un cours dans la colonne de gauche pour commencer la lecture.</p>
          </div>

          <LumenChapterViewer
            v-else
            :repo="currentRepo"
            :chapter="currentChapter"
            :content="currentContent"
            :loading="loadingChapter"
            :is-read="isCurrentRead"
            :prev-chapter="prevChapter"
            :next-chapter="nextChapter"
            @read="handleAutoRead"
            @navigate-prev="handleNavigatePrev"
            @navigate-next="handleNavigateNext"
            @navigate-chapter="handleNavigateChapter"
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

.lumen-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
  min-height: 48px;
}

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
.lumen-last-sync {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  padding: 4px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  white-space: nowrap;
}

.lumen-brand-org {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  margin-left: 6px;
}

.lumen-topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lumen-user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}
.lumen-user-login { font-weight: 600; }
.lumen-user-logout {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 3px;
}
.lumen-user-logout:hover { color: var(--danger); }

.lumen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
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

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.lumen-sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-sidebar, var(--bg-secondary));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lumen-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lumen-sidebar-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.lumen-sidebar-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 2px 7px;
  border-radius: 10px;
  font-variant-numeric: tabular-nums;
}

.lumen-sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  flex-shrink: 0;
}
.lumen-sidebar-footer p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fade-in 150ms ease-out;
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

.lumen-modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  width: min(440px, calc(100% - 32px));
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slide-up 200ms ease-out;
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
  border-radius: 6px;
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
  border-radius: 4px;
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.lumen-viewer .markdown-body pre.lumen-code {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
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
  border-radius: 6px;
  display: block;
  margin: 1.4em auto;
}
</style>
