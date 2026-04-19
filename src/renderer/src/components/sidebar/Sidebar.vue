<script setup lang="ts">
  import { ref, watch, onMounted, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Plus, ChevronDown, BookOpen, Pencil, Trash2, Search, X } from 'lucide-vue-next'
  import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'
  import ContextMenu from '@/components/ui/ContextMenu.vue'
  import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import { useAppStore }       from '@/stores/app'
  import { useModalsStore }    from '@/stores/modals'
  import PromoRail          from './PromoRail.vue'
  import ChannelItem        from './ChannelItem.vue'
  import SidebarDashboard   from './SidebarDashboard.vue'
  import SidebarProjects    from './SidebarProjects.vue'
  import SidebarDocProjects from './SidebarDocProjects.vue'
  import SidebarAgenda      from './SidebarAgenda.vue'
  import SidebarFichiers    from './SidebarFichiers.vue'
  import SidebarLive        from './SidebarLive.vue'
  import SidebarDmList      from './SidebarDmList.vue'
  import SidebarArchivedChannels from './SidebarArchivedChannels.vue'
  import LumenRepoSidebar   from '@/components/lumen/LumenRepoSidebar.vue'
  import SkeletonLoader     from '@/components/ui/SkeletonLoader.vue'
  import { useLumenStore }  from '@/stores/lumen'
  import { useLiveStore }   from '@/stores/live'
  import { useFichiersStore } from '@/stores/fichiers'

  import { useSidebarData }     from '@/composables/useSidebarData'
  import { useSidebarDm }       from '@/composables/useSidebarDm'
  import { useSidebarProjects } from '@/composables/useSidebarProjects'
  import { useSidebarActions }  from '@/composables/useSidebarActions'
  import { useSidebarNav }      from '@/composables/useSidebarNav'
  import { useSidebarArchivedChannels } from '@/composables/useSidebarArchivedChannels'
  import { useSidebarCategoryDrag } from '@/composables/useSidebarCategoryDrag'
  import { useSidebarDashboardSummary } from '@/composables/useSidebarDashboardSummary'
  import { useSidebarDocsHelpers } from '@/composables/useSidebarDocsHelpers'
  import { useSidebarKeyboardNav } from '@/composables/useSidebarKeyboardNav'

  const emit = defineEmits<{ navigate: [] }>()
  const channelFilter = ref('')

  const { onKeydown: onSidebarKeydown } = useSidebarKeyboardNav()

  const appStore   = useAppStore()
  const modals     = useModalsStore()
  const lumenStore    = useLumenStore()
  const liveStore     = useLiveStore()
  const fichiersStore = useFichiersStore()
  const route      = useRoute()
  const router     = useRouter()

  function onSelectLiveSession(s: { id: number; promo_id: number }) {
    liveStore.fetchSession(s.id)
    window.api.emitLiveJoin(s.promo_id)
  }

  // ── Composables ───────────────────────────────────────────────────────────
  const {
    promotions, channels, students, loading, user, activePromoName,
    loadTeacherChannels, load, visibleChannels, channelGroups, sortedChannelGroups, reorderCategories, dmStudents,
    selectPromo, setLoadRecentDmContacts,
  } = useSidebarData()

  /** Channels filtres par la recherche. */
  const filteredChannelGroups = computed(() => {
    const q = channelFilter.value.toLowerCase().trim()
    if (!q) return sortedChannelGroups.value
    return sortedChannelGroups.value
      .map((g) => ({
        ...g,
        channels: g.channels.filter((ch) => ch.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.channels.length > 0)
  })

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
    archiveChannel, restoreChannel,
    draggingChannel, dragOverCategory,
    onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  } = useSidebarActions(loadTeacherChannels)

  const {
    recentDmContacts, showAllDmStudents,
    loadRecentDmContacts, dmContactsToShow, getDmPreview,
    selectDm, openDmContextMenu,
    showNewDmSearch, newDmQuery, newDmFilteredStudents, startNewDm, toggleNewDmSearch,
  } = useSidebarDm(dmStudents, ctx, emit)

  const {
    allProjects, projectStats, loadCustomProjects, loadDbProjects,
    onProjectCreated, selectProject, dashboardProjectGroups,
    editingProject, getProjectMeta, saveProjectMeta, deleteProject, getProjectColor,
    projectTimePct, isProjectDone,
  } = useSidebarProjects(visibleChannels)

  // ── Lumen sidebar (v2.101) ─────────────────────────────────────────────────
  const lumenNotedChapters = computed<Set<string>>(() => {
    const set = new Set<string>()
    for (const [key, note] of lumenStore.chapterNotes.entries()) {
      if (note && note.content?.trim()) set.add(key)
    }
    return set
  })

  function handleLumenSelect(payload: { repoId: number; path: string }) {
    router.push({ name: 'lumen', query: { repo: String(payload.repoId), chapter: payload.path } })
  }

  async function handleLumenVisibility(payload: { repoId: number; visible: boolean }) {
    await lumenStore.setRepoVisibility(payload.repoId, payload.visible)
  }

  // ── Canaux archives (staff only) ──────────────────────────────────────────
  const {
    archivedChannels,
    collapsed: archivedCollapsed,
    load: loadArchivedChannels,
    selectArchived: selectArchivedChannel,
    restore: handleRestore,
  } = useSidebarArchivedChannels(channels, restoreChannel, () => emit('navigate'))

  // ── Documents sidebar helpers ────────────────────────────────────────────
  const { docCategories, projectDocCounts, docCatCounts } = useSidebarDocsHelpers()

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
  const {
    dragging: draggingCategory,
    onStart: onCategoryDragStart,
    onOver: onCategoryDragOver,
    onDrop: onCategoryDrop,
    onEnd: onCategoryDragEnd,
  } = useSidebarCategoryDrag(sortedChannelGroups, reorderCategories)

  function onProjectEditSave(proj: string, meta: ProjectMeta) {
    saveProjectMeta(proj, meta)
    editingProject.value = null
  }

  // Wire up DM loading into data composable so load*Sidebar calls it
  setLoadRecentDmContacts(loadRecentDmContacts)

  // ── Resume promo + activite recente (sidebar dashboard) ──────────────────
  const { activePromoObj, promoSummary, recentActivity } = useSidebarDashboardSummary(promotions, students)

  // ── Réactivité ────────────────────────────────────────────────────────────
  onMounted(() => {
    load(); loadCustomProjects(); loadArchivedChannels()
    if (route.name === 'devoirs' || route.name === 'dashboard' || route.name === 'documents') loadDbProjects()
  })

  watch(() => route.name, (n) => {
    if (n === 'messages' || n === 'dashboard') load()
    if (n === 'devoirs' || n === 'dashboard' || n === 'documents') loadDbProjects()
  })
  watch(() => modals.createChannel, (open) => { if (!open) { load(); loadArchivedChannels() } })
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
          <span class="sb-student-promo-badge">Etudiant</span>
        </div>
      </div>

      <!-- Squelette de chargement -->
      <SkeletonLoader v-if="loading" variant="list" :rows="5" />

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
        <SidebarProjects
          :all-projects="allProjects"
          :project-stats="projectStats"
          :get-project-color="getProjectColor"
          :editing-project="editingProject"
          :get-project-meta="getProjectMeta"
          :project-time-pct="projectTimePct"
          :is-project-done="isProjectDone"
          @select-project="selectProject"
          @open-project-ctx="(e, proj) => openProjectCtx(e, proj)"
          @project-edit-save="(proj, data) => onProjectEditSave(proj, data)"
          @cancel-edit="editingProject = null"
          @project-created="onProjectCreated"
        />
      </template>

      <!-- Liste des projets (section Documents) -->
      <template v-else-if="route.name === 'documents'">
        <SidebarDocProjects
          :all-projects="allProjects"
          :project-doc-counts="projectDocCounts"
          :doc-categories="docCategories"
          :doc-cat-counts="docCatCounts"
        />
      </template>

      <!-- Fichiers partages (sidebar etudiants, prof only) -->
      <template v-else-if="route.name === 'fichiers'">
        <SidebarFichiers
          :files="fichiersStore.files"
          :loading="fichiersStore.loading"
          :selected-student-id="fichiersStore.selectedStudentId"
          @select-student="(id: number | null) => fichiersStore.selectStudent(id)"
          @filter-type="(t: 'all' | 'images' | 'docs') => fichiersStore.setFilterType(t)"
        />
      </template>

      <!-- Live (sidebar brouillons + navigation) -->
      <template v-else-if="route.name === 'live' && appStore.isStaff">
        <SidebarLive
          @select-session="onSelectLiveSession"
          @tab="(t) => router.push({ name: 'live', query: { tab: t } })"
        />
      </template>

      <!-- Agenda (sidebar mini-cal + events, v2.108) -->
      <template v-else-if="route.name === 'agenda'">
        <SidebarAgenda
          @select-date="(d: string) => router.push({ name: 'agenda', query: { date: d } })"
          @new-reminder="router.push({ name: 'agenda', query: { action: 'new-reminder' } })"
        />
      </template>

      <!-- Cours Lumen (sidebar unifiee v2.101) -->
      <template v-else-if="route.name === 'lumen'">
        <LumenRepoSidebar
          :repos="lumenStore.repos"
          :current-repo-id="lumenStore.currentRepo?.id ?? null"
          :current-chapter-path="lumenStore.currentChapterPath"
          :noted-chapters="lumenNotedChapters"
          :can-toggle-visibility="appStore.isTeacher"
          :promo-id="appStore.activePromoId"
          @select="handleLumenSelect"
          @toggle-visibility="handleLumenVisibility"
        />
      </template>

      <!-- Salons groupes par categorie (autres sections) -->
      <template v-else>
        <!-- Recherche canaux -->
        <div v-if="visibleChannels.length >= 5" class="sb-channel-search">
          <Search :size="11" class="sb-channel-search-icon" />
          <input
            v-model="channelFilter"
            type="text"
            class="sb-channel-search-input"
            placeholder="Rechercher un canal..."
          />
          <button v-if="channelFilter" type="button" class="sb-channel-search-clear" @click="channelFilter = ''">
            <X :size="10" />
          </button>
        </div>

        <div
          id="sidebar-channels-header"
          class="sidebar-section-header sidebar-collapsible-header"
          role="button"
          tabindex="0"
          :aria-expanded="!channelsCollapsed"
          @click="channelsCollapsed = !channelsCollapsed"
          @keydown.enter="channelsCollapsed = !channelsCollapsed"
          @keydown.space.prevent="channelsCollapsed = !channelsCollapsed"
        >
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

        <div v-show="!channelsCollapsed" class="sidebar-scroll-list" @keydown="onSidebarKeydown">
        <div
          v-for="group in filteredChannelGroups"
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
            v-if="filteredChannelGroups.length > 1"
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

        <!-- Canaux archives (staff only) -->
        <SidebarArchivedChannels
          v-if="appStore.isStaff && archivedChannels.length"
          :channels="archivedChannels"
          :collapsed="archivedCollapsed"
          @update:collapsed="archivedCollapsed = $event"
          @select="selectArchivedChannel"
          @restore="handleRestore"
        />

        <!-- Messages directs (composant extrait) -->
        <SidebarDmList
          v-if="dmStudents.length"
          :dm-collapsed="dmCollapsed"
          :dm-contacts-to-show="dmContactsToShow"
          :dm-students="dmStudents"
          :show-all-dm-students="showAllDmStudents"
          :show-new-dm-search="showNewDmSearch"
          :new-dm-query="newDmQuery"
          :new-dm-filtered-students="newDmFilteredStudents"
          :get-dm-preview="getDmPreview"
          @update:dm-collapsed="dmCollapsed = $event"
          @update:show-all-dm-students="showAllDmStudents = $event"
          @update:new-dm-query="newDmQuery = $event"
          @toggle-new-dm-search="toggleNewDmSearch"
          @select-dm="selectDm"
          @open-dm-context-menu="openDmContextMenu"
          @start-new-dm="startNewDm"
        />
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
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-muted);
  transition: background var(--t-fast), border-color var(--t-fast);
  flex-shrink: 0;
  text-align: left;
}
.sidebar-search-bar:hover {
  background: var(--bg-active);
  border-color: var(--border-input);
  color: var(--text-secondary);
}
.sidebar-search-bar:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

