<script setup lang="ts">
/**
 * BookingShell.vue — coque visuelle des pages publiques de RDV.
 *
 * Refonte v2.319 : alignement sur la landing Cursus.
 *   - Background gradient radial indigo + emerald + dot pattern subtil.
 *   - Palette light : --bg #F5F3FF / --text #1E1B4B (lavande pale + indigo
 *     fonce, identique a landing/style.css).
 *   - Dark mode auto via prefers-color-scheme : --bg #0F0D1A / --text #F1F0FF.
 *   - Padding responsive : large desktop, plein ecran mobile.
 *
 * Les vues filles (BookingPublicView, BookingCampaignView,
 * BookingPublicEventView) montent BookingFlow dans le slot. BookingFlow
 * herite ses couleurs via --bf-* tokens definis dans son style scoped,
 * deja accordes sur la palette landing.
 */
</script>

<template>
  <div class="booking-public-shell">
    <slot />
    <p class="booking-public-shell__brand">cursus.school</p>
  </div>
</template>

<style scoped>
.booking-public-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 80% 50% at 50% 25%, rgba(99, 102, 241, 0.12), transparent 70%),
    radial-gradient(ellipse 40% 30% at 70% 60%, rgba(5, 150, 105, 0.06), transparent 60%),
    radial-gradient(circle 1px at center, rgba(99, 102, 241, 0.18) 1px, transparent 1px);
  background-color: #F5F3FF;
  background-size: 100% 100%, 100% 100%, 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 56px 16px 32px;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1E1B4B;
}

.booking-public-shell__brand {
  margin: 28px 0 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #94A3B8;
}

@media (prefers-color-scheme: dark) {
  .booking-public-shell {
    background:
      radial-gradient(ellipse 80% 50% at 50% 25%, rgba(129, 140, 248, 0.10), transparent 70%),
      radial-gradient(ellipse 40% 30% at 70% 60%, rgba(52, 211, 153, 0.05), transparent 60%),
      radial-gradient(circle 1px at center, rgba(129, 140, 248, 0.10) 1px, transparent 1px);
    background-color: #0F0D1A;
    background-size: 100% 100%, 100% 100%, 24px 24px;
    color: #F1F0FF;
  }
  .booking-public-shell__brand { color: #475569; }
}

@media (max-width: 640px) {
  .booking-public-shell { padding: 24px 0 24px; }
  .booking-public-shell__brand { display: none; }
}
</style>
