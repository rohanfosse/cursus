<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  Clock, CheckCircle2, CalendarDays, Award, AlertTriangle, Upload, Search,
} from 'lucide-vue-next'
import { useTravauxStore } from '@/stores/travaux'
import { useAppStore }     from '@/stores/app'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { formatDate, deadlineClass, deadlineLabel } from '@/utils/date'
import Modal from '@/components/ui/Modal.vue'
import type { Devoir } from '@/types'

defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [v: boolean] }>()

const travauxStore = useTravauxStore()
const appStore     = useAppStore()

const now = ref(Date.now())
let clockInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => { clockInterval = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => { if (clockInterval) clearInterval(clockInterval) })

const TYPE_LABELS: Record<string, string> = {
  livrable: 'Livrable', soutenance: 'Soutenance', cctl: 'CCTL',
  etude_de_cas: 'Étude de cas', memoire: 'Mémoire', autre: 'Autre',
}

// ── Filters & search ────────────────────────────────────────────────────────
type FilterTab = 'all' | 'pending' | 'done' | 'event'
const activeFilter = ref<FilterTab>('all')
const searchQuery  = ref('')

// Legend toggle filters
const legendFilters = ref<Record<string, boolean>>({
  done: true, urgent: true, overdue: true, event: true, pending: true,
})
function toggleLegend(key: string) { legendFilters.value[key] = !legendFilters.value[key] }

// Countdown helper
function countdownLabel(deadline: string): string | null {
  const diff = new Date(deadline).getTime() - now.value
  if (diff <= 0) return null
  const hours = Math.ceil(diff / 3_600_000)
  if (hours < 1) return "moins d'1h"
  if (hours < 24) return `dans ${hours}h`
  const days = Math.ceil(diff / 86_400_000)
  if (days < 3) return `dans ${days}j ${hours % 24}h`
  return `dans ${days}j`
}

// Tous les devoirs triés chronologiquement
const sorted = computed(() => {
  let list = travauxStore.devoirs.slice()

  // Tab filter
  if (activeFilter.value === 'pending') list = list.filter(t => t.depot_id == null && !isEventType(t))
  else if (activeFilter.value === 'done') list = list.filter(t => t.depot_id != null)
  else if (activeFilter.value === 'event') list = list.filter(t => isEventType(t))

  // Search filter
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter(t => t.title.toLowerCase().includes(q))

  // Legend filter
  list = list.filter(t => legendFilters.value[statusIcon(t)])

  return list.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
})

