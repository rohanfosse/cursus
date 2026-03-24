/** SidebarDashboard — section dashboard de la sidebar. */
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, FolderOpen, Layers, BookOpen, BarChart2, CalendarDays, Calendar } from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useModalsStore }  from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import NewProjectModal from '@/components/modals/NewProjectModal.vue'

const props = defineProps<{
  allProjects: string[]
  projectStats: Record<string, { depots: number; expected: number }>
  getProjectColor: (key: string) => string
  activePromoObj: { name: string; color: string } | null
  recentActivity: { id: number | string; text: string; time: string }[]
}>()

const emit = defineEmits<{
  selectProject: [key: string | null]
  projectCreated: [key: string]
}>()

const appStore     = useAppStore()
const modals       = useModalsStore()
const travauxStore = useTravauxStore()
const route        = useRoute()
const router       = useRouter()

const promoSummary = computed(() => {
  const gantt = travauxStore.ganttData
  const published = gantt.filter(t => t.published)
  let depots = 0, expected = 0
  for (const t of published) {
    depots   += t.depots_count  ?? 0
    expected += t.students_total ?? 0
  }
  return {
    studentCount: 0, // simplified - parent should pass this
    devoirCount: published.length,
    submissionPct: expected > 0 ? Math.round((depots / expected) * 100) : 0,
  }
})
</script>

<template>
  <!-- Résumé promo (prof) -->
  <div v-if="appStore.isTeacher && activePromoObj" class="sb-promo-card">
    <div class="sb-promo-card-header">
      <span class="sb-promo-card-dot" :style="{ background: activePromoObj.color }" />
      <span class="sb-promo-card-name">{{ activePromoObj.name }}</span>
    </div>
    <div class="sb-promo-card-stats">
      <span>{{ promoSummary.devoirCount }} devoirs</span>
      <span class="sb-promo-card-sep">&middot;</span>
      <span>{{ promoSummary.submissionPct }}% soumis</span>
    </div>
  </div>

  <!-- Onglets -->
  <div class="sidebar-section-header">
    <span>Tableau de bord</span>
  </div>
  <nav aria-label="Onglets du tableau de bord">
    <button class="sidebar-item" :class="{ active: !route.query.tab || route.query.tab === 'projets' }" @click="router.push('/dashboard')">
      <FolderOpen :size="13" class="project-icon" />
      <span class="channel-name">Accueil</span>
    </button>
    <button class="sidebar-item" :class="{ active: route.query.tab === 'frise' }" @click="router.push({ path: '/dashboard', query: { tab: 'frise' } })">
      <BarChart2 :size="13" class="project-icon" />
      <span class="channel-name">Frise chronologique</span>
    </button>
  </nav>

  <!-- Raccourcis -->
  <div class="sidebar-section-header" style="margin-top:8px">
    <span>Raccourcis</span>
  </div>
  <nav aria-label="Raccourcis">
    <template v-if="appStore.isTeacher">
      <button class="sidebar-item" @click="modals.classe = true">
        <Layers :size="13" class="project-icon" />
        <span class="channel-name">Vue Classe</span>
      </button>
      <button class="sidebar-item" @click="modals.echeancier = true">
        <CalendarDays :size="13" class="project-icon" />
        <span class="channel-name">Échéancier</span>
      </button>
      <button class="sidebar-item" @click="router.push('/devoirs')">
        <BookOpen :size="13" class="project-icon" />
        <span class="channel-name">Tous les devoirs</span>
      </button>
      <button class="sidebar-item" :class="{ active: (route.name as string) === 'agenda' }" @click="router.push('/agenda')">
        <Calendar :size="13" class="project-icon" />
        <span class="channel-name">Calendrier</span>
      </button>
    </template>
    <template v-else-if="appStore.isStudent">
      <button class="sidebar-item" @click="modals.studentTimeline = true">
        <CalendarDays :size="13" class="project-icon" />
        <span class="channel-name">Ma timeline</span>
      </button>
      <button class="sidebar-item" @click="router.push('/devoirs')">
        <BookOpen :size="13" class="project-icon" />
        <span class="channel-name">Mes devoirs</span>
      </button>
      <button class="sidebar-item" :class="{ active: (route.name as string) === 'agenda' }" @click="router.push('/agenda')">
        <Calendar :size="13" class="project-icon" />
        <span class="channel-name">Calendrier</span>
      </button>
    </template>
  </nav>

  <!-- Projets -->
  <template v-if="allProjects.length">
    <div class="sidebar-section-header" style="margin-top:8px">
      <span>{{ appStore.isStaff ? 'Projets' : 'Mes projets' }}</span>
      <button v-if="appStore.isTeacher" class="btn-icon" title="Nouveau projet" style="padding:2px" @click="modals.newProject = true">
        <Plus :size="14" />
      </button>
    </div>
    <nav aria-label="Filtrer par projet">
      <button v-for="proj in allProjects" :key="proj" class="sidebar-item sb-project-rich" @click="emit('selectProject', proj)">
        <div class="sb-project-rich-top">
          <span class="project-color-dot" :style="{ background: getProjectColor(proj) }" />
          <component v-if="parseCategoryIcon(proj).icon" :is="parseCategoryIcon(proj).icon!" :size="13" class="project-icon" />
          <span v-else class="project-bullet" />
          <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
        </div>
        <div v-if="projectStats[proj]" class="sb-project-rich-bar-wrap">
          <div class="sb-project-rich-bar">
            <div class="sb-project-rich-bar-fill" :style="{ width: (projectStats[proj].expected > 0 ? Math.round(projectStats[proj].depots / projectStats[proj].expected * 100) : 0) + '%', background: getProjectColor(proj) }" />
          </div>
          <span class="sb-project-rich-sub">{{ projectStats[proj].depots }}/{{ projectStats[proj].expected }} soumis</span>
        </div>
      </button>
    </nav>
  </template>

  <!-- Activité récente (prof) -->
  <template v-if="appStore.isTeacher && recentActivity.length">
    <div class="sidebar-section-header" style="margin-top:8px">
      <span>Activité récente</span>
    </div>
    <div class="sb-recent-list">
      <div v-for="item in recentActivity" :key="item.id" class="sb-recent-item">
        <span class="sb-recent-text">{{ item.text }}</span>
        <span class="sb-recent-time">{{ item.time }}</span>
      </div>
    </div>
  </template>

  <NewProjectModal v-model="modals.newProject" @created="(k: string) => emit('projectCreated', k)" />
</template>
