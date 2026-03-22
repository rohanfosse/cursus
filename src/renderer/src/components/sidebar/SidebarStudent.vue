/**
 * SidebarStudent — Full student sidebar with smart focus, next action,
 * contextual channel/DM/project lists, and focus mode toggle.
 */
<script setup lang="ts">
import { watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, FolderOpen, CalendarDays, BookOpen, Layers } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { avatarColor } from '@/utils/format'
import ChannelItem from './ChannelItem.vue'
import SidebarSearch from './SidebarSearch.vue'
import SidebarSmartFocus from './SidebarSmartFocus.vue'
import SidebarNextAction from './SidebarNextAction.vue'
import SidebarFocusToggle from './SidebarFocusToggle.vue'
import MicroRing from '@/components/ui/MicroRing.vue'

import { useSidebarData } from '@/composables/useSidebarData'
import { useSidebarNav } from '@/composables/useSidebarNav'
import { useSidebarDm } from '@/composables/useSidebarDm'
import { useSidebarProjects } from '@/composables/useSidebarProjects'
import { useSidebarStudentData } from '@/composables/useSidebarStudentData'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { ref } from 'vue'

const emit = defineEmits<{ navigate: [] }>()

const appStore = useAppStore()
const modals = useModalsStore()
const travauxStore = useTravauxStore()
const route = useRoute()
const router = useRouter()

// ── Composables ───────────────────────────────────────────────────────────
const {
  channels, students, loading, user,
  load, visibleChannels, channelGroups, dmStudents,
  setLoadRecentDmContacts,
} = useSidebarData()

const {
  collapsed, channelsCollapsed, dmCollapsed,
  toggleCategory,
  selectChannel,
} = useSidebarNav(emit)

const ctx = ref<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

const {
  recentDmContacts, showAllDmStudents,
  loadRecentDmContacts, dmContactsToShow, getDmPreview,
  selectDm, openDmContextMenu,
} = useSidebarDm(dmStudents, ctx, emit)

const {
  allProjects, loadCustomProjects, loadDbProjects,
  selectProject, getProjectColor,
} = useSidebarProjects(visibleChannels)

// Wire up DM loading
setLoadRecentDmContacts(loadRecentDmContacts)

const {
  smartFocusChannels,
  nextAction,
  projectProgress,
  focusModeActive,
  focusFilterChannels,
  focusFilterDms,
} = useSidebarStudentData(visibleChannels)

// ── Filtered data (focus mode aware) ──────────────────────────────────────
const filteredChannelGroups = computed(() => {
  return channelGroups.value.map((g) => ({
    ...g,
    channels: focusFilterChannels(g.channels),
  })).filter((g) => g.channels.length > 0)
})

const filteredDmContacts = computed(() => {
  return focusFilterDms(dmContactsToShow.value)
})

// ── Navigation helpers ────────────────────────────────────────────────────
function onOpenDevoir(id: number) {
  travauxStore.openTravail(id)
  appStore.rightPanel = 'travaux'
}

function onNavigateDevoirs() {
  router.push('/devoirs')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  load()
  loadCustomProjects()
  if (route.name === 'devoirs' || route.name === 'dashboard' || route.name === 'documents') {
    loadDbProjects()
  }
})

watch(() => route.name, (n) => {
  if (n === 'messages' || n === 'dashboard') load()
  if (n === 'devoirs' || n === 'dashboard' || n === 'documents') loadDbProjects()
})
watch(() => appStore.currentUser?.id, () => load())
</script>

