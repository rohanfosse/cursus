<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  FileText, Link2, Hash, Megaphone, ExternalLink,
  Award, Users, BookOpen,
  Image, FileSpreadsheet, FileArchive, Film, FileCode, File,
} from 'lucide-vue-next'
import { useAppStore }          from '@/stores/app'
import { useTravauxStore }      from '@/stores/travaux'
import { useDocumentsStore }    from '@/stores/documents'
import { useModalsStore }       from '@/stores/modals'
import { useToast }             from '@/composables/useToast'
import { avatarColor } from '@/utils/format'
import { numericGradeClass } from '@/utils/grade'
import StudentProjetHeader      from './StudentProjetHeader.vue'
import StudentProjetStats       from './StudentProjetStats.vue'
import StudentProjetDevoirsList from './StudentProjetDevoirsList.vue'
import LumenProjectSection      from '@/components/lumen/LumenProjectSection.vue'
import type { AppDocument, Channel, Devoir } from '@/types'
import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'

const props = defineProps<{ projectKey: string; promoId: number }>()

const router       = useRouter()
const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const docStore     = useDocumentsStore()
const modals       = useModalsStore()
const { showToast } = useToast()

// ── Métadonnées projet (localStorage) ────────────────────────────────────────
const projectMeta = computed((): ProjectMeta | null => {
  try {
    const raw = localStorage.getItem(`cc_projects_${props.promoId}`)
    const metas = raw ? (JSON.parse(raw) as ProjectMeta[]) : []
    return metas.find(m => m.name === props.projectKey) ?? null
  } catch { return null }
})

// ── Devoirs de l'étudiant pour ce projet ─────────────────────────────────────
const devoirs = computed((): Devoir[] =>
  travauxStore.devoirs
    .filter(t => t.category === props.projectKey)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
)

const devoirsSubmitted = computed(() => devoirs.value.filter(t => t.depot_id != null))
const devoirsPending   = computed(() => devoirs.value.filter(t => t.depot_id == null && !isEventType(t.type)))
const devoirsEvent     = computed(() => devoirs.value.filter(t => isEventType(t.type)))

// ── Horloge ───────────────────────────────────────────────────────────────────
const now = ref(Date.now())
let clockInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => { clockInterval = setInterval(() => { now.value = Date.now() }, 30_000) })
import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => { if (clockInterval) clearInterval(clockInterval) })

function isExpired(deadline: string)       { return now.value >= new Date(deadline).getTime() }
function isEventType(type: string)         { return type === 'soutenance' || type === 'cctl' }
function isOverdue(t: Devoir)              { return t.depot_id == null && !isEventType(t.type) && isExpired(t.deadline) }
// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = computed(() => {
  const graded  = devoirs.value.filter(t => t.note != null)
  const grades  = graded.map(t => parseFloat(t.note ?? '')).filter(n => !isNaN(n))
  const avg     = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10 : null
  const overdue = devoirs.value.filter(t => isOverdue(t)).length
  const pct     = devoirs.value.length ? Math.round((devoirsSubmitted.value.length / devoirs.value.length) * 100) : 0
  return {
    total:     devoirs.value.length,
    submitted: devoirsSubmitted.value.length,
    pending:   devoirsPending.value.length,
    overdue,
    graded:    graded.length,
    avg,
    pct,
    docs:      documents.value.length,
    channels:  channels.value.length,
  }
})

// ── Groupe (si devoir de groupe) ──────────────────────────────────────────────
const groupName = computed(() => devoirs.value.find(t => t.group_name)?.group_name ?? null)

interface GroupMember {
  student_id:      number
  student_name:    string
  avatar_initials: string
  group_name:      string
}
const groupMembers  = ref<GroupMember[]>([])
const loadingGroup  = ref(false)

async function loadGroupMembers() {
  const groupDevoir = devoirs.value.find(t => t.group_id != null)
  if (!groupDevoir) { groupMembers.value = []; return }
  loadingGroup.value = true
  try {
    const res = await window.api.getTravailGroupMembers(groupDevoir.id)
    groupMembers.value = res?.ok ? (res.data as GroupMember[]) : []
  } finally { loadingGroup.value = false }
}

watch(() => devoirs.value, () => { loadGroupMembers() }, { immediate: true })

// ── Documents + Canaux ────────────────────────────────────────────────────────
const documents = ref<AppDocument[]>([])
const channels  = ref<Channel[]>([])
const loading   = ref(false)

