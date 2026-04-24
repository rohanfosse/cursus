/** PollRenderer — affichage + vote sur un sondage embarque dans un message. */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { BarChart3, Check, Users, Lock } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { totalVotes, voterChoices, type PollDefinition, type PollVotes } from '@/utils/poll'
import type { Message } from '@/types'

interface Props {
  msg: Message
  definition: PollDefinition
}

const props = defineProps<Props>()

const appStore = useAppStore()
const messagesStore = useMessagesStore()

const votesState = computed<PollVotes>(() => {
  const raw = props.msg.poll_votes
  if (!raw) return { totals: Array(props.definition.o.length).fill(0), voters: {} }
  try {
    const parsed = JSON.parse(raw) as PollVotes
    if (parsed && Array.isArray(parsed.totals)) return parsed
  } catch { /* ignore */ }
  return { totals: Array(props.definition.o.length).fill(0), voters: {} }
})

const total = computed(() => totalVotes(votesState.value))

// Clef utilisateur : l ID signe (positif etudiant, negatif prof) cote serveur.
// Cote client on a currentUser.id (signe). Stringify pour matcher la clef DB.
const myKey = computed(() => String(appStore.currentUser?.id ?? ''))

const mySelection = computed<number[]>(() => {
  if (!myKey.value) return []
  return voterChoices(votesState.value, myKey.value)
})

const hasVoted = computed(() => mySelection.value.length > 0)

// Etat optimiste : pendant le vote on desactive les boutons
const voting = ref(false)

function percent(index: number): number {
  if (total.value === 0) return 0
  return Math.round((votesState.value.totals[index] ?? 0) / total.value * 100)
}

function isSelected(index: number): boolean {
  return mySelection.value.includes(index)
}

async function onVote(index: number) {
  if (voting.value || !myKey.value) return
  voting.value = true
  try {
    let next: number[]
    if (props.definition.multi) {
      next = isSelected(index)
        ? mySelection.value.filter((i) => i !== index)
        : [...mySelection.value, index]
    } else {
      // Single-choice : toggle (revoter sur le meme = annuler)
      next = isSelected(index) ? [] : [index]
    }
    await messagesStore.voteOnPoll(props.msg.id, next)
  } finally {
    voting.value = false
  }
}

function winnerIndex(): number | null {
  if (total.value === 0) return null
  let best = 0
  let bestIdx = -1
  votesState.value.totals.forEach((n, i) => { if (n > best) { best = n; bestIdx = i } })
  return bestIdx >= 0 ? bestIdx : null
}

const winner = computed(() => winnerIndex())
</script>

<template>
  <div class="poll" :class="{ 'poll--voted': hasVoted }">
    <div class="poll-head">
      <BarChart3 :size="14" class="poll-head-icon" />
      <span class="poll-head-label">Sondage</span>
      <span v-if="definition.multi" class="poll-badge" title="Choix multiple autorise">
        Plusieurs choix
      </span>
      <span v-if="definition.anon" class="poll-badge poll-badge--anon" title="Votes anonymes">
        <Lock :size="10" /> Anonyme
      </span>
    </div>

    <h4 class="poll-question">{{ definition.q }}</h4>

    <div class="poll-options" role="group" :aria-label="`Options du sondage : ${definition.q}`">
      <button
        v-for="(opt, i) in definition.o"
        :key="i"
        type="button"
        class="poll-opt"
        :class="{
          'poll-opt--selected': isSelected(i),
          'poll-opt--winner':   winner === i && total > 0,
        }"
        :disabled="voting"
        :aria-pressed="isSelected(i)"
        @click="onVote(i)"
      >
        <div class="poll-opt-bar" :style="{ width: percent(i) + '%' }" aria-hidden="true" />
        <div class="poll-opt-content">
          <span class="poll-opt-check">
            <Check v-if="isSelected(i)" :size="12" />
            <span v-else class="poll-opt-check-placeholder" />
          </span>
          <span class="poll-opt-label">{{ opt }}</span>
          <span v-if="total > 0" class="poll-opt-stats">
            <span class="poll-opt-count">{{ votesState.totals[i] ?? 0 }}</span>
            <span class="poll-opt-percent">{{ percent(i) }}%</span>
          </span>
        </div>
      </button>
    </div>

    <div class="poll-footer">
      <Users :size="11" />
      <span>{{ total }} vote{{ total > 1 ? 's' : '' }}</span>
      <span v-if="!hasVoted && total > 0" class="poll-footer-hint">Cliquez une option pour voter</span>
      <span v-else-if="hasVoted && !definition.multi" class="poll-footer-hint">Recliquez pour retirer votre vote</span>
    </div>
  </div>
</template>

<style scoped>
.poll {
  margin-top: 6px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  max-width: 520px;
}

.poll-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px; font-weight: 700;
  margin-bottom: 8px;
}
.poll-head-icon { color: var(--color-success); }
.poll-head-label { color: var(--color-success); }
.poll-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 7px; border-radius: 999px;
  background: var(--bg-hover); color: var(--text-secondary);
  font-size: 10px; letter-spacing: 0; text-transform: none; font-weight: 600;
}
.poll-badge--anon { gap: 4px; }

.poll-question {
  margin: 0 0 10px 0;
  font-size: 14px; font-weight: 600;
  color: var(--text-primary); line-height: 1.35;
  word-break: break-word;
}

.poll-options {
  display: flex; flex-direction: column; gap: 6px;
}

.poll-opt {
  position: relative;
  display: block; width: 100%;
  padding: 0; margin: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-main);
  font-family: var(--font);
  font-size: 13px; color: var(--text-primary);
  cursor: pointer; overflow: hidden;
  transition: border-color .12s, background .12s;
  text-align: left;
}
.poll-opt:disabled { cursor: wait; opacity: .7; }
.poll-opt:hover:not(:disabled) { border-color: var(--accent); }

.poll-opt--selected {
  border-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 10%, transparent);
}
.poll-opt--selected:hover:not(:disabled) { border-color: var(--color-success); }

.poll-opt--winner .poll-opt-label { font-weight: 700; }

.poll-opt-bar {
  position: absolute; top: 0; left: 0; bottom: 0;
  background: color-mix(in srgb, var(--color-success) 18%, transparent);
  transition: width .35s var(--ease-out, ease-out);
  pointer-events: none; z-index: 0;
}
.poll-opt--selected .poll-opt-bar {
  background: color-mix(in srgb, var(--color-success) 28%, transparent);
}

.poll-opt-content {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
}

.poll-opt-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  color: #fff;
  background: transparent;
  transition: background .15s, border-color .15s;
}
.poll-opt--selected .poll-opt-check {
  background: var(--color-success); border-color: var(--color-success);
}
.poll-opt-check-placeholder { width: 10px; height: 10px; }

.poll-opt-label {
  flex: 1; word-break: break-word; line-height: 1.35;
}

.poll-opt-stats {
  display: inline-flex; align-items: baseline; gap: 8px;
  font-variant-numeric: tabular-nums; font-size: 12px;
  color: var(--text-secondary);
}
.poll-opt-count { font-weight: 600; }
.poll-opt-percent { font-weight: 700; color: var(--text-primary); min-width: 36px; text-align: right; }

.poll-footer {
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px;
  font-size: 11.5px; color: var(--text-muted);
}
.poll-footer-hint {
  margin-left: auto; font-style: italic;
}
</style>