.sidebar-search-placeholder {
  flex: 1;
  font-size: 13px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-search-kbd {
  font-size: 10px;
  font-family: var(--font);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 1px 5px;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--text-muted);
}

/* ── Indicateur de section ── */
.sidebar-section-indicator {
  font-size: 11px;
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
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  border-bottom: 1px solid var(--border);
  transition: background var(--t-fast), color var(--t-fast);
  flex-shrink: 0;
}
.sidebar-all-docs-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.sidebar-all-docs-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

/* Couleurs actives par section */
.sidebar-all-docs-btn.section-messages .sidebar-all-docs-icon { color: var(--accent); }
.sidebar-all-docs-btn.section-messages.active { color: var(--accent); background: rgba(var(--accent-rgb),.08); }

.sidebar-all-docs-btn.section-devoirs .sidebar-all-docs-icon  { color: var(--color-cctl); }
.sidebar-all-docs-btn.section-devoirs.active  { color: var(--color-cctl); background: color-mix(in srgb, var(--color-cctl) 8%, transparent); }

.sidebar-all-docs-btn.section-documents .sidebar-all-docs-icon { color: var(--color-online); }
.sidebar-all-docs-btn.section-documents.active { color: var(--color-online); background: color-mix(in srgb, var(--color-online) 8%, transparent); }

