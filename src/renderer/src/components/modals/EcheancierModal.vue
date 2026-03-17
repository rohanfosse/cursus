<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    Clock, AlertTriangle, Eye, FileEdit, Award, BookOpen, CheckCircle2,
  } from 'lucide-vue-next'
  import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
  import { avatarColor } from '@/utils/format'
  import { useAppStore } from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import Modal from '@/components/ui/Modal.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const travauxStore = useTravauxStore()

  type Tab = 'aNoter' | 'urgents' | 'jalons' | 'brouillons'
  const activeTab = ref<Tab>('aNoter')

  interface ANoterRow {
    depot_id: number; student_name: string; avatar_initials: string
    submitted_at: string; travail_id: number; travail_title: string
    deadline: string; channel_name: string; promo_name: string; promo_color: string
  }
  interface UrgentRow {
    id: number; title: string; deadline: string; channel_name: string
    promo_name: string; promo_color: string; depots_count: number; students_total: number
  }
  interface JalonRow {
    id: number; title: string; deadline: string; description: string | null
    channel_name: string; promo_name: string; promo_color: string
  }
  interface BrouillonRow {
    id: number; title: string; deadline: string; type: string
    channel_name: string; promo_name: string; promo_color: string
  }

  const aNoter    = ref<ANoterRow[]>([])
  const urgents   = ref<UrgentRow[]>([])
  const jalons    = ref<JalonRow[]>([])
  const brouillons = ref<BrouillonRow[]>([])
  const loading   = ref(false)

  watch(() => props.modelValue, async (open) => {
    if (open) {
      loading.value = true
      try {
        const res = await window.api.getTeacherSchedule()
        if (res?.ok) {
          const d = res.data as { aNoter: ANoterRow[]; urgents: UrgentRow[]; jalons: JalonRow[]; brouillons: BrouillonRow[] }
          aNoter.value     = d.aNoter     ?? []
          urgents.value    = d.urgents    ?? []
          jalons.value     = d.jalons     ?? []
          brouillons.value = d.brouillons ?? []
        }
      } finally {
        loading.value = false
      }
    }
  })

  const tabCounts = computed(() => ({
    aNoter:    aNoter.value.length,
    urgents:   urgents.value.length,
    jalons:    jalons.value.length,
    brouillons: brouillons.value.length,
  }))

  async function openTravail(travailId: number) {
    appStore.currentTravailId = travailId
    await travauxStore.openTravail(travailId)
    modals.gestionDevoir = true
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Échéancier" max-width="760px" @update:model-value="emit('update:modelValue', $event)">
    <div class="ech-layout">

      <!-- Onglets -->
      <div class="ech-tabs">
        <button
          v-for="tab in (['aNoter', 'urgents', 'jalons', 'brouillons'] as Tab[])"
          :key="tab"
          class="ech-tab"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          <span class="ech-tab-label">{{
            tab === 'aNoter'     ? 'À noter'    :
            tab === 'urgents'    ? 'Urgents'    :
            tab === 'jalons'     ? 'Jalons'     :
            'Brouillons'
          }}</span>
          <span v-if="tabCounts[tab]" class="ech-tab-badge" :class="`badge-${tab}`">
            {{ tabCounts[tab] }}
          </span>
        </button>
      </div>

      <!-- Contenu -->
      <div class="ech-content">

        <!-- Chargement -->
        <div v-if="loading" class="ech-loading">
          <div v-for="i in 4" :key="i" class="skel-ech-row">
            <div class="skel skel-avatar skel-avatar-sm" />
            <div class="skel skel-line skel-w60" />
            <div class="skel skel-line skel-w30" style="margin-left:auto" />
          </div>
        </div>

        <!-- ── À NOTER ── -->
        <template v-else-if="activeTab === 'aNoter'">
          <div v-if="!aNoter.length" class="ech-empty">
            <CheckCircle2 :size="32" class="ech-empty-icon" />
            <p>Tous les rendus ont été notés.</p>
          </div>
          <div v-else class="ech-list">
            <div
              v-for="r in aNoter"
              :key="r.depot_id"
              class="ech-row"
              @click="openTravail(r.travail_id)"
            >
              <div class="ech-avatar" :style="{ background: avatarColor(r.student_name) }">
                {{ r.avatar_initials }}
              </div>
              <div class="ech-row-info">
                <span class="ech-row-main">{{ r.student_name }}</span>
                <span class="ech-row-sub">{{ r.travail_title }} · #{{ r.channel_name }}</span>
              </div>
              <div class="ech-row-right">
                <span class="ech-promo-pill" :style="{ background: r.promo_color + '33', color: r.promo_color }">
                  {{ r.promo_name }}
                </span>
                <span class="ech-date">{{ formatDate(r.submitted_at) }}</span>
              </div>
              <Award :size="14" class="ech-row-action-icon" />
            </div>
          </div>
        </template>

        <!-- ── URGENTS ── -->
        <template v-else-if="activeTab === 'urgents'">
          <div v-if="!urgents.length" class="ech-empty">
            <CheckCircle2 :size="32" class="ech-empty-icon" />
            <p>Aucun devoir dû dans les 7 prochains jours.</p>
          </div>
          <div v-else class="ech-list">
            <div
              v-for="r in urgents"
              :key="r.id"
              class="ech-row"
              @click="openTravail(r.id)"
            >
              <div class="ech-urgency-dot" :class="deadlineClass(r.deadline)" />
              <div class="ech-row-info">
                <span class="ech-row-main">{{ r.title }}</span>
                <span class="ech-row-sub">#{{ r.channel_name }}</span>
              </div>
              <div class="ech-row-right">
                <span class="ech-promo-pill" :style="{ background: r.promo_color + '33', color: r.promo_color }">
                  {{ r.promo_name }}
                </span>
                <span class="ech-deadline-badge" :class="deadlineClass(r.deadline)">
                  <Clock :size="10" />{{ deadlineLabel(r.deadline) }}
                </span>
              </div>
              <div class="ech-rendus-count">
                {{ r.depots_count }}/{{ r.students_total }}
              </div>
            </div>
          </div>
        </template>

        <!-- ── JALONS ── -->
        <template v-else-if="activeTab === 'jalons'">
          <div v-if="!jalons.length" class="ech-empty">
            <BookOpen :size="32" class="ech-empty-icon" />
            <p>Aucun jalon dans les 30 prochains jours.</p>
          </div>
          <div v-else class="ech-list">
            <div
              v-for="r in jalons"
              :key="r.id"
              class="ech-row"
              @click="openTravail(r.id)"
            >
              <div class="ech-jalon-dot" :class="deadlineClass(r.deadline)" />
              <div class="ech-row-info">
                <span class="ech-row-main">{{ r.title }}</span>
                <span v-if="r.description" class="ech-row-sub">{{ r.description }}</span>
                <span class="ech-row-sub">#{{ r.channel_name }}</span>
              </div>
              <div class="ech-row-right">
                <span class="ech-promo-pill" :style="{ background: r.promo_color + '33', color: r.promo_color }">
                  {{ r.promo_name }}
                </span>
                <span class="ech-date">{{ formatDate(r.deadline) }}</span>
              </div>
              <AlertTriangle :size="14" style="color:var(--color-warning);flex-shrink:0" />
            </div>
          </div>
        </template>

        <!-- ── BROUILLONS ── -->
        <template v-else>
          <div v-if="!brouillons.length" class="ech-empty">
            <FileEdit :size="32" class="ech-empty-icon" />
            <p>Aucun brouillon en attente de publication.</p>
          </div>
          <div v-else class="ech-list">
            <div
              v-for="r in brouillons"
              :key="r.id"
              class="ech-row"
              @click="openTravail(r.id)"
            >
              <span class="ech-type-badge" :class="`type-${r.type}`">{{ r.type }}</span>
              <div class="ech-row-info">
                <span class="ech-row-main">{{ r.title }}</span>
                <span class="ech-row-sub">#{{ r.channel_name }}</span>
              </div>
              <div class="ech-row-right">
                <span class="ech-promo-pill" :style="{ background: r.promo_color + '33', color: r.promo_color }">
                  {{ r.promo_name }}
                </span>
                <span class="ech-date">{{ formatDate(r.deadline) }}</span>
              </div>
              <Eye :size="14" class="ech-row-action-icon" />
            </div>
          </div>
        </template>

      </div>
    </div>

    <div class="modal-footer ech-footer">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Fermer</button>
    </div>
  </Modal>
</template>

<style scoped>
.ech-layout {
  display: flex;
  flex-direction: column;
  min-height: 340px;
}

/* ── Onglets ── */
.ech-tabs {
  display: flex;
  gap: 2px;
  padding: 10px 16px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ech-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px 9px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  transition: color var(--t-fast), border-color var(--t-fast);
  margin-bottom: -1px;
}
.ech-tab:hover { color: var(--text-secondary); }
.ech-tab.active { color: var(--text-primary); border-bottom-color: var(--accent); }

.ech-tab-label { }

.ech-tab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(255,255,255,.1);
  color: var(--text-secondary);
}
.badge-aNoter   { background: rgba(74,144,217,.2);  color: var(--accent-light); }
.badge-urgents  { background: rgba(231,76,60,.2);    color: #ff7b6b; }
.badge-jalons   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.badge-brouillons { background: rgba(255,255,255,.1); }

/* ── Contenu ── */
.ech-content {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
}

/* ── Chargement ── */
.ech-loading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 20px;
}
.skel-ech-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

