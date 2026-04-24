<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, FileText, Link2, Hash, Megaphone, ChevronLeft,
  ExternalLink, Download, Layers, CalendarDays, Users, FolderOpen,
  BookOpen, CheckSquare,
} from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore } from '@/stores/modals'
import { useDocumentsStore as useDocStore } from '@/stores/documents'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { formatDate, deadlineClass } from '@/utils/date'
import type { AppDocument, Channel } from '@/types'
import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'

const TYPE_LABELS: Record<string, string> = {
  livrable: 'Livrable', soutenance: 'Soutenance', cctl: 'CCTL',
  etude_de_cas: 'Étude de cas', memoire: 'Mémoire', autre: 'Autre',
}

const props = defineProps<{
  projectKey: string
  promoId: number
}>()

const router      = useRouter()
const appStore    = useAppStore()
const travauxStore = useTravauxStore()
const modals      = useModalsStore()
const docStore    = useDocStore()

// ── Métadonnées projet (localStorage) ────────────────────────────────────────
const projectMeta = computed((): ProjectMeta | null => {
  try {
    const raw = localStorage.getItem(`cc_projects_${props.promoId}`)
    const metas = raw ? (JSON.parse(raw) as ProjectMeta[]) : []
    return metas.find(m => m.name === props.projectKey) ?? null
  } catch { return null }
})

// ── Travaux (déjà chargés dans DevoirsView) ───────────────────────────────────
type GanttRow = { id: number; title: string; type: string; deadline: string; start_date?: string | null; published: number; category?: string | null; depots_count?: number; students_total?: number; group_name?: string | null }
const travaux = computed((): GanttRow[] =>
  (travauxStore.ganttData as GanttRow[]).filter(t => t.category === props.projectKey)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
)

const travauxPublished = computed(() => travaux.value.filter(t => t.published))
const travauxDraft     = computed(() => travaux.value.filter(t => !t.published))

const stats = computed(() => {
  const t = travauxPublished.value
  const rendus   = t.reduce((s, i) => s + (i.depots_count ?? 0), 0)
  const expected = t.reduce((s, i) => s + (i.students_total ?? 0), 0)
  return {
    travaux:  travaux.value.length,
    docs:     documents.value.length,
    channels: channels.value.length,
    rendus,
    expected,
    pct: expected ? Math.round((rendus / expected) * 100) : 0,
  }
})

// ── Documents ─────────────────────────────────────────────────────────────────
const documents  = ref<AppDocument[]>([])
const docsLoading = ref(false)

// ── Canaux ────────────────────────────────────────────────────────────────────
const channels = ref<Channel[]>([])
const loading  = ref(false)

async function loadData() {
  loading.value = true
  docsLoading.value = true
  try {
    const [docsRes, chRes] = await Promise.all([
      window.api.getProjectDocuments(props.promoId, props.projectKey),
      window.api.getChannels(props.promoId),
    ])
    documents.value = docsRes?.ok ? docsRes.data : []
    const all = chRes?.ok ? chRes.data as Channel[] : []
    channels.value = all.filter(c => c.category?.trim() === props.projectKey)
  } finally {
    loading.value = false
    docsLoading.value = false
  }
}

onMounted(loadData)
watch(() => [props.projectKey, props.promoId] as const, loadData)

// ── Actions ───────────────────────────────────────────────────────────────────
async function openTravail(id: number) {
  appStore.currentTravailId = id
  await travauxStore.openTravail(id)
  modals.gestionDevoir = true
}

function goToChannel(ch: Channel) {
  appStore.openChannel(ch.id, props.promoId, ch.name, ch.type)
  router.push('/messages')
}

function openDoc(doc: AppDocument) {
  if (doc.type === 'link') {
    window.api.openExternal(doc.content)
  } else {
    docStore.openPreview(doc)
    modals.documentPreview = true
  }
}

function addTravail() {
  modals.newDevoir = true
}

function goToDocs() {
  router.push('/documents')
}

function submitPct(t: GanttRow) {
  if (!t.students_total) return 0
  return Math.round(((t.depots_count ?? 0) / t.students_total) * 100)
}

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} → ${fmt(end)}`
  if (end) return `Jusqu'au ${fmt(end)}`
  return `Depuis ${fmt(start!)}`
}
</script>