async function loadData() {
  loading.value = true
  try {
    const [docsRes, chRes] = await Promise.all([
      window.api.getProjectDocuments(props.promoId, props.projectKey),
      window.api.getChannels(props.promoId),
    ])
    documents.value = docsRes?.ok ? docsRes.data : []
    const all = chRes?.ok ? chRes.data as Channel[] : []
    channels.value = all.filter(c => c.category?.trim() === props.projectKey)
  } finally { loading.value = false }
}

onMounted(loadData)
watch(() => [props.projectKey, props.promoId] as const, loadData)

// ── Dépôt inline ──────────────────────────────────────────────────────────────
const depositingDevoirId = ref<number | null>(null)
const depositMode        = ref<'file' | 'link'>('file')
const depositLink        = ref('')
const depositFile        = ref<string | null>(null)
const depositFileName    = ref<string | null>(null)
const depositing         = ref(false)
const dragOver           = ref(false)

function startDeposit(t: Devoir) {
  depositingDevoirId.value = t.id
  depositMode.value        = 'file'
  depositLink.value        = ''
  depositFile.value        = null
  depositFileName.value    = null
  dragOver.value           = false
}
function cancelDeposit() { depositingDevoirId.value = null; dragOver.value = false }

function displayName(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://'))
    return pathOrUrl.split('/').pop()?.replace(/^\d+_[a-f0-9]+_/, '') ?? pathOrUrl
  return pathOrUrl.split(/[\\/]/).pop() ?? pathOrUrl
}

async function pickFile() {
  const res = await window.api.openFileDialog()
  if (!res?.ok || !res.data) return
  const paths = res.data as string[]
  const localPath = paths[0]
  if (!localPath) return
  const localName = displayName(localPath)
  const uploadRes = await window.api.uploadFile(localPath)
  if (uploadRes?.ok && uploadRes.data) {
    depositFile.value     = uploadRes.data.url
    depositFileName.value = localName
  } else {
    showToast('Erreur lors du chargement du fichier.', 'error')
  }
}
function clearDepositFile() { depositFile.value = null; depositFileName.value = null }

// ── Drag & drop ───────────────────────────────────────────────────────────────
function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (depositMode.value === 'file') dragOver.value = true
}
function onDragLeave() { dragOver.value = false }
async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  if (depositMode.value !== 'file') return
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  const filePath = (file as File & { path?: string }).path
  if (!filePath) return  // web sans path natif → utiliser le sélecteur
  const uploadRes = await window.api.uploadFile(filePath)
  if (uploadRes?.ok && uploadRes.data) {
    depositFile.value     = uploadRes.data.url
    depositFileName.value = file.name
  } else {
    showToast('Erreur lors du chargement du fichier.', 'error')
  }
}

async function submitDeposit(devoir: Devoir) {
  if (depositing.value || !appStore.currentUser) return
  if (depositMode.value === 'file' && !depositFile.value) return
  if (depositMode.value === 'link' && !depositLink.value.trim()) return
  if (isExpired(devoir.deadline)) return
  depositing.value = true
  try {
    const ok = await travauxStore.addDepot({
      travail_id: devoir.id,
      student_id: appStore.currentUser.id,
      type:       depositMode.value,
      content:    depositMode.value === 'file' ? depositFile.value! : depositLink.value.trim(),
      file_name:  depositMode.value === 'file' ? depositFileName.value : null,
    })
    if (ok) {
      showToast('Dépôt enregistré.', 'success')
      cancelDeposit()
      await travauxStore.fetchStudentDevoirs()
    } else {
      showToast('Erreur lors du dépôt.', 'error')
    }
  } finally { depositing.value = false }
}

// ── Navigation ────────────────────────────────────────────────────────────────
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