// Grouper par mois
const byMonth = computed(() => {
  const map = new Map<string, Devoir[]>()
  for (const t of sorted.value) {
    const key = new Date(t.deadline).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return map
})

function isExpired(d: string)  { return now.value >= new Date(d).getTime() }
function isEventType(t: Devoir){ return t.type === 'soutenance' || t.type === 'cctl' }
function isOverdue(t: Devoir)  { return t.depot_id == null && !isEventType(t) && isExpired(t.deadline) }
function isUrgent(t: Devoir)   {
  if (t.depot_id != null || isExpired(t.deadline) || isEventType(t)) return false
  return new Date(t.deadline).getTime() - now.value < 3 * 86_400_000
}

function statusIcon(t: Devoir) {
  if (t.depot_id != null) return 'done'
  if (isOverdue(t))       return 'overdue'
  if (isUrgent(t))        return 'urgent'
  if (isEventType(t))     return 'event'
  return 'pending'
}

function gradeColor(note: string | null | undefined): string {
  const n = parseFloat(note ?? '')
  if (isNaN(n))  return 'grade-letter'
  if (n >= 16)   return 'grade-a'
  if (n >= 12)   return 'grade-b'
  if (n >= 8)    return 'grade-c'
  return 'grade-d'
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Ma timeline personnelle"
    size="lg"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="stl-shell">

      <!-- Filter bar -->
      <div class="stl-filter-bar">
        <div class="stl-tabs">
          <button class="stl-tab" :class="{ active: activeFilter === 'all' }" @click="activeFilter = 'all'">Tous</button>
          <button class="stl-tab" :class="{ active: activeFilter === 'pending' }" @click="activeFilter = 'pending'">À rendre</button>
          <button class="stl-tab" :class="{ active: activeFilter === 'done' }" @click="activeFilter = 'done'">Rendus</button>
          <button class="stl-tab" :class="{ active: activeFilter === 'event' }" @click="activeFilter = 'event'">Événements</button>
        </div>
        <div class="stl-search-wrap">
          <Search :size="12" class="stl-search-icon" />
          <input v-model="searchQuery" class="stl-search" placeholder="Rechercher un devoir..." type="text" />
        </div>
      </div>

      <div v-if="travauxStore.loading" class="stl-loading">
        <div v-for="i in 5" :key="i" class="skel-card">
          <div class="skel skel-line skel-w30" style="height:10px" />
          <div class="skel skel-line skel-w70" style="height:14px;margin-top:6px" />
        </div>
      </div>

      <div v-else-if="!sorted.length" class="stl-empty">
        <CalendarDays :size="36" class="stl-empty-icon" />
        <p>Aucun devoir pour le moment.</p>
      </div>

      <template v-else>
        <!-- Légende (clickable to toggle) -->
        <div class="stl-legend">
          <span class="stl-leg-item stl-leg-done" :class="{ 'stl-leg-off': !legendFilters.done }" @click="toggleLegend('done')"><CheckCircle2 :size="11" /> Rendu</span>
          <span class="stl-leg-item stl-leg-urgent" :class="{ 'stl-leg-off': !legendFilters.urgent }" @click="toggleLegend('urgent')"><AlertTriangle :size="11" /> Urgent</span>
          <span class="stl-leg-item stl-leg-overdue" :class="{ 'stl-leg-off': !legendFilters.overdue }" @click="toggleLegend('overdue')"><Clock :size="11" /> En retard</span>
          <span class="stl-leg-item stl-leg-event" :class="{ 'stl-leg-off': !legendFilters.event }" @click="toggleLegend('event')"><CalendarDays :size="11" /> Événement</span>
          <span class="stl-leg-item stl-leg-pending" :class="{ 'stl-leg-off': !legendFilters.pending }" @click="toggleLegend('pending')"><Upload :size="11" /> À rendre</span>
        </div>

        <!-- Mois groupés -->
        <div class="stl-months">
          <div v-for="[month, items] in byMonth" :key="month" class="stl-month-group">
            <div class="stl-month-label">{{ month }}</div>

            <div class="stl-timeline">
              <div
                v-for="t in items"
                :key="t.id"
                class="stl-row"
                :class="`stl-row--${statusIcon(t)}`"
              >
                <!-- Point de timeline -->
                <div class="stl-dot-wrap">
                  <div class="stl-dot" :class="`stl-dot--${statusIcon(t)}`" />
                  <div class="stl-line-v" />
                </div>

                <!-- Contenu -->
                <div class="stl-card">
                  <div class="stl-card-top">
                    <span class="stl-type-badge" :class="`type-${t.type}`">
                      {{ TYPE_LABELS[t.type] ?? t.type }}
                    </span>
                    <span class="stl-card-title">{{ t.title }}</span>

                    <!-- Statut -->
                    <template v-if="t.depot_id != null">
                      <CheckCircle2 :size="14" class="stl-status-done" />
                    </template>
                    <template v-else-if="isOverdue(t)">
                      <span class="stl-badge stl-badge-overdue"><Clock :size="10" /> Retard</span>
                    </template>
                    <template v-else-if="isUrgent(t)">
                      <span class="stl-badge stl-badge-urgent" :class="deadlineClass(t.deadline)">
                        <AlertTriangle :size="10" /> {{ deadlineLabel(t.deadline) }}
                      </span>
                    </template>
                  </div>

                  <div class="stl-card-meta">
                    <!-- Projet -->
                    <span v-if="t.category" class="stl-proj-pill">
                      <component
                        v-if="parseCategoryIcon(t.category).icon"
                        :is="parseCategoryIcon(t.category).icon!"
                        :size="10"
                      />
                      {{ parseCategoryIcon(t.category).label }}
                    </span>

                    <span class="stl-date">{{ formatDate(t.deadline) }}</span>
                    <span
                      v-if="countdownLabel(t.deadline)"
                      class="countdown-badge"
                      :class="new Date(t.deadline).getTime() - now < 3 * 86_400_000 ? 'countdown-urgent' : new Date(t.deadline).getTime() - now < 7 * 86_400_000 ? 'countdown-soon' : 'countdown-ok'"
                    >{{ countdownLabel(t.deadline) }}</span>

                    <!-- Note -->
                    <span v-if="t.note" class="stl-grade-badge" :class="gradeColor(t.note)">
                      <Award :size="10" /> {{ t.note }}
                    </span>
                  </div>

                  <!-- Feedback -->
                  <div v-if="t.feedback" class="stl-feedback">
                    « {{ t.feedback }} »
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </Modal>
</template>

<style scoped>
.stl-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
}

/* Filter bar */
.stl-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding-bottom: 10px;
}
.stl-tabs { display: flex; gap: 4px; }
.stl-tab {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font);
  transition: all .15s;
}
.stl-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.stl-tab.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }

