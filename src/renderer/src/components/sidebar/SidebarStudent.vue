/**
 * SidebarStudent - Full student sidebar with smart focus, next action,
 * contextual channel/DM/project lists, and focus mode toggle.
 */
<script setup lang="ts">
import { watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, FolderOpen, Layers } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { avatarColor } from '@/utils/format'
import ChannelItem from './ChannelItem.vue'
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

/* ── Section headers (CANAUX, MESSAGES DIRECTS) ── */
.sidebar-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: .06em;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  padding: 10px 12px 6px;
  cursor: pointer;
  user-select: none;
}
.sidebar-collapsible-header {
  margin: 4px 8px 2px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s;
}
.sidebar-collapsible-header:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,.04);
}

/* ── Category groups (Projet Web, Maths, etc.) ── */
.sidebar-category { margin-bottom: 4px; }
.sidebar-category-header-wrap { position: relative; }

.sidebar-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: calc(100% - 16px);
  margin: 0 8px;
  background: rgba(255,255,255,.02);
  border: none;
  border-left: 2px solid rgba(255,255,255,.06);
  padding: 5px 10px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  font-family: var(--font);
  border-radius: 0 6px 6px 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar-category-header:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,.04);
  border-left-color: var(--accent);
}

.sidebar-category-icon { flex-shrink: 0; opacity: .7; }
.sidebar-category-chevron {
  flex-shrink: 0;
  opacity: .5;
  transition: transform .18s ease, opacity .15s;
}
.sidebar-category-header:hover .sidebar-category-chevron { opacity: .8; }
.sidebar-category-chevron.rotated { transform: rotate(-90deg); }

.sidebar-category-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Sidebar scroll list ── */
.sidebar-scroll-list { padding: 0 4px; }

/* ── DM items ── */
.dm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 12px);
  margin: 1px 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 13.5px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  position: relative;
}
.dm-item:hover { background: rgba(255,255,255,.05); }
.dm-item.active {
  background: rgba(74,144,217,.14);
  color: var(--text-primary);
}
.dm-item.active::before {
  content: '';
  position: absolute; left: 0; top: 25%; bottom: 25%;
  width: 2px; background: var(--accent); border-radius: 1px;
}

.dm-avatar-wrap { position: relative; flex-shrink: 0; }
.dm-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.dm-avatar-teacher { border-radius: 50%; }
.dm-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 1px;
}
.dm-preview {
  font-size: 11px; color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  opacity: .7;
}
.dm-muted-icon { font-size: 11px; opacity: .5; margin-left: 4px; }

/* Presence dots */
.presence-dot {
  position: absolute; bottom: -1px; right: -1px;
  width: 9px; height: 9px; border-radius: 50%;
  border: 2px solid var(--bg-sidebar);
}
.presence-online { background: var(--color-success, #22c55e); }
.presence-offline { background: var(--text-muted); width: 7px; height: 7px; }

/* Unread DM state */
.dm-has-unread .channel-name {
  font-weight: 700;
  color: var(--text-primary);
}
.dm-has-unread .dm-preview { opacity: 1; color: var(--text-secondary); }

.dm-unread-badge {
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
  padding: 2px 7px;
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
  margin-left: auto;
  line-height: 1.2;
}

.dm-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 16px;
  font-style: italic;
}

/* ── Project items ── */
.project-icon { flex-shrink: 0; color: var(--accent); }
.project-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}
.project-color-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.channel-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
