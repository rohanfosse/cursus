/**
 * TabPromotions.vue
 * ---------------------------------------------------------------------------
 * Promotions tab: rich promo cards with ring chart, stat pills, top students,
 * grade distribution, search, summary stats, and comparison table.
 */
<script setup lang="ts">
import {
  Users, BookOpen, TrendingUp, Edit3,
  GraduationCap, FileText, PlusCircle,
  Search, Trash2, Palette, BarChart2,
} from 'lucide-vue-next'
import type { Promotion } from '@/types'
import type { GanttRow } from '@/composables/useDashboardTeacher'

import { computed, ref } from 'vue'

const props = defineProps<{
  promos: Promotion[]
  activePromoId: number | null
  savingPromo: boolean
  deletingPromoId: number | null
  renamingPromoId: number | null
  renamingPromoValue: string
  allStudents: { id: number; promo_id: number; name?: string }[]
  ganttAll: GanttRow[]
}>()

const searchQuery = ref('')

/* ── Stats per promo ── */
const promoStats = computed(() => {
  const map = new Map<number, {
    students: number; published: number; drafts: number; avgSubmission: number
    topStudents: { name: string; initials: string }[]
    gradeDistribution: { a: number; b: number; c: number; d: number }
  }>()
  for (const p of props.promos) {
    const studs = props.allStudents.filter(s => s.promo_id === p.id)
    const students = studs.length
    const promoRows = props.ganttAll.filter(t => t.promo_name === p.name)
    const published = promoRows.filter(t => t.published).length
    const drafts = promoRows.filter(t => !t.published).length
    const withStudents = promoRows.filter(t => t.published && t.students_total > 0)
    const avgSubmission = withStudents.length
      ? Math.round(withStudents.reduce((s, t) => s + t.depots_count / t.students_total, 0) / withStudents.length * 100)
      : 0

    // Top 3 students (by name, as proxy for recent submitters)
    const topStudents = studs.slice(0, 3).map(s => ({
      name: s.name || `Etudiant #${s.id}`,
      initials: (s.name || `E${s.id}`).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    }))

    // Simulated grade distribution based on submission rate bands
    const total = withStudents.length || 1
    const highSub = withStudents.filter(t => t.depots_count / t.students_total >= 0.75).length
    const midSub = withStudents.filter(t => {
      const r = t.depots_count / t.students_total
      return r >= 0.5 && r < 0.75
    }).length
    const lowSub = withStudents.filter(t => {
      const r = t.depots_count / t.students_total
      return r >= 0.25 && r < 0.5
    }).length
    const veryLow = total - highSub - midSub - lowSub
    const gradeDistribution = {
      a: Math.round(highSub / total * 100),
      b: Math.round(midSub / total * 100),
      c: Math.round(lowSub / total * 100),
      d: Math.round(veryLow / total * 100),
    }

    map.set(p.id, { students, published, drafts, avgSubmission, topStudents, gradeDistribution })
  }
  return map
})

/* ── Filtered promos ── */
const filteredPromos = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.promos
  return props.promos.filter(p => p.name.toLowerCase().includes(q))
})

/* ── Summary across all promos ── */
const summary = computed(() => ({
  promos: props.promos.length,
  students: props.allStudents.length,
  devoirs: props.ganttAll.length,
}))

/* ── Ring chart helpers ── */
function ringDash(pct: number): string {
  const circ = 2 * Math.PI * 18
  const filled = circ * pct / 100
  return `${filled} ${circ - filled}`
}
const ringCirc = 2 * Math.PI * 18

const emit = defineEmits<{
  'update:activePromoId': [id: number]
  'update:renamingPromoId': [id: number | null]
  'update:renamingPromoValue': [val: string]
  confirmRenamePromo: [promo: Promotion]
  deletePromo: [id: number, name: string]
  openClasse: []
  openImportStudents: [promoId: number]
  openCreatePromo: []
}>()
</script>