.sidebar-all-docs-icon { flex-shrink: 0; }

/* Document count badge in sidebar */
.sidebar-doc-count {
  margin-left: auto; font-size: 10px; font-weight: 600;
  color: var(--text-muted); background: var(--bg-hover);
  padding: 1px 6px; border-radius: var(--radius); flex-shrink: 0;
}

/* Sub-items (categories under project) */
.sidebar-item--sub { padding-left: 36px; }
.sidebar-sub-dot {
  width: 5px; height: 5px; border-radius: var(--radius-full);
  background: var(--text-muted); opacity: .4; flex-shrink: 0;
}
.sidebar-item--sub.active .sidebar-sub-dot { background: var(--accent); opacity: 1; }

/* Accent coloré selon la section active */
.sidebar-section-indicator::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--text-muted);
  flex-shrink: 0;
}
.sidebar-section--messages::before  { background: var(--accent); }
.sidebar-section--devoirs::before   { background: var(--color-cctl); }
.sidebar-section--documents::before { background: var(--color-online); }
.sidebar-section--dashboard::before { background: var(--color-gold); }
.sidebar-section--messages  { color: var(--accent); }
.sidebar-section--devoirs   { color: var(--color-cctl); }
.sidebar-section--documents { color: var(--color-online); }
.sidebar-section--dashboard { color: var(--color-gold); }

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
  background: var(--bg-input);
  border: 1px solid var(--accent);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font);
  padding: 3px 7px;
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb),.2);
}
.sidebar-rename-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }

/* ── Channel search ── */
.sb-channel-search {
  display: flex; align-items: center; gap: 4px;
  margin: 6px 10px 4px; padding: 5px 7px;
  background: var(--bg-primary); border: 1px solid var(--border); border-radius: 5px;
}
.sb-channel-search:focus-within { border-color: var(--accent); }
.sb-channel-search-icon { color: var(--text-muted); flex-shrink: 0; }
.sb-channel-search-input {
  flex: 1; background: transparent; border: none; color: var(--text-primary);
  font-size: 11px; font-family: inherit; outline: none;
}
.sb-channel-search-input::placeholder { color: var(--text-muted); }
.sb-channel-search-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 1px; }
.sb-channel-search-clear:hover { color: var(--text-primary); }

/* ── Accent spacer (etudiants) ── */
.sb-accent-spacer {
  display: flex; align-items: center; gap: 8px;
  margin: 12px 16px 6px;
}
.sb-accent-line {
  flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: .2;
}
.sb-accent-dot {
  width: 4px; height: 4px; border-radius: var(--radius-full);
  background: var(--accent); opacity: .4;
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
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  font-family: var(--font);
  transition: all var(--t-base);
}
.sidebar-category-header:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}
.sidebar-category-header:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--radius-sm); }

.sidebar-category-icon {
  flex-shrink: 0;
  opacity: .5;
  color: var(--text-muted);
}

