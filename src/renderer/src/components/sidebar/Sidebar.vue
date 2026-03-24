<script setup lang="ts">
  import { ref, watch, onMounted, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Plus, ChevronDown, FolderOpen, Layers, BookOpen, BarChart2, CalendarDays, Calendar, Pencil, Trash2 } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import NewProjectModal from '@/components/modals/NewProjectModal.vue'
  import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'
  import ProjectEditPanel from './ProjectEditPanel.vue'
  import ContextMenu from '@/components/ui/ContextMenu.vue'
  import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import PromoRail          from './PromoRail.vue'
  import ChannelItem        from './ChannelItem.vue'
  import SidebarDashboard   from './SidebarDashboard.vue'
  import { avatarColor }  from '@/utils/format'

  import { useSidebarData }     from '@/composables/useSidebarData'
  import { useSidebarDm }       from '@/composables/useSidebarDm'
  import { useSidebarProjects } from '@/composables/useSidebarProjects'
  import { useSidebarActions }  from '@/composables/useSidebarActions'
  import { useSidebarNav }      from '@/composables/useSidebarNav'

  const emit = defineEmits<{ navigate: [] }>()

  const appStore = useAppStore()
  const modals   = useModalsStore()
  const route    = useRoute()
  const router   = useRouter()

  // ── Composables ───────────────────────────────────────────────────────────
  const {
    promotions, channels, students, loading, user, activePromoName,
    loadTeacherChannels, load, visibleChannels, channelGroups, sortedChannelGroups, reorderCategories, dmStudents,
    selectPromo, setLoadRecentDmContacts,
  } = useSidebarData()

  const {
    collapsed, collapsedDashboard, channelsCollapsed, dmCollapsed,
    toggleCategory, toggleDashboardProject,
    sectionShortcut, sectionLabel, channelSectionLabel, channelActionLabel,
    selectChannel,
  } = useSidebarNav(emit)

  const {
    ctx, openCtxCategory, openCtxChannel,
    mutedIds, isMuted, toggleMute,
    renamingChannelId, renamingCategory, renameValue, renameInputEl,
    cancelRename, commitRenameChannel, commitRenameCategory,
    draggingChannel, dragOverCategory,
    onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  } = useSidebarActions(loadTeacherChannels)

  const {
    recentDmContacts, showAllDmStudents,
    loadRecentDmContacts, dmContactsToShow, getDmPreview,
    selectDm, openDmContextMenu,
  } = useSidebarDm(dmStudents, ctx, emit)

  const {
    allProjects, projectStats, loadCustomProjects, loadDbProjects,
    onProjectCreated, selectProject, dashboardProjectGroups,
    editingProject, getProjectMeta, saveProjectMeta, deleteProject, getProjectColor,
  } = useSidebarProjects(visibleChannels)

  // ── Project context menu ──────────────────────────────────────────────────
  function openProjectCtx(e: MouseEvent, proj: string) {
    const isCustom = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('cc_custom_projects') ?? '[]') as string[]
        return raw.includes(proj)
      } catch { return false }
    })()

    const items: ContextMenuItem[] = [
      { label: 'Modifier', icon: Pencil, action: () => { editingProject.value = proj } },
    ]
    if (isCustom) {
      items.push({ label: 'Supprimer', icon: Trash2, danger: true, action: () => { deleteProject(proj) } })
    }

    ctx.value = { x: e.clientX, y: e.clientY, items }
  }

  // ── Drag & drop categories (reorder) ─────────────────────────────────────
  interface CategoryGroup { label: string; key: string; channels: { id: number; name: string }[] }
  const draggingCategory = ref<CategoryGroup | null>(null)

  function onCategoryDragStart(e: DragEvent, group: CategoryGroup) {
    draggingCategory.value = group
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }
  function onCategoryDragOver(e: DragEvent, _group: CategoryGroup) {
    e.preventDefault()
  }
  function onCategoryDrop(_e: DragEvent, targetGroup: CategoryGroup) {
    if (!draggingCategory.value || draggingCategory.value.key === targetGroup.key) return
    const groups = [...sortedChannelGroups.value]
    const fromIdx = groups.findIndex(g => g.key === draggingCategory.value!.key)
    const toIdx = groups.findIndex(g => g.key === targetGroup.key)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = groups.splice(fromIdx, 1)
    groups.splice(toIdx, 0, moved)
    reorderCategories(groups)
    draggingCategory.value = null
  }
  function onCategoryDragEnd() {
    draggingCategory.value = null
  }

  function onProjectEditSave(proj: string, meta: ProjectMeta) {
    saveProjectMeta(proj, meta)
    editingProject.value = null
  }

  // Wire up DM loading into data composable so load*Sidebar calls it
  setLoadRecentDmContacts(loadRecentDmContacts)

  const travauxStore = useTravauxStore()

  // ── Résumé promo (sidebar dashboard) ──────────────────────────────────────
  const activePromoObj = computed(() => promotions.value.find(p => p.id === appStore.activePromoId) ?? null)

  const promoSummary = computed(() => {
    const gantt = travauxStore.ganttData
    const published = gantt.filter(t => t.published)
    let depots = 0, expected = 0
    for (const t of published) {
      depots   += t.depots_count  ?? 0
      expected += t.students_total ?? 0
    }
    const stuCount = students.value.filter(s => s.promo_id === appStore.activePromoId && s.id > 0).length
    return {
      studentCount: stuCount,
      devoirCount: published.length,
      submissionPct: expected > 0 ? Math.round((depots / expected) * 100) : 0,
    }
  })

  // ── Activité récente (derniers rendus) ────────────────────────────────────
  const recentActivity = computed(() => {
    return travauxStore.allRendus
      .filter(r => r.submitted_at)
      .sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime())
      .slice(0, 3)
      .map(r => {
        const ago = Date.now() - new Date(r.submitted_at).getTime()
        const mins = Math.floor(ago / 60_000)
        const label = mins < 60 ? `il y a ${mins}min` : mins < 1440 ? `il y a ${Math.floor(mins / 60)}h` : `il y a ${Math.floor(mins / 1440)}j`
        return { id: r.id, text: `${r.student_name} - ${r.travail_title ?? 'devoir'}`, time: label }
      })
  })

  // ── Réactivité ────────────────────────────────────────────────────────────
  onMounted(() => {
    load(); loadCustomProjects()
    if (route.name === 'devoirs' || route.name === 'dashboard' || route.name === 'documents') loadDbProjects()
  })

  watch(() => route.name, (n) => {
    if (n === 'messages' || n === 'dashboard') load()
    if (n === 'devoirs' || n === 'dashboard' || n === 'documents') loadDbProjects()
  })
  watch(() => modals.createChannel, (open) => { if (!open) load() })
  watch(() => appStore.currentUser?.id, () => load())
  watch(() => appStore.activePromoId, () => { if (route.name === 'devoirs') loadDbProjects() })
