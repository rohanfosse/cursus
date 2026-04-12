<script setup lang="ts">
/**
 * Page d'accueil Lumen (v2.85). Affichee quand aucun chapitre n'est
 * selectionne. Montre une grille de cours avec progression de lecture,
 * un raccourci "Reprendre la lecture" si un historique existe, et les
 * chapitres recemment lus.
 */
import { computed } from 'vue'
import { BookOpen, Lightbulb, Wrench, Hammer, Folder, Clock, ArrowRight, RotateCcw } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import type { LumenRepo, LumenRepoKind } from '@/types'
import type { Component } from 'vue'

interface Props {
  repos: LumenRepo[]
  lastChapterRepoId?: number | null
  lastChapterPath?: string | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'open-chapter', payload: { repoId: number; path: string }): void
}>()

const lumenStore = useLumenStore()

const HIDDEN_KINDS = new Set<string>(['student', 'group', 'readme'])

const courseRepos = computed(() =>
  props.repos.filter((r) => r.manifest && !HIDDEN_KINDS.has(r.manifest.kind ?? '')),
)

const KIND_META: Record<string, { icon: Component; label: string; color: string }> = {
  course:      { icon: BookOpen,  label: 'Cours',       color: 'var(--accent)' },
  prosit:      { icon: Lightbulb, label: 'Prosit',      color: '#f59e0b' },
  workshop:    { icon: Wrench,    label: 'Workshop',    color: '#8b5cf6' },
  miniproject: { icon: Hammer,    label: 'Mini-projet', color: '#ec4899' },
  project:     { icon: Folder,    label: 'Projet',      color: '#059669' },
}

function kindOf(repo: LumenRepo) {
  return KIND_META[repo.manifest?.kind ?? 'course'] ?? KIND_META.course
}

function repoProgress(repo: LumenRepo): { read: number; total: number; pct: number } {
  const chapters = repo.manifest?.chapters ?? []
  const total = chapters.length
  if (!total) return { read: 0, total: 0, pct: 0 }
  let read = 0
  for (const ch of chapters) {
    const k = `${repo.id}::${ch.path}`
    if (lumenStore.myReads.has(k)) read++
  }
  return { read, total, pct: Math.round((read / total) * 100) }
}

function totalDuration(repo: LumenRepo): number {
  return (repo.manifest?.chapters ?? []).reduce((sum, c) => sum + (c.duration ?? 0), 0)
}

function openFirstChapter(repo: LumenRepo) {
  const first = repo.manifest?.chapters[0]
  if (first) emit('open-chapter', { repoId: repo.id, path: first.path })
}

// Resume : dernier chapitre lu
const canResume = computed(() => {
  if (!props.lastChapterRepoId || !props.lastChapterPath) return false
  const repo = props.repos.find((r) => r.id === props.lastChapterRepoId)
  return repo?.manifest?.chapters.some((c) => c.path === props.lastChapterPath) ?? false
})

const resumeChapterTitle = computed(() => {
  if (!canResume.value) return ''
  const repo = props.repos.find((r) => r.id === props.lastChapterRepoId)
  const ch = repo?.manifest?.chapters.find((c) => c.path === props.lastChapterPath)
  return ch?.title ?? props.lastChapterPath ?? ''
})

const resumeRepoTitle = computed(() => {
  if (!canResume.value) return ''
  const repo = props.repos.find((r) => r.id === props.lastChapterRepoId)
  return repo?.manifest?.project ?? repo?.fullName ?? ''
})

function handleResume() {
  if (props.lastChapterRepoId && props.lastChapterPath) {
    emit('open-chapter', { repoId: props.lastChapterRepoId, path: props.lastChapterPath })
  }
}

