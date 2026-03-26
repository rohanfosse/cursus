/** Vue "Fichiers partagés" — accessible uniquement par le professeur. */
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Paperclip, Image, FileText, FileArchive, FileCode, Download, Eye, Copy,
  Search, X, LayoutGrid, List, ChevronDown, ChevronRight, User,
} from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { useModalsStore } from '@/stores/modals'
import { useApi }      from '@/composables/useApi'
import { relativeTime } from '@/utils/date'
import { authUrl }      from '@/utils/auth'

const appStore = useAppStore()
const documentsStore = useDocumentsStore()
const modals   = useModalsStore()
const router   = useRouter()
const { api }  = useApi()

if (!appStore.isTeacher) router.replace('/dashboard')

interface DmFile {
  message_id:   number
  student_id:   number
  student_name: string
  file_name:    string
  file_url:     string
  is_image:     boolean
  file_size:    number | null
  sent_at:      string
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' Ko'
  return (bytes / 1048576).toFixed(1) + ' Mo'
}

const files       = ref<DmFile[]>([])
const loading     = ref(true)
const search      = ref('')
const filterType  = ref<'all' | 'images' | 'docs'>('all')
const filterStudent = ref<number | null>(null)
const viewMode    = ref<'grid' | 'list'>('grid')
const lightboxUrl = ref<string | null>(null)
const collapsedStudents = ref<Set<number>>(new Set())

onMounted(async () => {
  const res = await api(() => window.api.getDmFiles())
  files.value = Array.isArray(res) ? (res as DmFile[]) : []
  loading.value = false
})

const students = computed(() => {
  const map = new Map<number, string>()
  for (const f of files.value) map.set(f.student_id, f.student_name)
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
})

const filtered = computed(() => {
  let list = files.value
  if (filterType.value === 'images') list = list.filter(f => f.is_image)
  if (filterType.value === 'docs')   list = list.filter(f => !f.is_image)
  if (filterStudent.value !== null)  list = list.filter(f => f.student_id === filterStudent.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(f => f.file_name.toLowerCase().includes(q) || f.student_name.toLowerCase().includes(q))
  }
  return list
})