</script>

<template>
  <div id="sidebar" class="sidebar">
    <!-- Espacement haut -->
    <div style="height:14px" />

    <!-- Section Messages -->
    <div id="sidebar-section-messages">
      <!-- Rail des promos (prof/TA) -->
      <PromoRail
        v-if="appStore.isStaff && promotions.length"
        :promotions="promotions"
        @select="selectPromo"
      />

      <!-- En-tete etudiant -->
      <div v-if="!appStore.isStaff && activePromoName" class="sb-student-header">
        <div class="sb-student-promo-icon">
          <BookOpen :size="14" />
        </div>
        <div class="sb-student-promo-text">
          <span class="sb-student-promo-name">{{ activePromoName }}</span>
          <span class="sb-student-promo-badge">Étudiant</span>
        </div>
      </div>

      <!-- Squelette de chargement -->
      <template v-if="loading">
        <div v-for="i in 5" :key="i" class="skel-list-row">
          <div class="skel skel-avatar skel-avatar-sm" />
          <div class="skel skel-line skel-w70" />
        </div>
      </template>

      <!-- Tableau de bord -->
      <template v-else-if="route.name === 'dashboard'">
        <SidebarDashboard
          :all-projects="allProjects"
          :project-stats="projectStats"
          :get-project-color="getProjectColor"
          :active-promo-obj="activePromoObj"
          :recent-activity="recentActivity"
          @select-project="selectProject"
          @project-created="onProjectCreated"
        />
      </template>

      <!-- Liste des projets (section Devoirs) -->
      <template v-else-if="route.name === 'devoirs'">
        <div class="sidebar-section-header">
          <span>{{ appStore.isStaff ? 'Projets' : 'Mes projets' }}</span>
        </div>

        <nav aria-label="Projets" class="sidebar-projects-nav">
          <!-- Accueil (tous les projets) -->
          <button
            class="sidebar-item"
            :class="{ active: appStore.activeProject === null }"
            @click="selectProject(null)"
          >
            <Layers :size="13" class="project-icon" />
            <span class="channel-name">Accueil</span>
          </button>

          <!-- Projets avec barre de progression -->
          <div v-for="proj in allProjects" :key="proj" class="sidebar-project-group">
            <button
              class="sidebar-item sb-project-rich"
              :class="{ active: appStore.activeProject === proj }"
              @click="selectProject(proj)"
              @contextmenu.prevent="openProjectCtx($event, proj)"
            >
              <div class="sb-project-rich-top">
                <span class="project-color-dot" :style="{ background: getProjectColor(proj) }" />
                <component
                  v-if="parseCategoryIcon(proj).icon"
                  :is="parseCategoryIcon(proj).icon!"
                  :size="13"
                  class="project-icon"
                />
                <span v-else class="project-bullet" />
                <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
              </div>
              <div v-if="projectStats[proj]" class="sb-project-rich-bar-wrap">
                <div class="sb-project-rich-bar">
                  <div
                    class="sb-project-rich-bar-fill"
                    :style="{ width: (projectStats[proj].expected > 0 ? Math.round(projectStats[proj].depots / projectStats[proj].expected * 100) : 0) + '%', background: getProjectColor(proj) }"
                  />
                </div>
                <span class="sb-project-rich-sub">{{ projectStats[proj].depots }}/{{ projectStats[proj].expected }} soumis</span>
              </div>
            </button>

            <!-- Inline edit panel -->
            <ProjectEditPanel
              v-if="editingProject === proj"
              :project-key="proj"
              :meta="getProjectMeta(proj)"
              :color="getProjectColor(proj)"
              @save="onProjectEditSave(proj, $event)"
              @cancel="editingProject = null"
            />
          </div>

          <!-- + Nouveau projet (prof uniquement) -->
          <button
            v-if="appStore.isTeacher"
            class="sidebar-item sidebar-add-project"
            @click="modals.newProject = true"
          >
            <Plus :size="13" class="project-icon" />
            <span class="channel-name">Nouveau projet</span>
          </button>
        </nav>

        <NewProjectModal v-if="appStore.isTeacher" v-model="modals.newProject" @created="onProjectCreated" />
      </template>

      <!-- Liste des projets (section Documents) -->
      <template v-else-if="route.name === 'documents'">
        <div class="sidebar-section-header">
          <span>{{ appStore.isStaff ? 'Projets' : 'Mes projets' }}</span>
        </div>

        <nav aria-label="Filtrer les documents par projet">
          <!-- Tous les documents -->
          <button
            class="sidebar-item"
            :class="{ active: appStore.activeProject === null }"
            @click="appStore.activeProject = null"
          >
            <FolderOpen :size="13" class="project-icon" />
            <span class="channel-name">Tous les documents</span>
          </button>

          <!-- Projets -->
          <button
            v-for="proj in allProjects"
            :key="proj"
            class="sidebar-item"
            :class="{ active: appStore.activeProject === proj }"
            @click="appStore.activeProject = proj"
          >
            <component
              v-if="parseCategoryIcon(proj).icon"
              :is="parseCategoryIcon(proj).icon!"
              :size="13"
              class="project-icon"
            />
            <span v-else class="project-bullet" />
            <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
          </button>
        </nav>
      </template>

      <!-- Salons groupes par categorie (autres sections) -->
      <template v-else>
        <!-- Spacer accent -->
        <div class="sb-accent-spacer">
          <span class="sb-accent-line" />
          <span class="sb-accent-dot" />
          <span class="sb-accent-line" />
        </div>

        <div id="sidebar-channels-header" class="sidebar-section-header sidebar-collapsible-header" @click="channelsCollapsed = !channelsCollapsed">
          <ChevronDown
            :size="12"
            class="sidebar-category-chevron"
            :class="{ rotated: channelsCollapsed }"
          />
          <span>{{ channelSectionLabel }}</span>
          <button
            v-if="appStore.isTeacher"
            class="btn-icon"
            title="Créer un canal"
            aria-label="Créer un canal"
            style="padding:2px;margin-left:auto"
            @click.stop="modals.createChannel = true"
          >
            <Plus :size="14" />
          </button>
        </div>

        <div v-show="!channelsCollapsed" class="sidebar-scroll-list">
        <div
          v-for="group in sortedChannelGroups"
          :key="group.key"
          class="sidebar-category"
          :class="{ 'drag-over': appStore.isStaff && dragOverCategory === group.key }"
          draggable="true"
          @dragstart.stop="onCategoryDragStart($event, group)"
          @dragover.prevent="onCategoryDragOver($event, group)"
          @drop.prevent="onCategoryDrop($event, group)"
          @dragend="onCategoryDragEnd"
        >
          <!-- En-tête de catégorie (affiché seulement s'il y a plusieurs groupes) -->
          <div
            v-if="sortedChannelGroups.length > 1"
            class="sidebar-category-header-wrap"
          >
            <!-- Renommage inline -->
            <div v-if="renamingCategory === group.key" class="sidebar-rename-row">
              <input
                ref="renameInputEl"
                v-model="renameValue"
                class="sidebar-rename-input"
                aria-label="Renommer"
                @keydown.enter.prevent="commitRenameCategory"
                @keydown.escape.prevent="cancelRename"
                @blur="commitRenameCategory"
              />
            </div>
            <button
              v-else
              class="sidebar-category-header"
              :aria-expanded="!collapsed.has(group.key)"
              @click="toggleCategory(group.key)"
              @contextmenu.prevent="openCtxCategory($event, group)"
            >
              <ChevronDown
                :size="10"
                class="sidebar-category-chevron"
                :class="{ rotated: collapsed.has(group.key) }"
              />
              <component
                v-if="parseCategoryIcon(group.label).icon"
                :is="parseCategoryIcon(group.label).icon!"
                :size="12"
                class="sidebar-category-icon"
              />
              <span class="sidebar-category-label">{{ parseCategoryIcon(group.label).label }}</span>
            </button>
          </div>

          <nav
            v-show="!collapsed.has(group.key)"
            :aria-label="group.label"
            class="sidebar-category-channels"
          >
            <!-- Renommage inline canal -->
            <template v-for="ch in group.channels" :key="ch.id">
              <div v-if="renamingChannelId === ch.id" class="sidebar-rename-row sidebar-rename-channel">
                <input
                  ref="renameInputEl"
                  v-model="renameValue"
                  class="sidebar-rename-input"
                aria-label="Renommer"
                  @keydown.enter.prevent="commitRenameChannel"
                  @keydown.escape.prevent="cancelRename"
                  @blur="commitRenameChannel"
                />
              </div>
              <div
                v-else
                :draggable="appStore.isStaff"
                class="channel-drag-wrap"
                :class="{ 'is-dragging': draggingChannel?.id === ch.id }"
                @dragstart="appStore.isStaff ? onDragStart($event, ch) : undefined"
                @dragend="appStore.isStaff ? onDragEnd() : undefined"
              >
                <ChannelItem
                  :channel-id="ch.id"
                  :name="ch.name"
                  :prefix="ch.type === 'annonce' ? '📢' : '#'"
                  :type="ch.type"
                  :muted="isMuted(ch.id)"
                  :is-private="!!ch.is_private"
                  :description="ch.description"
                  @click="selectChannel(ch)"
                  @contextmenu="openCtxChannel($event, ch)"
                />
              </div>
            </template>
          </nav>
        </div>
        </div><!-- /sidebar-scroll-list canaux -->

        <!-- Messages directs -->
        <template v-if="dmStudents.length">
          <div class="sidebar-separator" />
          <div class="sidebar-section-header sidebar-collapsible-header" @click="dmCollapsed = !dmCollapsed">
            <ChevronDown
              :size="12"
              class="sidebar-category-chevron"
              :class="{ rotated: dmCollapsed }"
            />
            <span>Messages directs</span>
            <button
              class="dm-toggle-btn"
              style="margin-left:auto"
              :title="showAllDmStudents ? 'Masquer' : 'Nouvelle conversation'"
              @click.stop="showAllDmStudents = !showAllDmStudents"
            >
              <Plus :size="14" />
            </button>
          </div>

          <!-- Conversations récentes + liste complète -->
          <div v-show="!dmCollapsed" class="sidebar-scroll-list">
            <nav aria-label="Messages directs">
              <button
                v-for="s in dmContactsToShow"
                :key="s.id"
                class="sidebar-item dm-item"
                :class="{
                  active:    appStore.activeDmStudentId === s.id,
                  'dm-has-unread': !!appStore.unreadDms[s.name],
                }"
                @click="selectDm(s)"
                @contextmenu.prevent="openDmContextMenu($event, s)"
              >
                <span class="dm-avatar-wrap">
                  <span class="dm-avatar" :class="{ 'dm-avatar-teacher': s.id < 0 }" :style="{ background: s.id < 0 ? 'var(--accent)' : avatarColor(s.name) }">{{ s.avatar_initials }}</span>
                  <span v-if="appStore.isUserOnline(s.name)" class="presence-dot presence-online" title="En ligne"></span>
                  <span v-else class="presence-dot presence-offline" title="Hors ligne"></span>
                </span>
                <span class="dm-info">
                  <span class="channel-name">{{ s.name }} <span v-if="appStore.isDmMuted(s.name)" class="dm-muted-icon" title="Notifications d\u00e9sactiv\u00e9es">\uD83D\uDD07</span></span>
                  <span v-if="getDmPreview(s.name)" class="dm-preview">{{ getDmPreview(s.name) }}</span>
                </span>
                <span
                  v-if="appStore.unreadDms[s.name]"
                  class="dm-unread-badge"
                >
                  {{ (appStore.unreadDms[s.name] as number) > 9 ? '9+' : appStore.unreadDms[s.name] }}
                </span>
              </button>

              <!-- Aucune conversation récente -->
              <div v-if="!dmContactsToShow.length && !showAllDmStudents" class="dm-empty">
                Aucune conversation
              </div>
            </nav>

            <!-- Liste complète (toggle) -->
            <template v-if="showAllDmStudents">
              <div class="dm-all-header">Tous les étudiants</div>
              <nav aria-label="Tous les étudiants">
                <button
                  v-for="s in dmStudents"
                  :key="'all-' + s.id"
                  class="sidebar-item"
                  :class="{ active: appStore.activeDmStudentId === s.id }"
                  @click="selectDm(s); showAllDmStudents = false"
                >
                  <span class="channel-prefix">@</span>
                  <span class="channel-name">{{ s.name }}</span>
                </button>
              </nav>
            </template>
          </div>
        </template>
      </template>
    </div>
  </div>

  <!-- Menu contextuel global sidebar -->
  <ContextMenu
    v-if="ctx"
    :x="ctx.x"
    :y="ctx.y"
    :items="ctx.items"
    @close="ctx = null"
  />
