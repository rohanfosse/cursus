/**
 * WidgetLumenProgress.vue — Progression de lecture des cours Lumen de
 * l'etudiant. Affiche un ring gauge avec le % lu et un compteur X/Y.
 * Cliquable pour ouvrir la vue Lumen.
 */
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { TrendingUp, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useLumenStore } from '@/stores/lumen'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()
const lumenStore = useLumenStore()

onMounted(async () => {
  // Charge les cours + unread si pas deja fait (widget peut se monter avant
  // que LumenView ne s'ouvre).
  const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
  if (!promoId) return
  if (lumenStore.courses.length === 0) {
    await lumenStore.fetchCoursesForPromo(promoId)
  }
  if (lumenStore.unreadCourses.length === 0 && lumenStore.unreadCount === 0) {
    await lumenStore.fetchUnread(promoId)
  }
})

const stats = computed(() => {
  const publishedCount = lumenStore.courses.filter(c => c.status === 'published').length
  if (publishedCount === 0) return null
  const readCount = Math.max(0, publishedCount - lumenStore.unreadCount)
  const percent = Math.round((readCount / publishedCount) * 100)
  return { readCount, publishedCount, percent }
})

function goToLumen() { router.push('/lumen') }

// Ring gauge : circonference = 2 * PI * r. r = 28, c = 175.93
const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const dashOffset = computed(() => {
  if (!stats.value) return CIRCUMFERENCE
  return CIRCUMFERENCE * (1 - stats.value.percent / 100)
})
</script>

<template>
  <div
    class="dashboard-card sa-card sa-lumen-progress"
    :class="{ 'sa-lumen-progress--empty': !stats }"
    role="button"
    tabindex="0"
    aria-label="Voir ma progression Lumen"
    @click="goToLumen"
    @keydown.enter="goToLumen"
    @keydown.space.prevent="goToLumen"
  >
    <div class="sa-card-header">
      <TrendingUp :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Progression Lumen</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </div>

    <div v-if="stats" class="sa-lumen-progress-body">
      <svg
        class="sa-lumen-progress-ring"
        viewBox="0 0 64 64"
        role="img"
        :aria-label="`Progression : ${stats.readCount} cours lus sur ${stats.publishedCount}, soit ${stats.percent} pourcent`"
      >
        <circle
          class="sa-lumen-progress-track"
          cx="32" cy="32" :r="RADIUS"
          fill="none" stroke-width="6"
        />
        <circle
          class="sa-lumen-progress-fill"
          cx="32" cy="32" :r="RADIUS"
          fill="none" stroke-width="6"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="36" text-anchor="middle" class="sa-lumen-progress-text" aria-hidden="true">{{ stats.percent }}%</text>
      </svg>
      <div class="sa-lumen-progress-info">
        <div class="sa-lumen-progress-count">
          <strong>{{ stats.readCount }}</strong> / {{ stats.publishedCount }}
        </div>
        <div class="sa-lumen-progress-label">
          cours {{ stats.publishedCount > 1 ? 'lus' : 'lu' }}
        </div>
      </div>
    </div>

    <p v-else class="sa-lumen-progress-empty">Aucun cours publie</p>
  </div>
</template>

<style scoped>
.sa-lumen-progress { cursor: pointer; }
.sa-lumen-progress--empty { cursor: default; }

.sa-lumen-progress-body {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 4px 0;
}

.sa-lumen-progress-ring {
  width: 68px;
  height: 68px;
  flex-shrink: 0;
}
.sa-lumen-progress-track {
  stroke: var(--bg-input);
}
.sa-lumen-progress-fill {
  stroke: var(--accent);
  transition: stroke-dashoffset 400ms ease-out;
}
.sa-lumen-progress-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  font-weight: 800;
  fill: var(--text-primary);
}

.sa-lumen-progress-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sa-lumen-progress-count {
  font-size: 18px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.sa-lumen-progress-count strong {
  color: var(--accent);
  font-weight: 800;
}
.sa-lumen-progress-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sa-lumen-progress-empty {
  font-size: 12px;
  color: var(--text-muted);
  margin: 10px 4px 0;
  font-style: italic;
}

@media (prefers-reduced-motion: reduce) {
  .sa-lumen-progress-fill { transition: none; }
}
</style>
