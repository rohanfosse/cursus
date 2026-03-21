<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { Clock, BarChart2, CheckCircle2, Users } from 'lucide-vue-next'
  import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
  import { useAppStore }     from '@/stores/app'
  import { useModalsStore }  from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import Modal from '@/components/ui/Modal.vue'
  import type { Devoir } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const travauxStore = useTravauxStore()

  type FilterType = 'all' | 'soutenance' | 'livrable' | 'cctl' | 'etude_de_cas' | 'memoire' | 'autre'

  const items      = ref<(Devoir & { promo_name?: string; promo_color?: string; depots_count?: number; students_total?: number })[]>([])
  const loading    = ref(false)
  const filterType = ref<FilterType>('all')

  watch(() => props.modelValue, async (open) => {
    if (open) {
      loading.value = true
      try {
        const res = await window.api.getGanttData(appStore.activePromoId ?? undefined as unknown as number)
        items.value = res?.ok ? (res.data as typeof items.value) : []
      } finally {
        loading.value = false
      }
    }
  })

  const filtered = computed(() => {
    const all = items.value.slice().sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    return filterType.value === 'all' ? all : all.filter((t) => t.type === filterType.value)
  })

  // Grouper par mois
  const byMonth = computed(() => {
    const map = new Map<string, typeof filtered.value>()
    for (const t of filtered.value) {
      const d   = new Date(t.deadline)
      const key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  })

  const typeCounts = computed(() => ({
    all:          items.value.length,
    soutenance:   items.value.filter((t) => t.type === 'soutenance').length,
    livrable:     items.value.filter((t) => t.type === 'livrable').length,
    cctl:         items.value.filter((t) => t.type === 'cctl').length,
    etude_de_cas: items.value.filter((t) => t.type === 'etude_de_cas').length,
    memoire:      items.value.filter((t) => t.type === 'memoire').length,
    autre:        items.value.filter((t) => t.type === 'autre').length,
  }))

  async function openTravail(id: number) {
    appStore.currentTravailId = id
    await travauxStore.openTravail(id)
    modals.gestionDevoir = true
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Timeline des travaux" max-width="820px" @update:model-value="emit('update:modelValue', $event)">
    <div class="tl-layout">

      <!-- Filtres de type -->
      <div class="tl-filters">
        <button
          v-for="f in (['all', 'livrable', 'soutenance', 'cctl', 'etude_de_cas', 'memoire', 'autre'] as FilterType[])"
          :key="f"
          class="tl-filter-btn"
          :class="{ active: filterType === f, [`type-${f}`]: f !== 'all' }"
          @click="filterType = f"
        >
          {{ f === 'all' ? 'Tous' : f === 'etude_de_cas' ? 'Étude de cas' : f.charAt(0).toUpperCase() + f.slice(1) }}
          <span class="tl-filter-count">{{ typeCounts[f] }}</span>
        </button>
      </div>

      <!-- Contenu -->
      <div class="tl-content">

        <!-- Chargement -->
        <div v-if="loading" class="tl-loading">
          <div v-for="i in 5" :key="i" class="skel-tl-row">
            <div class="skel" style="width:80px;height:12px;flex-shrink:0" />
            <div class="tl-skel-dot" />
            <div class="skel skel-line skel-w60" />
          </div>
        </div>

        <!-- Vide -->
        <div v-else-if="!filtered.length" class="tl-empty">
          <BarChart2 :size="36" class="tl-empty-icon" />
          <p>Aucun travail trouvé.</p>
        </div>

        <!-- Timeline groupée par mois -->
        <div v-else class="tl-body">
          <div
            v-for="[month, monthItems] in byMonth"
            :key="month"
            class="tl-month-group"
          >
            <!-- En-tête de mois -->
            <div class="tl-month-header">
              <span class="tl-month-label">{{ month }}</span>
              <span class="tl-month-count">{{ monthItems.length }} devoir{{ monthItems.length > 1 ? 's' : '' }}</span>
            </div>

            <!-- Items du mois -->
            <div class="tl-items">
              <div
                v-for="t in monthItems"
                :key="t.id"
                class="tl-item"
                @click="openTravail(t.id)"
              >
                <!-- Date à gauche -->
                <div class="tl-item-date">
                  <span class="tl-item-day">{{ new Date(t.deadline).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }}</span>
                </div>

                <!-- Ligne + point -->
                <div class="tl-item-connector">
                  <div class="tl-line" />
                  <div class="tl-dot" :class="deadlineClass(t.deadline)" />
                </div>

                <!-- Contenu -->
                <div class="tl-item-card">
                  <div class="tl-item-top">
                    <span class="tl-type-badge" :class="`type-${t.type}`">{{ t.type }}</span>
                    <span class="tl-item-title">{{ t.title }}</span>
                    <span v-if="t.promo_name" class="tl-promo-pill"
                      :style="{ background: (t.promo_color ?? '#4A90D9') + '33', color: t.promo_color ?? '#4A90D9' }">
                      {{ t.promo_name }}
                    </span>
                  </div>
                  <div class="tl-item-meta">
                    <span class="tl-channel">#{{ t.channel_name ?? t.channel_id }}</span>
                    <span v-if="t.room" class="tl-room-badge">Salle {{ t.room }}</span>
                    <span class="tl-deadline-badge" :class="deadlineClass(t.deadline)">
                      <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
                    </span>
                    <span v-if="t.students_total != null" class="tl-rendus-count">
                      <Users :size="10" />
                      {{ t.depots_count }}/{{ t.students_total }}
                    </span>
                    <span v-if="!t.is_published" class="tl-draft-badge">Brouillon</span>
                  </div>
                  <div v-if="t.aavs" class="tl-aavs">
                    <span v-for="a in (t.aavs as string).split('\n').filter(Boolean)" :key="a" class="aav-pill">{{ a.trim() }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <div class="modal-footer tl-footer">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Fermer</button>
    </div>
  </Modal>
</template>

<style scoped>
.tl-layout {
  display: flex;
  flex-direction: column;
  min-height: 360px;
}

/* ── Filtres ── */
.tl-filters {
  display: flex;
  gap: 6px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.tl-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: 1.5px solid var(--border-input);
  border-radius: 20px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  transition: all .15s;
}
.tl-filter-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.tl-filter-btn.active { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent-light); }

.tl-filter-count {
  font-size: 10px;
  font-weight: 700;
  background: rgba(255,255,255,.1);
  padding: 1px 5px;
  border-radius: 8px;
}

/* ── Contenu ── */
.tl-content {
  flex: 1;
  overflow-y: auto;
  max-height: 500px;
}

/* Chargement */
.tl-loading { display: flex; flex-direction: column; gap: 8px; padding: 20px; }
.skel-tl-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
.tl-skel-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--border); flex-shrink: 0; }