</template>

<style scoped>
/* ── Barre de recherche rapide ── */
.sidebar-search-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  width: calc(100% - 20px);
  margin: 8px 10px 4px;
  padding: 6px 10px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 7px;
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-muted);
  transition: background .12s, border-color .12s;
  flex-shrink: 0;
  text-align: left;
}
.sidebar-search-bar:hover {
  background: var(--bg-active);
  border-color: var(--border-input);
  color: var(--text-secondary);
}

.sidebar-search-placeholder {
  flex: 1;
  font-size: 12.5px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-search-kbd {
  font-size: 9.5px;
  font-family: var(--font);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--text-muted);
}

/* ── Indicateur de section ── */
.sidebar-section-indicator {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .8px;
  padding: 6px 16px 5px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Raccourci Tous les documents ── */
.sidebar-all-docs-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  border-bottom: 1px solid var(--border);
  transition: background var(--t-fast), color var(--t-fast);
  flex-shrink: 0;
}
.sidebar-all-docs-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Couleurs actives par section */
.sidebar-all-docs-btn.section-messages .sidebar-all-docs-icon { color: var(--accent); }
.sidebar-all-docs-btn.section-messages.active { color: var(--accent); background: rgba(74,144,217,.08); }

.sidebar-all-docs-btn.section-devoirs .sidebar-all-docs-icon  { color: var(--color-cctl); }
.sidebar-all-docs-btn.section-devoirs.active  { color: var(--color-cctl); background: rgba(155,135,245,.08); }