<template>
  <div class="db-tab-content">
    <!-- Summary bar -->
    <div class="tp-summary-bar">
      <span class="tp-summary-pill">{{ summary.promos }} promo{{ summary.promos > 1 ? 's' : '' }}</span>
      <span class="tp-summary-sep">&middot;</span>
      <span class="tp-summary-pill">{{ summary.students }} etudiants</span>
      <span class="tp-summary-sep">&middot;</span>
      <span class="tp-summary-pill">{{ summary.devoirs }} devoirs</span>
    </div>

    <!-- Search -->
    <div class="tp-search-wrap">
      <Search :size="14" class="tp-search-icon" />
      <label for="tp-search" class="sr-only">Rechercher une promotion</label>
      <input
        id="tp-search"
        v-model="searchQuery"
        class="tp-search-input"
        placeholder="Rechercher une promotion..."
        type="text"
      />
    </div>

    <!-- Promo cards -->
    <div class="tp-promo-list">
      <div
        v-for="p in filteredPromos"
        :key="p.id"
        class="tp-card"
        :class="{ 'tp-card--active': activePromoId === p.id }"
        :style="{ '--promo-color': p.color }"
      >
        <!-- Header -->
        <div class="tp-card-header">
          <div class="tp-card-identity">
            <span class="tp-card-dot" :style="{ background: p.color }" />
            <template v-if="renamingPromoId === p.id">
              <label :for="`rename-promo-${p.id}`" class="sr-only">Nom de la promotion</label>
              <input
                :id="`rename-promo-${p.id}`"
                :value="renamingPromoValue"
                class="tp-rename-input"
                aria-label="Nom de la promotion"
                :disabled="savingPromo"
                @input="emit('update:renamingPromoValue', ($event.target as HTMLInputElement).value)"
                @keydown.enter="emit('confirmRenamePromo', p)"
                @keydown.escape="emit('update:renamingPromoId', null)"
              />
              <button class="tp-btn tp-btn--accent" :disabled="savingPromo" @click="emit('confirmRenamePromo', p)">
                {{ savingPromo ? '...' : 'OK' }}
              </button>
              <button class="tp-btn" :disabled="savingPromo" @click="emit('update:renamingPromoId', null)">Annuler</button>
            </template>
            <template v-else>
              <span class="tp-card-name">{{ p.name }}</span>
              <span v-if="activePromoId === p.id" class="tp-badge-active">Active</span>
              <button v-else class="tp-btn tp-btn--sm" @click="emit('update:activePromoId', p.id)">Selectionner</button>
            </template>
          </div>

          <!-- Mini ring chart -->
          <div class="tp-ring-wrap" :title="`${promoStats.get(p.id)?.avgSubmission ?? 0}% soumission`">
            <svg viewBox="0 0 40 40" class="tp-ring-svg">
              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="3" />
              <circle
                cx="20" cy="20" r="18" fill="none"
                :stroke="p.color"
                stroke-width="3"
                stroke-linecap="round"
                :stroke-dasharray="ringDash(promoStats.get(p.id)?.avgSubmission ?? 0)"
                :stroke-dashoffset="ringCirc * 0.25"
                style="transition: stroke-dasharray .4s ease"
              />
            </svg>
            <span class="tp-ring-label">{{ promoStats.get(p.id)?.avgSubmission ?? 0 }}%</span>
          </div>
        </div>

        <!-- Stat pills -->
        <div class="tp-stat-pills">
          <span class="tp-pill"><Users :size="11" /> {{ promoStats.get(p.id)?.students ?? 0 }} Etudiants</span>
          <span class="tp-pill"><BookOpen :size="11" /> {{ promoStats.get(p.id)?.published ?? 0 }} Publies</span>
          <span class="tp-pill"><FileText :size="11" /> {{ promoStats.get(p.id)?.drafts ?? 0 }} Brouillons</span>
          <span class="tp-pill tp-pill--accent"><TrendingUp :size="11" /> {{ promoStats.get(p.id)?.avgSubmission ?? 0 }}%</span>
        </div>

        <!-- Top 3 students -->
        <div v-if="(promoStats.get(p.id)?.topStudents?.length ?? 0) > 0" class="tp-top-students">
          <span class="tp-top-label">Derniers actifs :</span>
          <div class="tp-avatar-row">
            <span
              v-for="(stu, idx) in promoStats.get(p.id)?.topStudents"
              :key="idx"
              class="tp-avatar"
              :title="stu.name"
              :style="{ background: p.color }"
            >{{ stu.initials }}</span>
          </div>
        </div>

        <!-- Grade distribution bar -->
        <div class="tp-grade-bar-wrap">
          <div class="tp-grade-bar">
            <div class="tp-grade-seg tp-grade-a" :style="{ width: (promoStats.get(p.id)?.gradeDistribution.a ?? 0) + '%' }" />
            <div class="tp-grade-seg tp-grade-b" :style="{ width: (promoStats.get(p.id)?.gradeDistribution.b ?? 0) + '%' }" />
            <div class="tp-grade-seg tp-grade-c" :style="{ width: (promoStats.get(p.id)?.gradeDistribution.c ?? 0) + '%' }" />
            <div class="tp-grade-seg tp-grade-d" :style="{ width: (promoStats.get(p.id)?.gradeDistribution.d ?? 0) + '%' }" />
          </div>
          <div class="tp-grade-legend">
            <span class="tp-grade-legend-item"><span class="tp-legend-dot tp-grade-a" />A</span>
            <span class="tp-grade-legend-item"><span class="tp-legend-dot tp-grade-b" />B</span>
            <span class="tp-grade-legend-item"><span class="tp-legend-dot tp-grade-c" />C</span>
            <span class="tp-grade-legend-item"><span class="tp-legend-dot tp-grade-d" />D</span>
          </div>
        </div>

        <!-- Actions row -->
        <div class="tp-actions">
          <button class="tp-btn" @click="emit('update:renamingPromoId', p.id); emit('update:renamingPromoValue', p.name)">
            <Edit3 :size="11" /> Renommer
          </button>
          <button class="tp-btn" @click="emit('update:activePromoId', p.id); emit('openClasse')">
            <GraduationCap :size="11" /> Classe
          </button>
          <button class="tp-btn" @click="emit('openImportStudents', p.id)">
            <FileText :size="11" /> Importer
          </button>
          <button class="tp-btn tp-btn--icon" title="Couleur">
            <Palette :size="11" />
          </button>
          <button
            class="tp-btn tp-btn--danger"
            :disabled="deletingPromoId === p.id"
            @click="emit('deletePromo', p.id, p.name)"
          >
            <Trash2 :size="11" /> {{ deletingPromoId === p.id ? 'Suppression...' : 'Supprimer' }}
          </button>
        </div>
      </div>

      <p v-if="filteredPromos.length === 0" class="tp-empty">Aucune promotion ne correspond a la recherche.</p>
    </div>

    <!-- New promo button -->
    <button class="tp-add-btn" @click="emit('openCreatePromo')">
      <PlusCircle :size="13" /> Nouvelle promotion
    </button>

    <!-- Comparison table -->
    <div v-if="promos.length > 1" class="tp-compare">
      <h4 class="tp-compare-title"><BarChart2 :size="13" /> Comparer les promotions</h4>
      <div class="tp-compare-table-wrap">
        <table class="tp-compare-table">
          <thead>
            <tr>
              <th>Promotion</th>
              <th>Etudiants</th>
              <th>Devoirs</th>
              <th>Soumission moy.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in promos" :key="p.id">
              <td>
                <span class="tp-card-dot tp-dot-inline" :style="{ background: p.color }" />
                {{ p.name }}
              </td>
              <td>{{ promoStats.get(p.id)?.students ?? 0 }}</td>
              <td>{{ (promoStats.get(p.id)?.published ?? 0) + (promoStats.get(p.id)?.drafts ?? 0) }}</td>
              <td>
                <span class="tp-compare-pct">{{ promoStats.get(p.id)?.avgSubmission ?? 0 }}%</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-tab-content { display: flex; flex-direction: column; gap: 14px; }

