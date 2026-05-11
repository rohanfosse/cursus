<script setup lang="ts">
/*
 * AdminHealth — dashboard de l'etat du serveur.
 *
 * Snapshot complet via /api/admin/health : systeme, disque, DB, backups,
 * sockets, scheduler, modules, SMTP, errors 24h, activite. Distinct du
 * /health public minimaliste (utilise par les monitors externes type
 * UptimeRobot).
 *
 * Conception : un grand bandeau de statut en haut (vert/orange/rouge selon
 * les alertes calculees), puis cards thematiques. Les seuils d'alerte sont
 * documentes en commentaire et resumables dans une legende.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Activity, AlertTriangle, CheckCircle2, Cpu, Database, FolderArchive,
  HardDrive, Mail, RefreshCw, Server, Users, Wrench, Zap,
} from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { relativeTime } from '@/utils/date'

type HealthSnapshot = NonNullable<Awaited<ReturnType<typeof window.api.adminGetHealth>>['data']>

const { api } = useApi()
const snapshot = ref<HealthSnapshot | null>(null)
const loading = ref(false)
const lastFetchAt = ref<number | null>(null)
const autoRefresh = ref(true)

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await api(() => window.api.adminGetHealth())
    if (data) snapshot.value = data as HealthSnapshot
    lastFetchAt.value = Date.now()
  } finally {
    loading.value = false
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null
function setAutoRefresh(enabled: boolean): void {
  autoRefresh.value = enabled
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
  if (enabled) { refreshTimer = setInterval(() => load(), 30_000) }
}

onMounted(() => { load(); setAutoRefresh(true) })
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer) })

// ── Calculs / seuils d'alerte ─────────────────────────────────────────────
// Vert  : tout OK
// Orange: avertissement (disque > 75%, memoire > 80%, backup > 24h)
// Rouge : critique (DB down, disque > 90%, errors critiques > 0, backup > 48h)

interface Alert { level: 'warn' | 'critical'; message: string }

const alerts = computed<Alert[]>(() => {
  const out: Alert[] = []
  const s = snapshot.value
  if (!s) return out

  // DB down = critique
  if (!s.db.ok) out.push({ level: 'critical', message: `Base de donnees inaccessible : ${s.db.error || 'erreur inconnue'}` })

  // Disque
  const disk = s.disk.rootDisk
  if (disk) {
    if (disk.usedPct >= 90) out.push({ level: 'critical', message: `Disque sature : ${disk.usedPct}% utilise (${disk.availGB} GB libre)` })
    else if (disk.usedPct >= 75) out.push({ level: 'warn', message: `Disque a ${disk.usedPct}% — penser au nettoyage` })
  }

  // Memoire (heuristique : > 1 GB RSS pour un pilote 150 users, c'est suspect)
  if (s.system.memory.rssMB > 1024) {
    out.push({ level: 'warn', message: `Memoire RSS elevee : ${s.system.memory.rssMB} MB` })
  }

  // Backup
  if (s.backup.configured) {
    if (s.backup.lastBackupAgeHours == null) {
      out.push({ level: 'warn', message: 'Aucun backup detecte dans /backups' })
    } else if (s.backup.lastBackupAgeHours > 48) {
      out.push({ level: 'critical', message: `Dernier backup il y a ${s.backup.lastBackupAgeHours}h (> 48h)` })
    } else if (s.backup.lastBackupAgeHours > 24) {
      out.push({ level: 'warn', message: `Dernier backup il y a ${s.backup.lastBackupAgeHours}h` })
    }
  }

  // Errors critiques 24h
  if (s.errors24h && s.errors24h.critical > 0) {
    out.push({ level: 'critical', message: `${s.errors24h.critical} erreurs critiques en 24h (boot / uncaught)` })
  } else if (s.errors24h && s.errors24h.total > 50) {
    out.push({ level: 'warn', message: `${s.errors24h.total} erreurs en 24h` })
  }

  // SMTP non configure (warn seulement, fonctionnalite mail OFF)
  if (!s.smtp.configured) {
    out.push({ level: 'warn', message: 'SMTP non configure — pas d\'envoi de mails' })
  }

  return out
})

const overallStatus = computed<'ok' | 'warn' | 'critical'>(() => {
  if (alerts.value.some(a => a.level === 'critical')) return 'critical'
  if (alerts.value.some(a => a.level === 'warn')) return 'warn'
  return 'ok'
})

const statusBadge = computed(() => {
  if (overallStatus.value === 'critical') return { label: 'Critique', class: 'status-critical' }
  if (overallStatus.value === 'warn') return { label: 'Avertissement', class: 'status-warn' }
  return { label: 'OK', class: 'status-ok' }
})

// ── Helpers formatage ─────────────────────────────────────────────────────
function formatBytes(b: number | null | undefined): string {
  if (b == null) return '?'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}j ${Math.floor((s % 86400) / 3600)}h`
}

const enabledModules = computed(() => {
  if (!snapshot.value) return []
  return Object.entries(snapshot.value.modules)
    .filter(([, v]) => v === true)
    .map(([k]) => k)
})

const disabledModules = computed(() => {
  if (!snapshot.value) return []
  return Object.entries(snapshot.value.modules)
    .filter(([, v]) => v === false)
    .map(([k]) => k)
})

const dbRowsList = computed(() => {
  if (!snapshot.value?.db.rowsByTable) return []
  return Object.entries(snapshot.value.db.rowsByTable)
    .sort((a, b) => b[1] - a[1])
})
</script>

<template>
  <div class="adm-health">
    <!-- Bandeau de statut global -->
    <header class="health-banner" :class="`health-banner--${overallStatus}`">
      <div class="banner-icon">
        <CheckCircle2 v-if="overallStatus === 'ok'" :size="40" />
        <AlertTriangle v-else :size="40" />
      </div>
      <div class="banner-main">
        <h1 class="banner-title">
          Etat : <span :class="statusBadge.class">{{ statusBadge.label }}</span>
        </h1>
        <p class="banner-subtitle">
          <template v-if="snapshot">
            <span>v{{ snapshot.system.version }}</span>
            <span class="banner-sep">·</span>
            <span>Uptime {{ formatUptime(snapshot.system.uptime_s) }}</span>
            <span class="banner-sep">·</span>
            <span>{{ snapshot.system.nodeEnv }}</span>
            <span v-if="lastFetchAt" class="banner-sep">·</span>
            <span v-if="lastFetchAt" class="banner-fetched">Maj {{ relativeTime(new Date(lastFetchAt).toISOString()) }}</span>
          </template>
          <template v-else-if="loading">Chargement…</template>
          <template v-else>Impossible de recuperer le snapshot</template>
        </p>
      </div>
      <div class="banner-actions">
        <button class="adm-btn-ghost" :class="{ 'adm-btn-ghost--on': autoRefresh }" @click="setAutoRefresh(!autoRefresh)">
          <RefreshCw :size="14" :class="{ 'spin': autoRefresh }" />
          Auto 30 s
        </button>
        <button class="adm-btn-ghost" @click="load">
          <RefreshCw :size="14" />
          Rafraîchir
        </button>
      </div>
    </header>

    <!-- Alertes actives -->
    <ul v-if="alerts.length" class="alerts-list">
      <li
        v-for="(a, i) in alerts"
        :key="i"
        class="alert-item"
        :class="`alert-item--${a.level}`"
      >
        <AlertTriangle :size="14" />
        {{ a.message }}
      </li>
    </ul>

    <!-- Cards -->
    <div v-if="snapshot" class="health-grid">
      <!-- Systeme -->
      <section class="health-card">
        <header class="card-head"><Cpu :size="16" /> Système</header>
        <dl class="kv">
          <div><dt>Version</dt><dd>{{ snapshot.system.version }}</dd></div>
          <div><dt>Node</dt><dd>{{ snapshot.system.nodeVersion }}</dd></div>
          <div><dt>Plateforme</dt><dd>{{ snapshot.system.platform }}</dd></div>
          <div><dt>NODE_ENV</dt><dd>{{ snapshot.system.nodeEnv }}</dd></div>
          <div><dt>PID</dt><dd>{{ snapshot.system.pid }}</dd></div>
          <div><dt>Uptime</dt><dd>{{ formatUptime(snapshot.system.uptime_s) }}</dd></div>
        </dl>
      </section>

      <!-- Memoire -->
      <section class="health-card">
        <header class="card-head"><Activity :size="16" /> Mémoire</header>
        <dl class="kv">
          <div><dt>Heap utilise</dt><dd>{{ snapshot.system.memory.heapUsedMB }} / {{ snapshot.system.memory.heapTotalMB }} MB</dd></div>
          <div><dt>RSS</dt>
            <dd :class="{ 'kv-warn': snapshot.system.memory.rssMB > 1024 }">
              {{ snapshot.system.memory.rssMB }} MB
            </dd>
          </div>
          <div><dt>External</dt><dd>{{ snapshot.system.memory.externalMB }} MB</dd></div>
        </dl>
      </section>

      <!-- Disque -->
      <section class="health-card">
        <header class="card-head"><HardDrive :size="16" /> Disque</header>
        <dl v-if="snapshot.disk.rootDisk" class="kv">
          <div>
            <dt>/ (root)</dt>
            <dd :class="{
              'kv-warn': snapshot.disk.rootDisk.usedPct >= 75,
              'kv-critical': snapshot.disk.rootDisk.usedPct >= 90,
            }">
              {{ snapshot.disk.rootDisk.usedGB }} / {{ snapshot.disk.rootDisk.totalGB }} GB
              ({{ snapshot.disk.rootDisk.usedPct }} %)
            </dd>
          </div>
          <div class="health-bar">
            <div
              class="health-bar-fill"
              :class="{
                'health-bar-fill--warn': snapshot.disk.rootDisk.usedPct >= 75,
                'health-bar-fill--critical': snapshot.disk.rootDisk.usedPct >= 90,
              }"
              :style="{ width: snapshot.disk.rootDisk.usedPct + '%' }"
            />
          </div>
          <div><dt>Libre</dt><dd>{{ snapshot.disk.rootDisk.availGB }} GB</dd></div>
        </dl>
        <p v-else class="muted-help">Statistiques disque indisponibles (non Linux).</p>
        <dl class="kv">
          <div><dt>DB SQLite</dt><dd>{{ formatBytes(snapshot.disk.dbBytes) }}</dd></div>
          <div><dt>Uploads</dt><dd>{{ formatBytes(snapshot.disk.uploads.bytes) }} ({{ snapshot.disk.uploads.count ?? '?' }} fichiers)</dd></div>
          <div><dt>Backups</dt><dd>{{ formatBytes(snapshot.disk.backups.bytes) }} ({{ snapshot.disk.backups.count ?? '?' }} fichiers)</dd></div>
        </dl>
      </section>

      <!-- Database -->
      <section class="health-card">
        <header class="card-head">
          <Database :size="16" />
          Base de données
          <span v-if="!snapshot.db.ok" class="card-head-badge card-head-badge--alert">DOWN</span>
        </header>
        <dl v-if="snapshot.db.ok" class="kv">
          <div><dt>Migration</dt><dd>v{{ snapshot.db.migrationVersion }}</dd></div>
          <div><dt>Tables</dt><dd>{{ snapshot.db.tables }}</dd></div>
        </dl>
        <p v-else class="kv-critical">{{ snapshot.db.error }}</p>
        <details v-if="dbRowsList.length" class="db-tables-details">
          <summary>Volumes par table ({{ dbRowsList.length }})</summary>
          <ul class="db-tables-list">
            <li v-for="[name, count] in dbRowsList" :key="name">
              <code>{{ name }}</code>
              <span>{{ count.toLocaleString('fr-FR') }}</span>
            </li>
          </ul>
        </details>
      </section>

      <!-- Backups -->
      <section class="health-card">
        <header class="card-head"><FolderArchive :size="16" /> Backups</header>
        <dl class="kv">
          <div><dt>Configure</dt><dd>{{ snapshot.backup.configured ? 'Oui' : 'Non' }}</dd></div>
          <template v-if="snapshot.backup.lastBackup">
            <div>
              <dt>Dernier</dt>
              <dd :class="{ 'kv-warn': snapshot.backup.lastBackupAgeHours && snapshot.backup.lastBackupAgeHours > 24, 'kv-critical': snapshot.backup.lastBackupAgeHours && snapshot.backup.lastBackupAgeHours > 48 }">
                {{ relativeTime(snapshot.backup.lastBackup.mtime) }}
                ({{ formatBytes(snapshot.backup.lastBackup.bytes) }})
              </dd>
            </div>
            <div><dt>Nb total</dt><dd>{{ snapshot.backup.total }}</dd></div>
            <div><dt>Nom</dt><dd><code>{{ snapshot.backup.lastBackup.name }}</code></dd></div>
          </template>
          <template v-else-if="snapshot.backup.configured">
            <div><dd class="kv-warn">Aucun backup detecte</dd></div>
          </template>
        </dl>
      </section>

      <!-- Sockets -->
      <section class="health-card">
        <header class="card-head"><Users :size="16" /> Connexions</header>
        <dl class="kv">
          <div><dt>Socket.io clients</dt><dd>{{ snapshot.sockets.socketIo?.clients ?? '?' }}</dd></div>
          <div v-if="snapshot.sockets.hocuspocus">
            <dt>Cahiers Yjs ouverts</dt>
            <dd>{{ snapshot.sockets.hocuspocus.openDocs }}</dd>
          </div>
          <div v-if="snapshot.activity">
            <dt>Users actifs (5min)</dt>
            <dd>{{ snapshot.activity.activeUsers5min }}</dd>
          </div>
        </dl>
      </section>

      <!-- Activite -->
      <section v-if="snapshot.activity" class="health-card">
        <header class="card-head"><Activity :size="16" /> Activité</header>
        <dl class="kv">
          <div><dt>Messages (1h)</dt><dd>{{ snapshot.activity.messagesLast1h }}</dd></div>
          <div><dt>Dépôts (24h)</dt><dd>{{ snapshot.activity.depotsLast24h }}</dd></div>
        </dl>
      </section>

      <!-- Scheduler -->
      <section class="health-card">
        <header class="card-head"><Wrench :size="16" /> Scheduler</header>
        <dl class="kv">
          <div><dt>Messages programmes en attente</dt><dd>{{ snapshot.scheduler.pendingMessages ?? '?' }}</dd></div>
          <div v-if="snapshot.scheduler.nextScheduledAt">
            <dt>Prochain</dt><dd>{{ relativeTime(snapshot.scheduler.nextScheduledAt) }}</dd>
          </div>
        </dl>
      </section>

      <!-- Erreurs 24h -->
      <section v-if="snapshot.errors24h" class="health-card">
        <header class="card-head">
          <AlertTriangle :size="16" />
          Erreurs 24h
          <span
            v-if="snapshot.errors24h.critical > 0"
            class="card-head-badge card-head-badge--alert"
          >{{ snapshot.errors24h.critical }} critiques</span>
        </header>
        <dl class="kv">
          <div><dt>Total</dt><dd :class="{ 'kv-warn': snapshot.errors24h.total > 50 }">{{ snapshot.errors24h.total }}</dd></div>
          <div v-for="(count, source) in snapshot.errors24h.bySource" :key="source">
            <dt>{{ source }}</dt>
            <dd :class="{ 'kv-critical': source === 'boot' || source === 'uncaught' }">{{ count }}</dd>
          </div>
        </dl>
      </section>

      <!-- SMTP -->
      <section class="health-card">
        <header class="card-head">
          <Mail :size="16" />
          SMTP
          <span v-if="!snapshot.smtp.configured" class="card-head-badge card-head-badge--warn">OFF</span>
        </header>
        <dl class="kv">
          <div><dt>Configure</dt><dd>{{ snapshot.smtp.configured ? 'Oui' : 'Non' }}</dd></div>
          <div v-if="snapshot.smtp.host"><dt>Host</dt><dd><code>{{ snapshot.smtp.host }}:{{ snapshot.smtp.port }}</code></dd></div>
          <div><dt>Alerte mail admin</dt><dd>{{ snapshot.smtp.adminNotifyEmail ? 'Active' : 'Non' }}</dd></div>
        </dl>
      </section>

      <!-- Modules -->
      <section class="health-card">
        <header class="card-head"><Server :size="16" /> Modules</header>
        <div class="modules-block">
          <div v-if="enabledModules.length">
            <strong>Actifs :</strong>
            <span v-for="m in enabledModules" :key="m" class="module-chip module-chip--on">{{ m }}</span>
          </div>
          <div v-if="disabledModules.length">
            <strong>Inactifs :</strong>
            <span v-for="m in disabledModules" :key="m" class="module-chip module-chip--off">{{ m }}</span>
          </div>
        </div>
      </section>

      <!-- Collection errors -->
      <section v-if="snapshot.collectionErrors.length" class="health-card health-card--warn">
        <header class="card-head"><Zap :size="16" /> Sections en erreur</header>
        <p class="muted-help">Le snapshot a ete construit mais ces sections ont leve une exception :</p>
        <ul class="kv-list">
          <li v-for="e in snapshot.collectionErrors" :key="e.section">
            <code>{{ e.section }}</code> : {{ e.error }}
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.adm-health {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Bandeau de statut global ── */
.health-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: var(--radius-lg);
  flex-wrap: wrap;
}
.health-banner--ok       { border-left-color: var(--color-success, #10b981); }
.health-banner--warn     { border-left-color: #f59e0b; background: rgba(245, 158, 11, .06); }
.health-banner--critical { border-left-color: var(--color-danger); background: rgba(var(--color-danger-rgb, 220, 38, 38), .06); }

.banner-icon { color: var(--text-muted); }
.health-banner--ok       .banner-icon { color: var(--color-success, #10b981); }
.health-banner--warn     .banner-icon { color: #f59e0b; }
.health-banner--critical .banner-icon { color: var(--color-danger); }

.banner-main { flex: 1; min-width: 240px; }
.banner-title { font-size: 18px; font-weight: 700; margin: 0 0 4px; color: var(--text-primary); }
.banner-title .status-ok       { color: var(--color-success, #10b981); }
.banner-title .status-warn     { color: #f59e0b; }
.banner-title .status-critical { color: var(--color-danger); }
.banner-subtitle {
  margin: 0; font-size: 13px; color: var(--text-muted);
  display: flex; flex-wrap: wrap; gap: 4px;
}
.banner-sep { opacity: .6; }
.banner-fetched { font-style: italic; }

.banner-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.adm-btn-ghost {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; font-size: 12px; font-weight: 500;
  background: transparent; border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text-secondary);
  cursor: pointer; font-family: inherit;
  transition: all var(--t-fast) var(--ease-out);
}
.adm-btn-ghost:hover { background: var(--bg-active); color: var(--text-primary); }
.adm-btn-ghost--on { background: rgba(var(--accent-rgb), .15); color: var(--accent); border-color: rgba(var(--accent-rgb), .35); }
.spin { animation: spin 1.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Alertes ── */
.alerts-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.alert-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  font-size: 13px; font-weight: 500;
  border-radius: var(--radius); border: 1px solid;
}
.alert-item--warn     { background: rgba(245, 158, 11, .08);  border-color: rgba(245, 158, 11, .35);  color: #f59e0b; }
.alert-item--critical { background: rgba(var(--color-danger-rgb, 220, 38, 38), .08); border-color: var(--color-danger); color: var(--color-danger); }

/* ── Grid de cards ── */
.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.health-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.health-card--warn { border-color: rgba(245, 158, 11, .35); background: rgba(245, 158, 11, .04); }
.card-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.card-head-badge {
  margin-left: auto;
  font-size: 10px; font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full, 999px);
  text-transform: uppercase;
}
.card-head-badge--alert { background: var(--color-danger); color: white; }
.card-head-badge--warn  { background: #f59e0b; color: white; }

/* ── Key/value lists ── */
.kv {
  margin: 0; display: flex; flex-direction: column; gap: 4px;
  font-size: 13px;
}
.kv > div {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 3px 0;
  border-bottom: 1px dashed var(--border);
}
.kv > div:last-child { border-bottom: none; }
.kv dt { color: var(--text-muted); margin: 0; font-weight: 400; }
.kv dd { margin: 0; color: var(--text-primary); font-weight: 500; text-align: right; font-variant-numeric: tabular-nums; }
.kv dd code { background: var(--bg-active); padding: 1px 5px; border-radius: 3px; font-size: 11.5px; }
.kv-warn     { color: #f59e0b !important; font-weight: 700 !important; }
.kv-critical { color: var(--color-danger) !important; font-weight: 700 !important; }

.kv-list { list-style: none; padding: 0; margin: 0; font-size: 12px; color: var(--text-secondary); }
.kv-list li { padding: 3px 0; }
.kv-list code { background: var(--bg-active); padding: 1px 5px; border-radius: 3px; font-size: 11.5px; }

.muted-help { font-size: 12px; color: var(--text-muted); margin: 0; }

/* ── Barre disque ── */
.health-bar {
  position: relative;
  width: 100%; height: 6px;
  background: var(--bg-active);
  border-radius: var(--radius-full, 999px);
  overflow: hidden;
}
.health-bar-fill {
  position: absolute; top: 0; left: 0; height: 100%;
  background: var(--color-success, #10b981);
  transition: width var(--t-fast) var(--ease-out);
}
.health-bar-fill--warn     { background: #f59e0b; }
.health-bar-fill--critical { background: var(--color-danger); }

/* ── Modules chips ── */
.modules-block { display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
.modules-block strong { color: var(--text-muted); margin-right: 6px; font-weight: 600; }
.module-chip {
  display: inline-block; margin: 2px 4px 2px 0;
  padding: 2px 8px;
  font-size: 11px; font-weight: 500;
  border-radius: var(--radius-full, 999px);
}
.module-chip--on  { background: rgba(16, 185, 129, .15); color: #10b981; }
.module-chip--off { background: var(--bg-active); color: var(--text-muted); opacity: .7; }

/* ── DB tables expand ── */
.db-tables-details summary {
  cursor: pointer; font-size: 12px; font-weight: 500;
  color: var(--text-muted);
  padding: 4px 0;
  list-style: revert;
}
.db-tables-details summary:hover { color: var(--text-primary); }
.db-tables-list {
  list-style: none; padding: 6px 0 0; margin: 0;
  display: flex; flex-direction: column; gap: 3px;
  font-size: 12px;
}
.db-tables-list li {
  display: flex; justify-content: space-between;
  padding: 3px 0;
}
.db-tables-list code { background: var(--bg-active); padding: 1px 5px; border-radius: 3px; font-size: 11.5px; }
.db-tables-list span { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
</style>
