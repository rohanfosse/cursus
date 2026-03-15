<script setup lang="ts">
  import { ref, watch, computed, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { Plus } from '@lucide/vue-next'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useTravauxStore } from '@/stores/travaux'
  import PromoRail    from './PromoRail.vue'
  import ChannelItem  from './ChannelItem.vue'
  import { avatarColor }  from '@/utils/format'
  import type { Channel, Student, Promotion } from '@/types'

  const appStore      = useAppStore()
  const modals        = useModalsStore()
  const messagesStore = useMessagesStore()
  const travauxStore  = useTravauxStore()
  const route         = useRoute()

  // ── État local ────────────────────────────────────────────────────────────
  const promotions  = ref<Promotion[]>([])
  const channels    = ref<Channel[]>([])
  const students    = ref<Student[]>([])
  const loading     = ref(false)

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

  const dmStudents = computed(() =>
    students.value.filter((s) => s.id !== user.value?.id),
  )

  // ── Interactions ──────────────────────────────────────────────────────────
  function selectChannel(ch: Channel) {
    appStore.openChannel(ch.id, ch.promo_id, ch.name, ch.type)
    messagesStore.fetchMessages()
    messagesStore.fetchPinned(ch.id)
    if (appStore.isStudent) travauxStore.fetchStudentTravaux()
  }

  function selectDm(s: Student) {
    appStore.openDm(s.id, s.promo_id, s.name)
    messagesStore.fetchMessages()
  }

  async function selectPromo(promoId: number) {
    appStore.activePromoId = promoId
    await loadTeacherChannels()
  }

  // ── Réactivité ────────────────────────────────────────────────────────────
  onMounted(load)

  // Recharger quand on revient sur la section Messages
  watch(() => route.name, (n) => { if (n === 'messages') load() })

  // Recharger après création d'un canal
  watch(() => modals.createChannel, (open) => { if (!open) load() })
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

      <!-- Canaux -->
      <template v-else>
        <div id="sidebar-channels-header" class="sidebar-section-header">
          <span>Canaux</span>
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

        <nav id="sidebar-nav" aria-label="Canaux">
          <ChannelItem
            v-for="ch in visibleChannels"
            :key="ch.id"
            :channel-id="ch.id"
            :name="ch.name"
            :prefix="ch.type === 'annonce' ? '📢' : '#'"
            :type="ch.type"
            @click="selectChannel(ch)"
          />
        </nav>

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
