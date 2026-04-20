/** Vue "Fichiers partagés" — accessible uniquement par le professeur. */
<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Paperclip, Image, FileText, FileArchive, FileCode, Download, Eye, Copy,
  Search, X, LayoutGrid, List, ChevronDown, ChevronRight, User, FolderOpen,
} from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { useModalsStore } from '@/stores/modals'
import { useFichiersStore } from '@/stores/fichiers'
import { useApi }      from '@/composables/useApi'
import { useSlashFocusSearch } from '@/composables/useSlashFocusSearch'
import { relativeTime } from '@/utils/date'
import { authUrl }      from '@/utils/auth'

const appStore = useAppStore()
const documentsStore = useDocumentsStore()
const modals   = useModalsStore()
const fichiersStore = useFichiersStore()
const router   = useRouter()
const { api }  = useApi()

if (!appStore.isTeacher) router.replace('/dashboard')

// ── Raccourci clavier : '/' focalise la recherche (convention cross-vues) ──
useSlashFocusSearch('.fv-search')

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

const files       = computed(() => fichiersStore.files)
const loading     = computed(() => fichiersStore.loading)
const search      = ref('')
const filterType  = computed(() => fichiersStore.filterType)
const filterStudent = computed(() => fichiersStore.selectedStudentId)
const viewMode    = ref<'grid' | 'list'>('grid')
const lightboxUrl = ref<string | null>(null)
const collapsedStudents = ref<Set<number>>(new Set())