.sidebar-category-chevron {
  flex-shrink: 0;
  transition: transform var(--t-base) ease;
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
  border-radius: var(--radius-full);
  background: var(--color-cctl);
  flex-shrink: 0;
  margin-left: 4px;
  margin-right: 2px;
  opacity: .7;
}

.sidebar-item.active .project-bullet { opacity: 1; background: var(--color-cctl); }

.project-color-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  opacity: .8;
}
.sidebar-item.active .project-color-dot { opacity: 1; }

.sidebar-add-project {
  opacity: .6;
  transition: opacity var(--t-fast);
}
.sidebar-add-project:hover { opacity: 1; }
.sidebar-add-project:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

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
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font);
  padding: 3px 7px;
  outline: none;
  min-width: 0;
}
.project-add-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.project-add-input:focus {
  border-color: var(--color-cctl);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-cctl) 20%, transparent);
}

/* ── Badge DM non lus ── */
.dm-unread-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent);
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dm-has-unread .dm-name {
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
  border-radius: var(--radius);
  font-weight: 600;
}

/* ── DM recents ── */
.dm-toggle-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  margin-left: auto;
  opacity: 0;
  transition: opacity var(--t-base), color var(--t-fast), background var(--t-fast);
}
.dm-toggle-btn--visible { opacity: 1; }
.sidebar-section-header:hover .dm-toggle-btn { opacity: 1; }
.dm-toggle-btn:hover { color: var(--accent); background: var(--bg-hover); }
.dm-toggle-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

.dm-item {
  display: flex !important;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 18px !important;
  min-height: 28px;
  border-radius: 6px;
  transition: background .1s;
}
.dm-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.dm-avatar-wrap .msg-avatar {
  border-radius: 8px !important;
}
.dm-avatar {
  width: 20px;
  height: 20px;
  min-width: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  text-transform: uppercase;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.dm-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.dm-name {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.dm-email {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dm-preview {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}
/* Note : le pattern "teacher tag" DM a ete extrait vers <UiRoleBadge role="teacher"> */
.presence-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--bg-sidebar);
}
.presence-online  { background: var(--color-success); }
.presence-offline { background: var(--text-muted); }
.dm-muted-icon {
  font-size: 10px;
  opacity: .4;
  margin-left: 3px;
}
.dm-empty {
  font-size: 11px; color: var(--text-muted); padding: 8px 16px; font-style: italic;
}
.dm-all-header {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-muted);
  padding: 10px 14px 4px;
  font-weight: 700;
}

/* ── Recherche nouveau DM ── */
.dm-search {
  padding: 6px 10px 8px;
}
.dm-search-input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font);
  padding: 7px 10px;
  outline: none;
  margin-bottom: 4px;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.dm-search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb),.2);
}
.dm-search-input::placeholder {
  color: var(--text-muted);
  font-style: italic;
}
.dm-search-result {
  display: flex !important;
  align-items: center;
  gap: 8px;
  padding: 6px 8px !important;
  border-radius: 6px;
  transition: background .1s;
}
.dm-search-result .msg-avatar {
  border-radius: 8px !important;
}

