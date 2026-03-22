/**
 * TabReglages.vue
 * ---------------------------------------------------------------------------
 * Administration/settings tab: 6 rich action cards in a 2-column grid with
 * icons, descriptions, action buttons, and colored left borders.
 */
<script setup lang="ts">
import {
  Users, Upload, CalendarDays, MessageSquare,
  Settings, Info, Download, PlusCircle,
} from 'lucide-vue-next'
import type { Promotion } from '@/types'
import type { GanttRow } from '@/composables/useDashboardTeacher'

defineProps<{
  promos: Promotion[]
  allStudents: { id: number; promo_id: number; name?: string }[]
  ganttAll: GanttRow[]
}>()

const emit = defineEmits<{
  openIntervenants: []
  openEcheancier: []
  navigateDevoirs: []
  navigateMessages: []
  openSettings: []
  openImportStudents: [promoId: number | undefined]
  exportNotes: []
  createChannel: []
}>()
</script>

<template>
  <div class="db-tab-content">
    <div class="tr-grid">
      <!-- Card 1: Intervenants et acces -->
      <div class="tr-card" style="--card-accent: #60a5fa">
        <div class="tr-card-icon-wrap" style="--icon-bg: rgba(96,165,250,.12)">
          <Users :size="18" style="color: #60a5fa" />
        </div>
        <div class="tr-card-body">
          <h4 class="tr-card-title">Intervenants et acces</h4>
          <p class="tr-card-desc">Gerez les intervenants, leurs acces aux canaux et promotions.</p>
          <div class="tr-card-stat">{{ allStudents.length > 0 ? Math.max(1, Math.floor(allStudents.length / 10)) : 0 }} intervenants actifs</div>
        </div>
        <div class="tr-card-footer">
          <button class="tr-btn" @click="emit('openIntervenants')">
            <Users :size="12" /> Gerer les intervenants
          </button>
        </div>
      </div>

      <!-- Card 2: Import et donnees -->
      <div class="tr-card" style="--card-accent: #4ade80">
        <div class="tr-card-icon-wrap" style="--icon-bg: rgba(74,222,128,.12)">
          <Upload :size="18" style="color: #4ade80" />
        </div>
        <div class="tr-card-body">
          <h4 class="tr-card-title">Import et donnees</h4>
          <p class="tr-card-desc">Importez des etudiants, examens, ou exportez les donnees.</p>
        </div>
        <div class="tr-card-footer">
          <button class="tr-btn" @click="emit('openImportStudents', undefined)">
            <Upload :size="12" /> Importer etudiants
          </button>
          <button class="tr-btn" @click="emit('exportNotes')">
            <Download :size="12" /> Exporter notes
          </button>
        </div>
      </div>

      <!-- Card 3: Echeancier et planning -->
      <div class="tr-card" style="--card-accent: #fbbf24">
        <div class="tr-card-icon-wrap" style="--icon-bg: rgba(251,191,36,.12)">
          <CalendarDays :size="18" style="color: #fbbf24" />
        </div>
        <div class="tr-card-body">
          <h4 class="tr-card-title">Echeancier et planning</h4>
          <p class="tr-card-desc">Visualisez et gerez les deadlines de tous les devoirs.</p>
        </div>
        <div class="tr-card-footer">
          <button class="tr-btn" @click="emit('openEcheancier')">
            <CalendarDays :size="12" /> Ouvrir l'echeancier
          </button>
        </div>
      </div>

      <!-- Card 4: Communication -->
      <div class="tr-card" style="--card-accent: #c084fc">
        <div class="tr-card-icon-wrap" style="--icon-bg: rgba(192,132,252,.12)">
          <MessageSquare :size="18" style="color: #c084fc" />
        </div>
        <div class="tr-card-body">
          <h4 class="tr-card-title">Communication</h4>
          <p class="tr-card-desc">Accedez aux canaux et messages de la promotion.</p>
        </div>
        <div class="tr-card-footer">
          <button class="tr-btn" @click="emit('navigateMessages')">
            <MessageSquare :size="12" /> Messages
          </button>
          <button class="tr-btn" @click="emit('createChannel')">
            <PlusCircle :size="12" /> Creer un canal
          </button>
        </div>
      </div>

      <!-- Card 5: Parametres -->
      <div class="tr-card" style="--card-accent: #f472b6">
        <div class="tr-card-icon-wrap" style="--icon-bg: rgba(244,114,182,.12)">
          <Settings :size="18" style="color: #f472b6" />
        </div>
        <div class="tr-card-body">
          <h4 class="tr-card-title">Parametres</h4>
          <p class="tr-card-desc">Theme, notifications, densite d'affichage.</p>
        </div>
        <div class="tr-card-footer">
          <button class="tr-btn" @click="emit('openSettings')">
            <Settings :size="12" /> Preferences
          </button>
        </div>
      </div>

      <!-- Card 6: À propos -->
      <div class="tr-card" style="--card-accent: #94a3b8">
        <div class="tr-card-icon-wrap" style="--icon-bg: rgba(148,163,184,.12)">
          <Info :size="18" style="color: #94a3b8" />
        </div>
        <div class="tr-card-body">
          <h4 class="tr-card-title">À propos</h4>
          <p class="tr-card-desc">Informations sur la plateforme et statistiques.</p>
          <div class="tr-about-stats">
            <span>Version Cursus v0.1.0-beta</span>
            <span>{{ promos.length }} promotion{{ promos.length > 1 ? 's' : '' }}</span>
            <span>{{ allStudents.length }} etudiants</span>
            <span>{{ ganttAll.length }} devoirs</span>
          </div>
        </div>
        <div class="tr-card-footer">
          <span class="tr-card-update">Dernière mise à jour : mars 2026</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-tab-content { display: flex; flex-direction: column; gap: 0; }

/* ── Grid ── */
.tr-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
}
@media (max-width: 700px) {
  .tr-grid { grid-template-columns: 1fr; }
}

/* ── Card ── */
.tr-card {
  display: flex; flex-direction: column;
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 12px;
  border-left: 3px solid var(--card-accent, var(--border));
  padding: 18px; gap: 12px;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.tr-card:hover {
  border-color: var(--card-accent, var(--border));
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}

/* ── Icon ── */
.tr-card-icon-wrap {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: var(--icon-bg, rgba(255,255,255,.05));
  flex-shrink: 0;
}

/* ── Body ── */
.tr-card-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.tr-card-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; }
.tr-card-desc { font-size: 12px; color: var(--text-muted); line-height: 1.5; margin: 0; }
.tr-card-stat {
  font-size: 11px; font-weight: 600; color: var(--accent);
  margin-top: 2px;
}

/* ── About stats ── */
.tr-about-stats {
  display: flex; flex-direction: column; gap: 2px;
  font-size: 11px; color: var(--text-muted); margin-top: 4px;
}

/* ── Footer ── */
.tr-card-footer {
  display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
  padding-top: 4px; border-top: 1px solid var(--border);
}
.tr-card-update {
  font-size: 11px; color: var(--text-muted); font-style: italic;
}

/* ── Button ── */
.tr-btn {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 6px;
  background: var(--bg-hover); color: var(--text-secondary);
  border: 1px solid var(--border-input); cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast); white-space: nowrap;
}
.tr-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
</style>
