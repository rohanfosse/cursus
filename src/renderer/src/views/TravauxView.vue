<script setup lang="ts">
  /**
   * TravauxView — Section Travaux
   *
   * Cette vue est un squelette structuré. Les sous-composants complexes
   * (GanttView, RendusList, StudentTravauxView) sont à implémenter.
   *
   * Référence originale : renderer/js/views/travaux-main.js, travaux.js,
   *   gantt.js, rendus.js, student-dashboard.js
   */
  import { ref, computed, onMounted, watch } from 'vue'
  import { BarChart2, List, Plus } from '@lucide/vue-next'
  import { useAppStore }     from '@/stores/app'
  import { useTravauxStore } from '@/stores/travaux'
  import { useModalsStore }  from '@/stores/modals'

  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const modals       = useModalsStore()

  const promoFilter = ref<number | null>(null)
  const promotions  = ref<{ id: number; name: string }[]>([])

  const activePromoId = computed(() => promoFilter.value ?? appStore.activePromoId)

  onMounted(async () => {
    const res = await window.api.getPromotions()
    promotions.value = res?.ok ? res.data : []
    if (!promoFilter.value && promotions.value.length) {
      promoFilter.value = promotions.value[0].id
    }
    await loadView()
  })

  async function loadView() {
    if (!activePromoId.value) return
    if (appStore.isStudent) {
      await travauxStore.fetchStudentTravaux()
    } else {
      if (travauxStore.view === 'gantt') await travauxStore.fetchGantt(activePromoId.value)
      if (travauxStore.view === 'rendus') await travauxStore.fetchRendus(activePromoId.value)
    }
  }

  watch(() => travauxStore.view, loadView)
  watch(promoFilter, loadView)
</script>

<template>
  <div id="travaux-area" class="travaux-area">
    <header class="travaux-area-header">
      <div class="travaux-area-title">
        <BarChart2 :size="18" />
        <span>Travaux</span>
      </div>

      <!-- Filtre de promo (prof) -->
      <select
        v-if="appStore.isTeacher && promotions.length"
        id="travaux-promo-filter"
        v-model="promoFilter"
        class="form-select"
        style="font-size:12px;padding:4px 8px;width:auto"
      >
        <option v-for="p in promotions" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>

      <!-- Boutons de vue (prof) -->
      <template v-if="appStore.isTeacher">
        <div class="travaux-view-btns">
          <button
            id="btn-view-gantt"
            class="btn-ghost"
            :class="{ active: travauxStore.view === 'gantt' }"
            @click="travauxStore.setView('gantt')"
          >
            <BarChart2 :size="14" /> Gantt
          </button>
          <button
            id="btn-view-rendus"
            class="btn-ghost"
            :class="{ active: travauxStore.view === 'rendus' }"
            @click="travauxStore.setView('rendus')"
          >
            <List :size="14" /> Rendus
          </button>
        </div>

        <button class="btn-primary" style="font-size:12px" @click="modals.newTravail = true">
          <Plus :size="14" /> Nouveau travail
        </button>
      </template>
    </header>

    <div class="travaux-main-content">
      <!-- ── Vue étudiant ────────────────────────────────────────────────── -->
      <div v-if="appStore.isStudent" id="student-view">
        <!-- TODO: Migrer depuis renderer/js/views/student-dashboard.js -->
        <!-- Composant cible : @/components/travaux/StudentTravauxView.vue -->
        <div class="empty-state" style="padding:40px">
          <p>
            Vue étudiant — à implémenter dans
            <code>src/renderer/src/components/travaux/StudentTravauxView.vue</code>
          </p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            Référence : <code>renderer/js/views/student-dashboard.js</code>
          </p>
          <div v-if="travauxStore.pendingTravaux.length" style="margin-top:16px;text-align:left">
            <p>{{ travauxStore.pendingTravaux.length }} travaux en attente :</p>
            <ul>
              <li v-for="t in travauxStore.pendingTravaux" :key="t.id">{{ t.title }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ── Vue Gantt (prof) ───────────────────────────────────────────── -->
      <div v-else-if="travauxStore.view === 'gantt'" id="gantt-view">
        <!-- TODO: Migrer depuis renderer/js/views/gantt.js -->
        <!-- Composant cible : @/components/travaux/GanttView.vue -->
        <div class="empty-state" style="padding:40px">
          <p>
            Diagramme de Gantt — à implémenter dans
            <code>src/renderer/src/components/travaux/GanttView.vue</code>
          </p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            Référence : <code>renderer/js/views/gantt.js</code>
            ({{ travauxStore.ganttData.length }} éléments chargés)
          </p>
        </div>
      </div>

      <!-- ── Vue Rendus (prof) ──────────────────────────────────────────── -->
      <div v-else-if="travauxStore.view === 'rendus'" id="rendus-view">
        <!-- TODO: Migrer depuis renderer/js/views/rendus.js -->
        <!-- Composant cible : @/components/travaux/RendusList.vue -->
        <div class="empty-state" style="padding:40px">
          <p>
            Liste des rendus — à implémenter dans
            <code>src/renderer/src/components/travaux/RendusList.vue</code>
          </p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            Référence : <code>renderer/js/views/rendus.js</code>
            ({{ travauxStore.allRendus.length }} rendus chargés)
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
