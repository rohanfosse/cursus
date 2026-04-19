<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Hourglass } from 'lucide-vue-next'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

export interface NextDeadline {
  title: string
  deadline: string
}

const props = defineProps<{ nextDeadline: NextDeadline | null }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  stopTimer()
  now.value = Date.now()
  timer = setInterval(() => { now.value = Date.now() }, 60_000)
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

onMounted(() => { if (props.nextDeadline) startTimer() })
onUnmounted(stopTimer)

watch(() => props.nextDeadline, (v) => { v ? startTimer() : stopTimer() })

const remaining = computed(() => {
  if (!props.nextDeadline) return null
  const diff = new Date(props.nextDeadline.deadline).getTime() - now.value
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, total: 0 }
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return { days, hours, minutes, total: diff }
})

const colorClass = computed(() => {
  if (!remaining.value) return ''
  const ms = remaining.value.total
  if (ms > 7 * 86_400_000) return 'wcd--ok'
  if (ms > 86_400_000) return 'wcd--warn'
  return 'wcd--danger'
})
</script>

<template>
  <UiWidgetCard
    :icon="Hourglass"
    label="Prochaine échéance"
    accent-color="var(--color-countdown)"
    aria-label="Compte à rebours"
  >
    <template v-if="nextDeadline && remaining">
      <div class="wcd-value" :class="colorClass">
        {{ remaining.days }}j {{ remaining.hours }}h {{ remaining.minutes }}m
      </div>
      <p class="wcd-title">{{ nextDeadline.title }}</p>
    </template>
    <EmptyState v-else size="sm" tone="muted" title="Aucune échéance à venir" />
  </UiWidgetCard>
</template>

<style scoped>
.wcd-value {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: var(--space-xs);
}

.wcd--ok     { color: var(--color-success); }
.wcd--warn   { color: var(--color-warning); }
.wcd--danger { color: var(--color-danger); }

.wcd-title {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>