<template>
  <div class="pf-shell">

    <!-- ── En-tête projet ─────────────────────────────────────────────── -->
    <header class="pf-header">
      <div class="pf-header-top">
        <button class="pf-back-btn" title="Tous les devoirs" @click="appStore.activeProject = null">
          <ChevronLeft :size="15" />
          <span>Tous les projets</span>
        </button>
        <button class="btn-primary pf-btn-add" @click="addTravail">
          <Plus :size="13" /> Nouveau travail
        </button>
      </div>

      <div class="pf-header-identity">
        <div class="pf-icon-wrap">
          <component
            :is="parseCategoryIcon(projectKey).icon!"
            v-if="parseCategoryIcon(projectKey).icon"
            :size="22"
            class="pf-project-icon"
          />
          <Layers v-else :size="22" class="pf-project-icon" />
        </div>
        <div class="pf-header-text">
          <h2 class="pf-project-name">{{ parseCategoryIcon(projectKey).label }}</h2>
          <p v-if="projectMeta?.description" class="pf-project-desc">{{ projectMeta.description }}</p>
          <p v-if="projectMeta?.startDate || projectMeta?.endDate" class="pf-project-dates">
            <CalendarDays :size="11" />
            {{ formatDateRange(projectMeta?.startDate, projectMeta?.endDate) }}
          </p>
        </div>
      </div>

      <!-- Chips de stats -->
      <div class="pf-stats-row">
        <span class="pf-stat-chip pf-chip-blue">
          <BookOpen :size="11" />
          {{ stats.travaux }} travaux
        </span>
        <span class="pf-stat-chip" :class="stats.pct >= 80 ? 'pf-chip-green' : stats.pct >= 40 ? 'pf-chip-orange' : 'pf-chip-muted'">
          <CheckSquare :size="11" />
          {{ stats.rendus }}/{{ stats.expected }} rendus
          <span v-if="stats.expected" class="pf-chip-pct">({{ stats.pct }}%)</span>
        </span>
        <span class="pf-stat-chip pf-chip-muted">
          <FolderOpen :size="11" />
          {{ stats.docs }} documents
        </span>
        <span v-if="stats.channels" class="pf-stat-chip pf-chip-muted">
          <Hash :size="11" />
          {{ stats.channels }} canal{{ stats.channels > 1 ? 'ux' : '' }}
        </span>
      </div>
    </header>

    <!-- ── Corps : Travaux (gauche) + Docs+Canaux (droite) ────────────── -->
    <div class="pf-body">

      <!-- ── COLONNE PRINCIPALE : Travaux ──────────────────────────────── -->
      <section class="pf-col-main">

        <!-- Publiés -->
        <div class="pf-section-header">
          <span>Travaux publiés</span>
          <span class="pf-count">{{ travauxPublished.length }}</span>
        </div>

        <div v-if="!travauxPublished.length" class="pf-empty">
          Aucun travail publié pour ce projet.
        </div>
        <div v-else class="pf-travaux-list">
          <button
            v-for="t in travauxPublished"
            :key="t.id"
            class="pf-travail-card"
            @click="openTravail(t.id)"
          >
            <div class="pf-travail-top">
              <span class="pf-type-badge" :class="`type-${t.type}`">
                {{ TYPE_LABELS[t.type] ?? t.type }}
              </span>
              <span class="pf-deadline" :class="deadlineClass(t.deadline)">
                {{ formatDate(t.deadline) }}
              </span>
            </div>
            <div class="pf-travail-title">{{ t.title }}</div>
            <!-- Barre de progression des rendus -->
            <div v-if="t.students_total" class="pf-progress-row">
              <div class="pf-progress-bar">
                <div class="pf-progress-fill" :style="{ width: submitPct(t) + '%' }" :class="submitPct(t) === 100 ? 'fill-complete' : submitPct(t) > 50 ? 'fill-good' : ''"/>
              </div>
              <span class="pf-progress-label">{{ t.depots_count ?? 0 }}/{{ t.students_total }}</span>
            </div>
          </button>
        </div>

        <!-- Brouillons -->
        <template v-if="travauxDraft.length">
          <div class="pf-section-header pf-section-header--draft" style="margin-top:16px">
            <span>Brouillons</span>
            <span class="pf-count">{{ travauxDraft.length }}</span>
          </div>
          <div class="pf-travaux-list">
            <button
              v-for="t in travauxDraft"
              :key="t.id"
              class="pf-travail-card pf-travail-card--draft"
              @click="openTravail(t.id)"
            >
              <div class="pf-travail-top">
                <span class="pf-type-badge" :class="`type-${t.type}`">{{ TYPE_LABELS[t.type] ?? t.type }}</span>
                <span class="pf-draft-badge">Brouillon</span>
                <span class="pf-deadline pf-deadline--muted">{{ formatDate(t.deadline) }}</span>
              </div>
              <div class="pf-travail-title">{{ t.title }}</div>
            </button>
          </div>
        </template>

      </section>

      <!-- ── COLONNE SECONDAIRE : Ressources + Canaux ───────────────────── -->
      <aside class="pf-col-aside">

        <!-- Ressources -->
        <div class="pf-aside-section">
          <div class="pf-section-header">
            <span>Ressources</span>
            <span class="pf-count">{{ documents.length }}</span>
            <button class="pf-aside-add-btn" title="Gérer dans la section Ressources" @click="goToDocs">
              <ExternalLink :size="12" />
            </button>
          </div>

          <div v-if="docsLoading" class="pf-aside-loading">
            <div v-for="i in 3" :key="i" class="skel-list-row">
              <div class="skel skel-avatar" style="width:22px;height:22px;border-radius:4px" />
              <div class="skel skel-line skel-w70" />
            </div>
          </div>
          <div v-else-if="!documents.length" class="pf-aside-empty">
            Aucun document pour ce projet.
            <button class="pf-inline-link" @click="goToDocs">Ajouter →</button>
          </div>
          <ul v-else class="pf-doc-list">
            <li
              v-for="doc in documents"
              :key="doc.id"
              class="pf-doc-item"
              @click="openDoc(doc)"
            >
              <span class="pf-doc-icon">
                <Link2 v-if="doc.type === 'link'" :size="12" />
                <FileText v-else :size="12" />
              </span>
              <span class="pf-doc-name">{{ doc.name }}</span>
              <ExternalLink :size="11" class="pf-doc-open" />
            </li>
          </ul>
        </div>

        <!-- Canaux -->
        <div class="pf-aside-section" style="margin-top:20px">
          <div class="pf-section-header">
            <span>Canaux</span>
            <span class="pf-count">{{ channels.length }}</span>
          </div>

          <div v-if="!channels.length" class="pf-aside-empty">
            Aucun canal associé à ce projet.
          </div>
          <ul v-else class="pf-channel-list">
            <li
              v-for="ch in channels"
              :key="ch.id"
              class="pf-channel-item"
              @click="goToChannel(ch)"
            >
              <Megaphone v-if="ch.type === 'annonce'" :size="13" class="pf-ch-icon pf-ch-icon--ann" />
              <Hash v-else :size="13" class="pf-ch-icon" />
              <span class="pf-ch-name">{{ ch.name }}</span>
              <ChevronLeft :size="12" class="pf-ch-arrow" style="transform:rotate(180deg)" />
            </li>
          </ul>
        </div>

      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell ── */