/* ── Canaux archives ── */
.archived-channel-item {
  opacity: .55;
  display: flex !important;
  align-items: center;
  gap: 6px;
}
.archived-channel-item:hover { opacity: .85; }
.archived-channel-item.active { opacity: 1; }
.archived-prefix { color: var(--text-muted); }
.archived-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: italic;
}
.archived-restore-btn {
  display: none;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}
.archived-channel-item:hover .archived-restore-btn { display: flex; }
.archived-restore-btn:hover { color: var(--accent); background: var(--bg-hover); }
.archived-restore-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

/* ── Badge rendus par projet ── */
.project-rendus-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-cctl) 12%, transparent);
  color: var(--color-cctl);
  flex-shrink: 0;
  margin-left: auto;
  opacity: .85;
}
.project-rendus-badge.badge-complete {
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
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
.dash-project-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--radius-xs); }

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
  border: 1px solid color-mix(in srgb, var(--color-cctl) 30%, transparent);
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-cctl);
  cursor: pointer;
  font-family: var(--font);
  margin-right: 8px;
  transition: background-color var(--t-fast), color var(--t-fast);
  white-space: nowrap;
}
.dash-devoirs-link:hover {
  background: color-mix(in srgb, var(--color-cctl) 15%, transparent);
  color: color-mix(in srgb, var(--color-cctl) 85%, white);
}
.dash-devoirs-link:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

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
  transition: opacity var(--t-base);
}
.channel-drag-wrap:active { cursor: grabbing; }
.channel-drag-wrap.is-dragging { opacity: .4; }

.sidebar-category.drag-over {
  background: rgba(var(--accent-rgb), .07);
  border-radius: var(--radius-sm);
  outline: 1.5px dashed rgba(var(--accent-rgb), .6);
  outline-offset: -1px;
}

/* ── Résumé promo card ── */
/* ── Student header ── */
.sb-student-header {
  display: flex; align-items: center; gap: 10px;
  margin: 4px 10px 2px;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: linear-gradient(135deg, rgba(var(--accent-rgb),.08), rgba(var(--accent-rgb),.02));
  border: 1px solid rgba(var(--accent-rgb),.12);
}
.sb-student-promo-icon {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--radius);
  background: rgba(var(--accent-rgb),.12); color: var(--accent);
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
  border-radius: var(--radius);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.sb-promo-card-header {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 4px;
}
.sb-promo-card-dot {
  width: 8px; height: 8px; border-radius: var(--radius-full); flex-shrink: 0;
}
.sb-promo-card-name {
  font-size: 12px; font-weight: 700; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sb-promo-card-stats {
  font-size: 11px; color: var(--text-muted);
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
  flex: 1; height: 3px; border-radius: var(--radius-xs);
  background: var(--bg-active); overflow: hidden;
}
.sb-project-rich-bar-fill {
  height: 100%; border-radius: var(--radius-xs);
  transition: width var(--t-slow) ease;
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
  font-size: 11px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1; min-width: 0;
}
.sb-recent-time {
  font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0;
}

/* ══════════════ Reduced motion (a11y) ══════════════ */
@media (prefers-reduced-motion: reduce) {
  .sidebar-category-header,
  .sidebar-category-chevron,
  .sidebar-all-docs-btn,
  .sb-channel-search,
  .dash-project-toggle,
  .dash-devoirs-link,
  .dm-item,
  .dm-search-result,
  .dm-search-input,
  .dm-toggle-btn,
  .archived-restore-btn,
  .channel-drag-wrap,
  .project-add-input,
  .sidebar-add-project,
  .sb-project-rich-bar-fill { transition: none !important; }
}

</style>
