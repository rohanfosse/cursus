<script setup lang="ts">
  import { ref, watch, computed, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Plus, ChevronDown, FolderOpen, Layers } from 'lucide-vue-next'
  import NewProjectModal from '@/components/modals/NewProjectModal.vue'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useTravauxStore } from '@/stores/travaux'
  import PromoRail    from './PromoRail.vue'
  import ChannelItem  from './ChannelItem.vue'
  import { avatarColor }  from '@/utils/format'
  import type { Channel, Student, Promotion } from '@/types'

  const CUSTOM_PROJECTS_KEY = 'cc_custom_projects'

  const appStore      = useAppStore()
  const modals        = useModalsStore()
  const messagesStore = useMessagesStore()
  const travauxStore  = useTravauxStore()
  const route         = useRoute()
  const router        = useRouter()

  // ── État local ────────────────────────────────────────────────────────────
  const promotions  = ref<Promotion[]>([])
  const channels    = ref<Channel[]>([])
  const students    = ref<Student[]>([])
  const loading     = ref(false)
  // Set des catégories repliées
  const collapsed   = ref<Set<string>>(new Set())

  const user = computed(() => appStore.currentUser)

  // ── Chargement ────────────────────────────────────────────────────────────
  async function loadTeacherSidebar() {
    loading.value = true
    try {
      const [promRes, stuRes] = await Promise.all([
        window.api.getPromotions(),
        window.api.getAllStudents(),
      ])
      promotions.value = promRes?.ok ? promRes.data : []
      students.value   = stuRes?.ok ? stuRes.data : []

      if (promotions.value.length && !appStore.activePromoId) {
        appStore.activePromoId = promotions.value[0].id
      }
      await loadTeacherChannels()
    } finally {
      loading.value = false
    }
  }

  async function loadTeacherChannels() {
    if (!appStore.activePromoId) return
    const res = await window.api.getChannels(appStore.activePromoId)
    channels.value = res?.ok ? res.data : []
  }

  async function loadStudentSidebar() {
    if (!user.value?.promo_id) return
    loading.value = true
    try {
      const [chRes, stuRes] = await Promise.all([
        window.api.getChannels(user.value.promo_id),
        window.api.getStudents(user.value.promo_id),
      ])
      channels.value = chRes?.ok ? chRes.data : []
      students.value  = stuRes?.ok ? stuRes.data : []
    } finally {
      loading.value = false
    }
  }

  async function load() {
    if (appStore.isTeacher) await loadTeacherSidebar()
    else await loadStudentSidebar()
  }

  // Filtrer les canaux visibles pour un étudiant (privés → vérifier membership)
  const visibleChannels = computed(() => {
    if (appStore.isTeacher) return channels.value
    return channels.value.filter((ch) => {
      if (!ch.is_private) return true
      try {
        const members: number[] = Array.isArray(ch.members) ? ch.members : JSON.parse(ch.members as unknown as string ?? '[]')
        return members.includes(user.value?.id ?? -1)
      } catch { return false }
    })
  })

  // Grouper les canaux par catégorie
  // null/undefined category → groupe "Sans catégorie" mis en dernier
  const NO_CAT = '__no_category__'

  interface CategoryGroup {
    label: string
    key: string
    channels: Channel[]
  }

  const channelGroups = computed((): CategoryGroup[] => {
    const map = new Map<string, Channel[]>()
    for (const ch of visibleChannels.value) {
      const key = ch.category?.trim() || NO_CAT
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ch)
    }

    const groups: CategoryGroup[] = []
    for (const [key, chs] of map) {
      if (key !== NO_CAT) groups.push({ label: key, key, channels: chs })
    }
    // Sans catégorie toujours en dernier
    if (map.has(NO_CAT)) {
      const hasCats = groups.length > 0
      groups.push({ label: hasCats ? 'Autres' : 'Canaux', key: NO_CAT, channels: map.get(NO_CAT)! })
    }
    return groups
  })

  function toggleCategory(key: string) {
    const next = new Set(collapsed.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsed.value = next
  }

  const dmStudents = computed(() =>
    students.value.filter((s) => s.id !== user.value?.id),
  )

  // ── Projets (section Devoirs) ─────────────────────────────────────────────
  const dbProjects     = ref<string[]>([])
  const customProjects = ref<string[]>([])

  function loadCustomProjects() {
    try {
      const raw = localStorage.getItem(CUSTOM_PROJECTS_KEY)
      customProjects.value = raw ? JSON.parse(raw) : []
    } catch { customProjects.value = [] }
  }

  async function loadDbProjects() {
    const promoId = appStore.activePromoId ?? user.value?.promo_id
    if (!promoId) return
    const res = await window.api.getTravailCategories(promoId)
    dbProjects.value = res?.ok ? res.data : []
  }

  const allProjects = computed(() => {
    const set = new Set([...dbProjects.value, ...customProjects.value])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  })

  function onProjectCreated(name: string) {
    loadCustomProjects()
    appStore.activeProject = name
    router.push('/devoirs')
  }

  function selectProject(name: string | null) {
    appStore.activeProject = name
    router.push('/devoirs')
  }

  // ── Contexte sidebar selon la route ───────────────────────────────────────
  const sectionLabel = computed(() => {
    if (route.name === 'devoirs')   return 'Devoirs'
    if (route.name === 'documents') return 'Documents'
    return 'Messages'
  })

  const channelSectionLabel = computed(() => {
    if (route.name === 'devoirs')   return 'Devoirs par canal'
    if (route.name === 'documents') return 'Docs par canal'
    return 'Canaux'
  })

  const channelActionLabel = computed(() => {
    if (route.name === 'devoirs')   return 'Voir les devoirs de ce canal'
    if (route.name === 'documents') return 'Voir les docs de ce canal'
    return undefined
  })

  // ── Interactions ──────────────────────────────────────────────────────────
  function selectChannel(ch: Channel) {
    appStore.openChannel(ch.id, ch.promo_id, ch.name, ch.type)
    // Naviguer vers la section active pour que la vue charge le bon contenu
    if (route.name !== 'messages') {
      router.push(`/${route.name as string}`)
    }
    // MessagesView, TravauxView, DocumentsView ont chacun leur watcher sur activeChannelId
  }

  function selectDm(s: Student) {
    appStore.openDm(s.id, s.promo_id, s.name)
    if (route.name !== 'messages') router.push('/messages')
  }

  async function selectPromo(promoId: number) {
    appStore.activePromoId = promoId
    await loadTeacherChannels()
  }

  // ── Réactivité ────────────────────────────────────────────────────────────
  onMounted(() => { load(); loadCustomProjects(); if (route.name === 'devoirs') loadDbProjects() })

  watch(() => route.name, (n) => {
    if (n === 'messages') load()
    if (n === 'devoirs')  loadDbProjects()
  })
  watch(() => modals.createChannel, (open) => { if (!open) load() })
  // Recharger quand l'utilisateur change (simulation étudiant)
  watch(() => appStore.currentUser?.id, () => load())
  watch(() => appStore.activePromoId, () => { if (route.name === 'devoirs') loadDbProjects() })
</script>

<template>
  <div id="sidebar" class="sidebar">
    <!-- En-tête utilisateur -->
    <div id="sidebar-header" class="sidebar-header">
      <div v-if="user" id="teacher-badge" class="teacher-badge">
        <div
          class="avatar teacher-avatar"
          :style="{
            background: user.type === 'teacher' ? 'var(--accent)' : avatarColor(user.name),
            color: '#fff',
          }"
        >
          {{ user.avatar_initials }}
        </div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{{ user.name }}</span>
          <span class="sidebar-user-role">
            {{ user.type === 'teacher' ? 'Professeur' : user.promo_name ?? '' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Indicateur de section actuelle -->
    <div class="sidebar-section-indicator" :class="`sidebar-section--${route.name as string}`">
      {{ sectionLabel }}
    </div>

    <!-- Raccourci "Tous les documents" -->
    <button
      class="sidebar-all-docs-btn"
      :class="{ active: route.name === 'documents' && !appStore.activeChannelId }"
      @click="appStore.activeChannelId = null; router.push('/documents')"
    >
      <FolderOpen :size="13" class="sidebar-all-docs-icon" />
      Tous les documents
    </button>

    <!-- Section Messages -->
    <div id="sidebar-section-messages">
      <!-- Rail des promos (prof) -->
      <PromoRail
        v-if="appStore.isTeacher && promotions.length"
        :promotions="promotions"
        @select="selectPromo"
      />

      <!-- Squelette de chargement -->
      <template v-if="loading">
        <div v-for="i in 5" :key="i" class="skel-list-row">
          <div class="skel skel-avatar skel-avatar-sm" />
          <div class="skel skel-line skel-w70" />
        </div>
      </template>

      <!-- Liste des projets (section Devoirs) -->
      <template v-else-if="route.name === 'devoirs'">
        <div class="sidebar-section-header">
          <span>Projets</span>
          <button
            class="btn-icon"
            title="Nouveau projet"
            aria-label="Nouveau projet"
            style="padding:2px"
            @click="modals.newProject = true"
          >
            <Plus :size="14" />
          </button>
        </div>

        <nav aria-label="Projets">
          <!-- Tous les devoirs -->
          <button
            class="sidebar-item"
            :class="{ active: appStore.activeProject === null }"
            @click="selectProject(null)"
          >
            <Layers :size="13" class="project-icon" />
            <span class="channel-name">Tous les devoirs</span>
          </button>

          <!-- Projets -->
          <button
            v-for="proj in allProjects"
            :key="proj"
            class="sidebar-item"
            :class="{ active: appStore.activeProject === proj }"
            @click="selectProject(proj)"
          >
            <span class="project-bullet" />
            <span class="channel-name">{{ proj }}</span>
          </button>
        </nav>

        <NewProjectModal v-model="modals.newProject" @created="onProjectCreated" />
      </template>

      <!-- Canaux groupés par catégorie (autres sections) -->
      <template v-else>
        <div id="sidebar-channels-header" class="sidebar-section-header">
          <span>{{ channelSectionLabel }}</span>
          <button
            v-if="appStore.isTeacher"
            class="btn-icon"
            title="Créer un canal"
            aria-label="Créer un canal"
            style="padding:2px"
            @click="modals.createChannel = true"
          >
            <Plus :size="14" />
          </button>
        </div>

        <div
          v-for="group in channelGroups"
          :key="group.key"
          class="sidebar-category"
        >
          <!-- En-tête de catégorie (affiché seulement s'il y a plusieurs groupes) -->
          <button
            v-if="channelGroups.length > 1"
            class="sidebar-category-header"
            :aria-expanded="!collapsed.has(group.key)"
            @click="toggleCategory(group.key)"
          >
            <ChevronDown
              :size="12"
              class="sidebar-category-chevron"
              :class="{ rotated: collapsed.has(group.key) }"
            />
            <span class="sidebar-category-label">{{ group.label }}</span>
            <span class="sidebar-category-count">{{ group.channels.length }}</span>
          </button>

          <nav
            v-show="!collapsed.has(group.key)"
            :aria-label="group.label"
          >
            <ChannelItem
              v-for="ch in group.channels"
              :key="ch.id"
              :channel-id="ch.id"
              :name="ch.name"
              :prefix="ch.type === 'annonce' ? '📢' : '#'"
              :type="ch.type"
              @click="selectChannel(ch)"
            />
          </nav>
        </div>

        <!-- Messages directs (étudiant) -->
        <template v-if="appStore.isStudent && dmStudents.length">
          <div class="sidebar-section-header" style="margin-top:12px">Messages directs</div>
          <nav aria-label="Messages directs">
            <button
              v-for="s in dmStudents"
              :key="s.id"
              class="sidebar-item"
              :class="{ active: appStore.activeDmStudentId === s.id }"
              @click="selectDm(s)"
            >
              <span class="channel-prefix">@</span>
              <span class="channel-name">{{ s.name }}</span>
            </button>
          </nav>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
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
.sidebar-all-docs-btn:hover  { background: var(--bg-hover); color: var(--text-primary); }
.sidebar-all-docs-btn.active { color: #27AE60; background: rgba(39,174,96,.08); }

.sidebar-all-docs-icon { flex-shrink: 0; color: #27AE60; }

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
.sidebar-section--messages::before { background: var(--accent); }
.sidebar-section--devoirs::before  { background: #9B87F5; }
.sidebar-section--documents::before{ background: #27AE60; }
.sidebar-section--messages { color: var(--accent); }
.sidebar-section--devoirs  { color: #9B87F5; }
.sidebar-section--documents{ color: #27AE60; }

/* ── Catégories de canaux ── */
.sidebar-category {
  margin-bottom: 4px;
}

.sidebar-category-header {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  background: transparent;
  border: none;
  padding: 4px 12px 4px 10px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  font-family: var(--font);
  transition: color var(--t-fast);
}

.sidebar-category-header:hover { color: var(--text-secondary); }
.sidebar-category-header:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 3px; }

.sidebar-category-chevron {
  flex-shrink: 0;
  transition: transform .18s ease;
}
.sidebar-category-chevron.rotated { transform: rotate(-90deg); }

.sidebar-category-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-category-count {
  font-size: 10px;
  opacity: .5;
  font-weight: 400;
}

/* ── Projets (section Devoirs) ── */
.project-icon {
  flex-shrink: 0;
  opacity: .6;
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
.project-add-input:focus { border-color: #9B87F5; box-shadow: 0 0 0 2px rgba(155,135,245,.2); }
</style>