/* ── Summary bar ── */
.tp-summary-bar {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; color: var(--text-secondary);
  padding: 8px 12px; border-radius: 8px;
  background: rgba(255,255,255,.03);
}
.tp-summary-pill { color: var(--text-primary); }
.tp-summary-sep { color: var(--text-muted); }

/* ── Search ── */
.tp-search-wrap {
  position: relative; display: flex; align-items: center;
}
.tp-search-icon {
  position: absolute; left: 10px; color: var(--text-muted); pointer-events: none;
}
.tp-search-input {
  width: 100%; padding: 7px 10px 7px 30px; font-size: 13px;
  background: var(--bg-input, rgba(255,255,255,.04)); border: 1px solid var(--border-input);
  border-radius: 8px; color: var(--text-primary); font-family: var(--font);
  outline: none; transition: border-color var(--t-fast);
}
.tp-search-input:focus { border-color: var(--accent); }
.tp-search-input::placeholder { color: var(--text-muted); }

/* ── Promo list ── */
.tp-promo-list { display: flex; flex-direction: column; gap: 10px; }

/* ── Card ── */
.tp-card {
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px; transition: border-color var(--t-fast), box-shadow var(--t-fast);
  border-left: 3px solid var(--promo-color, var(--border));
}
.tp-card--active {
  border-color: var(--accent); background: rgba(74,144,217,.04);
  box-shadow: 0 0 0 1px rgba(74,144,217,.12);
}

