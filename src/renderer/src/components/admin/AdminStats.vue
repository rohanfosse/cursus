<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Users, MessageSquare, FileText, Hash, Activity, Wifi, TrendingUp, Clock, UserX } from 'lucide-vue-next'
import SparklineWpm from '@/components/typerace/SparklineWpm.vue'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import { relativeTime } from '@/utils/date'

type Stats = NonNullable<Awaited<ReturnType<typeof window.api.adminGetStats>>['data']>
type Adoption = NonNullable<Awaited<ReturnType<typeof window.api.adminGetAdoption>>['data']>
type HeatmapCell = { day_of_week: number; hour: number; count: number }

const { api } = useApi()
const appStore = useAppStore()

const stats = ref<Stats | null>(null)
const adoption = ref<Adoption | null>(null)
const heatmap = ref<HeatmapCell[]>([])
const inactive = ref<Array<{ id: number; name: string; promo_name: string | null; last_seen: string | null }>>([])
const loading = ref(false)
const inactiveDays = ref(7)

async function loadAll() {
  loading.value = true
  const [s, a, h, i] = await Promise.all([
    api(() => window.api.adminGetStats()),
    api(() => window.api.adminGetAdoption()),
    api(() => window.api.adminGetHeatmap()),
    api(() => window.api.adminGetInactive(inactiveDays.value)),
  ])
  if (s) stats.value = s
  if (a) adoption.value = a
  if (h) heatmap.value = h
  if (i) inactive.value = i
  loading.value = false
}

async function loadInactive() {
  const i = await api(() => window.api.adminGetInactive(inactiveDays.value))
  if (i) inactive.value = i
}

onMounted(loadAll)

const onlineCount = computed(() => appStore.onlineUsers.length)

// Pre-indexe la heatmap : lookup O(1) dans le template (vs O(n) scan par cell).
const heatmapMap = computed(() => {
  const m = new Map<string, number>()
  for (const c of heatmap.value) m.set(`${c.day_of_week}:${c.hour}`, c.count)
  return m
})

const heatmapMax = computed(() => {
  let max = 1
  for (const c of heatmap.value) if (c.count > max) max = c.count
  return max
})

function heatmapCell(day: number, hour: number): number {
  return heatmapMap.value.get(`${day}:${hour}`) ?? 0
}