.sidebar-all-docs-btn.section-documents .sidebar-all-docs-icon { color: #27AE60; }
.sidebar-all-docs-btn.section-documents.active { color: #27AE60; background: rgba(39,174,96,.08); }

.sidebar-all-docs-icon { flex-shrink: 0; }

/* Accent coloré selon la section active */
.sidebar-section-indicator::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}
.sidebar-section--messages::before  { background: var(--accent); }
.sidebar-section--devoirs::before   { background: #9B87F5; }
.sidebar-section--documents::before { background: #27AE60; }
.sidebar-section--dashboard::before { background: #E5A842; }
.sidebar-section--messages  { color: var(--accent); }
.sidebar-section--devoirs   { color: var(--color-cctl); }
.sidebar-section--documents { color: #27AE60; }
.sidebar-section--dashboard { color: #E5A842; }

/* ── Renommage inline ── */
.sidebar-category-header-wrap { position: relative; }
.sidebar-rename-row {
  padding: 3px 8px 3px 10px;
}
.sidebar-rename-channel {
  padding: 2px 8px;
}
.sidebar-rename-input {
  width: 100%;
  background: var(--bg-input, rgba(255,255,255,.07));
  border: 1px solid var(--accent, #4A90D9);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font);
  padding: 3px 7px;
  outline: none;
  box-shadow: 0 0 0 2px rgba(74,144,217,.2);
}
.sidebar-rename-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }

/* ── Accent spacer (etudiants) ── */
.sb-accent-spacer {
  display: flex; align-items: center; gap: 8px;
  margin: 12px 16px 6px;
}
.sb-accent-line {
  flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent, #4a90d9), transparent);
  opacity: .2;
}
.sb-accent-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--accent, #4a90d9); opacity: .4;
}

/* ── Categories de canaux ── */
.sidebar-category {
  margin-bottom: 0;
}

/* ── Separateur entre sections ── */
.sidebar-separator {
  height: 1px;
  background: var(--border);
  margin: 10px 14px;
  opacity: .5;
}

.sidebar-category-header {
  display: flex;
  align-items: center;
  gap: 5px;
  width: calc(100% - 16px);
  margin: 4px 8px 2px;
  padding: 4px 8px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  font-family: var(--font);
  transition: all .15s;
}
.sidebar-category-header:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,.03);
}
.sidebar-category-header:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 6px; }

.sidebar-category-icon {
  flex-shrink: 0;
  opacity: .5;
  color: var(--text-muted);
}

.sidebar-category-chevron {
  flex-shrink: 0;
  transition: transform .18s ease;
  opacity: .4;
}
.sidebar-category-chevron.rotated { transform: rotate(-90deg); }
.sidebar-category-header:hover .sidebar-category-chevron { opacity: .8; }

/* Canaux indentes sous la categorie */
.sidebar-category-channels {
  padding-left: 10px;
}

.sidebar-category-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-category-count {
  font-size: 11px;
  opacity: .5;
  font-weight: 400;
}

/* ── Projets (section Devoirs) ── */
.project-icon {
  flex-shrink: 0;
  opacity: .8;
}

.project-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9B87F5;
  flex-shrink: 0;
  margin-left: 4px;
  margin-right: 2px;
  opacity: .7;
}

.sidebar-item.active .project-bullet { opacity: 1; background: #9B87F5; }

.project-color-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: .8;
}
.sidebar-item.active .project-color-dot { opacity: 1; }

.sidebar-add-project {
  opacity: .6;
  transition: opacity .12s;
}
.sidebar-add-project:hover { opacity: 1; }

.project-add-row {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px 3px 14px;
}

.project-add-input {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font);
  padding: 3px 7px;
  outline: none;
  min-width: 0;
}
.project-add-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.project-add-input:focus { border-color: var(--color-cctl); box-shadow: 0 0 0 2px rgba(155,135,245,.2); }