// Groupement par étudiant pour la vue liste
const groupedByStudent = computed(() => {
  const groups = new Map<number, { id: number; name: string; files: DmFile[] }>()
  for (const f of filtered.value) {
    if (!groups.has(f.student_id)) groups.set(f.student_id, { id: f.student_id, name: f.student_name, files: [] })
    groups.get(f.student_id)!.files.push(f)
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const stats = computed(() => ({
  total:   files.value.length,
  images:  files.value.filter(f => f.is_image).length,
  docs:    files.value.filter(f => !f.is_image).length,
  students: new Set(files.value.map(f => f.student_id)).size,
}))

function extOf(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }

function fileIcon(f: DmFile) {
  if (f.is_image) return Image
  const ext = extOf(f.file_name)
  if (['pdf','doc','docx','txt','md','odt'].includes(ext)) return FileText
  if (['zip','rar','7z','tar','gz'].includes(ext))         return FileArchive
  if (['js','ts','py','java','c','cpp','cs','html','css','json','xml'].includes(ext)) return FileCode
  return Paperclip
}

function fileColor(f: DmFile) {
  if (f.is_image) return '#06b6d4'
  const ext = extOf(f.file_name)
  if (ext === 'pdf')                        return '#ef4444'
  if (['doc','docx','odt'].includes(ext))   return '#4a90d9'
  if (['zip','rar','7z'].includes(ext))     return '#f59e0b'
  if (['js','ts','py','java','c','cpp'].includes(ext)) return '#22c55e'
  return '#8b8d91'
}

function avatarColor(name: string) {
  const colors = ['#4a90d9','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316']
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length
  return colors[h]
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function openFile(f: DmFile) {
  if (f.is_image) { lightboxUrl.value = f.file_url; return }
  const ext = extOf(f.file_name)
  const previewable = ['pdf', 'docx', 'xlsx', 'txt']
  if (previewable.includes(ext)) {
    documentsStore.openPreview({ id: 0, channel_id: null, promo_id: null, name: f.file_name, type: 'file', content: f.file_url, category: null, description: null, created_at: f.sent_at })
    modals.documentPreview = true
  } else {
    window.api.openPath(authUrl(f.file_url))
  }
}
function downloadFile(f: DmFile) { window.api.openPath(authUrl(f.file_url)) }
function copyFileLink(f: DmFile) { navigator.clipboard.writeText(authUrl(f.file_url)) }
function downloadLightbox()       { if (lightboxUrl.value) window.api.openPath(authUrl(lightboxUrl.value)) }

function toggleCollapse(studentId: number) {
  if (collapsedStudents.value.has(studentId)) collapsedStudents.value.delete(studentId)
  else collapsedStudents.value.add(studentId)
  collapsedStudents.value = new Set(collapsedStudents.value) // trigger reactivity
}
</script>

<template>
  <div class="fv-root">

    <!-- ── Header ── -->
    <div class="fv-header">
      <div class="fv-header-top">
        <div class="fv-title-block">
          <Paperclip :size="16" class="fv-title-icon" />
          <h1 class="fv-title">Fichiers partagés</h1>
        </div>

        <!-- Stats pills -->
        <div v-if="!loading && files.length" class="fv-stats">
          <span class="fv-stat"><User :size="11" />{{ stats.students }} étudiants</span>
          <span class="fv-stat-sep" />
          <span class="fv-stat"><Image :size="11" />{{ stats.images }} images</span>
          <span class="fv-stat-sep" />
          <span class="fv-stat"><FileText :size="11" />{{ stats.docs }} documents</span>
        </div>

        <!-- Toggle vue -->
        <div class="fv-view-toggle">
          <button :class="['fv-view-btn', { active: viewMode === 'grid' }]" title="Vue grille" @click="viewMode = 'grid'"><LayoutGrid :size="14" /></button>
          <button :class="['fv-view-btn', { active: viewMode === 'list' }]" title="Vue liste" @click="viewMode = 'list'"><List :size="14" /></button>
        </div>
      </div>

      <!-- Filtres -->
      <div class="fv-filters">
        <div class="fv-search-wrap">
          <Search :size="13" class="fv-search-icon" />
          <input v-model="search" class="fv-search" placeholder="Rechercher…" />
          <button v-if="search" class="fv-search-clear" @click="search = ''"><X :size="11" /></button>
        </div>

        <div class="fv-type-pills">
          <button :class="['fv-pill', { active: filterType === 'all' }]"    @click="filterType = 'all'">Tous</button>
          <button :class="['fv-pill', { active: filterType === 'images' }]" @click="filterType = 'images'">Images</button>
          <button :class="['fv-pill', { active: filterType === 'docs' }]"   @click="filterType = 'docs'">Documents</button>
        </div>

        <select v-if="students.length > 1" v-model="filterStudent" class="fv-select">
          <option :value="null">Tous les étudiants</option>
          <option v-for="s in students" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>

        <span v-if="filtered.length !== files.length" class="fv-filter-count">{{ filtered.length }} résultat{{ filtered.length > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- ── Loading ── -->
    <div v-if="loading" class="fv-empty">
      <div class="fv-spinner" />
    </div>

    <!-- ── Empty state ── -->
    <div v-else-if="!filtered.length" class="fv-empty">
      <Paperclip :size="36" class="fv-empty-icon" />
      <p class="fv-empty-title">{{ files.length ? 'Aucun fichier ne correspond' : 'Aucun fichier partagé' }}</p>
      <p class="fv-empty-sub">{{ files.length ? 'Modifiez vos filtres' : 'Les fichiers envoyés par vos étudiants en conversation privée apparaîtront ici.' }}</p>
    </div>

    <!-- ── Vue GRILLE ── -->
    <div v-else-if="viewMode === 'grid'" class="fv-grid">
      <div
        v-for="f in filtered"
        :key="f.message_id + f.file_url"
        class="fv-card"
        @click="openFile(f)"
      >
        <div class="fv-card-thumb" :style="{ background: fileColor(f) + '15' }">
          <img v-if="f.is_image" :src="authUrl(f.file_url)" class="fv-card-img" />
          <component v-else :is="fileIcon(f)" :size="26" :style="{ color: fileColor(f) }" />
          <div class="fv-card-ext" :style="{ background: fileColor(f) }">{{ extOf(f.file_name) || '?' }}</div>
        </div>
        <div class="fv-card-body">
          <span class="fv-card-name" :title="f.file_name">{{ f.file_name }}</span>
          <div class="fv-card-meta">
            <span class="fv-card-avatar" :style="{ background: avatarColor(f.student_name) }">{{ initials(f.student_name) }}</span>
            <span class="fv-card-student">{{ f.student_name }}</span>
            <span v-if="f.file_size" class="fv-card-size">{{ formatFileSize(f.file_size) }}</span>
            <span class="fv-card-date">{{ relativeTime(f.sent_at) }}</span>
          </div>
        </div>
        <div class="fv-card-actions" @click.stop>
          <button class="fv-card-btn" title="Aperçu" @click="openFile(f)"><Eye :size="13" /></button>
          <button class="fv-card-btn" title="Copier le lien" @click="copyFileLink(f)"><Copy :size="13" /></button>
          <button class="fv-card-btn" title="Télécharger" @click="downloadFile(f)"><Download :size="13" /></button>
        </div>
      </div>
    </div>

    <!-- ── Vue LISTE groupée par étudiant ── -->
    <div v-else class="fv-list">
      <div v-for="group in groupedByStudent" :key="group.id" class="fv-list-group">
        <!-- En-tête étudiant -->
        <button class="fv-list-group-header" @click="toggleCollapse(group.id)">
          <span class="fv-list-avatar" :style="{ background: avatarColor(group.name) }">{{ initials(group.name) }}</span>
          <span class="fv-list-group-name">{{ group.name }}</span>
          <span class="fv-list-group-count">{{ group.files.length }} fichier{{ group.files.length > 1 ? 's' : '' }}</span>
          <component :is="collapsedStudents.has(group.id) ? ChevronRight : ChevronDown" :size="14" class="fv-list-chevron" />
        </button>

        <!-- Fichiers du groupe -->
        <div v-if="!collapsedStudents.has(group.id)" class="fv-list-items">
          <div
            v-for="f in group.files"
            :key="f.message_id + f.file_url"
            class="fv-list-item"
            @click="openFile(f)"
          >
            <div class="fv-list-item-icon" :style="{ background: fileColor(f) + '18', color: fileColor(f) }">
              <img v-if="f.is_image" :src="authUrl(f.file_url)" class="fv-list-thumb" />
              <component v-else :is="fileIcon(f)" :size="15" />
            </div>
            <span class="fv-list-item-name">{{ f.file_name }}</span>
            <span class="fv-list-item-ext">{{ extOf(f.file_name).toUpperCase() || '—' }}</span>
            <span v-if="f.file_size" class="fv-list-item-size">{{ formatFileSize(f.file_size) }}</span>
            <span class="fv-list-item-date">{{ relativeTime(f.sent_at) }}</span>
            <button class="fv-card-btn" title="Aperçu" @click.stop="openFile(f)"><Eye :size="13" /></button>
            <button class="fv-card-btn" title="Télécharger" @click.stop="downloadFile(f)"><Download :size="13" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Lightbox image ── -->
    <Transition name="lb">
      <div v-if="lightboxUrl" class="fv-lightbox" @click="lightboxUrl = null">
        <img :src="authUrl(lightboxUrl!)" class="fv-lightbox-img" @click.stop />
        <button class="fv-lightbox-close" @click="lightboxUrl = null"><X :size="16" /></button>
        <button class="fv-lightbox-dl" @click.stop="downloadLightbox"><Download :size="14" /> Télécharger</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fv-root {
  display: flex; flex-direction: column;
  height: 100%; padding: 20px 24px 16px; gap: 14px;
  background: var(--bg-base); overflow: hidden;
}

/* ── Header ── */
.fv-header { display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }

.fv-header-top {
  display: flex; align-items: center; gap: 12px;
}
.fv-title-block { display: flex; align-items: center; gap: 8px; }
.fv-title-icon { color: var(--accent); opacity: .75; flex-shrink: 0; }
.fv-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; white-space: nowrap; }

.fv-stats {
  display: flex; align-items: center; gap: 6px; flex: 1;
}
.fv-stat {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-muted);
}
.fv-stat-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--text-muted); opacity: .4; }

.fv-view-toggle { display: flex; gap: 2px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 2px; flex-shrink: 0; }
.fv-view-btn {
  width: 28px; height: 26px; border: none; border-radius: 6px;
  background: transparent; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all .12s;
}
.fv-view-btn.active { background: var(--bg-active); color: var(--text-primary); }

/* ── Filtres ── */
.fv-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.fv-search-wrap {
  position: relative; display: flex; align-items: center;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; padding: 0 8px; gap: 5px; min-width: 180px;
}
.fv-search-icon { color: var(--text-muted); flex-shrink: 0; }
.fv-search {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 12px; color: var(--text-primary); padding: 5px 0;
}
.fv-search-clear {
  background: none; border: none; cursor: pointer;
  color: var(--text-muted); padding: 1px; display: flex;
}
.fv-type-pills { display: flex; gap: 4px; }
.fv-pill {
  font-size: 11.5px; font-weight: 500; padding: 4px 10px;
  border-radius: 20px; border: 1px solid var(--border);
  background: var(--bg-elevated); color: var(--text-secondary);
  cursor: pointer; transition: all .12s;
}
.fv-pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.fv-select {
  font-size: 12px; padding: 4px 8px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-elevated); color: var(--text-primary);
  cursor: pointer; outline: none;
}
.fv-filter-count {
  font-size: 11px; color: var(--text-muted);
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 2px 8px;
}

/* ── Grid ── */
.fv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px; overflow-y: auto; padding-right: 2px; flex: 1;
}