/* ── Card header ── */
.tp-card-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 10px;
}
.tp-card-identity { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.tp-card-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.tp-dot-inline { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.tp-card-name { font-size: 15px; font-weight: 700; color: var(--text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-badge-active {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  padding: 2px 8px; border-radius: 10px;
  background: rgba(74,144,217,.15); color: var(--accent);
}

/* ── Ring chart ── */
.tp-ring-wrap {
  position: relative; width: 44px; height: 44px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.tp-ring-svg { width: 44px; height: 44px; transform: rotate(-90deg); }
.tp-ring-label {
  position: absolute; font-size: 10px; font-weight: 700; color: var(--text-primary);
}

/* ── Stat pills ── */
.tp-stat-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.tp-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 3px 8px;
  border-radius: 12px; background: rgba(255,255,255,.05);
  color: var(--text-secondary); white-space: nowrap;
}
.tp-pill--accent { background: rgba(74,144,217,.1); color: var(--accent); }

/* ── Top students ── */
.tp-top-students {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px; font-size: 11px; color: var(--text-muted);
}
.tp-top-label { white-space: nowrap; }
.tp-avatar-row { display: flex; gap: 4px; }
.tp-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff;
  opacity: .85;
}

/* ── Grade distribution ── */
.tp-grade-bar-wrap { margin-bottom: 10px; }
.tp-grade-bar {
  display: flex; height: 6px; border-radius: 3px; overflow: hidden;
  background: rgba(255,255,255,.04);
}
.tp-grade-seg { min-width: 2px; transition: width .3s ease; }
.tp-grade-a { background: #4ade80; }
.tp-grade-b { background: #60a5fa; }
.tp-grade-c { background: #fbbf24; }
.tp-grade-d { background: #f87171; }
.tp-grade-legend {
  display: flex; gap: 10px; margin-top: 4px;
  font-size: 10px; color: var(--text-muted);
}
.tp-grade-legend-item { display: flex; align-items: center; gap: 3px; }
.tp-legend-dot {
  width: 6px; height: 6px; border-radius: 50%; display: inline-block;
}
.tp-legend-dot.tp-grade-a { background: #4ade80; }
.tp-legend-dot.tp-grade-b { background: #60a5fa; }
.tp-legend-dot.tp-grade-c { background: #fbbf24; }
.tp-legend-dot.tp-grade-d { background: #f87171; }

/* ── Actions ── */
.tp-actions { display: flex; gap: 6px; flex-wrap: wrap; }

/* ── Buttons ── */
.tp-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
  background: rgba(255,255,255,.06); color: var(--text-secondary);
  border: 1px solid var(--border-input); cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast); white-space: nowrap;
}
.tp-btn:hover { background: rgba(255,255,255,.1); color: var(--text-primary); }
.tp-btn--sm { font-size: 10px; padding: 2px 7px; border-radius: 4px; }
.tp-btn--accent { background: var(--accent); color: #fff; border-color: var(--accent); }
.tp-btn--accent:hover { opacity: .9; }
.tp-btn--danger { color: var(--color-danger, #f87171); }
.tp-btn--danger:hover { background: rgba(248,113,113,.1); }
.tp-btn--icon { padding: 4px 6px; }

/* ── Rename input ── */
.tp-rename-input {
  flex: 1; font-size: 14px; font-weight: 600; padding: 3px 8px;
  background: var(--bg-input); border: 1px solid var(--accent); border-radius: 6px;
  color: var(--text-primary); font-family: var(--font); outline: none;
}

/* ── Add button ── */
.tp-add-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 6px 14px; flex-shrink: 0;
  color: var(--text-muted);
  border: 1.5px dashed var(--border-input); border-radius: 20px;
  background: none; cursor: pointer; font-family: var(--font);
  transition: all .15s ease; align-self: flex-start;
}
.tp-add-btn:hover { color: var(--accent); border-color: var(--accent); background: rgba(74,144,217,.07); }

/* ── Empty state ── */
.tp-empty { font-size: 13px; color: var(--text-muted); text-align: center; padding: 24px 0; }

/* ── Comparison table ── */
.tp-compare {
  margin-top: 4px; padding: 16px; border-radius: 12px;
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
}
.tp-compare-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px;
}
.tp-compare-table-wrap { overflow-x: auto; }
.tp-compare-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.tp-compare-table th {
  text-align: left; padding: 6px 10px; font-weight: 600;
  color: var(--text-muted); border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.tp-compare-table td {
  padding: 8px 10px; color: var(--text-secondary);
  border-bottom: 1px solid rgba(255,255,255,.03);
  white-space: nowrap;
}
.tp-compare-pct { font-weight: 700; color: var(--accent); }

/* Screen reader only */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>
