/**
 * TeacherHeader.vue
 * ---------------------------------------------------------------------------
 * Header section of the teacher dashboard: greeting, date, hamburger menu,
 * promo selection chips, and stats pills row.
 */
<script setup lang="ts">
import {
  Menu, Edit3, AlertTriangle, FileText, Users,
} from 'lucide-vue-next'
import type { Promotion } from '@/types'

defineProps<{
  toggleSidebar?: () => void
  greetingName: string
  today: string
  promos: Promotion[]
  activePromoId: number | null
  aNoterCount: number
  urgentsCount: number
  brouillonsCount: number
  totalStudents: number
}>()

const emit = defineEmits<{
  'update:activePromoId': [id: number]
}>()
</script>

<template>
  <!-- En-tête compact -->
  <div class="db-header">
    <div class="db-header-left">
      <button v-if="toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="toggleSidebar">
        <Menu :size="22" />
      </button>
      <div>
        <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
        <p class="db-date">{{ today }}</p>
      </div>
    </div>
    <!-- Sélecteur de promo inline dans le header -->
    <div class="db-header-promos">
      <button
        v-for="p in promos"
        :key="p.id"
        class="db-promo-chip"
        :class="{ active: activePromoId === p.id }"
        :style="activePromoId === p.id ? { background: 'color-mix(in srgb, ' + p.color + ' 20%, transparent)', color: p.color, borderColor: p.color } : {}"
        :aria-label="`Sélectionner la promotion ${p.name}`"
        @click="emit('update:activePromoId', p.id)"
      >
        <span class="db-promo-chip-dot" :style="{ background: p.color }" />
        {{ p.name }}
      </button>
    </div>
  </div>

  <!-- Stats compactes en ligne -->
  <div class="db-stats-row">
    <div class="db-stat-pill" :class="{ 'db-stat-pill--alert': aNoterCount > 0 }">
      <Edit3 :size="14" />
      <strong>{{ aNoterCount }}</strong> à noter
    </div>
    <div class="db-stat-pill" :class="{ 'db-stat-pill--warn': urgentsCount > 0 }">
      <AlertTriangle :size="14" />
      <strong>{{ urgentsCount }}</strong> cette semaine
    </div>
    <div v-if="brouillonsCount > 0" class="db-stat-pill db-stat-pill--muted">
      <FileText :size="14" />
      <strong>{{ brouillonsCount }}</strong> brouillon{{ brouillonsCount > 1 ? 's' : '' }}
    </div>
    <div class="db-stat-pill">
      <Users :size="14" />
      <strong>{{ totalStudents }}</strong> étudiant{{ totalStudents > 1 ? 's' : '' }}
    </div>
  </div>
</template>

<style scoped>
/* ── En-tête ── */
.db-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.db-header-left { display: flex; align-items: center; gap: 12px; }
.db-title { font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.db-date  { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }

/* ── Header promos inline ── */
.db-header-promos { display: flex; gap: 6px; flex-wrap: wrap; }
.db-promo-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 600;
  background: rgba(255,255,255,.04); color: var(--text-secondary);
  border: 1.5px solid rgba(255,255,255,.08); cursor: pointer;
  font-family: var(--font); transition: all .15s;
}
.db-promo-chip:hover { background: rgba(255,255,255,.08); }
.db-promo-chip.active { font-weight: 700; }
.db-promo-chip-dot { width: 7px; height: 7px; border-radius: 50%; }

/* ── Stats compactes en ligne ── */
.db-stats-row {
  display: flex; gap: 8px; padding: 0 0 12px; flex-wrap: wrap;
}
.db-stat-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 8px; font-size: 12px;
  background: rgba(255,255,255,.03); color: var(--text-secondary);
  border: 1px solid var(--border);
}
.db-stat-pill strong { color: var(--text-primary); font-weight: 700; }
.db-stat-pill--alert { background: rgba(231,76,60,.08); border-color: rgba(231,76,60,.2); color: var(--color-danger); }
.db-stat-pill--alert strong { color: var(--color-danger); }
.db-stat-pill--warn { background: rgba(243,156,18,.08); border-color: rgba(243,156,18,.2); color: var(--color-warning); }
.db-stat-pill--warn strong { color: var(--color-warning); }
.db-stat-pill--muted { opacity: .6; }
</style>
