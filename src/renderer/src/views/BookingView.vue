<script setup lang="ts">
/**
 * BookingView.vue — vue racine de l'onglet Rendez-vous (cote prof).
 *
 * Auparavant accessible via Dashboard > tab "Rendez-vous", la page est
 * promue en route top-level `/booking` (cf. NavRail) parce qu'elle est
 * devenue une vraie page d'accueil dediee (stats, callout, 3 sections,
 * raccourci Ctrl+N) qui merite son propre URL et un acces 1-clic.
 *
 * Ne charge que ce dont TabBooking a besoin (allStudents) au lieu de
 * remonter tout `useDashboardTeacher`.
 */
import { ref, onMounted } from 'vue'
import TabBooking from '@/components/dashboard/TabBooking.vue'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'

interface BookingStudent { id: number; name?: string; email?: string; promo_id?: number }

const allStudents = ref<BookingStudent[]>([])

onMounted(async () => {
  try {
    const res = await window.api.getAllStudents()
    if (res?.ok && Array.isArray(res.data)) {
      allStudents.value = res.data as BookingStudent[]
    }
  } catch { /* erreur silencieuse : TabBooking gere son propre etat */ }
})
</script>

<template>
  <ErrorBoundary label="Rendez-vous">
    <div class="booking-view">
      <TabBooking :all-students="allStudents" />
    </div>
  </ErrorBoundary>
</template>

<style scoped>
.booking-view {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl);
  background: var(--bg-main);
}
@media (max-width: 720px) {
  .booking-view { padding: var(--space-md); }
}
</style>