onMounted(() => {
  if (fichiersStore.files.length === 0) fichiersStore.fetchFiles()
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

/** Nom de fichier nettoyé (retire le préfixe timestamp_hex_ du serveur). */
function cleanFileName(name: string) {
  return name.replace(/^\d+_[a-f0-9]+_/, '')
}

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
  if (['xls','xlsx','csv'].includes(ext))   return '#22c55e'
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
  collapsedStudents.value = new Set(collapsedStudents.value)
}
</script>

<template>
  <ErrorBoundary label="Fichiers">
  <div class="fv-root">

    <!-- ── Header ── -->
    <div class="fv-header">
      <div class="fv-header-top">
        <div class="fv-title-block">
          <div class="fv-title-icon-wrap">
            <FolderOpen :size="18" />
          </div>
          <div>
            <h1 class="fv-title">Fichiers partagés</h1>
            <p v-if="!loading && files.length" class="fv-subtitle">
              {{ stats.students }} étudiant{{ stats.students > 1 ? 's' : '' }} · {{ stats.total }} fichier{{ stats.total > 1 ? 's' : '' }}
            </p>
          </div>
        </div>

        <div class="fv-header-right">
          <!-- Stats badges -->
          <div v-if="!loading && files.length" class="fv-stat-badges">
            <span class="fv-badge fv-badge--img"><Image :size="12" />{{ stats.images }}</span>
            <span class="fv-badge fv-badge--doc"><FileText :size="12" />{{ stats.docs }}</span>
          </div>

          <!-- Toggle vue -->
          <div class="fv-view-toggle">
            <button :class="['fv-view-btn', { active: viewMode === 'grid' }]" title="Vue grille" aria-label="Vue grille" @click="viewMode = 'grid'"><LayoutGrid :size="14" /></button>
            <button :class="['fv-view-btn', { active: viewMode === 'list' }]" title="Vue liste" aria-label="Vue liste" @click="viewMode = 'list'"><List :size="14" /></button>
          </div>
        </div>
      </div>

      <!-- Filtres -->
      <div class="fv-filters">
        <div class="fv-search-wrap">
          <Search :size="14" class="fv-search-icon" />
          <input v-model="search" class="fv-search" placeholder="Rechercher un fichier ou un étudiant…" />
          <button v-if="search" class="fv-search-clear" aria-label="Effacer la recherche" @click="search = ''"><X :size="12" /></button>
        </div>

        <div class="fv-type-pills">
          <button :class="['fv-pill', { active: filterType === 'all' }]"    @click="filterType = 'all'">Tous</button>
          <button :class="['fv-pill', { active: filterType === 'images' }]" @click="filterType = 'images'"><Image :size="11" /> Images</button>
          <button :class="['fv-pill', { active: filterType === 'docs' }]"   @click="filterType = 'docs'"><FileText :size="11" /> Documents</button>
        </div>

        <select v-if="students.length > 1" v-model="filterStudent" class="fv-select" aria-label="Filtrer par étudiant">
          <option :value="null">Tous les étudiants</option>
          <option v-for="s in students" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>

        <span v-if="filtered.length !== files.length" class="fv-filter-count">{{ filtered.length }} résultat{{ filtered.length > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- ── Loading ── -->
    <div v-if="loading" class="fv-empty">
      <div class="fv-spinner" />
      <p class="fv-empty-sub">Chargement des fichiers…</p>
    </div>

    <!-- ── Empty state ── -->
    <div v-else-if="!filtered.length" class="fv-empty">
      <div class="fv-empty-icon-wrap">
        <FolderOpen :size="32" />
      </div>
      <p class="fv-empty-title">{{ files.length ? 'Aucun fichier ne correspond' : 'Aucun fichier partagé' }}</p>
      <p class="fv-empty-sub">{{ files.length ? 'Essayez de modifier vos filtres.' : 'Les fichiers envoyés par vos étudiants en conversation privée apparaîtront ici.' }}</p>
    </div>

    <!-- ── Vue GRILLE ── -->
    <div v-else-if="viewMode === 'grid'" class="fv-grid">
      <div
        v-for="f in filtered"
        :key="f.message_id + f.file_url"
        class="fv-card"
        @click="openFile(f)"
      >
        <!-- Thumbnail -->
        <div class="fv-card-thumb" :style="{ '--fc': fileColor(f) }">
          <img v-if="f.is_image" :src="authUrl(f.file_url)" :alt="cleanFileName(f.file_name)" class="fv-card-img" />
          <template v-else>
            <div class="fv-card-icon-ring">
              <component :is="fileIcon(f)" :size="20" />
            </div>
          </template>
          <span class="fv-card-ext-badge">{{ extOf(f.file_name).toUpperCase() || '?' }}</span>
        </div>

        <!-- Info -->
        <div class="fv-card-body">
          <span class="fv-card-name" :title="cleanFileName(f.file_name)">{{ cleanFileName(f.file_name) }}</span>
          <div class="fv-card-meta">
            <span class="fv-card-avatar" :style="{ background: avatarColor(f.student_name) }">{{ initials(f.student_name) }}</span>
            <span class="fv-card-student">{{ f.student_name }}</span>
          </div>
          <div class="fv-card-bottom">
            <span v-if="f.file_size" class="fv-card-size">{{ formatFileSize(f.file_size) }}</span>
            <span class="fv-card-date">{{ relativeTime(f.sent_at) }}</span>
          </div>
        </div>

        <!-- Actions au survol -->
        <div class="fv-card-actions" @click.stop>
          <button class="fv-card-btn" title="Aperçu" aria-label="Aperçu" @click="openFile(f)"><Eye :size="13" /></button>
          <button class="fv-card-btn" title="Copier le lien" aria-label="Copier le lien" @click="copyFileLink(f)"><Copy :size="13" /></button>
          <button class="fv-card-btn" title="Télécharger" aria-label="Télécharger" @click="downloadFile(f)"><Download :size="13" /></button>
        </div>
      </div>
    </div>

    <!-- ── Vue LISTE groupée par étudiant ── -->
    <div v-else class="fv-list">
      <div v-for="group in groupedByStudent" :key="group.id" class="fv-list-group">
        <button class="fv-list-group-header" @click="toggleCollapse(group.id)">
          <span class="fv-list-avatar" :style="{ background: avatarColor(group.name) }">{{ initials(group.name) }}</span>
          <span class="fv-list-group-name">{{ group.name }}</span>
          <span class="fv-list-group-count">{{ group.files.length }} fichier{{ group.files.length > 1 ? 's' : '' }}</span>
          <component :is="collapsedStudents.has(group.id) ? ChevronRight : ChevronDown" :size="14" class="fv-list-chevron" />
        </button>

        <div v-if="!collapsedStudents.has(group.id)" class="fv-list-items">
          <div
            v-for="f in group.files"
            :key="f.message_id + f.file_url"
            class="fv-list-item"
            @click="openFile(f)"
          >
            <div class="fv-list-item-icon" :style="{ '--fc': fileColor(f) }">
              <img v-if="f.is_image" :src="authUrl(f.file_url)" :alt="cleanFileName(f.file_name)" class="fv-list-thumb" />
              <component v-else :is="fileIcon(f)" :size="15" />
            </div>
            <span class="fv-list-item-name">{{ cleanFileName(f.file_name) }}</span>
            <span class="fv-list-item-ext" :style="{ color: fileColor(f) }">{{ extOf(f.file_name).toUpperCase() || '—' }}</span>
            <span v-if="f.file_size" class="fv-list-item-size">{{ formatFileSize(f.file_size) }}</span>
            <span class="fv-list-item-date">{{ relativeTime(f.sent_at) }}</span>
            <div class="fv-list-item-actions" @click.stop>
              <button class="fv-card-btn" title="Aperçu" aria-label="Aperçu" @click="openFile(f)"><Eye :size="13" /></button>
              <button class="fv-card-btn" title="Télécharger" aria-label="Télécharger" @click="downloadFile(f)"><Download :size="13" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Lightbox image ── -->
    <Transition name="lb">
      <div v-if="lightboxUrl" class="fv-lightbox" @click="lightboxUrl = null">
        <img :src="authUrl(lightboxUrl!)" alt="Image agrandie" class="fv-lightbox-img" @click.stop />
        <button class="fv-lightbox-close" aria-label="Fermer la visionneuse" @click="lightboxUrl = null"><X :size="16" /></button>
        <button class="fv-lightbox-dl" @click.stop="downloadLightbox"><Download :size="14" /> Télécharger</button>
      </div>
    </Transition>
  </div>
  </ErrorBoundary>
</template>

<style scoped>
/* ═══════════════════════════════════════════
   ROOT
═══════════════════════════════════════════ */
.fv-root {
  display: flex; flex-direction: column;
  height: 100%; padding: 24px 28px 16px; gap: 16px;
  background: var(--bg-base); overflow: hidden;
}

/* ═══════════════════════════════════════════
   HEADER
═══════════════════════════════════════════ */
.fv-header { display: flex; flex-direction: column; gap: 14px; flex-shrink: 0; }

.fv-header-top {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.fv-title-block { display: flex; align-items: center; gap: 12px; }
.fv-title-icon-wrap {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, rgba(var(--accent-rgb),.2), rgba(var(--accent-rgb),.08));
  border: 1px solid rgba(var(--accent-rgb),.2);
  display: flex; align-items: center; justify-content: center;
  color: var(--accent); flex-shrink: 0;
}
.fv-title { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; }
.fv-subtitle { font-size: 12px; color: var(--text-muted); margin: 2px 0 0; }

.fv-header-right { display: flex; align-items: center; gap: 10px; }

.fv-stat-badges { display: flex; gap: 6px; }
.fv-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; font-weight: 600; padding: 3px 10px;
  border-radius: 20px; border: 1px solid var(--border);
  background: var(--bg-elevated);
}
.fv-badge--img { color: #06b6d4; }
.fv-badge--doc { color: #ef4444; }

.fv-view-toggle {
  display: flex; gap: 2px; background: var(--bg-elevated);
  border: 1px solid var(--border); border-radius: 9px; padding: 3px;
}
.fv-view-btn {
  width: 30px; height: 28px; border: none; border-radius: 7px;
  background: transparent; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.fv-view-btn:hover { color: var(--text-secondary); }
.fv-view-btn.active { background: var(--accent); color: #fff; box-shadow: 0 1px 4px rgba(var(--accent-rgb),.3); }

/* ═══════════════════════════════════════════
   FILTRES
═══════════════════════════════════════════ */
.fv-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.fv-search-wrap {
  display: flex; align-items: center;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 9px; padding: 0 10px; gap: 7px; min-width: 220px;
  transition: border-color .15s;
}
.fv-search-wrap:focus-within { border-color: var(--accent); }
.fv-search-icon { color: var(--text-muted); flex-shrink: 0; }
.fv-search {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 12.5px; color: var(--text-primary); padding: 7px 0;
  font-family: var(--font);
}
.fv-search::placeholder { color: var(--text-muted); }
.fv-search-clear {
  background: var(--bg-hover); border: none; cursor: pointer;
  color: var(--text-muted); padding: 2px; display: flex; border-radius: 4px;
  transition: color .12s;
}
.fv-search-clear:hover { color: var(--text-primary); }

.fv-type-pills { display: flex; gap: 4px; }
.fv-pill {
  font-size: 12px; font-weight: 500; padding: 5px 12px;
  border-radius: 20px; border: 1px solid var(--border);
  background: var(--bg-elevated); color: var(--text-secondary);
  cursor: pointer; transition: all .15s;
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--font);
}
.fv-pill:hover { border-color: var(--text-muted); color: var(--text-primary); }
.fv-pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.fv-select {
  font-size: 12px; padding: 5px 10px;
  border: 1px solid var(--border); border-radius: 9px;
  background: var(--bg-elevated); color: var(--text-primary);
  cursor: pointer; outline: none; font-family: var(--font);
  transition: border-color .15s;
}
.fv-select:focus { border-color: var(--accent); }

.fv-filter-count {
  font-size: 11.5px; color: var(--accent); font-weight: 600;
  background: rgba(var(--accent-rgb),.1); border: 1px solid rgba(var(--accent-rgb),.2);
  border-radius: 12px; padding: 3px 10px;
}

/* ═══════════════════════════════════════════
   GRID
═══════════════════════════════════════════ */
.fv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px; overflow-y: auto; padding-right: 4px; flex: 1;
  align-content: start;
}

/* ═══════════════════════════════════════════
   CARD
═══════════════════════════════════════════ */
.fv-card {
  display: flex; flex-direction: column;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden; cursor: pointer;
  transition: border-color .18s, box-shadow .18s, transform .18s;
  position: relative;
}
.fv-card:hover {
  border-color: rgba(var(--accent-rgb),.35);
  box-shadow: 0 8px 24px rgba(0,0,0,.15), 0 0 0 1px rgba(var(--accent-rgb),.1);
  transform: translateY(-2px);
}

/* Thumbnail */
.fv-card-thumb {
  height: 100px; display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
  background: linear-gradient(135deg, color-mix(in srgb, var(--fc) 8%, transparent), color-mix(in srgb, var(--fc) 3%, transparent));
}
.fv-card-img { width: 100%; height: 100%; object-fit: cover; }

.fv-card-icon-ring {
  width: 48px; height: 48px; border-radius: 14px;
  background: color-mix(in srgb, var(--fc) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--fc) 20%, transparent);
  display: flex; align-items: center; justify-content: center;
  color: var(--fc);
}

.fv-card-ext-badge {
  position: absolute; bottom: 8px; right: 8px;
  font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
  color: #fff; padding: 2px 7px; border-radius: 5px;
  background: var(--fc); box-shadow: 0 2px 6px rgba(0,0,0,.2);
}

/* Card body */
.fv-card-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
.fv-card-name {
  font-size: 12.5px; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.3;
}
.fv-card-meta { display: flex; align-items: center; gap: 6px; }
.fv-card-avatar {
  width: 16px; height: 16px; border-radius: 50%;
  font-size: 7.5px; font-weight: 700; color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fv-card-student {
  font-size: 11px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
}
.fv-card-bottom {
  display: flex; align-items: center; gap: 6px;
  margin-top: -1px;
}
.fv-card-size {
  font-size: 10px; color: var(--text-muted);
  background: var(--bg-hover); padding: 1px 6px; border-radius: 4px;
  font-weight: 500;
}
.fv-card-date { font-size: 10px; color: var(--text-muted); }

/* Actions overlay */
.fv-card-actions {
  position: absolute; top: 8px; right: 8px;
  display: flex; gap: 4px;
  opacity: 0; transition: opacity .15s;
}
.fv-card:hover .fv-card-actions { opacity: 1; }
.fv-card-btn {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--bg-base); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); cursor: pointer;
  transition: color .12s, background .12s, border-color .12s;
  backdrop-filter: blur(4px);
}
.fv-card-btn:hover {
  color: var(--accent); background: var(--bg-hover);
  border-color: rgba(var(--accent-rgb),.3);
}

/* ═══════════════════════════════════════════
   VUE LISTE
═══════════════════════════════════════════ */
.fv-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1; padding-right: 4px; }

.fv-list-group { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }

.fv-list-group-header {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; background: transparent; border: none;
  cursor: pointer; text-align: left; transition: background .12s;
  font-family: var(--font);
}
.fv-list-group-header:hover { background: var(--bg-hover); }
.fv-list-avatar {
  width: 26px; height: 26px; border-radius: 50%;
  font-size: 10px; font-weight: 700; color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fv-list-group-name { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
.fv-list-group-count { font-size: 11px; color: var(--text-muted); }
.fv-list-chevron { color: var(--text-muted); }

.fv-list-items { border-top: 1px solid var(--border); }
.fv-list-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; cursor: pointer; transition: background .1s;
  border-bottom: 1px solid var(--border);
}
.fv-list-item:last-child { border-bottom: none; }
.fv-list-item:hover { background: var(--bg-hover); }
.fv-list-item:hover .fv-list-item-actions { opacity: 1; }

.fv-list-item-icon {
  width: 34px; height: 34px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--fc) 12%, transparent);
  color: var(--fc);
}
.fv-list-thumb { width: 100%; height: 100%; object-fit: cover; }
.fv-list-item-name {
  flex: 1; font-size: 13px; color: var(--text-primary); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fv-list-item-ext {
  font-size: 10px; font-weight: 800; text-transform: uppercase; flex-shrink: 0;
  min-width: 36px; text-align: center;
  padding: 2px 6px; border-radius: 4px;
  background: var(--bg-hover);
}
.fv-list-item-size { font-size: 11px; color: var(--text-muted); flex-shrink: 0; min-width: 50px; text-align: right; }
.fv-list-item-date { font-size: 11px; color: var(--text-muted); flex-shrink: 0; min-width: 70px; text-align: right; }
.fv-list-item-actions {
  display: flex; gap: 4px; opacity: 0; transition: opacity .12s;
}

/* ═══════════════════════════════════════════
   EMPTY / LOADING
═══════════════════════════════════════════ */
.fv-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
.fv-empty-icon-wrap {
  width: 56px; height: 56px; border-radius: 16px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); margin-bottom: 4px;
}
.fv-empty-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); margin: 0; }
.fv-empty-sub   { font-size: 12.5px; color: var(--text-muted); text-align: center; max-width: 340px; margin: 0; line-height: 1.5; }
.fv-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid var(--border); border-top-color: var(--accent);
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ═══════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════ */
.fv-lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,.85);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
  backdrop-filter: blur(8px);
}
.fv-lightbox-img {
  max-width: 88vw; max-height: 84vh; border-radius: 10px;
  box-shadow: 0 12px 48px rgba(0,0,0,.5);
}
.fv-lightbox-close {
  position: absolute; top: 18px; right: 18px;
  background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.12);
  border-radius: 10px; color: #fff; cursor: pointer; padding: 8px;
  display: flex; align-items: center; backdrop-filter: blur(8px);
  transition: background .15s;
}
.fv-lightbox-close:hover { background: rgba(255,255,255,.2); }
.fv-lightbox-dl {
  position: absolute; bottom: 24px;
  background: var(--accent); border: none; border-radius: 10px;
  color: #fff; cursor: pointer; padding: 9px 20px;
  font-size: 13px; font-weight: 600; font-family: var(--font);
  display: flex; align-items: center; gap: 7px;
  box-shadow: 0 4px 16px rgba(var(--accent-rgb),.3);
  transition: transform .15s;
}
.fv-lightbox-dl:hover { transform: translateY(-1px); }

.lb-enter-active, .lb-leave-active { transition: opacity .18s; }
.lb-enter-from, .lb-leave-to { opacity: 0; }

/* ═══════════════════════════════════════════
   SCROLLBAR
═══════════════════════════════════════════ */
.fv-grid::-webkit-scrollbar,
.fv-list::-webkit-scrollbar { width: 5px; }
.fv-grid::-webkit-scrollbar-track,
.fv-list::-webkit-scrollbar-track { background: transparent; }
.fv-grid::-webkit-scrollbar-thumb,
.fv-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.fv-grid::-webkit-scrollbar-thumb:hover,
.fv-list::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
</style>
