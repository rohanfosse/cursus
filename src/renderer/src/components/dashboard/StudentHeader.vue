/**
 * StudentHeader.vue
 * Header section of the student dashboard: greeting, date, hamburger,
 * timeline and devoirs action buttons.
 */
<script setup lang="ts">
import { computed } from 'vue'
import { LayoutDashboard, CalendarDays, BookOpen, Menu } from 'lucide-vue-next'

const props = defineProps<{
  toggleSidebar?: () => void
  greetingName: string
  today: string
  urgentCount?: number
}>()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h >= 6 && h <= 17) return 'Bonjour'
  if (h >= 18 && h <= 21) return 'Bonsoir'
  return 'Bonne nuit'
})

const emit = defineEmits<{
  openStudentTimeline: []
  navigateDevoirs: []
}>()
</script>

<template>
  <div class="db-header">
    <div class="db-header-left">
      <button v-if="toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="toggleSidebar">
        <Menu :size="22" />
      </button>
      <LayoutDashboard :size="20" class="db-header-icon" />
      <div>
        <h1 class="db-title">{{ greeting }}, {{ greetingName }}</h1>
        <p class="db-date">{{ today }}</p>
      </div>
    </div>
    <div class="db-header-actions">
      <button class="btn-ghost db-echeancier-btn" @click="emit('openStudentTimeline')">
        <CalendarDays :size="14" /> Ma timeline
      </button>
      <button class="btn-ghost db-echeancier-btn" @click="emit('navigateDevoirs')">
        <BookOpen :size="14" /> Tous mes devoirs
        <span v-if="props.urgentCount" class="header-badge">{{ props.urgentCount }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.db-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.db-header-left { display: flex; align-items: center; gap: 12px; }
.db-header-icon { color: var(--accent); }
.db-title {
  font-size: 20px; font-weight: 800; line-height: 1.2;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.db-date  { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }
.db-echeancier-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 8px 14px; flex-shrink: 0; min-height: 36px; }
.header-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 10px; font-size: 10px; font-weight: 700;
  background: var(--color-danger); color: #fff;
}
.db-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
</style>