function heatmapIntensity(count: number): string {
  if (count === 0) return '0'
  const ratio = count / heatmapMax.value
  if (ratio >= 0.75) return '4'
  if (ratio >= 0.5) return '3'
  if (ratio >= 0.25) return '2'
  return '1'
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const messagesTrend = computed(() => (stats.value?.messagesPerDay ?? []).map(d => d.count))
const depotsTrend   = computed(() => (stats.value?.depotsPerDay   ?? []).map(d => d.count))
const dauTrend      = computed(() => (adoption.value?.dauTrend    ?? []).map(d => d.count))

// ── Adoption ratio ──
const dauRatio = computed(() => {
  if (!adoption.value || !adoption.value.totalStudents) return 0
  return Math.round((adoption.value.dau / adoption.value.totalStudents) * 100)
})
</script>

<template>
  <div class="adm-stats">
    <!-- Cartes principales -->
    <div class="adm-cards">
      <div class="adm-card">
        <div class="adm-card-icon" style="color: var(--color-info)"><Users :size="16" /></div>
        <div>
          <div class="adm-card-val">{{ stats?.counts.students ?? '...' }}</div>
          <div class="adm-card-lbl">Etudiants</div>
        </div>
      </div>
      <div class="adm-card">
        <div class="adm-card-icon" style="color: var(--accent)"><Hash :size="16" /></div>
        <div>
          <div class="adm-card-val">{{ stats?.counts.promotions ?? '...' }}</div>
          <div class="adm-card-lbl">Promotions</div>
        </div>
      </div>
      <div class="adm-card">
        <div class="adm-card-icon" style="color: var(--color-success, #22c55e)"><MessageSquare :size="16" /></div>
        <div>
          <div class="adm-card-val">{{ stats?.counts.messages?.toLocaleString() ?? '...' }}</div>
          <div class="adm-card-lbl">Messages</div>
        </div>
      </div>
      <div class="adm-card">
        <div class="adm-card-icon" style="color: var(--color-warn, #f59e0b)"><FileText :size="16" /></div>
        <div>
          <div class="adm-card-val">{{ stats?.counts.depots?.toLocaleString() ?? '...' }}</div>
          <div class="adm-card-lbl">Depots</div>
        </div>
      </div>
      <div class="adm-card adm-card--live">
        <div class="adm-card-icon adm-card-icon--live">
          <Wifi :size="16" />
          <span class="adm-live-dot" aria-hidden="true" />
        </div>
        <div>
          <div class="adm-card-val">{{ onlineCount }}</div>
          <div class="adm-card-lbl">En ligne <span class="adm-live-badge">Live</span></div>
        </div>
      </div>
    </div>

    <!-- Activite 24h -->
    <div class="adm-row">
      <section class="adm-panel">
        <div class="adm-panel-head">
          <Activity :size="14" />
          <h2>Activite dernieres 24h</h2>
        </div>
        <div class="adm-activity">
          <div>
            <div class="adm-activity-val">{{ stats?.activity24h?.messages_24h ?? 0 }}</div>
            <div class="adm-activity-lbl">messages</div>
          </div>
          <div>
            <div class="adm-activity-val">{{ stats?.activity24h?.depots_24h ?? 0 }}</div>
            <div class="adm-activity-lbl">depots</div>
          </div>
        </div>
      </section>

      <!-- Tendance messages -->
      <section class="adm-panel">
        <div class="adm-panel-head">
          <TrendingUp :size="14" />
          <h2>Messages / jour <span class="adm-panel-sub">30 derniers jours</span></h2>
        </div>
        <SparklineWpm :samples="messagesTrend" :width="260" :height="48" :y-min="1" class="adm-spark adm-spark--accent" />
      </section>

      <!-- Tendance depots -->
      <section class="adm-panel">
        <div class="adm-panel-head">
          <TrendingUp :size="14" />
          <h2>Depots / jour <span class="adm-panel-sub">30 derniers jours</span></h2>
        </div>
        <SparklineWpm :samples="depotsTrend" :width="260" :height="48" :y-min="1" class="adm-spark adm-spark--warn" />
      </section>
    </div>

    <!-- Adoption DAU/WAU/MAU -->
    <section class="adm-panel adm-panel--wide">
      <div class="adm-panel-head">
        <Users :size="14" />
        <h2>Adoption <span class="adm-panel-sub">utilisateurs actifs uniques</span></h2>
      </div>
      <div class="adm-adoption">
        <div class="adm-adoption-metric">
          <div class="adm-adoption-val">{{ adoption?.dau ?? '...' }}</div>
          <div class="adm-adoption-lbl">DAU <span>(24h)</span></div>
          <div v-if="adoption" class="adm-adoption-ratio">{{ dauRatio }}% des etudiants</div>
        </div>
        <div class="adm-adoption-metric">
          <div class="adm-adoption-val">{{ adoption?.wau ?? '...' }}</div>
          <div class="adm-adoption-lbl">WAU <span>(7j)</span></div>
        </div>
        <div class="adm-adoption-metric">
          <div class="adm-adoption-val">{{ adoption?.mau ?? '...' }}</div>
          <div class="adm-adoption-lbl">MAU <span>(30j)</span></div>
        </div>
        <div class="adm-adoption-trend">
          <div class="adm-adoption-trend-lbl">DAU sur 14j</div>
          <SparklineWpm :samples="dauTrend" :width="260" :height="48" :y-min="1" class="adm-spark adm-spark--info" />
        </div>
      </div>
    </section>

    <!-- Heatmap -->
    <section class="adm-panel adm-panel--wide">
      <div class="adm-panel-head">
        <Activity :size="14" />
        <h2>Heatmap d'activite <span class="adm-panel-sub">90 derniers jours · par jour &amp; heure</span></h2>
      </div>
      <div class="adm-heatmap" role="img" aria-label="Heatmap activite par jour et heure">
        <div class="adm-heatmap-hours">
          <span v-for="h in [0, 6, 12, 18, 23]" :key="h" :style="{ left: (h / 23 * 100) + '%' }">
            {{ h.toString().padStart(2, '0') }}h
          </span>
        </div>
        <div class="adm-heatmap-grid">
          <div v-for="d in 7" :key="d - 1" class="adm-heatmap-row">
            <span class="adm-heatmap-day">{{ DAYS[d - 1] }}</span>
            <div
              v-for="h in 24"
              :key="h - 1"
              class="adm-heatmap-cell"
              :data-intensity="heatmapIntensity(heatmapCell(d - 1, h - 1))"
              :title="`${DAYS[d - 1]} ${(h - 1).toString().padStart(2, '0')}h : ${heatmapCell(d - 1, h - 1)} message(s)`"
            />
          </div>
        </div>
        <div class="adm-heatmap-legend">
          <span>Moins</span>
          <span class="adm-heatmap-cell" data-intensity="0" />
          <span class="adm-heatmap-cell" data-intensity="1" />
          <span class="adm-heatmap-cell" data-intensity="2" />
          <span class="adm-heatmap-cell" data-intensity="3" />
          <span class="adm-heatmap-cell" data-intensity="4" />
          <span>Plus</span>
        </div>
      </div>
    </section>

    <!-- Etudiants inactifs -->
    <section class="adm-panel adm-panel--wide">
      <div class="adm-panel-head">
        <UserX :size="14" />
        <h2>Etudiants inactifs</h2>
        <div class="adm-inactive-filter">
          <label for="inactive-days">Depuis</label>
          <select id="inactive-days" v-model.number="inactiveDays" @change="loadInactive">
            <option :value="3">3 jours</option>
            <option :value="7">7 jours</option>
            <option :value="14">14 jours</option>
            <option :value="30">30 jours</option>
          </select>
        </div>
      </div>
      <div v-if="!inactive.length" class="adm-inactive-empty">
        <Clock :size="14" /> Aucun etudiant inactif sur cette periode.
      </div>
      <ul v-else class="adm-inactive-list">
        <li v-for="s in inactive.slice(0, 20)" :key="s.id">
          <span class="adm-inactive-name">{{ s.name }}</span>
          <span class="adm-inactive-promo">{{ s.promo_name ?? '-' }}</span>
          <span class="adm-inactive-last">
            {{ s.last_seen ? `vu ${relativeTime(s.last_seen)}` : 'jamais connecte' }}
          </span>
        </li>
      </ul>
      <div v-if="inactive.length > 20" class="adm-inactive-more">
        +{{ inactive.length - 20 }} autre(s)
      </div>
    </section>
  </div>
</template>

<style scoped>
.adm-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Cartes principales ── */
.adm-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.adm-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.adm-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--bg-active);
  position: relative;
}
.adm-card-icon--live {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-success, #22c55e);
}
.adm-card-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}
.adm-card-lbl {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
.adm-card--live { border-color: rgba(34, 197, 94, 0.35); }

.adm-live-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success, #22c55e);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
  animation: adm-pulse 2s ease-out infinite;
}
@keyframes adm-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3); }
  50%      { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.12); }
}
.adm-live-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  color: var(--color-success, #22c55e);
  background: rgba(34, 197, 94, 0.15);
  padding: 1px 5px;
  border-radius: 6px;
  margin-left: 4px;
  letter-spacing: 0.5px;
}

