<script setup lang="ts">
/*
 * AdminErrors — dashboard monitoring centralise.
 *
 * Affiche les errors backend (uncaught, rejection, boot, server) ET frontend
 * (Vue errorHandler, window.onerror) capturees par log.error() puis persistees
 * dans la table error_reports (cf. logger.js + migration v94).
 *
 * Mise en avant :
 *   - 5 stat cards en haut avec compteurs 24h par source (boot et fatal en
 *     rouge bordure pour attirer l'oeil)
 *   - Filtre rapide par source via boutons toggle
 *   - Filtre temporel : 1h / 24h / 7j / tout
 *   - Liste paginee 50 items, expand pour voir stack + meta
 *   - Boot failures dans une section separee (lus depuis le fichier flat
 *     persistant /data/db/boot-errors.log)
 *   - Bouton "Purger" avec confirmation
 *   - Refresh manuel + auto-refresh toutes les 30s (toggle)
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  AlertCircle, AlertTriangle, Bug, ChevronDown, RefreshCw, Server,
  ShieldAlert, Trash2, Zap, Globe,
} from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { relativeTime } from '@/utils/date'

interface ErrorReport {
  id: number
  created_at: string
  source: 'frontend' | 'server' | 'uncaught' | 'rejection' | 'boot' | null
  level: 'warn' | 'error' | 'fatal' | null
  message: string
  stack: string | null
  page: string | null
  user_name: string | null
  user_type: string | null
  app_version: string | null
  user_agent: string | null
  meta_json: string | null
}

interface BootError {
  ts: string
  reason: string
  nodeEnv: string | null
  pid: number | null
  version?: string
  length?: number
  raw?: string
}

interface StatsRow {
  source: string
  level: string
  count: number
}

type SourceFilter = 'all' | 'boot' | 'uncaught' | 'rejection' | 'server' | 'frontend'
type WindowFilter = '1h' | '24h' | '7d' | 'all'

const { api } = useApi()
const { showToast } = useToast()

const stats = ref<StatsRow[]>([])
const items = ref<ErrorReport[]>([])
const total = ref(0)
const bootErrors = ref<BootError[]>([])
const loading = ref(false)
const sourceFilter = ref<SourceFilter>('all')
const windowFilter = ref<WindowFilter>('24h')
const expandedId = ref<number | null>(null)
const autoRefresh = ref(false)

const LIMIT = 50

// ── Filtres temporels ─────────────────────────────────────────────────────
function sinceFromWindow(w: WindowFilter): string | undefined {
  if (w === 'all') return undefined
  const now = Date.now()
  const map = { '1h': 60 * 60_000, '24h': 24 * 60 * 60_000, '7d': 7 * 24 * 60 * 60_000 }
  return new Date(now - map[w]).toISOString()
}

// ── Stat cards (compteurs 24h par source) ─────────────────────────────────
interface StatCard {
  id: SourceFilter
  label: string
  icon: typeof Bug
  count: number
  fatal: number
  variant: 'critical' | 'warning' | 'info'
}

const statCards = computed<StatCard[]>(() => {
  // Aggrege les rows stats par source. Le breakdown level/source nous permet
  // de distinguer "20 frontend errors mais 0 fatal" de "1 boot fatal" et
  // d'eviter de noyer l'attention sous le bruit frontend.
  const bySource: Record<string, { count: number; fatal: number }> = {}
  for (const row of stats.value) {
    if (!bySource[row.source]) bySource[row.source] = { count: 0, fatal: 0 }
    bySource[row.source].count += row.count
    if (row.level === 'fatal') bySource[row.source].fatal += row.count
  }
  const get = (s: string) => bySource[s] ?? { count: 0, fatal: 0 }
  return [
    { id: 'boot',      label: 'Boot',         icon: Zap,         count: get('boot').count,      fatal: get('boot').fatal,      variant: 'critical' },
    { id: 'uncaught',  label: 'Uncaught',     icon: AlertCircle, count: get('uncaught').count,  fatal: get('uncaught').fatal,  variant: 'critical' },
    { id: 'rejection', label: 'Promise rej.', icon: ShieldAlert, count: get('rejection').count, fatal: get('rejection').fatal, variant: 'warning' },
    { id: 'server',    label: 'Serveur',      icon: Server,      count: get('server').count,    fatal: get('server').fatal,    variant: 'warning' },
    { id: 'frontend',  label: 'Frontend',     icon: Globe,       count: get('frontend').count,  fatal: get('frontend').fatal,  variant: 'info' },
  ]
})

const totalLast24h = computed(() => statCards.value.reduce((s, c) => s + c.count, 0))
const criticalLast24h = computed(() => statCards.value
  .filter(c => c.variant === 'critical')
  .reduce((s, c) => s + c.count, 0),
)

// ── Chargement ────────────────────────────────────────────────────────────
async function loadStats(): Promise<void> {
  const res = await api(() => window.api.adminGetErrorReportsStats())
  if (res && Array.isArray(res)) stats.value = res as StatsRow[]
}

async function loadItems(): Promise<void> {
  loading.value = true
  try {
    const res = await api(() => window.api.adminGetErrorReports({
      source: sourceFilter.value === 'all' ? undefined : sourceFilter.value,
      since: sinceFromWindow(windowFilter.value),
      limit: LIMIT,
      offset: 0,
    })) as { items?: ErrorReport[]; total?: number } | null
    if (res) {
      items.value = res.items ?? []
      total.value = res.total ?? 0
    }
  } finally {
    loading.value = false
  }
}

async function loadBootErrors(): Promise<void> {
  const res = await api(() => window.api.adminGetBootErrors()) as { entries?: BootError[] } | null
  if (res?.entries) bootErrors.value = res.entries.slice().reverse() // plus recents en haut
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadStats(), loadItems(), loadBootErrors()])
}

async function clearAll(): Promise<void> {
  if (!confirm('Supprimer TOUS les error reports (cette action est definitive) ?')) return
  await api(() => window.api.adminClearErrorReports())
  showToast('Error reports purges.', 'info')
  await refreshAll()
}

function toggleExpand(id: number): void {
  expandedId.value = expandedId.value === id ? null : id
}

// ── Auto-refresh ──────────────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setInterval> | null = null
function setAutoRefresh(enabled: boolean): void {
  autoRefresh.value = enabled
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
  if (enabled) {
    refreshTimer = setInterval(() => { refreshAll() }, 30_000)
  }
}

onMounted(() => { refreshAll() })
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer) })

// ── Helpers UI ────────────────────────────────────────────────────────────
function sourceLabel(s: string | null): string {
  return ({
    frontend: 'Frontend', server: 'Serveur', uncaught: 'Uncaught',
    rejection: 'Promise rej.', boot: 'Boot',
  } as Record<string, string>)[s ?? ''] ?? (s ?? '—')
}

function levelClass(level: string | null): string {
  if (level === 'fatal') return 'lvl-fatal'
  if (level === 'warn')  return 'lvl-warn'
  return 'lvl-error'
}

function sourceClass(s: string | null): string {
  return `src-${s ?? 'other'}`
}

function safeMeta(json: string | null): string {
  if (!json) return ''
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch { return json }
}
</script>

<template>
  <div class="adm-errors">
    <!-- Header : compteurs grands + actions globales -->
    <header class="adm-errors-head">
      <div class="adm-errors-summary">
        <div class="adm-summary-main">
          <div class="adm-summary-count" :class="{ 'adm-summary-count--alert': criticalLast24h > 0 }">
            {{ totalLast24h }}
          </div>
          <div>
            <div class="adm-summary-label">erreurs ces dernières 24 h</div>
            <div v-if="criticalLast24h > 0" class="adm-summary-alert">
              <AlertTriangle :size="14" />
              {{ criticalLast24h }} critiques (boot / uncaught)
            </div>
            <div v-else class="adm-summary-ok">Aucune erreur critique sur les dernières 24 h.</div>
          </div>
        </div>
        <div class="adm-errors-actions">
          <button class="adm-btn-ghost" :class="{ 'adm-btn-ghost--on': autoRefresh }" @click="setAutoRefresh(!autoRefresh)">
            <RefreshCw :size="14" :class="{ 'spin': autoRefresh }" />
            Auto 30 s
          </button>
          <button class="adm-btn-ghost" @click="refreshAll">
            <RefreshCw :size="14" />
            Rafraîchir
          </button>
          <button class="adm-btn-danger-ghost" @click="clearAll">
            <Trash2 :size="14" />
            Purger
          </button>
        </div>
      </div>

      <!-- Stat cards : 5 sources cote a cote -->
      <div class="adm-stat-cards">
        <button
          v-for="c in statCards"
          :key="c.id"
          class="adm-stat-card"
          :class="[
            `adm-stat-card--${c.variant}`,
            { 'adm-stat-card--active': sourceFilter === c.id },
            { 'adm-stat-card--has-fatal': c.fatal > 0 },
          ]"
          @click="sourceFilter = sourceFilter === c.id ? 'all' : c.id; loadItems()"
        >
          <div class="adm-stat-card-top">
            <component :is="c.icon" :size="16" />
            <span class="adm-stat-card-label">{{ c.label }}</span>
          </div>
          <div class="adm-stat-card-count">{{ c.count }}</div>
          <div v-if="c.fatal > 0" class="adm-stat-card-fatal">
            {{ c.fatal }} fatal
          </div>
        </button>
      </div>
    </header>

    <!-- Boot failures (toujours visibles en haut si non vide — c'est le signal #1) -->
    <section v-if="bootErrors.length" class="adm-boot-section">
      <h2 class="adm-section-title">
        <Zap :size="16" />
        Boot failures persistantes
        <span class="adm-count-badge adm-count-badge--alert">{{ bootErrors.length }}</span>
      </h2>
      <p class="adm-section-help">
        Erreurs au démarrage du serveur (avant que la DB soit disponible).
        Lecture du fichier flat <code>/data/db/boot-errors.log</code>.
      </p>
      <ul class="adm-boot-list">
        <li v-for="(b, i) in bootErrors.slice(0, 10)" :key="i" class="adm-boot-item">
          <div class="adm-boot-ts">{{ relativeTime(b.ts) }}</div>
          <div class="adm-boot-reason">{{ b.reason || b.raw }}</div>
          <div class="adm-boot-meta">
            <span v-if="b.version">v{{ b.version }}</span>
            <span v-if="b.nodeEnv">env={{ b.nodeEnv }}</span>
            <span v-if="b.pid">pid={{ b.pid }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- Filtres temporels -->
    <div class="adm-filters">
      <div class="adm-filter-group">
        <span class="adm-filter-label">Période :</span>
        <button
          v-for="w in ['1h', '24h', '7d', 'all'] as WindowFilter[]"
          :key="w"
          class="adm-filter-btn"
          :class="{ 'adm-filter-btn--active': windowFilter === w }"
          @click="windowFilter = w; loadItems()"
        >
          {{ w === 'all' ? 'Tout' : w }}
        </button>
      </div>
      <div class="adm-filter-meta">
        {{ total }} résultat{{ total > 1 ? 's' : '' }}
        <span v-if="sourceFilter !== 'all'">· filtré sur <strong>{{ sourceLabel(sourceFilter) }}</strong></span>
      </div>
    </div>

    <!-- Liste -->
    <div v-if="loading" class="adm-loading">Chargement…</div>
    <div v-else-if="!items.length" class="adm-empty">
      <Bug :size="32" />
      <p>Aucune erreur trouvée pour ces critères.</p>
      <p class="adm-empty-help">{{ sourceFilter === 'all' && windowFilter === 'all' ? 'Tout est calme.' : 'Élargissez les filtres pour voir plus.' }}</p>
    </div>
    <ul v-else class="adm-error-list">
      <li
        v-for="e in items"
        :key="e.id"
        class="adm-error-row"
        :class="[sourceClass(e.source), levelClass(e.level), { 'adm-error-row--expanded': expandedId === e.id }]"
      >
        <button class="adm-error-summary" @click="toggleExpand(e.id)">
          <span class="adm-error-source">{{ sourceLabel(e.source) }}</span>
          <span v-if="e.level" class="adm-error-level" :class="levelClass(e.level)">{{ e.level }}</span>
          <span class="adm-error-msg">{{ e.message }}</span>
          <span class="adm-error-ts">{{ relativeTime(e.created_at) }}</span>
          <ChevronDown :size="14" class="adm-error-chevron" />
        </button>
        <div v-if="expandedId === e.id" class="adm-error-detail">
          <div v-if="e.user_name" class="adm-error-detail-row">
            <strong>Utilisateur :</strong> {{ e.user_name }} ({{ e.user_type || '?' }})
          </div>
          <div v-if="e.page" class="adm-error-detail-row">
            <strong>Page / route :</strong> <code>{{ e.page }}</code>
          </div>
          <div v-if="e.app_version" class="adm-error-detail-row">
            <strong>Version :</strong> <code>{{ e.app_version }}</code>
          </div>
          <div v-if="e.user_agent" class="adm-error-detail-row">
            <strong>User-Agent :</strong> <code class="adm-ua">{{ e.user_agent }}</code>
          </div>
          <details v-if="e.stack" class="adm-error-stack-block">
            <summary>Stack ({{ e.stack.split('\n').length }} lignes)</summary>
            <pre>{{ e.stack }}</pre>
          </details>
          <details v-if="e.meta_json" class="adm-error-stack-block">
            <summary>Métadonnées</summary>
            <pre>{{ safeMeta(e.meta_json) }}</pre>
          </details>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.adm-errors {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Header ── */