/* ── Badge DM non lus ── */
.dm-unread-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent, #4a90d9);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dm-has-unread .channel-name {
  font-weight: 700;
  color: var(--text-primary);
}

/* ── Sous-listes (pas de max-height propre, le parent scroll) ── */
.sidebar-scroll-list {
  /* Pas de contrainte ici - le scroll est géré par le parent */
}

/* ── Section repliable ── */
.sidebar-collapsible-header {
  display: flex !important;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}
.sidebar-collapsible-header:hover {
  color: var(--text-primary);
}
.sidebar-section-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}

/* ── DM récents ── */
.dm-toggle-btn {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  padding: 2px; border-radius: 4px; display: flex; align-items: center;
  opacity: 0; transition: opacity .15s;
}
.sidebar-section-header:hover .dm-toggle-btn { opacity: 1; }
.dm-toggle-btn:hover { color: var(--accent, #4a90d9); background: var(--bg-hover); }

.dm-item {
  display: flex !important; align-items: center; gap: 6px; padding: 4px 10px 4px 14px !important;
}
.dm-avatar {
  width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; text-transform: uppercase;
}
.dm-info {
  display: flex; flex-direction: column; min-width: 0; flex: 1;
}
.dm-preview {
  font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.3; margin-top: 1px;
}
.dm-avatar-teacher {
  box-shadow: 0 0 0 2px var(--accent-subtle, rgba(74,144,217,.2));
}
.dm-teacher-tag {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--accent);
  background: var(--accent-subtle, rgba(74,144,217,.14));
  padding: 0 4px;
  border-radius: 3px;
  margin-left: 4px;
  vertical-align: middle;
}
.dm-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.presence-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary, #1e1e2e);
}
.presence-online  { background: #22c55e; }
.presence-offline { background: #6b7280; }
.dm-muted-icon {
  font-size: 10px;
  opacity: .5;
  margin-left: 2px;
}
.dm-empty {
  font-size: 11px; color: var(--text-muted); padding: 6px 16px; font-style: italic;
}
.dm-all-header {
  font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
  color: var(--text-muted); padding: 8px 16px 4px; font-weight: 600;
}

/* ── Badge rendus par projet ── */
.project-rendus-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(155,135,245,.12);
  color: var(--color-cctl);
  flex-shrink: 0;
  margin-left: auto;
  opacity: .85;
}
.project-rendus-badge.badge-complete {
  background: rgba(39,174,96,.14);
  color: var(--color-success);
}

/* ── Arbre projets (dashboard) ── */
.dash-project-group {
  margin-bottom: 2px;
}

.dash-project-header {
  display: flex;
  align-items: center;
  gap: 2px;
}

.dash-project-toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  padding: 4px 6px 4px 10px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  font-family: var(--font);
  transition: color var(--t-fast);
  text-align: left;
}
.dash-project-toggle:hover { color: var(--text-secondary); }
.dash-project-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 3px; }