/* ── Panels ── */
.adm-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.adm-panel {
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.adm-panel--wide { min-height: 120px; }
.adm-panel-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--text-primary);
}
.adm-panel-head h2 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  flex: 1;
}
.adm-panel-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 400;
  margin-left: 4px;
}

/* ── 24h activity ── */
.adm-activity {
  display: flex;
  gap: 18px;
}
.adm-activity-val {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}
.adm-activity-lbl {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.adm-spark {
  width: 100%;
  height: 48px;
  display: block;
}
.adm-spark--accent { color: var(--accent); }
.adm-spark--warn   { color: var(--color-warn, #f59e0b); }
.adm-spark--info   { color: var(--color-info, #3b82f6); }

/* ── Adoption ── */
.adm-adoption {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  align-items: center;
}
.adm-adoption-metric {
  padding: 10px;
  border-radius: 10px;
  background: var(--bg-active);
}
.adm-adoption-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.adm-adoption-lbl {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.adm-adoption-lbl span {
  font-weight: 400;
  opacity: 0.8;
}
.adm-adoption-ratio {
  font-size: 10px;
  color: var(--color-info, #3b82f6);
  margin-top: 2px;
}
.adm-adoption-trend { grid-column: span 2; min-width: 0; }
.adm-adoption-trend-lbl {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

/* ── Heatmap ── */
.adm-heatmap { position: relative; }
.adm-heatmap-hours {
  position: relative;
  height: 16px;
  margin-left: 36px;
  font-size: 10px;
  color: var(--text-muted);
}
.adm-heatmap-hours span {
  position: absolute;
  transform: translateX(-50%);
}
.adm-heatmap-grid { display: flex; flex-direction: column; gap: 2px; }
.adm-heatmap-row { display: flex; align-items: center; gap: 2px; }
.adm-heatmap-day {
  width: 34px;
  font-size: 10px;
  color: var(--text-muted);
  text-align: right;
  padding-right: 4px;
}
.adm-heatmap-cell {
  flex: 1;
  aspect-ratio: 1;
  max-width: 18px;
  min-width: 6px;
  border-radius: 2px;
  background: var(--bg-active);
  transition: transform var(--t-fast) var(--ease-out);
}
.adm-heatmap-cell:hover { transform: scale(1.3); }
.adm-heatmap-cell[data-intensity="0"] { background: var(--bg-active); }
.adm-heatmap-cell[data-intensity="1"] { background: rgba(var(--accent-rgb), 0.22); }
.adm-heatmap-cell[data-intensity="2"] { background: rgba(var(--accent-rgb), 0.45); }
.adm-heatmap-cell[data-intensity="3"] { background: rgba(var(--accent-rgb), 0.7); }
.adm-heatmap-cell[data-intensity="4"] { background: var(--accent); }

.adm-heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 8px;
}
.adm-heatmap-legend .adm-heatmap-cell {
  width: 12px;
  height: 12px;
  min-width: 12px;
  max-width: 12px;
  flex: 0 0 auto;
}

/* ── Inactifs ── */
.adm-inactive-filter {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.adm-inactive-filter select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-primary);
}
.adm-inactive-empty {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 10px 0;
}
.adm-inactive-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.adm-inactive-list li {
  display: grid;
  grid-template-columns: 1fr 120px 160px;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  align-items: center;
}
.adm-inactive-list li:hover { background: var(--bg-active); }
.adm-inactive-name { color: var(--text-primary); font-weight: 500; }
.adm-inactive-promo { color: var(--text-muted); }
.adm-inactive-last { color: var(--text-muted); text-align: right; font-size: 11px; }
.adm-inactive-more {
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
  padding: 6px 10px;
}

@media (max-width: 720px) {
  .adm-inactive-list li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .adm-inactive-last { text-align: left; }
}
</style>