// Chapitres recemment lus (max 5)
const recentReads = computed(() => {
  const entries: Array<{ repoId: number; path: string; title: string; repoTitle: string; at: string }> = []
  for (const [key, at] of lumenStore.myReadsAt.entries()) {
    const [repoIdStr, ...pathParts] = key.split('::')
    const repoId = Number(repoIdStr)
    const path = pathParts.join('::')
    const repo = props.repos.find((r) => r.id === repoId)
    if (!repo?.manifest) continue
    const ch = repo.manifest.chapters.find((c) => c.path === path)
    if (!ch) continue
    entries.push({
      repoId,
      path,
      title: ch.title,
      repoTitle: repo.manifest.project ?? repo.fullName,
      at,
    })
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
})

// Stats globales
const totalStats = computed(() => {
  let totalChapters = 0
  let totalRead = 0
  for (const repo of courseRepos.value) {
    const p = repoProgress(repo)
    totalChapters += p.total
    totalRead += p.read
  }
  return { courses: courseRepos.value.length, totalChapters, totalRead }
})

const globalPct = computed(() => {
  if (!totalStats.value.totalChapters) return 0
  return Math.round((totalStats.value.totalRead / totalStats.value.totalChapters) * 100)
})
</script>

<template>
  <div class="lw">
    <!-- Header -->
    <header class="lw-header">
      <BookOpen :size="28" class="lw-header-icon" />
      <div>
        <h2 class="lw-title">Lumen</h2>
        <p class="lw-subtitle">
          {{ totalStats.courses }} cours · {{ totalStats.totalChapters }} chapitres
          <template v-if="totalStats.totalRead > 0">
            · {{ totalStats.totalRead }} lus
          </template>
        </p>
      </div>
    </header>

    <!-- Progression globale (v2.93) -->
    <div v-if="totalStats.totalChapters > 0 && totalStats.totalRead > 0" class="lw-global-progress">
      <div class="lw-global-progress-bar">
        <div class="lw-global-progress-fill" :style="{ width: globalPct + '%' }" />
      </div>
      <span class="lw-global-progress-label">{{ totalStats.totalRead }}/{{ totalStats.totalChapters }} chapitres lus ({{ globalPct }}%)</span>
    </div>

    <!-- Message first-time (v2.88) -->
    <div v-if="!canResume && recentReads.length === 0 && courseRepos.length > 0" class="lw-firsttime">
      <p>Choisis un cours ci-dessous pour commencer la lecture. Ta progression sera sauvegardee automatiquement.</p>
    </div>

    <!-- Resume rapide -->
    <button
      v-if="canResume"
      type="button"
      class="lw-resume"
      @click="handleResume"
    >
      <RotateCcw :size="14" />
      <span class="lw-resume-text">
        Reprendre : <strong>{{ resumeChapterTitle }}</strong>
        <span class="lw-resume-repo">{{ resumeRepoTitle }}</span>
      </span>
      <ArrowRight :size="14" />
    </button>

    <!-- Chapitres recents -->
    <section v-if="recentReads.length > 0" class="lw-section">
      <h3 class="lw-section-title">Recemment lus</h3>
      <div class="lw-recents">
        <button
          v-for="r in recentReads"
          :key="`${r.repoId}::${r.path}`"
          type="button"
          class="lw-recent"
          @click="emit('open-chapter', { repoId: r.repoId, path: r.path })"
        >
          <span class="lw-recent-title">{{ r.title }}</span>
          <span class="lw-recent-repo">{{ r.repoTitle }}</span>
        </button>
      </div>
    </section>

    <!-- Grille des cours -->
    <section class="lw-section">
      <h3 class="lw-section-title">Cours</h3>
      <div v-if="courseRepos.length" class="lw-grid">
        <button
          v-for="repo in courseRepos"
          :key="repo.id"
          type="button"
          class="lw-card"
          @click="openFirstChapter(repo)"
        >
          <span class="lw-card-badge" :style="{ color: kindOf(repo).color }">
            <component :is="kindOf(repo).icon" :size="12" />
            {{ kindOf(repo).label }}
          </span>
          <span class="lw-card-title">{{ repo.manifest?.project ?? repo.fullName }}</span>
          <span v-if="repo.manifest?.summary" class="lw-card-desc">{{ repo.manifest.summary }}</span>
          <div class="lw-card-footer">
            <span class="lw-card-meta">{{ repo.manifest?.chapters.length ?? 0 }} chapitres</span>
            <span v-if="totalDuration(repo) > 0" class="lw-card-meta">
              <Clock :size="10" /> {{ Math.round(totalDuration(repo) / 60) }}h
            </span>
          </div>
          <!-- Barre de progression -->
          <div
            v-if="repoProgress(repo).total > 0"
            class="lw-card-progress"
            :title="`${repoProgress(repo).read}/${repoProgress(repo).total} chapitres lus`"
          >
            <div class="lw-card-progress-bar" :style="{ width: repoProgress(repo).pct + '%' }" />
          </div>
        </button>
      </div>
      <div v-else class="lw-empty-box">
        <BookOpen :size="32" class="lw-empty-icon" />
        <p class="lw-empty-text">Aucun cours disponible pour le moment.</p>
        <p class="lw-empty-hint">Ton enseignant n'a pas encore publie de cours, ou la synchronisation est en attente.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lw {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40px 32px;
  overflow-y: auto;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
  gap: 28px;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.lw-header {
  display: flex;
  align-items: center;
  gap: 14px;
}
.lw-header-icon { color: var(--accent); flex-shrink: 0; }
.lw-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}
.lw-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

/* ── Global progress bar (v2.93) ───────────────────────────────────── */
.lw-global-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lw-global-progress-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}
.lw-global-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.4s ease;
}
.lw-global-progress-label {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

/* ── First-time hint (v2.88) ───────────────────────────────────────── */
.lw-firsttime {
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px dashed var(--border);
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  text-align: center;
}
.lw-firsttime p { margin: 0; }

/* ── Resume button ─────────────────────────────────────────────────── */
.lw-resume {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  color: var(--text-primary);
}
@supports not (color: color-mix(in srgb, white, black)) {
  .lw-resume { background: var(--bg-hover); }
}
.lw-resume:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.lw-resume-text {
  flex: 1;
  text-align: left;
  font-size: 14px;
  line-height: 1.3;
}
.lw-resume-text strong { font-weight: 600; }
.lw-resume-repo {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 1px;
}

/* ── Sections ──────────────────────────────────────────────────────── */
.lw-section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Chapitres recents ─────────────────────────────────────────────── */
.lw-recents {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.lw-recent {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  cursor: pointer;
  min-width: 160px;
  max-width: 220px;
  transition: border-color 0.15s;
}
.lw-recent:hover { border-color: var(--accent); }
.lw-recent-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lw-recent-repo {
  font-size: 11px;
  color: var(--text-muted);
}

/* ── Grille de cours ───────────────────────────────────────────────── */
.lw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.lw-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.lw-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.lw-card-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.lw-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}
.lw-card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.lw-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
}
.lw-card-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.lw-card-progress {
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
  margin-top: 4px;
}
.lw-card-progress-bar {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  transition: width 0.3s ease;
  min-width: 0;
}

.lw-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  gap: 8px;
}
.lw-empty-icon { color: var(--text-muted); }
.lw-empty-text {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.lw-empty-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  max-width: 400px;
  line-height: 1.5;
}
</style>