/* ── Liste ── */
.ech-list {
  display: flex;
  flex-direction: column;
}

.ech-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t-fast);
}
.ech-row:last-child { border-bottom: none; }
.ech-row:hover { background: rgba(255,255,255,.03); }

.ech-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.ech-urgency-dot,
.ech-jalon-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.deadline-passed  { background: var(--color-danger); }
.deadline-critical { background: var(--color-danger); }
.deadline-soon    { background: var(--color-warning); }
.deadline-warning { background: #F39C12; }
.deadline-ok      { background: var(--color-success); }

.ech-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.type-livrable    { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance  { background: rgba(155,135,245,.2);  color: #9b87f5; }
.type-cctl        { background: rgba(231,76,60,.2);    color: #E74C3C; }
.type-etude_de_cas { background: rgba(230,126,34,.2);  color: #E67E22; }
.type-memoire     { background: rgba(39,174,96,.2);    color: #27AE60; }
.type-autre       { background: rgba(149,165,166,.2);  color: #95a5a6; }
/* backward compat */
.type-devoir { background: rgba(74,144,217,.2);  color: var(--accent); }
.type-projet { background: rgba(155,135,245,.2); color: #9b87f5; }
.type-jalon  { background: rgba(243,156,18,.2);  color: var(--color-warning); }

.ech-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ech-row-main {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ech-row-sub {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ech-row-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.ech-promo-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}

.ech-date {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.ech-deadline-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
}
.ech-deadline-badge.deadline-passed,
.ech-deadline-badge.deadline-critical {
  background: rgba(231,76,60,.15);
  color: #ff7b6b;
}
.ech-deadline-badge.deadline-soon {
  background: rgba(243,156,18,.15);
  color: var(--color-warning);
}
.ech-deadline-badge.deadline-warning {
  background: rgba(243,156,18,.1);
  color: #F39C12;
}
.ech-deadline-badge.deadline-ok {
  background: rgba(39,174,96,.1);
  color: var(--color-success);
}

.ech-rendus-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;
}

.ech-row-action-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color var(--t-fast);
}
.ech-row:hover .ech-row-action-icon { color: var(--accent); }

/* ── Empty ── */
.ech-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 20px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}
.ech-empty-icon { opacity: .35; }

/* ── Footer ── */
.ech-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