.dash-project-icon {
  flex-shrink: 0;
  opacity: .7;
}

.dash-project-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dash-devoirs-link {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border: 1px solid rgba(155,135,245,.3);
  border-radius: 4px;
  background: transparent;
  color: var(--color-cctl);
  cursor: pointer;
  font-family: var(--font);
  margin-right: 8px;
  transition: background var(--t-fast), color var(--t-fast);
  white-space: nowrap;
}
.dash-devoirs-link:hover { background: rgba(155,135,245,.15); color: #b8a8f7; }

.dash-project-channels {
  padding-left: 10px;
}

.dash-empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Drag & drop canaux ── */
.channel-drag-wrap {
  cursor: grab;
  transition: opacity .15s;
}
.channel-drag-wrap:active { cursor: grabbing; }
.channel-drag-wrap.is-dragging { opacity: .4; }

.sidebar-category.drag-over {
  background: rgba(74, 144, 217, .07);
  border-radius: 6px;
  outline: 1.5px dashed rgba(74, 144, 217, .6);
  outline-offset: -1px;
}

/* ── Résumé promo card ── */
/* ── Student header ── */
.sb-student-header {
  display: flex; align-items: center; gap: 10px;
  margin: 4px 10px 2px;
  padding: 10px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(74,144,217,.08), rgba(74,144,217,.02));
  border: 1px solid rgba(74,144,217,.12);
}
.sb-student-promo-icon {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(74,144,217,.12); color: var(--accent);
  flex-shrink: 0;
}
.sb-student-promo-text {
  display: flex; flex-direction: column; min-width: 0;
}
.sb-student-promo-name {
  font-size: 13px; font-weight: 700; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.2;
}
.sb-student-promo-badge {
  font-size: 9px; font-weight: 600;
  color: var(--accent); opacity: .7;
  text-transform: uppercase; letter-spacing: .04em;
}

