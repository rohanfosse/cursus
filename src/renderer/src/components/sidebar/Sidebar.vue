<script setup lang="ts">
  import { ref, watch, computed, onMounted, nextTick } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Plus, ChevronDown, FolderOpen, Layers, PlusCircle, Pencil, Trash2, VolumeX, Volume2, MessageSquare, BookOpen, BarChart2, CalendarDays } from 'lucide-vue-next'
  import NewProjectModal from '@/components/modals/NewProjectModal.vue'
  import ContextMenu from '@/components/ui/ContextMenu.vue'
  import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useTravauxStore } from '@/stores/travaux'
  import { useToast }   from '@/composables/useToast'
  import { useConfirm } from '@/composables/useConfirm'
  import PromoRail    from './PromoRail.vue'
  import ChannelItem  from './ChannelItem.vue'
  import { avatarColor }  from '@/utils/format'
  import type { Channel, Student, Promotion } from '@/types'

  const emit = defineEmits<{ navigate: [] }>()

  const CUSTOM_PROJECTS_KEY = 'cc_custom_projects'

  const appStore      = useAppStore()
  const modals        = useModalsStore()
  const messagesStore = useMessagesStore()
  const travauxStore  = useTravauxStore()
  const route         = useRoute()
  const router        = useRouter()
  const { showToast } = useToast()
  const { confirm }   = useConfirm()

  // ── État local ────────────────────────────────────────────────────────────
  const promotions  = ref<Promotion[]>([])
  const channels    = ref<Channel[]>([])
  const students    = ref<Student[]>([])
  const loading     = ref(false)
  // Set des catégories repliées
  const collapsed          = ref<Set<string>>(new Set())
  const collapsedDashboard = ref<Set<string>>(new Set())
  // Sections principales repliables
  const channelsCollapsed = ref(false)
  const dmCollapsed       = ref(false)

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
      await loadRecentDmContacts()
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
      const [chRes, stuRes, teachRes] = await Promise.all([
        window.api.getChannels(user.value.promo_id),
        window.api.getStudents(user.value.promo_id),
        window.api.getTeachers(),
      ])
      channels.value = chRes?.ok ? chRes.data : []
      const stuList  = stuRes?.ok ? stuRes.data : []
      const teachers = teachRes?.ok ? teachRes.data : []
      students.value = [...teachers, ...stuList]
      await loadRecentDmContacts()
    } finally {
      loading.value = false
    }
  }

  async function load() {
    if (appStore.isStaff) await loadTeacherSidebar()
    else await loadStudentSidebar()
  }

  // Filtrer les canaux visibles
  const visibleChannels = computed(() => {
    if (appStore.isTeacher) return channels.value
    if (appStore.currentUser?.type === 'ta') {
      // Intervenants : uniquement leurs canaux assignés (si assignés)
      const ids = appStore.taChannelIds
      if (ids.length > 0) return channels.value.filter((ch) => ids.includes(ch.id))
      return channels.value // aucune restriction définie → tout voir
    }
    // Étudiant : exclure les canaux privés dont il n'est pas membre
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

  function toggleDashboardProject(key: string) {
    const next = new Set(collapsedDashboard.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsedDashboard.value = next
  }

  function toggleCategory(key: string) {
    const next = new Set(collapsed.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsed.value = next
  }

  const dmStudents = computed(() => {
    const promoId = appStore.isStaff ? appStore.activePromoId : user.value?.promo_id
    return students.value.filter((s) => {
      if (s.id === user.value?.id) return false
      // Les enseignants (id négatif) sont toujours visibles dans les DMs
      if (s.id < 0) return true
      // Les étudiants sont filtrés par promo
      return !promoId || s.promo_id === promoId
    })
  })

  // ── Conversations DM récentes ──────────────────────────────────────────────
  interface DmContact { name: string; last_message_at: string; last_message_preview: string }
  const recentDmContacts = ref<DmContact[]>([])
  const showAllDmStudents = ref(false)
  const DM_RECENT_LIMIT = 10

  async function loadRecentDmContacts() {
    if (!user.value?.id) return
    // Pour le prof : pas de contacts récents (pas de student_id), on montre la liste directement
    if (appStore.isStaff) { recentDmContacts.value = []; return }
    try {
      const res = await window.api.getRecentDmContacts(user.value.id, DM_RECENT_LIMIT)
      recentDmContacts.value = res?.ok ? res.data : []
    } catch { recentDmContacts.value = [] }
  }

  // Les contacts récents + ceux avec unread, avec infos student pour pouvoir cliquer
  const dmContactsToShow = computed(() => {
    // Prof/TA : montrer les étudiants de la promo active (limité à DM_RECENT_LIMIT)
    if (appStore.isStaff) {
      return dmStudents.value.slice(0, DM_RECENT_LIMIT)
    }

    // Enseignants toujours visibles en premier pour les étudiants
    const teachers = dmStudents.value.filter(s => s.id < 0)

    const recentNames = new Set(recentDmContacts.value.map(c => c.name))
    // Ajouter les noms avec unread
    for (const name of Object.keys(appStore.unreadDms)) {
      recentNames.add(name)
    }
    // Contacts récents (hors enseignants déjà inclus)
    const teacherNames = new Set(teachers.map(t => t.name))
    const recentStudents = dmStudents.value.filter(s => s.id > 0 && recentNames.has(s.name))
    // Trier les étudiants par date de dernier message
    const orderMap = new Map(recentDmContacts.value.map((c, i) => [c.name, i]))
    recentStudents.sort((a, b) => {
      const ai = orderMap.get(a.name) ?? 999
      const bi = orderMap.get(b.name) ?? 999
      return ai - bi
    })
    return [...teachers, ...recentStudents]
  })

  function getDmPreview(name: string) {
    const c = recentDmContacts.value.find(c => c.name === name)
    return c?.last_message_preview?.substring(0, 40) || ''
  }

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

  // ── Stats de rendus par projet (pour indicateurs sidebar) ─────────────────
  const projectStats = computed((): Record<string, { depots: number; expected: number }> => {
    const map: Record<string, { depots: number; expected: number }> = {}
    for (const t of travauxStore.ganttData as any[]) {
      const cat = (t as any).category?.trim()
      if (!cat || !(t as any).published) continue
      if (!map[cat]) map[cat] = { depots: 0, expected: 0 }
      map[cat].depots   += (t as any).depots_count  ?? 0
      map[cat].expected += (t as any).students_total ?? 0
    }
    return map
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

  // ── Arbre projets pour le dashboard ──────────────────────────────────────
  interface DashboardProjectGroup {
    key: string     // category raw value (e.g. "monitor Développement Web")
    label: string   // parsed label
    channels: Channel[]
  }

  const dashboardProjectGroups = computed((): DashboardProjectGroup[] => {
    const all = [...allProjects.value]
    const groups: DashboardProjectGroup[] = []

    for (const proj of all) {
      const chs = visibleChannels.value.filter(ch => ch.category?.trim() === proj)
      if (chs.length) groups.push({ key: proj, label: parseCategoryIcon(proj).label, channels: chs })
    }

    // Canaux sans projet
    const uncategorized = visibleChannels.value.filter(ch => !ch.category?.trim())
    if (uncategorized.length) {
      groups.push({ key: NO_CAT, label: 'Autres canaux', channels: uncategorized })
    }
    return groups
  })

  // ── Raccourci "Tout afficher" contextuel ──────────────────────────────────
  const sectionShortcut = computed(() => {
    switch (route.name) {
      case 'messages':
        return {
          label:  'Tous les canaux',
          icon:   MessageSquare,
          active: !appStore.activeChannelId && !appStore.activeDmStudentId,
          action: () => {
            appStore.activeChannelId   = null
            appStore.activeDmStudentId = null
            router.push('/messages')
          },
        }
      case 'devoirs':
        return {
          label:  'Tous les devoirs',
          icon:   BookOpen,
          active: !appStore.activeProject,
          action: () => {
            appStore.activeProject = null
            router.push('/devoirs')
          },
        }
      case 'documents':
        return {
          label:  'Tous les documents',
          icon:   FolderOpen,
          active: !appStore.activeChannelId && !appStore.activeProject,
          action: () => {
            appStore.activeChannelId = null
            appStore.activeProject   = null
            router.push('/documents')
          },
        }
      default:
        return null
    }
  })

  // ── Contexte sidebar selon la route ───────────────────────────────────────
  const sectionLabel = computed(() => {
    if (route.name === 'dashboard') return 'Accueil'
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
    emit('navigate')
  }

  function selectDm(s: Student) {
    appStore.openDm(s.id, s.promo_id, s.name)
    if (route.name !== 'messages') router.push('/messages')
    emit('navigate')
    // Rafraîchir les contacts récents après un petit délai
    setTimeout(() => loadRecentDmContacts(), 500)
  }

  async function selectPromo(promoId: number) {
    appStore.activePromoId = promoId
    await loadTeacherChannels()
  }

  // ── Mute (localStorage) ───────────────────────────────────────────────────
  const MUTE_KEY = computed(() => `cc_muted_${appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0}`)

  function loadMuted(): Set<number> {
    try { return new Set(JSON.parse(localStorage.getItem(MUTE_KEY.value) ?? '[]') as number[]) }
    catch { return new Set() }
  }
  function saveMuted(s: Set<number>) {
    localStorage.setItem(MUTE_KEY.value, JSON.stringify([...s]))
  }

  const mutedIds = ref<Set<number>>(loadMuted())
  watch(MUTE_KEY, () => { mutedIds.value = loadMuted() })

  function isMuted(id: number) { return mutedIds.value.has(id) }
  function toggleMute(ch: Channel) {
    const next = new Set(mutedIds.value)
    if (next.has(ch.id)) { next.delete(ch.id); showToast(`"${ch.name}" retiré de la sourdine.`) }
    else                  { next.add(ch.id);    showToast(`"${ch.name}" mis en sourdine.`) }
    mutedIds.value = next
    saveMuted(next)
  }

  // ── Renommage inline ──────────────────────────────────────────────────────
  const renamingChannelId  = ref<number | null>(null)
  const renamingCategory   = ref<string | null>(null)
  const renameValue        = ref('')
  const renameInputEl      = ref<HTMLInputElement | null>(null)

  async function startRenameChannel(ch: Channel) {
    renamingCategory.value  = null
    renamingChannelId.value = ch.id
    renameValue.value       = ch.name
    await nextTick(); renameInputEl.value?.select()
  }
  async function startRenameCategory(cat: string) {
    renamingChannelId.value = null
    renamingCategory.value  = cat
    renameValue.value       = parseCategoryIcon(cat).label || cat
    await nextTick(); renameInputEl.value?.select()
  }
  function cancelRename() {
    renamingChannelId.value = null
    renamingCategory.value  = null
    renameValue.value       = ''
  }

  async function commitRenameChannel() {
    const id   = renamingChannelId.value
    const name = renameValue.value.trim()
    cancelRename()
    if (!id || !name) return
    const res = await window.api.renameChannel(id, name)
    if ((res as any)?.ok === false) { showToast('Erreur lors du renommage.', 'error'); return }
    await loadTeacherChannels()
    showToast('Canal renommé.', 'success')
  }

  async function commitRenameCategory() {
    const old  = renamingCategory.value
    const next = renameValue.value.trim()
    cancelRename()
    if (!old || !next || !appStore.activePromoId) return
    // Reconstruire la clé catégorie : on conserve l'icône prefix si présente
    const iconPrefix = old.includes(' ') ? old.split(' ')[0] + ' ' : ''
    const newKey = iconPrefix + next
    const res = await window.api.renameCategory(appStore.activePromoId, old, newKey)
    if ((res as any)?.ok === false) { showToast('Erreur lors du renommage.', 'error'); return }
    await loadTeacherChannels()
    showToast('Catégorie renommée.', 'success')
  }

  // ── Menu contextuel ───────────────────────────────────────────────────────
  interface CtxState { x: number; y: number; items: ContextMenuItem[] }
  const ctx = ref<CtxState | null>(null)

  function openCtxCategory(e: MouseEvent, group: { key: string; label: string }) {
    if (!appStore.isStaff) return
    ctx.value = {
      x: e.clientX, y: e.clientY,
      items: [
        {
          label: 'Ajouter un canal ici',
          icon:  PlusCircle,
          action: () => {
            appStore.pendingChannelCategory = group.key
            modals.createChannel = true
          },
        },
        {
          label: 'Renommer la catégorie',
          icon:  Pencil,
          action: () => startRenameCategory(group.key),
        },
        {
          label: 'Dissoudre la catégorie',
          icon:  Trash2,
          danger: true,
          separator: true,
          action: async () => {
            if (!appStore.activePromoId) return
            if (!await confirm(`Dissoudre la catégorie « ${group.key} » ? Les canaux seront déplacés hors catégorie.`, 'warning', 'Dissoudre')) return
            const res = await window.api.deleteCategory(appStore.activePromoId, group.key)
            if ((res as any)?.ok === false) { showToast('Erreur.', 'error'); return }
            await loadTeacherChannels()
            showToast('Catégorie dissoute.', 'success')
          },
        },
      ],
    }
  }

  function openCtxChannel(e: MouseEvent, ch: Channel) {
    if (!appStore.isStaff) return
    ctx.value = {
      x: e.clientX, y: e.clientY,
      items: [
        {
          label: 'Renommer',
          icon:  Pencil,
          action: () => startRenameChannel(ch),
        },
        {
          label:  isMuted(ch.id) ? 'Retirer la sourdine' : 'Mettre en sourdine',
          icon:   isMuted(ch.id) ? Volume2 : VolumeX,
          action: () => toggleMute(ch),
        },
        {
          label: 'Supprimer le canal',
          icon:  Trash2,
          danger: true,
          separator: true,
          action: async () => {
            if (!await confirm(`Supprimer le canal « #${ch.name} » et tous ses messages ? Cette action est irréversible.`, 'danger', 'Supprimer')) return
            const res = await window.api.deleteChannel(ch.id)
            if ((res as any)?.ok === false) { showToast('Erreur.', 'error'); return }
            if (appStore.activeChannelId === ch.id) appStore.activeChannelId = null
            await loadTeacherChannels()
            showToast('Canal supprimé.', 'success')
          },
        },
      ],
    }
  }

  // ── Drag & drop canaux entre catégories ──────────────────────────────────
  const draggingChannel  = ref<Channel | null>(null)
  const dragOverCategory = ref<string | null>(null)

  function onDragStart(e: DragEvent, ch: Channel) {
    draggingChannel.value = ch
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('text/plain', String(ch.id))
  }

  function onDragEnd() {
    draggingChannel.value  = null
    dragOverCategory.value = null
  }

  function onDragOver(e: DragEvent, groupKey: string) {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    dragOverCategory.value = groupKey
  }

  function onDragLeave(e: DragEvent, groupKey: string) {
    // Only clear if leaving to outside the group element
    const related = e.relatedTarget as Node | null
    const target  = e.currentTarget as HTMLElement
    if (!related || !target.contains(related)) {
      if (dragOverCategory.value === groupKey) dragOverCategory.value = null
    }
  }

  async function onDrop(e: DragEvent, groupKey: string) {
    e.preventDefault()
    const ch = draggingChannel.value
    draggingChannel.value  = null
    dragOverCategory.value = null
    if (!ch) return
    const newCategory = groupKey === NO_CAT ? null : groupKey
    if ((ch.category ?? null) === newCategory) return  // no change
    const res = await window.api.updateChannelCategory(ch.id, newCategory)
    if ((res as any)?.ok === false) { showToast('Erreur lors du déplacement.', 'error'); return }
    await loadTeacherChannels()
  }

  // ── Réactivité ────────────────────────────────────────────────────────────
  onMounted(() => {
    load(); loadCustomProjects()
    if (route.name === 'devoirs' || route.name === 'dashboard' || route.name === 'documents') loadDbProjects()
  })

  watch(() => route.name, (n) => {
    if (n === 'messages' || n === 'dashboard') load()
    if (n === 'devoirs' || n === 'dashboard' || n === 'documents')  loadDbProjects()
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
            background: user.type === 'teacher' ? 'var(--accent)' : user.type === 'ta' ? '#7B5EA7' : avatarColor(user.name),
            color: '#fff',
          }"
        >
          {{ user.avatar_initials }}
        </div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{{ user.name }}</span>
          <span class="sidebar-user-role">
            {{ user.type === 'teacher' ? 'Responsable Pédagogique' : user.type === 'ta' ? 'Intervenant' : user.promo_name ?? '' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Barre de recherche rapide -->
    <button
      class="sidebar-search-bar"
      aria-label="Rechercher (Ctrl+K)"
      @click="modals.cmdPalette = true"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <span class="sidebar-search-placeholder">Rechercher…</span>
      <kbd class="sidebar-search-kbd">Ctrl K</kbd>
    </button>

    <!-- Indicateur de section actuelle -->
    <div class="sidebar-section-indicator" :class="`sidebar-section--${route.name as string}`">
      {{ sectionLabel }}
    </div>

    <!-- Raccourci contextuel "Tout afficher" (caché sur le dashboard) -->
    <button
      v-if="sectionShortcut"
      class="sidebar-all-docs-btn"
      :class="{ active: sectionShortcut.active, [`section-${route.name as string}`]: true }"
      @click="sectionShortcut.action(); emit('navigate')"
    >
      <component :is="sectionShortcut.icon" :size="13" class="sidebar-all-docs-icon" />
      {{ sectionShortcut.label }}
    </button>

    <!-- Section Messages -->
    <div id="sidebar-section-messages">
      <!-- Rail des promos (prof/TA) -->
      <PromoRail
        v-if="appStore.isStaff && promotions.length"
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

      <!-- Tableau de bord -->
      <template v-else-if="route.name === 'dashboard'">
        <!-- Onglets de la vue dashboard -->
        <div class="sidebar-section-header">
          <span>Vue</span>
        </div>
        <nav aria-label="Onglets du tableau de bord">
          <button
            class="sidebar-item"
            :class="{ active: !route.query.tab || route.query.tab === 'projets' }"
            @click="router.push('/dashboard')"
          >
            <FolderOpen :size="13" class="project-icon" />
            <span class="channel-name">Projets</span>
          </button>
          <button
            class="sidebar-item"
            :class="{ active: route.query.tab === 'frise' }"
            @click="router.push({ path: '/dashboard', query: { tab: 'frise' } })"
          >
            <BarChart2 :size="13" class="project-icon" />
            <span class="channel-name">Frise chronologique</span>
          </button>
        </nav>

        <!-- Raccourcis rapides -->
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
          </template>
        </nav>

        <!-- Liste des projets -->
        <template v-if="allProjects.length">
          <div class="sidebar-section-header" style="margin-top:8px">
            <span>Projets</span>
            <button
              v-if="appStore.isTeacher"
              class="btn-icon"
              title="Nouveau projet"
              aria-label="Nouveau projet"
              style="padding:2px"
              @click="modals.newProject = true"
            >
              <Plus :size="14" />
            </button>
          </div>
          <nav aria-label="Filtrer par projet">
            <button
              v-for="proj in allProjects"
              :key="proj"
              class="sidebar-item"
              @click="selectProject(proj)"
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

        <NewProjectModal v-model="modals.newProject" @created="onProjectCreated" />
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
            <component
              v-if="parseCategoryIcon(proj).icon"
              :is="parseCategoryIcon(proj).icon!"
              :size="13"
              class="project-icon"
            />
            <span v-else class="project-bullet" />
            <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
            <span
              v-if="appStore.isStaff && projectStats[proj]"
              class="project-rendus-badge"
              :class="{ 'badge-complete': projectStats[proj].depots >= projectStats[proj].expected && projectStats[proj].expected > 0 }"
            >{{ projectStats[proj].depots }}/{{ projectStats[proj].expected }}</span>
          </button>
        </nav>

        <NewProjectModal v-model="modals.newProject" @created="onProjectCreated" />
      </template>

      <!-- Liste des projets (section Documents) -->
      <template v-else-if="route.name === 'documents'">
        <div class="sidebar-section-header">
          <span>Projets</span>
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

      <!-- Canaux groupés par catégorie (autres sections) -->
      <template v-else>
        <div id="sidebar-channels-header" class="sidebar-section-header sidebar-collapsible-header" @click="channelsCollapsed = !channelsCollapsed">
          <ChevronDown
            :size="12"
            class="sidebar-category-chevron"
            :class="{ rotated: channelsCollapsed }"
          />
          <span>{{ channelSectionLabel }}</span>
          <span class="sidebar-section-count">{{ visibleChannels.length }}</span>
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
          v-for="group in channelGroups"
          :key="group.key"
          class="sidebar-category"
          :class="{ 'drag-over': appStore.isStaff && dragOverCategory === group.key }"
          @dragover="appStore.isStaff ? onDragOver($event, group.key) : undefined"
          @dragleave="appStore.isStaff ? onDragLeave($event, group.key) : undefined"
          @drop="appStore.isStaff ? onDrop($event, group.key) : undefined"
        >
          <!-- En-tête de catégorie (affiché seulement s'il y a plusieurs groupes) -->
          <div
            v-if="channelGroups.length > 1"
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
              <span class="sidebar-category-count">{{ group.channels.length }}</span>
            </button>
          </div>

          <nav
            v-show="!collapsed.has(group.key)"
            :aria-label="group.label"
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
          <div class="sidebar-section-header sidebar-collapsible-header" style="margin-top:12px" @click="dmCollapsed = !dmCollapsed">
            <ChevronDown
              :size="12"
              class="sidebar-category-chevron"
              :class="{ rotated: dmCollapsed }"
            />
            <span>Messages directs</span>
            <span class="sidebar-section-count">{{ dmContactsToShow.length }}</span>
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
              >
                <span class="dm-avatar" :class="{ 'dm-avatar-teacher': s.id < 0 }" :style="{ background: s.id < 0 ? 'var(--accent)' : avatarColor(s.name) }">{{ s.avatar_initials }}</span>
                <span class="dm-info">
                  <span class="channel-name">{{ s.name }} <span v-if="s.id < 0" class="dm-teacher-tag">Prof</span></span>
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
  background: rgba(255, 255, 255, .05);
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
  background: rgba(255, 255, 255, .09);
  border-color: rgba(255, 255, 255, .18);
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
  background: rgba(255, 255, 255, .07);
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

.sidebar-all-docs-btn.section-devoirs .sidebar-all-docs-icon  { color: #9B87F5; }
.sidebar-all-docs-btn.section-devoirs.active  { color: #9B87F5; background: rgba(155,135,245,.08); }

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
.sidebar-section--devoirs   { color: #9B87F5; }
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

.sidebar-category-icon {
  flex-shrink: 0;
  opacity: .85;
}

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
.project-add-input:focus { border-color: #9B87F5; box-shadow: 0 0 0 2px rgba(155,135,245,.2); }

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
  /* Pas de contrainte ici — le scroll est géré par le parent */
}

/* ── Section repliable ── */
.sidebar-collapsible-header {
  display: flex !important;
  align-items: center;
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
  background: rgba(255,255,255,.06);
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
.dm-toggle-btn:hover { color: var(--accent, #4a90d9); background: rgba(255,255,255,.06); }

.dm-item {
  display: flex !important; align-items: center; gap: 8px; padding: 5px 12px !important;
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
  color: #9B87F5;
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
  color: #9B87F5;
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

</style>
