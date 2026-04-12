/** Podium.vue - Ecran final avec podium 3 places, confettis CSS et resume de session */
<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { Trophy, Users, Zap } from 'lucide-vue-next'
  import { medal, KAHOOT_COLORS } from '@/utils/liveActivity'

  const props = defineProps<{
    top3: { name: string; points: number }[]
    totalParticipants?: number
    totalActivities?: number
    sessionTitle?: string
  }>()

  const show = ref(false)
  onMounted(() => { setTimeout(() => { show.value = true }, 100) })

  const totalPoints = computed(() => props.top3.reduce((s, p) => s + p.points, 0))

  // Reorder: [1st, 2nd, 3rd] → display [2nd, 1st, 3rd]
  function displayOrder() {
    const first  = props.top3[0] ?? { name: '-', points: 0 }
    const second = props.top3[1] ?? { name: '-', points: 0 }
    const third  = props.top3[2] ?? { name: '-', points: 0 }
    return [
      { ...second, rank: 2, height: 120 },
      { ...first,  rank: 1, height: 180 },
      { ...third,  rank: 3, height: 80 },
    ]
  }


</script>

<template>
  <div class="podium-wrapper" :class="{ visible: show }">
    <!-- Confetti -->
    <div class="confetti-container">
      <span v-for="i in 40" :key="i" class="confetti-dot" :style="{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`,
        animationDuration: `${2 + Math.random() * 2}s`,
        background: KAHOOT_COLORS[i % KAHOOT_COLORS.length],
        width: `${6 + Math.random() * 6}px`,
        height: `${6 + Math.random() * 6}px`,
      }" />
    </div>

    <h2 class="podium-title">Resultats finaux</h2>
    <p v-if="sessionTitle" class="podium-session-name">{{ sessionTitle }}</p>

    <!-- Session summary stats -->
    <div v-if="totalParticipants || totalActivities" class="podium-summary">
      <div v-if="totalParticipants" class="podium-stat">
        <Users :size="14" />
        <span>{{ totalParticipants }} participant{{ totalParticipants > 1 ? 's' : '' }}</span>
      </div>
      <div v-if="totalActivities" class="podium-stat">
        <Zap :size="14" />
        <span>{{ totalActivities }} question{{ totalActivities > 1 ? 's' : '' }}</span>
      </div>
      <div class="podium-stat">
        <Trophy :size="14" />
        <span>{{ totalPoints.toLocaleString() }} pts au total</span>
      </div>
    </div>

    <div class="podium-blocks">
      <div
        v-for="entry in displayOrder()"
        :key="entry.rank"
        class="podium-col"
      >
        <div class="podium-name">{{ entry.name }}</div>
        <div class="podium-pts">{{ entry.points.toLocaleString() }} pts</div>
        <div
          class="podium-block"
          :class="`rank-${entry.rank}`"
          :style="{ height: `${entry.height}px` }"
        >
          <span class="podium-medal">{{ medal(entry.rank) }}</span>
          <span class="podium-rank-num">{{ entry.rank }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.podium-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px 20px 20px;
  position: relative;
  overflow: hidden;
  opacity: 0;
  transform: translateY(40px);
  transition: all 0.8s cubic-bezier(.25,.8,.25,1);
}
.podium-wrapper.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Confetti */
.confetti-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.confetti-dot {
  position: absolute;
  top: -10px;
  border-radius: 50%;
  animation: confetti-fall linear infinite;
  opacity: 0.8;
}
@keyframes confetti-fall {
  0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
}

.podium-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  z-index: 1;
}
.podium-session-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  z-index: 1;
  margin: -12px 0 0;
}
.podium-summary {
  display: flex;
  gap: 16px;
  z-index: 1;
  flex-wrap: wrap;
  justify-content: center;
}
.podium-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #aaa);
  padding: 6px 14px;
  background: rgba(255,255,255,.04);
  border-radius: 20px;
}

.podium-blocks {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  z-index: 1;
}
.podium-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}
.podium-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.podium-pts {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.podium-block {
  width: 120px;
  border-radius: 12px 12px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  animation: podium-rise 0.8s cubic-bezier(.25,.8,.25,1) backwards;
}
.podium-block.rank-1 {
  background: linear-gradient(180deg, #eab308 0%, #ca8a04 100%);
  animation-delay: 0.3s;
}
.podium-block.rank-2 {
  background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
  animation-delay: 0.1s;
}
.podium-block.rank-3 {
  background: linear-gradient(180deg, #c2884d 0%, #92400e 100%);
  animation-delay: 0.5s;
}
.podium-medal {
  font-size: 32px;
}
.podium-rank-num {
  font-size: 24px;
  font-weight: 900;
  color: rgba(255,255,255,.9);
}
@keyframes podium-rise {
  from { height: 0 !important; opacity: 0; }
  to { opacity: 1; }
}
</style>