.stl-search-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 140px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}
.stl-search-icon { color: var(--text-muted); flex-shrink: 0; }
.stl-search {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 11.5px;
  font-family: var(--font);
  outline: none;
}
.stl-search::placeholder { color: var(--text-muted); }

/* Légende */
.stl-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.stl-leg-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: opacity .15s;
}
.stl-leg-off { opacity: .35; text-decoration: line-through; }
.stl-leg-done    { background: rgba(39,174,96,.1);   color: var(--color-success); }
.stl-leg-urgent  { background: rgba(243,156,18,.1);  color: var(--color-warning); }
.stl-leg-overdue { background: rgba(231,76,60,.1);   color: var(--color-danger);  }
.stl-leg-event   { background: rgba(155,135,245,.1); color: var(--color-cctl); }
.stl-leg-pending { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--border); }

/* Groupes mois */
.stl-months { display: flex; flex-direction: column; gap: 20px; }

.stl-month-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

/* Timeline verticale */
.stl-timeline { display: flex; flex-direction: column; gap: 0; }

.stl-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
}

.stl-dot-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 16px;
}
.stl-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
  margin-top: 6px;
  transition: background .15s;
}
.stl-dot--done    { background: var(--color-success); border-color: var(--color-success); }
.stl-dot--overdue { background: var(--color-danger);  border-color: var(--color-danger);  }
.stl-dot--urgent  { background: var(--color-warning); border-color: var(--color-warning); }
.stl-dot--event   { background: #9B87F5;              border-color: var(--color-cctl);              }
.stl-dot--pending { background: var(--bg-secondary);  border-color: var(--border);        }

.stl-line-v {
  width: 1px;
  flex: 1;
  min-height: 12px;
  background: var(--border);
  opacity: .5;
}
.stl-row:last-child .stl-line-v { display: none; }

/* Carte */
.stl-card {
  flex: 1;
  min-width: 0;
  padding: 8px 12px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.stl-row--done    .stl-card { opacity: .7; }
.stl-row--overdue .stl-card { border-color: rgba(231,76,60,.3);   background: rgba(231,76,60,.04); }
.stl-row--urgent  .stl-card { border-color: rgba(243,156,18,.3);  background: rgba(243,156,18,.04); }
.stl-row--event   .stl-card { border-color: rgba(155,135,245,.25); }

.stl-card-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.stl-type-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
}
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

.stl-card-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
}

.stl-status-done { color: var(--color-success); margin-left: auto; flex-shrink: 0; }

.stl-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  margin-left: auto;
}
.stl-badge-overdue { background: rgba(231,76,60,.12);  color: var(--color-danger);  }
.stl-badge-urgent  { background: rgba(243,156,18,.12); color: var(--color-warning); }

.stl-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.stl-proj-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(155,135,245,.1);
  color: var(--color-cctl);
}
.stl-date { font-size: 11px; color: var(--text-muted); }

.stl-grade-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}
.grade-a { background: rgba(39,174,96,.15);  color: var(--color-success); }
.grade-b { background: rgba(74,144,217,.15); color: var(--accent); }
.grade-c { background: rgba(243,156,18,.15); color: var(--color-warning); }
.grade-d { background: rgba(231,76,60,.15);  color: var(--color-danger); }
.grade-letter { background: rgba(155,135,245,.15); color: var(--color-cctl); }

.stl-feedback {
  font-size: 11.5px;
  font-style: italic;
  color: var(--text-secondary);
  padding-top: 2px;
  line-height: 1.4;
}

/* Loading */
.stl-loading { display: flex; flex-direction: column; gap: 10px; }

/* Empty */
.stl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;
}
.stl-empty-icon { opacity: .3; color: var(--text-muted); }
</style>