.pf-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── En-tête ── */
.pf-header {
  padding: 16px 24px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pf-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pf-back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12.5px;
  font-family: var(--font);
  cursor: pointer;
  padding: 3px 6px 3px 2px;
  border-radius: 4px;
  transition: color var(--t-fast), background var(--t-fast);
}
.pf-back-btn:hover { color: var(--text-primary); background: var(--bg-hover); }

.pf-btn-add {
  font-size: 12px;
  padding: 5px 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.pf-header-identity {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.pf-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(var(--accent-rgb),.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pf-project-icon { color: var(--accent); }

.pf-header-text { display: flex; flex-direction: column; gap: 3px; }
.pf-project-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}
.pf-project-desc {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0;
}
.pf-project-dates {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--text-muted);
  margin: 0;
}

/* Stats chips */
.pf-stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pf-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid transparent;
}
.pf-chip-blue   { background: rgba(var(--accent-rgb),.12);  color: var(--accent);        border-color: rgba(var(--accent-rgb),.25); }
.pf-chip-green  { background: rgba(var(--color-success-rgb),.12);   color: var(--color-success); border-color: rgba(var(--color-success-rgb),.25); }
.pf-chip-orange { background: rgba(var(--color-warning-rgb),.12);  color: var(--color-warning); border-color: rgba(var(--color-warning-rgb),.25); }
.pf-chip-muted  { background: var(--bg-elevated); color: var(--text-muted);    border-color: var(--border); }
.pf-chip-pct    { opacity: .7; font-size: 10.5px; }