/* Vide */
.tl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 20px;
  color: var(--text-muted);
  font-size: 13px;
}
.tl-empty-icon { opacity: .35; }

/* ── Corps ── */
.tl-body {
  padding: 8px 0 16px;
}

.tl-month-group {
  margin-bottom: 4px;
}

.tl-month-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px 6px;
  position: sticky;
  top: 0;
  background: var(--bg-main);
  z-index: 1;
}

.tl-month-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-secondary);
}

.tl-month-count {
  font-size: 11px;
  color: var(--text-muted);
}

/* Items */
.tl-items {
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}

.tl-item {
  display: flex;
  align-items: stretch;
  gap: 0;
  cursor: pointer;
}
.tl-item:hover .tl-item-card { background: rgba(255,255,255,.04); }

/* Date */
.tl-item-date {
  width: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: 10px;
  justify-content: flex-end;
  padding-right: 12px;
}

.tl-item-day {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* Connecteur (ligne + point) */
.tl-item-connector {
  width: 20px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tl-line {
  width: 2px;
  flex: 1;
  background: var(--border);
  min-height: 100%;
}

.tl-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 14px;
  border: 2px solid var(--bg-main);
  position: relative;
  z-index: 1;
}
.tl-dot.deadline-passed,
.tl-dot.deadline-critical { background: var(--color-danger); }
.tl-dot.deadline-soon     { background: var(--color-warning); }
.tl-dot.deadline-warning  { background: #F39C12; }
.tl-dot.deadline-ok       { background: var(--color-success); }

/* Carte */
.tl-item-card {
  flex: 1;
  margin: 4px 0 4px 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-sidebar);
  transition: background var(--t-fast);
  min-width: 0;
}

.tl-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.tl-type-badge {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

.tl-item-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tl-promo-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  flex-shrink: 0;
}

.tl-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tl-channel { font-size: 11px; color: var(--text-muted); }

.tl-deadline-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
}
.tl-deadline-badge.deadline-passed,
.tl-deadline-badge.deadline-critical { background: rgba(231,76,60,.12); color: #ff7b6b; }
.tl-deadline-badge.deadline-soon     { background: rgba(243,156,18,.12); color: var(--color-warning); }
.tl-deadline-badge.deadline-warning  { background: rgba(243,156,18,.08); color: #F39C12; }
.tl-deadline-badge.deadline-ok       { background: rgba(39,174,96,.1);  color: var(--color-success); }

.tl-rendus-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--text-muted);
}

.tl-draft-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(255,255,255,.08);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .3px;
}
.tl-room-badge {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-secondary);
}
.tl-aavs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.aav-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  background: rgba(74,144,217,.12);
  color: var(--accent);
}

/* Footer */
.tl-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
