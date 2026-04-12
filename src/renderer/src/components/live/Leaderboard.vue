/** Leaderboard.vue - Classement en direct style Kahoot (complet avec barres de progression) */
<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { ChevronDown, ChevronUp } from 'lucide-vue-next'
  import { medal } from '@/utils/liveActivity'
  import type { LeaderboardEntry } from '@/types'

  const props = defineProps<{
    entries: LeaderboardEntry[]
  }>()

  const showAll = ref(false)

  const displayEntries = computed(() =>
    showAll.value ? props.entries : props.entries.slice(0, 5),
  )

  const maxPoints = computed(() =>
    props.entries.reduce((max, e) => Math.max(max, e.points), 1),
  )

  const RANK_COLORS = ['#eab308', '#94a3b8', '#c2884d']
</script>

<template>
  <div class="leaderboard">
    <h3 class="lb-title">Classement</h3>
    <TransitionGroup name="lb-row" tag="div" class="lb-list">
      <div
        v-for="entry in displayEntries"
        :key="entry.studentId"
        class="lb-row"
        :class="{ 'lb-top': entry.rank <= 3 }"
      >
        <span class="lb-rank" :style="entry.rank <= 3 ? { color: RANK_COLORS[entry.rank - 1] } : {}">
          {{ medal(entry.rank, String) }}
        </span>
        <div class="lb-info">
          <span class="lb-name">{{ entry.name }}</span>
          <div class="lb-bar-track">
            <div
              class="lb-bar-fill"
              :style="{
                width: (entry.points / maxPoints * 100) + '%',
                background: entry.rank <= 3 ? RANK_COLORS[entry.rank - 1] : 'var(--accent)',
              }"
            />
          </div>
        </div>
        <div class="lb-scores">
          <span class="lb-points">{{ entry.points.toLocaleString() }}</span>
          <span v-if="entry.pointsThisRound && entry.pointsThisRound > 0" class="lb-round-pts">
            +{{ entry.pointsThisRound }}
          </span>
        </div>
      </div>
    </TransitionGroup>

    <button
      v-if="entries.length > 5"
      class="lb-toggle"
      @click="showAll = !showAll"
    >
      <component :is="showAll ? ChevronUp : ChevronDown" :size="14" />
      {{ showAll ? 'Voir moins' : `Voir les ${entries.length} participants` }}
    </button>
  </div>
</template>

<style scoped>
.leaderboard {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lb-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: .5px;
  text-align: center;
  margin-bottom: 4px;
}
.lb-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.lb-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 0.4s cubic-bezier(.25,.8,.25,1);
}
.lb-row.lb-top {
  background: linear-gradient(135deg, rgba(234,179,8,.06), rgba(234,179,8,.02));
  border-color: rgba(234,179,8,.15);
}
.lb-rank {
  width: 36px;
  text-align: center;
  font-size: 20px;
  font-weight: 800;
  flex-shrink: 0;
}
.lb-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.lb-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lb-bar-track {
  height: 6px;
  background: rgba(255,255,255,.04);
  border-radius: 3px;
  overflow: hidden;
}
.lb-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .6s cubic-bezier(.25,.8,.25,1);
  min-width: 2px;
}
.lb-scores {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.lb-points {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.lb-round-pts {
  font-size: 12px;
  font-weight: 700;
  color: #22c55e;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.lb-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all .15s;
}
.lb-toggle:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary, #aaa);
}

/* TransitionGroup animations */
.lb-row-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.lb-row-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.lb-row-move {
  transition: all 0.4s cubic-bezier(.25,.8,.25,1);
}
</style>
