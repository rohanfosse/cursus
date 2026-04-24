/** StudentProjetHeader.vue - Breadcrumb, back button, and project identity */
<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, Layers, CalendarDays, Users } from 'lucide-vue-next'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'

const props = defineProps<{
  projectKey: string
  projectMeta: ProjectMeta | null
  groupName: string | null
}>()

const emit = defineEmits<{ back: [] }>()

const parsed = computed(() => parseCategoryIcon(props.projectKey))

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} → ${fmt(end)}`
  if (end) return `Jusqu'au ${fmt(end)}`
  return `Depuis ${fmt(start!)}`
}
</script>

<template>
  <nav class="spf-breadcrumb">
    <button class="spf-back-btn" @click="emit('back')">
      <ChevronLeft :size="14" />
    </button>
    <span class="spf-bread-link" @click="emit('back')">Devoirs</span>
    <span class="spf-bread-sep">/</span>
    <span class="spf-bread-current">{{ parsed.label }}</span>
  </nav>

  <div class="spf-header-identity">
    <div class="spf-icon-wrap">
      <component :is="parsed.icon!" v-if="parsed.icon" :size="22" class="spf-project-icon" />
      <Layers v-else :size="22" class="spf-project-icon" />
    </div>
    <div class="spf-header-text">
      <h2 class="spf-project-name">{{ parsed.label }}</h2>
      <p v-if="projectMeta?.description" class="spf-project-desc">{{ projectMeta.description }}</p>
      <div class="spf-project-meta-row">
        <span v-if="projectMeta?.startDate || projectMeta?.endDate" class="spf-project-dates">
          <CalendarDays :size="11" />
          {{ formatDateRange(projectMeta?.startDate, projectMeta?.endDate) }}
        </span>
        <span v-if="groupName" class="spf-group-pill">
          <Users :size="11" /> {{ groupName }}
        </span>
      </div>
    </div>
  </div>
</template>
