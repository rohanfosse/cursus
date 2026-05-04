/** Leaderboard.vue - Classement en direct style Kahoot (complet avec barres de progression) */
<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { ChevronDown, ChevronUp, MessageSquare, Copy, PartyPopper } from 'lucide-vue-next'
  import { medal } from '@/utils/liveActivity'
  import type { LeaderboardEntry } from '@/types'
  import { useAppStore } from '@/stores/app'
  import { useToast } from '@/composables/useToast'
  import { useContextMenu } from '@/composables/useContextMenu'
  import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

  const props = defineProps<{
    entries: LeaderboardEntry[]
  }>()

  const showAll = ref(false)

  // v2.277 : detection des students ayant gagne des points ce round pour
  // declencher un "pulse" visuel + score-pop animation. Le composable parent
  // passe `pointsThisRound` quand une nouvelle reponse arrive ; on tracke
  // l'id pour ne re-animer que ces lignes-la.
  const recentlyScored = ref<Set<string>>(new Set())
  watch(() => props.entries.map(e => `${e.studentId}:${e.pointsThisRound ?? 0}`), (next, prev) => {
    if (!prev) return
    const newScorers = new Set<string>()
    next.forEach((token, idx) => {
      const prevToken = prev[idx]
      const entry = props.entries[idx]
      if (!entry) return
      if (token !== prevToken && (entry.pointsThisRound ?? 0) > 0) {
        newScorers.add(entry.studentId)
      }
    })
    if (newScorers.size > 0) {
      recentlyScored.value = newScorers
      setTimeout(() => { recentlyScored.value = new Set() }, 1000)
    }
  })

  const displayEntries = computed(() =>
    showAll.value ? props.entries : props.entries.slice(0, 5),
  )

  const maxPoints = computed(() =>
    props.entries.reduce((max, e) => Math.max(max, e.points), 1),
  )

  const RANK_COLORS = ['#eab308', '#94a3b8', '#c2884d']

  const appStore = useAppStore()
  const { showToast } = useToast()
  const { ctx, open: openCtx, close: closeCtx } = useContextMenu<LeaderboardEntry>()
  const ctxItems = computed<ContextMenuItem[]>(() => {
    const en = ctx.value?.target
    if (!en) return []
    const items: ContextMenuItem[] = [
      { label: 'Copier le nom', icon: Copy, action: async () => {
        await navigator.clipboard.writeText(en.name)
        showToast('Nom copié.', 'success')
      } },
      { label: `Copier le score (${en.points})`, icon: Copy, action: async () => {
        await navigator.clipboard.writeText(String(en.points))
        showToast('Score copié.', 'success')
      } },
    ]
    if (appStore.isTeacher) {
      items.push({ label: 'Envoyer un message', icon: MessageSquare, separator: true, action: () => {
        const pid = appStore.activePromoId
        if (!pid) return
        appStore.openDm(en.studentId, pid, en.name)
      } })
      items.push({ label: 'Encourager', icon: PartyPopper, action: () => {
        const pid = appStore.activePromoId
        if (!pid) return
        appStore.openDm(en.studentId, pid, en.name)
        showToast(`Conversation ouverte avec ${en.name}.`, 'info')
      } })
    }
    return items
  })
</script>

<template>
  <div class="leaderboard">
    <h3 class="lb-title">Classement</h3>
    <TransitionGroup name="lb-row" tag="div" class="lb-list">
      <div
        v-for="(entry, i) in displayEntries"
        :key="entry.studentId"
        class="lb-row"
        :class="{
          'lb-top': entry.rank <= 3,
          'lb-recent-score': recentlyScored.has(entry.studentId),
        }"
        :style="{ animationDelay: `${i * 60}ms` }"
        @contextmenu="openCtx($event, entry)"
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
                background: entry.rank <= 3 ? RANK_COLORS[entry.rank - 1] : 'var(--color-live)',
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

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
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
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  color: var(--color-live);
  text-transform: uppercase;
  letter-spacing: .06em;
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
  border-radius: var(--radius);
  transition: all 0.4s cubic-bezier(.25,.8,.25,1);
  position: relative;
  overflow: hidden;
}
.lb-row::after {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--color-live); opacity: 0;
  transition: opacity .3s;
}
.lb-row:hover {
  border-color: color-mix(in srgb, var(--color-live) 30%, var(--border));
  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-live) 12%, transparent);
}
.lb-row.lb-top {
  background: linear-gradient(135deg, rgba(234,179,8,.08), rgba(234,179,8,.02));
  border-color: rgba(234,179,8,.25);
}
.lb-row.lb-top::after { background: #eab308; opacity: .7; }
.lb-row:hover::after { opacity: 1; }
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
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
}
.lb-round-pts {
  font-size: 12px;
  font-weight: 700;
  color: #22c55e;
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  animation: lb-pts-pop .4s cubic-bezier(.34,1.56,.64,1);
}
@keyframes lb-pts-pop {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.lb-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: var(--radius-sm);
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

/* v2.277 : pulse on score change. Quand un etudiant marque ce round
   (pointsThisRound > 0), le row "respire" pendant 1s. Cf. Wooclap /
   Mentimeter qui font remonter visuellement les nouvelles reponses. */
.lb-row.lb-recent-score {
  animation: lb-row-pulse 1s ease-out;
}
@keyframes lb-row-pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
    background: rgba(34, 197, 94, 0.10);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
    background: rgba(34, 197, 94, 0.06);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    background: var(--bg-elevated);
  }
}
.lb-row.lb-recent-score.lb-top {
  /* Garde le fond gradient gold mais ajoute le glow vert */
  animation-name: lb-row-pulse-top;
}
@keyframes lb-row-pulse-top {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lb-row.lb-recent-score {
    animation: none;
    background: rgba(34, 197, 94, 0.10);
  }
}
</style>