.adm-errors-head { display: flex; flex-direction: column; gap: 16px; }
.adm-errors-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  flex-wrap: wrap;
}
.adm-summary-main { display: flex; align-items: center; gap: 16px; }
.adm-summary-count {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  color: var(--text-primary);
  letter-spacing: -.5px;
  font-variant-numeric: tabular-nums;
}
.adm-summary-count--alert { color: var(--color-danger); }
.adm-summary-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
.adm-summary-alert {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-danger);
  font-weight: 600;
}
.adm-summary-ok { font-size: 12px; color: var(--text-muted); }

.adm-errors-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.adm-btn-ghost,
.adm-btn-danger-ghost {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; font-size: 12px; font-weight: 500;
  background: transparent; border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text-secondary);
  cursor: pointer; transition: all var(--t-fast) var(--ease-out);
  font-family: inherit;
}
.adm-btn-ghost:hover { background: var(--bg-active); color: var(--text-primary); }
.adm-btn-ghost--on { background: rgba(var(--accent-rgb), .15); color: var(--accent); border-color: rgba(var(--accent-rgb), .35); }
.adm-btn-danger-ghost:hover { background: rgba(var(--color-danger-rgb, 220, 38, 38), .1); color: var(--color-danger); border-color: var(--color-danger); }
.spin { animation: spin 1.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Stat cards ── */
.adm-stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.adm-stat-card {
  display: flex; flex-direction: column;
  align-items: flex-start; gap: 8px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background var(--t-fast), border-color var(--t-fast), transform var(--t-fast);
}
.adm-stat-card:hover { background: var(--bg-active); transform: translateY(-1px); }
.adm-stat-card-top {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: .5px;
}
.adm-stat-card-count {
  font-size: 28px; font-weight: 700;
  color: var(--text-primary);
  line-height: 1; font-variant-numeric: tabular-nums;
}
.adm-stat-card-fatal {
  font-size: 11px; font-weight: 600;
  color: var(--color-danger);
}
.adm-stat-card--critical { border-color: rgba(var(--color-danger-rgb, 220, 38, 38), .4); }
.adm-stat-card--critical .adm-stat-card-top { color: var(--color-danger); }
.adm-stat-card--has-fatal {
  background: rgba(var(--color-danger-rgb, 220, 38, 38), .06);
  border-color: var(--color-danger);
}
.adm-stat-card--has-fatal .adm-stat-card-count { color: var(--color-danger); }
.adm-stat-card--active {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* ── Boot failures section ── */
.adm-boot-section {
  padding: 16px 18px;
  background: rgba(var(--color-danger-rgb, 220, 38, 38), .06);
  border: 1px solid rgba(var(--color-danger-rgb, 220, 38, 38), .35);
  border-radius: var(--radius-lg);
}
.adm-section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 700; color: var(--color-danger);
  margin: 0 0 4px;
}
.adm-section-help { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; }
.adm-count-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 8px;
  font-size: 11px; font-weight: 700;
  background: var(--bg-elevated); border-radius: var(--radius-full, 999px);
  margin-left: auto;
}
.adm-count-badge--alert {
  background: var(--color-danger); color: white;
}
.adm-boot-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.adm-boot-item {
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: grid; grid-template-columns: 110px 1fr auto; gap: 12px;
  align-items: center;
  font-size: 13px;
}
.adm-boot-ts { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.adm-boot-reason { color: var(--text-primary); font-weight: 500; }
.adm-boot-meta { display: flex; gap: 8px; font-size: 11px; color: var(--text-muted); }
.adm-boot-meta span {
  padding: 2px 6px;
  background: var(--bg-active);
  border-radius: var(--radius-sm);
  font-family: monospace;
}

/* ── Filtres ── */
.adm-filters { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.adm-filter-group { display: flex; align-items: center; gap: 6px; }
.adm-filter-label { font-size: 12px; color: var(--text-muted); margin-right: 4px; }
.adm-filter-btn {
  padding: 4px 10px;
  font-size: 12px; font-weight: 500;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
}
.adm-filter-btn:hover { background: var(--bg-active); }
.adm-filter-btn--active {
  background: rgba(var(--accent-rgb), .12);
  border-color: var(--accent);
  color: var(--accent);
}
.adm-filter-meta { font-size: 12px; color: var(--text-muted); }

/* ── Liste errors ── */
.adm-loading,
.adm-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 60px 20px;
  color: var(--text-muted); text-align: center;
}
.adm-empty p { margin: 0; font-size: 14px; }
.adm-empty-help { font-size: 12px; opacity: .7; }

.adm-error-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.adm-error-row {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  border-left-width: 3px;
}
/* Border-left colore selon source pour scanner rapidement la liste */
.adm-error-row.src-boot      { border-left-color: var(--color-danger); }
.adm-error-row.src-uncaught  { border-left-color: var(--color-danger); }
.adm-error-row.src-rejection { border-left-color: #f59e0b; }
.adm-error-row.src-server    { border-left-color: #f59e0b; }
.adm-error-row.src-frontend  { border-left-color: var(--accent); }

.adm-error-summary {
  display: grid;
  grid-template-columns: 110px 60px 1fr 100px 20px;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  text-align: left;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}
.adm-error-summary:hover { background: var(--bg-active); }
.adm-error-source {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.adm-error-level {
  display: inline-flex; justify-content: center;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.adm-error-level.lvl-fatal { background: var(--color-danger); color: white; }
.adm-error-level.lvl-error { background: rgba(245, 158, 11, .2); color: #f59e0b; }
.adm-error-level.lvl-warn  { background: rgba(var(--accent-rgb), .15); color: var(--accent); }
.adm-error-msg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 12.5px;
}
.adm-error-ts { font-size: 11px; color: var(--text-muted); text-align: right; font-variant-numeric: tabular-nums; }
.adm-error-chevron {
  transition: transform var(--t-fast) var(--ease-out);
  color: var(--text-muted);
}
.adm-error-row--expanded .adm-error-chevron { transform: rotate(180deg); }

.adm-error-detail {
  padding: 12px 16px 14px;
  background: var(--bg-active);
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
  display: flex; flex-direction: column; gap: 6px;
}
.adm-error-detail-row strong { color: var(--text-primary); font-weight: 600; margin-right: 4px; }
.adm-error-detail code {
  font-family: monospace;
  background: var(--bg-elevated);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11.5px;
}
.adm-ua { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
.adm-error-stack-block { margin-top: 4px; }
.adm-error-stack-block summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--text-primary);
  padding: 4px 0;
  list-style: revert;
}
.adm-error-stack-block pre {
  background: var(--bg-canvas);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 4px 0 0;
  max-height: 320px;
}

/* Mobile : reduit la grille header summary */
@media (max-width: 640px) {
  .adm-error-summary {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'source ts'
      'msg msg'
      'level chevron';
    gap: 4px;
  }
  .adm-error-source { grid-area: source; }
  .adm-error-ts { grid-area: ts; }
  .adm-error-msg { grid-area: msg; white-space: normal; word-break: break-word; }
  .adm-error-level { grid-area: level; justify-self: start; }
  .adm-error-chevron { grid-area: chevron; }

  .adm-boot-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
