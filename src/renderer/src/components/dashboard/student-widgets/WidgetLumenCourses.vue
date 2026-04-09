/**
 * WidgetLumenCourses.vue - Liste les cours Lumen non lus pour l'etudiant.
 * Source de verite : lumenStore.unreadCourses (alimente par le listener
 * socket dans useAppListeners et le watch sur activePromoId).
 */
<script setup lang="ts">
import { computed } from 'vue'
import { Lightbulb, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useLumenStore } from '@/stores/lumen'
import { relativeTime } from '@/utils/date'

const router = useRouter()
const lumenStore = useLumenStore()

// Limite a 3 cours pour respecter la taille compacte du widget bento.
const visibleCourses = computed(() => lumenStore.unreadCourses.slice(0, 3))
const remaining = computed(() => Math.max(0, lumenStore.unreadCount - visibleCourses.value.length))

function relativeDate(iso: string | null): string {
  return iso ? relativeTime(iso) : ''
}

function openCourse(courseId: number) {
  router.push({ name: 'lumen', query: { course: String(courseId) } })
}

function navigateToLumen() {
  router.push('/lumen')
}
</script>

<template>
  <div
    v-if="visibleCourses.length > 0"
    class="dashboard-card sa-card sa-lumen"
    role="button"
    tabindex="0"
    aria-label="Voir les cours Lumen non lus"
    @click="navigateToLumen"
    @keydown.enter="navigateToLumen"
    @keydown.space.prevent="navigateToLumen"
  >
    <div class="sa-card-header">
      <Lightbulb :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Nouveaux cours</span>
      <span class="sa-lumen-count">{{ lumenStore.unreadCount }}</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </div>
    <ul class="sa-lumen-list">
      <li
        v-for="course in visibleCourses"
        :key="course.id"
        class="sa-lumen-item"
        @click.stop="openCourse(course.id)"
        @keydown.enter.stop="openCourse(course.id)"
        tabindex="0"
        role="button"
      >
        <span class="sa-lumen-title">{{ course.title }}</span>
        <span class="sa-lumen-date sa-mono">{{ relativeDate(course.published_at) }}</span>
      </li>
    </ul>
    <p v-if="remaining > 0" class="sa-lumen-more">
      + {{ remaining }} autre{{ remaining > 1 ? 's' : '' }}
    </p>
  </div>

  <div v-else class="dashboard-card sa-card sa-lumen sa-lumen--empty">
    <div class="sa-card-header">
      <Lightbulb :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Nouveaux cours</span>
    </div>
    <p class="sa-lumen-empty">Aucun cours en attente</p>
  </div>
</template>

<style scoped>
.sa-mono { font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace; font-size: 12px; }

.sa-lumen { cursor: pointer; }
.sa-lumen--empty { cursor: default; }

.sa-lumen-count {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-xl);
  background: var(--accent-subtle);
  color: var(--accent-light);
  margin-left: auto;
  margin-right: 4px;
}

.sa-lumen-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sa-lumen-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;
  cursor: pointer;
  border-radius: var(--radius-xs);
}
.sa-lumen-item:hover {
  background: var(--bg-hover);
  padding-inline: 6px;
  margin-inline: -6px;
}

.sa-lumen-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.sa-lumen-date {
  color: var(--text-muted);
  flex-shrink: 0;
}

.sa-lumen-more {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.sa-lumen-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
  opacity: .7;
}
</style>