<template>
  <div id="sidebar" class="sidebar sb-student">
    <div style="height:14px" />

    <SidebarSearch />

    <!-- Smart Focus -->
    <SidebarSmartFocus
      v-if="route.name === 'messages' || route.name === 'dashboard'"
      :items="smartFocusChannels"
    />

    <!-- Next Action -->
    <SidebarNextAction
      :action="nextAction"
      @open-devoir="onOpenDevoir"
      @navigate-devoirs="onNavigateDevoirs"
    />

    <!-- Skeleton loader -->
    <template v-if="loading">
      <div class="sb-scroll">
        <div v-for="i in 5" :key="i" class="skel-list-row">
          <div class="skel skel-avatar skel-avatar-sm" />
          <div class="skel skel-line skel-w70" />
        </div>
      </div>
    </template>

    <!-- Scrollable content area -->
    <div v-else class="sb-scroll">

      <!-- ═══ /messages: channel groups + DMs ═══ -->
      <template v-if="route.name === 'messages'">
        <!-- Channel groups -->
        <div
          class="sidebar-section-header sidebar-collapsible-header"
          style="padding-top: 16px; margin-top: 8px"
          @click="channelsCollapsed = !channelsCollapsed"
        >
          <ChevronDown
            :size="12"
            class="sidebar-category-chevron"
            :class="{ rotated: channelsCollapsed }"
          />
          <span>Canaux</span>
        </div>

        <div v-show="!channelsCollapsed" class="sidebar-scroll-list">
          <TransitionGroup name="sb-focus-list" tag="div">
            <div
              v-for="group in filteredChannelGroups"
              :key="group.key"
              class="sidebar-category"
            >
              <div
                v-if="filteredChannelGroups.length > 1"
                class="sidebar-category-header-wrap"
              >
                <button
                  class="sidebar-category-header"
                  :aria-expanded="!collapsed.has(group.key)"
                  @click="toggleCategory(group.key)"
                >
                  <ChevronDown
                    :size="12"
                    class="sidebar-category-chevron"
                    :class="{ rotated: collapsed.has(group.key) }"
                  />
                  <component
                    v-if="parseCategoryIcon(group.label).icon"
                    :is="parseCategoryIcon(group.label).icon!"
                    :size="11"
                    class="sidebar-category-icon"
                  />
                  <span class="sidebar-category-label">{{ parseCategoryIcon(group.label).label }}</span>
                </button>
              </div>

              <nav v-show="!collapsed.has(group.key)" :aria-label="group.label">
                <ChannelItem
                  v-for="ch in group.channels"
                  :key="ch.id"
                  :channel-id="ch.id"
                  :name="ch.name"
                  :prefix="ch.type === 'annonce' ? '\uD83D\uDCE2' : '#'"
                  :type="ch.type"
                  :muted="false"
                  :is-private="!!ch.is_private"
                  :description="ch.description"
                  @click="selectChannel(ch)"
                />
              </nav>
            </div>
          </TransitionGroup>
        </div>

        <!-- DMs -->
        <template v-if="dmStudents.length">
          <div
            class="sidebar-section-header sidebar-collapsible-header"
            style="margin-top:12px"
            @click="dmCollapsed = !dmCollapsed"
          >
            <ChevronDown
              :size="12"
              class="sidebar-category-chevron"
              :class="{ rotated: dmCollapsed }"
            />
            <span>Messages directs</span>
          </div>

          <div v-show="!dmCollapsed" class="sidebar-scroll-list">
            <nav aria-label="Messages directs">
              <TransitionGroup name="sb-focus-list" tag="div">
                <button
                  v-for="s in filteredDmContacts"
                  :key="s.id"
                  class="sidebar-item dm-item"
                  :class="{
                    active: appStore.activeDmStudentId === s.id,
                    'dm-has-unread': !!appStore.unreadDms[s.name],
                  }"
                  @click="selectDm(s)"
                  @contextmenu.prevent="openDmContextMenu($event, s)"
                >
                  <span class="dm-avatar-wrap">
                    <span
                      class="dm-avatar"
                      :class="{ 'dm-avatar-teacher': s.id < 0 }"
                      :style="{ background: s.id < 0 ? 'var(--accent)' : avatarColor(s.name) }"
                    >{{ s.avatar_initials }}</span>
                    <span
                      v-if="appStore.isUserOnline(s.name)"
                      class="presence-dot presence-online"
                      title="En ligne"
                    />
                    <span v-else class="presence-dot presence-offline" title="Hors ligne" />
                  </span>
                  <span class="dm-info">
                    <span class="channel-name">
                      {{ s.name }}
                      <span
                        v-if="appStore.isDmMuted(s.name)"
                        class="dm-muted-icon"
                        title="Notifications désactivées"
                      >&#128263;</span>
                    </span>
                    <span v-if="getDmPreview(s.name)" class="dm-preview">{{ getDmPreview(s.name) }}</span>
                  </span>
                  <span
                    v-if="appStore.unreadDms[s.name]"
                    class="dm-unread-badge"
                  >
                    {{ (appStore.unreadDms[s.name] as number) > 9 ? '9+' : appStore.unreadDms[s.name] }}
                  </span>
                </button>
              </TransitionGroup>

              <div v-if="!filteredDmContacts.length && !showAllDmStudents" class="dm-empty">
                Aucune conversation
              </div>
            </nav>
          </div>
        </template>
      </template>

      <!-- ═══ /dashboard: shortcuts + projects with MicroRing ═══ -->
      <template v-else-if="route.name === 'dashboard'">
        <div class="sb-section-title sb-pad">
          <span>RACCOURCIS</span>
        </div>
        <nav aria-label="Raccourcis" class="sb-pad-nav">
          <button class="sidebar-item" @click="modals.studentTimeline = true">
            <CalendarDays :size="13" class="project-icon" />
            <span class="channel-name">Ma timeline</span>
          </button>
          <button class="sidebar-item" @click="router.push('/devoirs')">
            <BookOpen :size="13" class="project-icon" />
            <span class="channel-name">Mes devoirs</span>
          </button>
        </nav>

        <template v-if="allProjects.length">
          <div class="sb-section-title sb-pad" style="margin-top:8px">
            <span>PROJETS</span>
          </div>
          <nav aria-label="Projets" class="sb-pad-nav">
            <button
              v-for="proj in allProjects"
              :key="proj"
              class="sidebar-item sb-project-item"
              @click="selectProject(proj)"
            >
              <span class="project-color-dot" :style="{ background: getProjectColor(proj) }" />
              <component
                v-if="parseCategoryIcon(proj).icon"
                :is="parseCategoryIcon(proj).icon!"
                :size="13"
                class="project-icon"
              />
              <span v-else class="project-bullet" />
              <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
              <MicroRing
                v-if="projectProgress[proj]"
                :value="projectProgress[proj].submitted"
                :total="projectProgress[proj].total"
                class="sb-proj-ring"
              />
            </button>
          </nav>
        </template>
      </template>

      <!-- ═══ /devoirs: projects with progress + overdue ═══ -->
      <template v-else-if="route.name === 'devoirs'">
        <div class="sb-section-title sb-pad">
          <span>PROJETS</span>
        </div>
        <nav aria-label="Projets" class="sb-pad-nav">
          <button
            class="sidebar-item"
            :class="{ active: appStore.activeProject === null }"
            @click="selectProject(null)"
          >
            <Layers :size="13" class="project-icon" />
            <span class="channel-name">Accueil</span>
          </button>
          <button
            v-for="proj in allProjects"
            :key="proj"
            class="sidebar-item sb-project-item"
            :class="{ active: appStore.activeProject === proj }"
            @click="selectProject(proj)"
          >
            <span class="project-color-dot" :style="{ background: getProjectColor(proj) }" />
            <component
              v-if="parseCategoryIcon(proj).icon"
              :is="parseCategoryIcon(proj).icon!"
              :size="13"
              class="project-icon"
            />
            <span v-else class="project-bullet" />
            <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
            <span class="sb-proj-meta">
              <MicroRing
                v-if="projectProgress[proj]"
                :value="projectProgress[proj].submitted"
                :total="projectProgress[proj].total"
              />
              <span
                v-if="projectProgress[proj]?.overdue"
                class="sb-overdue-badge"
              >{{ projectProgress[proj].overdue }} en retard</span>
            </span>
          </button>
        </nav>
      </template>

      <!-- ═══ /documents: projects with doc counts ═══ -->
      <template v-else-if="route.name === 'documents'">
        <div class="sb-section-title sb-pad">
          <span>PROJETS</span>
        </div>
        <nav aria-label="Filtrer les documents par projet" class="sb-pad-nav">
          <button
            class="sidebar-item"
            :class="{ active: appStore.activeProject === null }"
            @click="appStore.activeProject = null"
          >
            <FolderOpen :size="13" class="project-icon" />
            <span class="channel-name">Tous les documents</span>
          </button>
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

    </div><!-- /.sb-scroll -->

    <SidebarFocusToggle v-model="focusModeActive" />

    <!-- Context menu -->
    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctx.items"
      @close="ctx = null"
    />
  </div>
</template>

<style scoped>
.sb-student {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sb-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

/* Section titles following strict design rules */
.sb-section-title {
  display: flex;
  align-items: center;
  gap: 5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  padding: 8px 0 4px;
}
.sb-pad {
  padding-left: 14px;
  padding-right: 14px;
}
.sb-pad-nav {
  padding: 0 4px;
}

/* Project item with ring */
.sb-project-item {
  display: flex;
  align-items: center;
}
.sb-proj-ring {
  margin-left: auto;
}
.sb-proj-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.sb-overdue-badge {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 9px;
  color: #f87171;
  background: rgba(239, 68, 68, 0.12);
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
}

/* Focus mode transitions */
.sb-focus-list-enter-active,
.sb-focus-list-leave-active {
  transition: opacity 0.3s ease, max-height 0.3s ease;
}
.sb-focus-list-enter-from,
.sb-focus-list-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}
.sb-focus-list-enter-to,
.sb-focus-list-leave-from {
  opacity: 1;
  max-height: 200px;
}

.sb-focus-hidden {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: opacity 0.3s ease, max-height 0.3s ease;
}
</style>
