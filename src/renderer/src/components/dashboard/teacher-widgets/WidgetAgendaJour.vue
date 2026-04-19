<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarClock, Clock, MapPin, Video } from 'lucide-vue-next'
import { useAgendaStore } from '@/stores/agenda'
import { useAppStore } from '@/stores/app'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import UiWidgetHeaderLink from '@/components/ui/UiWidgetHeaderLink.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const agendaStore = useAgendaStore()
const appStore = useAppStore()

onMounted(async () => {
  if (!agendaStore.events.length) {
    const pid = appStore.activePromoId ?? 0
    await agendaStore.fetchEvents(pid)
  }
})

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate()
}

const today = new Date()

const todayEvents = computed(() => {
  return agendaStore.events
    .filter(e => isSameDay(e.start, today))
    .sort((a, b) => a.start.localeCompare(b.start))
})

const nextUpId = computed(() => {
  const now = Date.now()
  return todayEvents.value.find(e => new Date(e.end || e.start).getTime() >= now)?.id ?? null
})

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
}

function dotColor(eventType: string): string {
  switch (eventType) {
    case 'deadline':   return 'var(--color-danger)'
    case 'start_date': return 'var(--accent)'
    case 'reminder':   return 'var(--color-warning)'
    case 'outlook':    return 'var(--brand-outlook)'
    default:           return 'var(--text-muted)'
  }
}

function openTeams(joinUrl: string | null | undefined) {
  if (!joinUrl) return
  if (window.api?.openExternal) window.api.openExternal(joinUrl)
  else window.open(joinUrl, '_blank')
}

function goToAgenda() {
  router.push('/agenda')
}
</script>

<template>
  <UiWidgetCard
    :icon="CalendarClock"
    label="Aujourd’hui"
    aria-label="Agenda du jour"
  >
    <template #header-extra>
      <UiWidgetHeaderLink @click="goToAgenda" />
    </template>

    <EmptyState
      v-if="!todayEvents.length"
      size="sm"
      tone="muted"
      title="Rien aujourd’hui"
      subtitle="Profite d’une journée plus calme."
    />

    <ul v-else class="waj-list">
      <li
        v-for="ev in todayEvents.slice(0, 6)"
        :key="ev.id"
        class="waj-item"
        :class="{ 'waj-item--next': ev.id === nextUpId }"
      >
        <span class="waj-dot" :style="{ background: dotColor(ev.eventType) }" />
        <span class="waj-time">{{ fmtTime(ev.start) }}</span>
        <span class="waj-title">{{ ev.title }}</span>
        <span v-if="ev.location" class="waj-meta" :title="ev.location">
          <MapPin :size="10" /> {{ ev.location }}
        </span>
        <button
          v-if="ev.teamsJoinUrl"
          type="button"
          class="waj-join"
          aria-label="Rejoindre la visio Teams"
          @click="openTeams(ev.teamsJoinUrl)"
        >
          <Video :size="11" />
        </button>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.waj-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.waj-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  transition: background var(--motion-fast) var(--ease-out);
}
.waj-item--next {
  background: var(--accent-subtle);
  border-left-color: var(--accent);
}

.waj-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.waj-time {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.waj-title {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waj-meta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--text-2xs);
  color: var(--text-muted);
  flex-shrink: 0;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waj-join {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: var(--brand-teams);
  color: #fff;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out);
}
.waj-join:hover { background: var(--brand-teams-hover); }
.waj-join:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