// ── Prochaine échéance (< 3 jours) ───────────────────────────────────────────
const nextDeadlineSoon = computed(() => {
  const upcoming = devoirsPending.value.filter(t => !isExpired(t.deadline))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  if (!upcoming.length) return null
  const first = upcoming[0]
  const diff = new Date(first.deadline).getTime() - now.value
  if (diff > 3 * 86_400_000) return null
  const days = Math.ceil(diff / 86_400_000)
  const label = days <= 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`
  return { title: first.title, deadline: first.deadline, label }
})

function gradeColor(note: string | null | undefined): string {
  return numericGradeClass(note)
}

// ── File type icon helper ────────────────────────────────────────────────────
function fileTypeIcon(name: string): typeof FileText {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png','jpg','jpeg','gif','svg','webp','bmp'].includes(ext)) return Image
  if (['xls','xlsx','csv','ods'].includes(ext)) return FileSpreadsheet
  if (['zip','rar','7z','tar','gz'].includes(ext)) return FileArchive
  if (['mp4','avi','mkv','mov','webm'].includes(ext)) return Film
  if (['js','ts','py','java','html','css','json','xml','vue'].includes(ext)) return FileCode
  if (['pdf','doc','docx','odt','txt','rtf','ppt','pptx'].includes(ext)) return FileText
  return File
}
</script>

<template>
  <div class="spf-shell">

    <!-- ── En-tête ──────────────────────────────────────────────────────── -->
    <header class="spf-header">
      <StudentProjetHeader
        :project-key="projectKey"
        :project-meta="projectMeta"
        :group-name="groupName"
        @back="appStore.activeProject = null"
      />
      <StudentProjetStats
        :stats="stats"
        :next-deadline-soon="nextDeadlineSoon"
      />
    </header>

    <!-- Cours Lumen lies au projet (cache si aucun repo lie) -->
    <LumenProjectSection
      :promo-id="promoId"
      :project-name="projectKey"
      :is-teacher="false"
    />

    <!-- ── Corps ────────────────────────────────────────────────────────── -->
    <div class="spf-body">

      <!-- ── Colonne principale : Devoirs ─────────────────────────────── -->
      <section class="spf-col-main">

        <!-- Squelettes chargement -->
        <div v-if="travauxStore.loading" class="spf-loading">
          <div v-for="i in 3" :key="i" class="skel-card">
            <div class="skel skel-line skel-w30" style="height:11px" />
            <div class="skel skel-line skel-w70" style="height:15px;margin-top:8px" />
          </div>
        </div>

        <div v-else-if="!devoirs.length" class="spf-empty">
          <BookOpen :size="32" class="spf-empty-icon" />
          <p>Aucun devoir pour ce projet.</p>
        </div>

        <template v-else>
          <StudentProjetDevoirsList
            :devoirs-pending="devoirsPending"
            :devoirs-event="devoirsEvent"
            :devoirs-submitted="devoirsSubmitted"
            :now="now"
            :depositing-devoir-id="depositingDevoirId"
            :deposit-mode="depositMode"
            :deposit-link="depositLink"
            :deposit-file="depositFile"
            :deposit-file-name="depositFileName"
            :depositing="depositing"
            :drag-over="dragOver"
            @start-deposit="startDeposit"
            @cancel-deposit="cancelDeposit"
            @pick-file="pickFile"
            @clear-deposit-file="clearDepositFile"
            @submit-deposit="submitDeposit"
            @update:deposit-mode="depositMode = $event"
            @update:deposit-link="depositLink = $event"
            @drag-over="onDragOver"
            @drag-leave="onDragLeave"
            @drop="onDrop"
          />
        </template>
      </section>

      <!-- ── Colonne secondaire : Ressources + Canaux ───────────────────── -->
      <aside class="spf-col-aside">

        <!-- Ressources -->
        <div class="spf-aside-section">
          <div class="spf-aside-header">
            <span>Ressources</span>
            <span class="spf-aside-count">{{ documents.length }}</span>
          </div>
          <div v-if="loading" class="spf-aside-loading">
            <div v-for="i in 3" :key="i" class="skel-list-row">
              <div class="skel" style="width:20px;height:20px;border-radius:4px;flex-shrink:0" />
              <div class="skel skel-line skel-w70" />
            </div>
          </div>
          <div v-else-if="!documents.length" class="spf-aside-empty">
            Aucune ressource déposée.
          </div>
          <ul v-else class="spf-doc-list">
            <li v-for="doc in documents" :key="doc.id" class="spf-doc-item" @click="openDoc(doc)">
              <span class="spf-doc-icon">
                <Link2 v-if="doc.type === 'link'" :size="12" />
                <component v-else :is="fileTypeIcon(doc.name)" :size="12" />
              </span>
              <span class="spf-doc-name">{{ doc.name }}</span>
              <ExternalLink :size="11" class="spf-doc-open" />
            </li>
          </ul>
        </div>

        <!-- Canaux -->
        <div class="spf-aside-section" style="margin-top:20px">
          <div class="spf-aside-header">
            <span>Canaux</span>
            <span class="spf-aside-count">{{ channels.length }}</span>
          </div>
          <div v-if="!channels.length" class="spf-aside-empty">
            Aucun canal associé.
          </div>
          <ul v-else class="spf-channel-list">
            <li v-for="ch in channels" :key="ch.id" class="spf-channel-item" @click="goToChannel(ch)">
              <Megaphone v-if="ch.type === 'annonce'" :size="13" class="spf-ch-icon spf-ch-icon--ann" />
              <Hash v-else :size="13" class="spf-ch-icon" />
              <span class="spf-ch-name">{{ ch.name }}</span>
              <ExternalLink :size="11" class="spf-ch-open" />
            </li>
          </ul>
        </div>

        <!-- P3 - Membres du groupe -->
        <div v-if="groupName" class="spf-aside-section" style="margin-top:20px">
          <div class="spf-aside-header">
            <Users :size="11" />
            <span>Mon groupe</span>
            <span class="spf-aside-count">{{ groupMembers.length }}</span>
          </div>
          <div v-if="loadingGroup" class="spf-aside-loading">
            <div v-for="i in 3" :key="i" class="skel-list-row">
              <div class="skel" style="width:24px;height:24px;border-radius:50%;flex-shrink:0" />
              <div class="skel skel-line skel-w70" />
            </div>
          </div>
          <div v-else-if="!groupMembers.length" class="spf-aside-empty">Aucun membre trouvé.</div>
          <ul v-else class="spf-member-list">
            <li
              v-for="m in groupMembers"
              :key="m.student_id"
              class="spf-member-item"
              :class="{ 'spf-member-me': m.student_id === appStore.currentUser?.id }"
            >
              <div class="spf-member-avatar" :style="{ background: avatarColor(m.avatar_initials ?? m.student_name ?? '?') }">
                {{ m.avatar_initials ?? '?' }}
              </div>
              <span class="spf-member-name">{{ m.student_name }}</span>
              <span v-if="m.student_id === appStore.currentUser?.id" class="spf-member-you">moi</span>
            </li>
          </ul>
        </div>

        <!-- P5 - Mes résultats -->
        <div v-if="devoirsSubmitted.length > 0" class="spf-aside-section" style="margin-top:20px">
          <div class="spf-aside-header">
            <Award :size="11" />
            <span>Mes résultats</span>
            <span class="spf-aside-count">{{ stats.graded }}/{{ devoirsSubmitted.length }}</span>
          </div>
          <div class="spf-results-list">
            <div
              v-for="t in devoirsSubmitted"
              :key="t.id"
              class="spf-result-row"
            >
              <div class="spf-result-top">
                <span class="spf-result-title">{{ t.title }}</span>
                <span v-if="t.note" class="spf-result-grade" :class="gradeColor(t.note)">{{ t.note }}</span>
                <span v-else class="spf-result-pending">-</span>
              </div>
              <div v-if="t.feedback" class="spf-result-feedback">
                « {{ t.feedback }} »
              </div>
            </div>
          </div>
          <div v-if="stats.avg != null" class="spf-results-avg">
            <Award :size="11" /> Moyenne du projet : <strong>{{ stats.avg }}/20</strong>
          </div>
        </div>

      </aside>
    </div>
  </div>
</template>

<style>
/* Non-scoped pour que les sous-composants (StudentProjetDevoirsList, etc.) heritent des styles spf-* */
/* ── Shell ── */
.spf-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── En-tête ── */
.spf-header {
  padding: 14px 24px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Breadcrumb */
.spf-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.spf-bread-link {
  cursor: pointer;
  color: var(--accent);
  transition: color var(--t-fast);
}
.spf-bread-link:hover { color: var(--accent-hover); text-decoration: underline; }
.spf-bread-sep { color: var(--text-muted); opacity: .5; }
.spf-bread-current { color: var(--text-primary); font-weight: 600; }

.spf-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
  padding: 2px 6px 2px 2px;
  border-radius: 4px;
  transition: color var(--t-fast), background var(--t-fast);
}
.spf-back-btn:hover { color: var(--text-primary); background: var(--bg-hover); }

.spf-header-identity {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.spf-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(155,135,245,.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.spf-project-icon { color: var(--color-cctl); }

.spf-header-text { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.spf-project-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}
.spf-project-desc {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0;
}
.spf-project-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spf-project-dates {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}
.spf-group-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(155,135,245,.12);
  color: var(--color-cctl);
}

/* Stats chips */
.spf-stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.spf-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid transparent;
}
.spf-chip-green  { background: rgba(39,174,96,.12);   color: var(--color-success); border-color: rgba(39,174,96,.25); }
.spf-chip-orange { background: rgba(243,156,18,.12);  color: var(--color-warning); border-color: rgba(243,156,18,.25); }
.spf-chip-red    { background: rgba(231,76,60,.12);   color: var(--color-danger);  border-color: rgba(231,76,60,.25); }
.spf-chip-blue   { background: rgba(74,144,217,.12);  color: var(--accent);        border-color: rgba(74,144,217,.25); }
.spf-chip-muted  { background: var(--bg-elevated); color: var(--text-muted);    border-color: var(--border); }
.spf-chip-pct    { font-size: 10px; opacity: .7; }

/* Barre de progression globale */
.spf-global-progress { padding: 0; }
.spf-global-bar {
  height: 5px;
  border-radius: 3px;
  background: var(--bg-hover);
  overflow: hidden;
}
.spf-global-fill {
  height: 100%;
  border-radius: 3px;
  background: #9B87F5;
  transition: width .4s ease;
  opacity: .8;
}
.spf-global-fill.fill-good     { opacity: 1; }
.spf-global-fill.fill-complete { background: var(--color-success); opacity: 1; }

/* Deadline banner */
.spf-deadline-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(243,156,18,.1);
  border: 1px solid rgba(243,156,18,.25);
  color: var(--color-warning);
  font-size: 12px;
  font-weight: 500;
}

/* ── Corps ── */
.spf-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Colonne principale ── */
.spf-col-main {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  border-right: 1px solid var(--border);
  min-width: 0;
}

.spf-loading { display: flex; flex-direction: column; gap: 10px; }

.spf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;
}
.spf-empty-icon { opacity: .3; }

.spf-section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.spf-section-toggle { cursor: pointer; user-select: none; }
.spf-section-toggle:hover { color: var(--text-secondary); }
.spf-section-count {
  font-size: 10px;
  font-weight: 600;
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 8px;
  color: var(--text-muted);
}

.spf-devoir-list { display: flex; flex-direction: column; gap: 8px; }

/* Carte devoir */
.spf-devoir-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: background var(--t-fast);
}
.spf-card--overdue { border-color: rgba(231,76,60,.3); background: rgba(231,76,60,.04); }
.spf-card--urgent  { border-color: rgba(243,156,18,.3); background: rgba(243,156,18,.04); }
.spf-card--event   { border-color: rgba(155,135,245,.25); background: rgba(155,135,245,.04); }
.spf-card--done    { opacity: .75; }

.spf-card-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.spf-type-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

.spf-card-title {
  flex: 1;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
}
.spf-deadline-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}
.deadline-ok       { background: rgba(39,174,96,.1);  color: var(--color-success); }
.deadline-warning  { background: rgba(243,156,18,.1); color: #F39C12; }
.deadline-soon     { background: rgba(243,156,18,.12); color: var(--color-warning); }
.deadline-critical,
.deadline-passed   { background: rgba(231,76,60,.12); color: #ff7b6b; }

.spf-card-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spf-card-date  { font-size: 11px; color: var(--text-muted); }
.spf-card-group { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--color-cctl); }
.spf-card-desc  { font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.4; }

/* Note */
.spf-done-check { color: var(--color-success); margin-left: auto; flex-shrink: 0; }
.spf-grade-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spf-grade-badge {
  font-size: 13px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 6px;
  flex-shrink: 0;
}
.grade-a { background: rgba(39,174,96,.15);   color: var(--color-success); }
.grade-b { background: rgba(74,144,217,.15);  color: var(--accent); }
.grade-c { background: rgba(243,156,18,.15);  color: var(--color-warning); }
.grade-d { background: rgba(231,76,60,.15);   color: var(--color-danger); }
.grade-letter { background: rgba(155,135,245,.15); color: var(--color-cctl); }

.spf-feedback-text {
  font-size: 11.5px;
  font-style: italic;
  color: var(--text-secondary);
  flex: 1;
}
.spf-grade-pending {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

/* Événement */
.spf-event-notice {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-cctl);
  background: rgba(155,135,245,.08);
  padding: 4px 10px;
  border-radius: 6px;
  width: fit-content;
}

/* Actions */
.spf-card-actions { display: flex; justify-content: flex-end; }
.spf-btn-deposit { font-size: 12px; padding: 5px 12px; display: inline-flex; align-items: center; gap: 5px; }
.spf-btn-expired {
  font-size: 11px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: not-allowed;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Formulaire dépôt */
.spf-deposit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: 8px;
  border: 1px solid var(--border-input);
}
.spf-deposit-toggle { display: flex; gap: 4px; }
.spf-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border-input);
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11.5px;
  font-family: var(--font);
  cursor: pointer;
  transition: all .15s;
}
.spf-toggle-btn.active { border-color: var(--color-cctl); background: rgba(155,135,245,.12); color: var(--color-cctl); }

.spf-file-zone {
  border: 2px dashed var(--border-input);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 12px;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.spf-file-zone:hover   { border-color: var(--color-cctl); background: rgba(155,135,245,.05); }
.spf-file-zone--drag   { border-color: var(--color-cctl); background: rgba(155,135,245,.10); border-style: solid; }
.spf-file-zone--drag span { color: var(--color-cctl); font-weight: 600; }
.spf-file-zone-icon { opacity: .5; }

.spf-file-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(39,174,96,.06);
  border: 1px solid rgba(39,174,96,.2);
  border-radius: 6px;
}
.spf-file-ok   { color: var(--color-success); flex-shrink: 0; }
.spf-file-name { flex: 1; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spf-file-clear {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  transition: color var(--t-fast);
}
.spf-file-clear:hover { color: var(--color-danger); }

.spf-deposit-actions { display: flex; justify-content: flex-end; gap: 6px; }

/* ── Colonne secondaire ── */
.spf-col-aside {
  width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 18px 16px;
  background: rgba(0,0,0,.04);
}

.spf-aside-section { display: flex; flex-direction: column; gap: 8px; }
.spf-aside-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
}
.spf-aside-count {
  font-size: 10px;
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 8px;
  color: var(--text-muted);
}
.spf-aside-loading { display: flex; flex-direction: column; gap: 6px; }
.spf-aside-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }

.spf-doc-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.spf-doc-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: background var(--t-fast);
}
.spf-doc-item:hover { background: var(--bg-hover); }
.spf-doc-item:hover .spf-doc-open { opacity: 1; }
.spf-doc-icon { flex-shrink: 0; color: var(--text-muted); display: flex; align-items: center; }
.spf-doc-name { flex: 1; font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spf-doc-open { flex-shrink: 0; color: var(--text-muted); opacity: 0; transition: opacity var(--t-fast); }

.spf-channel-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.spf-channel-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: background var(--t-fast);
}
.spf-channel-item:hover { background: var(--bg-hover); }
.spf-channel-item:hover .spf-ch-open { opacity: 1; }
.spf-ch-icon     { flex-shrink: 0; color: var(--text-muted); }
.spf-ch-icon--ann { color: #E5A842; }
.spf-ch-name     { flex: 1; font-size: 12px; color: var(--text-secondary); }
.spf-ch-open     { flex-shrink: 0; color: var(--text-muted); opacity: 0; transition: opacity var(--t-fast); }

/* ── P3 Membres du groupe ── */
.spf-member-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.spf-member-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  transition: background var(--t-fast);
}
.spf-member-item:hover { background: var(--bg-hover); }
.spf-member-me { background: rgba(155,135,245,.06); }
.spf-member-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  letter-spacing: 0;
}
.spf-member-name { flex: 1; font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spf-member-you {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(155,135,245,.15);
  color: var(--color-cctl);
  flex-shrink: 0;
}

/* ── P5 Résultats ── */
.spf-results-list { display: flex; flex-direction: column; gap: 6px; }
.spf-result-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-elevated);
}
.spf-result-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.spf-result-title {
  flex: 1;
  font-size: 11.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spf-result-grade {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 5px;
  flex-shrink: 0;
}
.spf-result-pending { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.spf-result-feedback {
  font-size: 11px;
  font-style: italic;
  color: var(--text-muted);
  line-height: 1.4;
}
.spf-results-avg {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--text-secondary);
  padding: 6px 9px 0;
  margin-top: 2px;
  border-top: 1px solid var(--border);
}
.spf-results-avg strong { color: var(--text-primary); }
</style>