/* ── Card ── */
.fv-card {
  display: flex; flex-direction: column;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius, 10px); overflow: hidden; cursor: pointer;
  transition: border-color .15s, box-shadow .15s, transform .15s;
  position: relative;
}
.fv-card:hover { border-color: rgba(74,144,217,.3); box-shadow: 0 4px 16px rgba(0,0,0,.12); transform: translateY(-1px); }

.fv-card-thumb {
  height: 88px; display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
}
.fv-card-img { width: 100%; height: 100%; object-fit: cover; }
.fv-card-ext {
  position: absolute; bottom: 6px; right: 6px;
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px;
  color: #fff; padding: 2px 6px; border-radius: 4px;
}

.fv-card-body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 4px; }
.fv-card-name {
  font-size: 12px; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fv-card-meta { display: flex; align-items: center; gap: 5px; }
.fv-card-avatar {
  width: 14px; height: 14px; border-radius: 50%;
  font-size: 7px; font-weight: 700; color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fv-card-student {
  font-size: 10.5px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
}
.fv-card-date { font-size: 9.5px; color: var(--text-muted); white-space: nowrap; }

.fv-card-size { font-size: 9.5px; color: var(--text-muted); }

.fv-card-actions {
  position: absolute; top: 6px; right: 6px;
  display: flex; gap: 3px;
  opacity: 0; transition: opacity .12s;
}
.fv-card:hover .fv-card-actions { opacity: 1; }
.fv-card-btn {
  width: 26px; height: 26px; border-radius: 7px;
  background: var(--bg-base); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); cursor: pointer; transition: color .12s, background .12s;
}
.fv-card-btn:hover { color: var(--accent); background: var(--bg-hover); }

/* ── Vue Liste ── */
.fv-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; padding-right: 2px; }