/* ── Corps ── */
.pf-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;
}

/* ── Colonne principale ── */
.pf-col-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  border-right: 1px solid var(--border);
}

.pf-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.pf-section-header--draft { color: var(--color-autre); }

.pf-count {
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}

.pf-empty {
  color: var(--text-muted);
  font-size: 12.5px;
  font-style: italic;
  padding: 8px 0;
}

.pf-travaux-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pf-travail-card {
  width: 100%;
  text-align: left;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--font);
}
.pf-travail-card:hover { background: var(--bg-hover); border-color: var(--border-input); }
.pf-travail-card--draft { opacity: .65; }

.pf-travail-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.pf-type-badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
}
/* inherits .type-* colors from global/parent scope */
.type-livrable     { background: rgba(var(--accent-rgb),.2);   color: var(--accent); }
.type-soutenance   { background: rgba(var(--color-warning-rgb),.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(var(--color-success-rgb),.2);    color: var(--color-success); }
.type-memoire      { background: rgba(var(--color-danger-rgb),.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

.pf-deadline {
  font-size: 11px;
  font-weight: 500;
  margin-left: auto;
}
.pf-deadline--muted { color: var(--text-muted); }
/* inherits .deadline-ok/.deadline-warning/etc from global */

.pf-draft-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-hover);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.pf-travail-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

/* Progress bar */
.pf-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pf-progress-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-active);
  overflow: hidden;
}
.pf-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  transition: width var(--motion-slow) var(--ease-out);
  opacity: .7;
}
.pf-progress-fill.fill-good     { opacity: .9; }
.pf-progress-fill.fill-complete { background: var(--color-success); opacity: 1; }

.pf-progress-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  font-weight: 500;
}

/* ── Colonne secondaire ── */
.pf-col-aside {
  width: 260px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 20px 18px;
  background: rgba(0,0,0,.04);
}

.pf-aside-section { display: flex; flex-direction: column; gap: 8px; }

.pf-aside-add-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  transition: color var(--t-fast);
}
.pf-aside-add-btn:hover { color: var(--text-secondary); }

.pf-aside-loading { display: flex; flex-direction: column; gap: 6px; }

.pf-aside-empty {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pf-inline-link {
  background: transparent;
  border: none;
  color: var(--accent);
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.pf-inline-link:hover { text-decoration: underline; }

/* Documents */
.pf-doc-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }

.pf-doc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--t-fast);
}
.pf-doc-item:hover { background: var(--bg-hover); }
.pf-doc-item:hover .pf-doc-open { opacity: 1; }

.pf-doc-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}
.pf-doc-name {
  flex: 1;
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pf-doc-open {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity var(--t-fast);
}

/* Canaux */
.pf-channel-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }

.pf-channel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--t-fast);
}
.pf-channel-item:hover { background: var(--bg-hover); }
.pf-channel-item:hover .pf-ch-arrow { opacity: 1; }

.pf-ch-icon     { flex-shrink: 0; color: var(--text-muted); }
.pf-ch-icon--ann { color: #E5A842; }
.pf-ch-name     { flex: 1; font-size: 12.5px; color: var(--text-secondary); }
.pf-ch-arrow    { flex-shrink: 0; color: var(--text-muted); opacity: 0; transition: opacity var(--t-fast); }
</style>
