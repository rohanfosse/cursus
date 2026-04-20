<script setup lang="ts">
/**
 * Sidebar Fichiers — inspire du style LumenRepoSidebar.
 * Liste les etudiants avec leur nombre de fichiers, filtres par type,
 * recherche, et stats globales. Prof uniquement.
 */
import { ref, computed } from 'vue'
import { Search, X, Image, FileText, Paperclip, Users, ChevronRight, MessageSquare, Copy } from 'lucide-vue-next'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useContextMenu } from '@/composables/useContextMenu'

interface DmFile {
  message_id: number
  student_id: number
  student_name: string
  file_name: string
  file_url: string
  is_image: boolean
  file_size: number | null
  sent_at: string
}

interface Props {
  files: DmFile[]
  loading: boolean
  selectedStudentId: number | null
}

interface Emits {
  (e: 'select-student', id: number | null): void
  (e: 'filter-type', type: 'all' | 'images' | 'docs'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const filter = ref('')
const activeType = ref<'all' | 'images' | 'docs'>('all')

// ── Stats ─────────────────────────────────────────────────────────────
const stats = computed(() => {
  const total = props.files.length
  const images = props.files.filter((f) => f.is_image).length
  const docs = total - images
  const students = new Set(props.files.map((f) => f.student_id)).size
  return { total, images, docs, students }
})

// ── Students grouped ──────────────────────────────────────────────────
interface StudentGroup {
  id: number
  name: string
  fileCount: number
  imageCount: number
  lastFile: string
}

const students = computed<StudentGroup[]>(() => {
  const map = new Map<number, StudentGroup>()
  for (const f of props.files) {
    const existing = map.get(f.student_id)
    if (existing) {
      existing.fileCount++
      if (f.is_image) existing.imageCount++
      if (f.sent_at > existing.lastFile) existing.lastFile = f.sent_at
    } else {
      map.set(f.student_id, {
        id: f.student_id,
        name: f.student_name,
        fileCount: 1,
        imageCount: f.is_image ? 1 : 0,
        lastFile: f.sent_at,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const filteredStudents = computed(() => {
  const q = filter.value.toLowerCase().trim()
  if (!q) return students.value
  return students.value.filter((s) => s.name.toLowerCase().includes(q))
})

function selectStudent(id: number) {
  emit('select-student', props.selectedStudentId === id ? null : id)
}

function setType(type: 'all' | 'images' | 'docs') {
  activeType.value = type
  emit('filter-type', type)
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 45%, 45%)`
}

const appStore = useAppStore()
const { showToast } = useToast()
const { ctx, open: openCtx, close: closeCtx } = useContextMenu<StudentGroup>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const s = ctx.value?.target
  if (!s) return []
  const items: ContextMenuItem[] = [
    { label: 'Voir ses fichiers', icon: Paperclip, action: () => selectStudent(s.id) },
    { label: 'Envoyer un message', icon: MessageSquare, action: () => {
      const pid = appStore.activePromoId
      if (!pid) return
      appStore.openDm(s.id, pid, s.name)
    } },
  ]
  if (s.imageCount > 0) {
    items.push({ label: 'Filtrer sur les images', icon: Image, separator: true, action: () => { selectStudent(s.id); setType('images') } })
  }
  if (s.fileCount - s.imageCount > 0) {
    items.push({ label: 'Filtrer sur les documents', icon: FileText, action: () => { selectStudent(s.id); setType('docs') } })
  }
  items.push({ label: 'Copier le nom', icon: Copy, separator: true, action: async () => {
    await navigator.clipboard.writeText(s.name)
    showToast('Nom copié.', 'success')
  } })
  return items
})
</script>

<template>
  <div class="sb-fichiers">
    <!-- Stats header -->
    <div class="sb-fich-stats">
      <div class="sb-fich-stat">
        <Users :size="12" />
        <span>{{ stats.students }} etudiant{{ stats.students > 1 ? 's' : '' }}</span>
      </div>
      <div class="sb-fich-stat">
        <Paperclip :size="12" />
        <span>{{ stats.total }} fichier{{ stats.total > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- Type filter pills -->
    <div class="sb-fich-types">
      <button
        type="button"
        class="sb-fich-type"
        :class="{ active: activeType === 'all' }"
        @click="setType('all')"
      >
        Tous <span class="sb-fich-type-count">{{ stats.total }}</span>
      </button>
      <button
        type="button"
        class="sb-fich-type"
        :class="{ active: activeType === 'images' }"
        @click="setType('images')"
      >
        <Image :size="11" /> <span class="sb-fich-type-count">{{ stats.images }}</span>
      </button>
      <button
        type="button"
        class="sb-fich-type"
        :class="{ active: activeType === 'docs' }"
        @click="setType('docs')"
      >
        <FileText :size="11" /> <span class="sb-fich-type-count">{{ stats.docs }}</span>
      </button>
    </div>

    <!-- Search -->
    <div class="sb-fich-search">
      <Search :size="12" class="sb-fich-search-icon" />
      <input
        v-model="filter"
        type="text"
        class="sb-fich-search-input"
        placeholder="Rechercher un etudiant..."
      />
      <button v-if="filter" type="button" class="sb-fich-search-clear" @click="filter = ''">
        <X :size="11" />
      </button>
    </div>

    <!-- Tous les etudiants (bouton reset) -->
    <button
      v-if="selectedStudentId !== null"
      type="button"
      class="sb-fich-all-btn"
      @click="emit('select-student', null)"
    >
      <Users :size="12" />
      Tous les etudiants
    </button>

    <!-- Student list -->
    <div v-if="loading" class="sb-fich-loading">
      <SkeletonLoader variant="sidebar" :rows="5" />
    </div>
    <div v-else-if="filteredStudents.length === 0" class="sb-fich-empty">
      <Paperclip :size="20" style="opacity: 0.3" />
      <span>{{ filter ? 'Aucun etudiant pour "' + filter + '"' : 'Aucun fichier partage' }}</span>
    </div>
    <div v-else class="sb-fich-list">
      <button
        v-for="s in filteredStudents"
        :key="s.id"
        type="button"
        class="sb-fich-student"
        :class="{ 'is-active': selectedStudentId === s.id }"
        @click="selectStudent(s.id)"
        @contextmenu="openCtx($event, s, true)"
      >
        <div class="sb-fich-avatar" :style="{ background: avatarColor(s.name) }">
          {{ initials(s.name) }}
        </div>
        <div class="sb-fich-student-info">
          <span class="sb-fich-student-name">{{ s.name }}</span>
          <span class="sb-fich-student-meta">
            {{ s.fileCount }} fichier{{ s.fileCount > 1 ? 's' : '' }}
            <span v-if="s.imageCount" class="sb-fich-student-images">· {{ s.imageCount }} img</span>
          </span>
        </div>
        <ChevronRight v-if="selectedStudentId === s.id" :size="12" class="sb-fich-chevron" />
      </button>
    </div>

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </div>
</template>

<style scoped>
.sb-fichiers {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  overflow-y: auto;
  flex: 1;
}

/* Stats */
.sb-fich-stats {
  display: flex;
  gap: 12px;
  padding: 8px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.sb-fich-stat {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

/* Type pills */
.sb-fich-types {
  display: flex;
  gap: 4px;
}
.sb-fich-type {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
}
.sb-fich-type:hover { background: var(--bg-hover); color: var(--text-primary); }
.sb-fich-type.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
.sb-fich-type-count {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.7;
}

/* Search */
.sb-fich-search {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.sb-fich-search:focus-within { border-color: var(--accent); }
.sb-fich-search-icon { color: var(--text-muted); flex-shrink: 0; }
.sb-fich-search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.sb-fich-search-input::placeholder { color: var(--text-muted); }
.sb-fich-search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
}
.sb-fich-search-clear:hover { color: var(--text-primary); }

/* All students reset button */
.sb-fich-all-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.sb-fich-all-btn:hover { border-color: var(--accent); color: var(--accent); }

/* Loading/empty */
.sb-fich-loading { padding: 0; }
.sb-fich-empty {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text-muted); padding: 20px 8px; text-align: center;
}

/* Student list */
.sb-fich-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sb-fich-student {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: none;
  border-left: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.1s;
}
.sb-fich-student:hover { background: var(--bg-hover); }
.sb-fich-student.is-active {
  background: var(--bg-active, rgba(var(--accent-rgb), .16));
  border-left-color: var(--accent);
}

.sb-fich-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.sb-fich-student-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sb-fich-student-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sb-fich-student-meta {
  font-size: 10px;
  color: var(--text-muted);
}
.sb-fich-student-images {
  opacity: 0.7;
}

.sb-fich-chevron {
  color: var(--accent);
  flex-shrink: 0;
}
</style>