.fv-list-group { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }

.fv-list-group-header {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: transparent; border: none;
  cursor: pointer; text-align: left; transition: background .12s;
}
.fv-list-group-header:hover { background: var(--bg-hover); }
.fv-list-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  font-size: 10px; font-weight: 700; color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fv-list-group-name { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
.fv-list-group-count { font-size: 11px; color: var(--text-muted); }
.fv-list-chevron { color: var(--text-muted); }

.fv-list-items { border-top: 1px solid var(--border); }
.fv-list-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; cursor: pointer; transition: background .1s;
  border-bottom: 1px solid var(--border);
}
.fv-list-item:last-child { border-bottom: none; }
.fv-list-item:hover { background: var(--bg-hover); }

.fv-list-item-icon {
  width: 30px; height: 30px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  overflow: hidden;
}
.fv-list-thumb { width: 100%; height: 100%; object-fit: cover; }
.fv-list-item-name { flex: 1; font-size: 12.5px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv-list-item-ext { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; flex-shrink: 0; min-width: 28px; text-align: right; }
.fv-list-item-size { font-size: 10px; color: var(--text-muted); flex-shrink: 0; min-width: 50px; text-align: right; }
.fv-list-item-date { font-size: 10.5px; color: var(--text-muted); flex-shrink: 0; min-width: 70px; text-align: right; }

/* ── Empty / Loading ── */
.fv-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.fv-empty-icon { color: var(--text-muted); opacity: .35; }
.fv-empty-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin: 0; }
.fv-empty-sub   { font-size: 12px; color: var(--text-muted); text-align: center; max-width: 320px; margin: 0; }
.fv-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid var(--border); border-top-color: var(--accent);
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Lightbox ── */
.fv-lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,.82);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.fv-lightbox-img {
  max-width: 88vw; max-height: 84vh; border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0,0,0,.5);
}
.fv-lightbox-close {
  position: absolute; top: 18px; right: 18px;
  background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15);
  border-radius: 8px; color: #fff; cursor: pointer; padding: 6px;
  display: flex; align-items: center; backdrop-filter: blur(4px);
}
.fv-lightbox-dl {
  position: absolute; bottom: 22px;
  background: var(--accent); border: none; border-radius: 8px;
  color: #fff; cursor: pointer; padding: 7px 16px;
  font-size: 12.5px; font-weight: 600;
  display: flex; align-items: center; gap: 6px;
}

.lb-enter-active, .lb-leave-active { transition: opacity .15s; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
</style>