.sb-promo-card {
  margin: 6px 10px 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.sb-promo-card-header {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 4px;
}
.sb-promo-card-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.sb-promo-card-name {
  font-size: 12px; font-weight: 700; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sb-promo-card-stats {
  font-size: 10.5px; color: var(--text-muted);
  display: flex; flex-wrap: wrap; gap: 2px;
}
.sb-promo-card-sep { margin: 0 2px; }

/* ── Enriched project items ── */
.sb-project-rich {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 3px !important;
  padding-top: 5px !important;
  padding-bottom: 5px !important;
}
.sb-project-rich-top {
  display: flex; align-items: center; gap: 6px; width: 100%;
}
.sb-project-rich-bar-wrap {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding-left: 20px;
}
.sb-project-rich-bar {
  flex: 1; height: 3px; border-radius: 2px;
  background: var(--bg-active); overflow: hidden;
}
.sb-project-rich-bar-fill {
  height: 100%; border-radius: 2px;
  transition: width .3s ease;
}
.sb-project-rich-sub {
  font-size: 10px; color: var(--text-muted); white-space: nowrap;
}

/* ── Activité récente ── */
.sb-recent-list { padding: 0 10px 4px; }
.sb-recent-item {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 6px; padding: 3px 0;
  border-bottom: 1px solid var(--border);
}
.sb-recent-item:last-child { border-bottom: none; }
.sb-recent-text {
  font-size: 10.5px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1; min-width: 0;
}
.sb-recent-time {
  font-size: 9.5px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0;
}

</style>
