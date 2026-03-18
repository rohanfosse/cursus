<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { MessageSquare, BookOpen, FileText, Calendar, UserCheck, LayoutDashboard, X } from 'lucide-vue-next'
  import logoUrl from '@/assets/logo.png'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import { avatarColor }    from '@/utils/format'
  import type { User } from '@/types'

  const appStore    = useAppStore()
  const modals      = useModalsStore()
  const travauxStore = useTravauxStore()
  const router      = useRouter()
  const route       = useRoute()

  const user = computed(() => appStore.currentUser)

  const avatarStyle = computed(() => {
    if (!user.value) return {}
    if (user.value.type === 'teacher') return { background: 'var(--accent)' }
    if (user.value.type === 'ta')      return { background: '#7B5EA7' }
    return { background: avatarColor(user.value.name) }
  })

  const pendingCount = computed(() => travauxStore.pendingDevoirs.length)

  // ── Bascule rapide vers un étudiant ─────────────────────────────────────────
  const quickStudent = ref<User | null>(null)

  onMounted(async () => {
    if (!appStore.isStaff) return
    const res = await window.api.getAllStudents()
    const list = res?.ok ? res.data : []
    if (list.length) {
      const s = list[0]
      quickStudent.value = {
        id:              s.id,
        name:            s.name,
        avatar_initials: s.avatar_initials ?? s.name.slice(0, 2).toUpperCase(),
        photo_data:      s.photo_data,
        type:            'student',
        promo_id:        s.promo_id,
        promo_name:      s.promo_name,
      }
    }
  })

  function toggleQuickStudent() {
    if (appStore.isSimulating) {
      appStore.stopSimulation()
    } else if (quickStudent.value) {
      appStore.startSimulation(quickStudent.value)
      router.replace('/messages')
    }
  }
</script>

<template>
  <nav class="nav-rail" aria-label="Navigation principale">
    <!-- Logo — cliquable pour le prof -->
    <div class="nav-logo">
      <img
        :src="logoUrl"
        class="nav-logo-img"
        alt="CESIA"
        :style="appStore.isStaff ? { cursor: 'pointer' } : {}"
        :title="appStore.isStaff ? 'Tableau de bord' : undefined"
        @click="appStore.isStaff && router.push('/dashboard')"
      />
    </div>

    <!-- ── Tableau de bord ── -->
    <button
      class="nav-btn"
      :class="{ active: route.name === 'dashboard' }"
      title="Tableau de bord"
      aria-label="Tableau de bord"
      @click="router.push('/dashboard')"
    >
      <LayoutDashboard :size="20" />
      <span class="nav-label">Accueil</span>
    </button>

    <!-- ── Navigation principale ── -->
    <button
      class="nav-btn"
      :class="{ active: route.name === 'messages' }"
      title="Messages"
      aria-label="Section Messages"
      @click="router.push('/messages')"
    >
      <MessageSquare :size="20" />
      <span class="nav-label">Messages</span>
    </button>

    <button
      class="nav-btn"
      :class="{ active: route.name === 'devoirs' }"
      title="Devoirs"
      aria-label="Section Devoirs"
      @click="router.push('/devoirs')"
    >
      <BookOpen :size="20" />
      <span class="nav-label">Devoirs</span>
      <span
        v-if="appStore.isStudent && pendingCount > 0"
        id="nav-badge-devoirs"
        class="nav-badge"
      >
        {{ pendingCount > 9 ? '9+' : pendingCount }}
      </span>
    </button>

    <button
      class="nav-btn"
      :class="{ active: route.name === 'documents' }"
      title="Documents"
      aria-label="Section Documents"
      @click="router.push('/documents')"
    >
      <FileText :size="20" />
      <span class="nav-label">Documents</span>
    </button>

    <!-- Espaceur -->
    <div style="flex:1" />

    <!-- ── Outils professeur / TA ── -->
    <template v-if="appStore.isStaff">
      <div class="nav-divider" />

      <button
        class="nav-btn"
        title="Simuler la vue d'un étudiant"
        aria-label="Simuler la vue d'un étudiant"
        @click="modals.impersonate = true"
      >
        <UserCheck :size="20" />
        <span class="nav-label">Simuler</span>
      </button>

      <button
        class="nav-btn"
        title="Échéancier"
        aria-label="Ouvrir l'échéancier"
        @click="modals.echeancier = true"
      >
        <Calendar :size="20" />
        <span class="nav-label">Agenda</span>
      </button>
    </template>

    <!-- ── Bascule rapide étudiant (prof/TA uniquement) ── -->
    <template v-if="appStore.isStaff && quickStudent">
      <button
        class="nav-quick-student"
        :class="{ simulating: appStore.isSimulating }"
        :title="appStore.isSimulating
          ? `Quitter la simulation (${quickStudent.name})`
          : `Basculer vers ${quickStudent.name}`"
        aria-label="Bascule rapide vue étudiant"
        @click="toggleQuickStudent"
      >
        <template v-if="appStore.isSimulating">
          <X :size="14" class="nqs-stop-icon" />
        </template>
        <template v-else>
          <div
            v-if="quickStudent.photo_data"
            class="nqs-photo"
          >
            <img :src="quickStudent.photo_data" :alt="quickStudent.name" />
          </div>
          <span v-else class="nqs-initials" :style="{ background: avatarColor(quickStudent.name) }">
            {{ quickStudent.avatar_initials }}
          </span>
        </template>
      </button>
    </template>

    <!-- ── Avatar / Paramètres ── -->
    <div class="nav-divider" />

    <button
      id="nav-user-avatar"
      class="nav-avatar-btn"
      :style="avatarStyle"
      :title="`${user?.name} — Paramètres`"
      aria-label="Paramètres du compte"
      @click="modals.settings = true"
    >
      <img v-if="user?.photo_data" :src="user.photo_data" :alt="user?.name" />
      <span v-else>{{ user?.avatar_initials }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* ── Logo ── */
.nav-logo-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,.3));
  transition: transform .15s;
}
.nav-logo-img:hover {
  transform: scale(1.07);
}

/* ── Bascule rapide étudiant ── */
.nav-quick-student {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1.5px solid rgba(230, 126, 34, .35);
  background: rgba(230, 126, 34, .08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 4px 0 2px;
  flex-shrink: 0;
  overflow: hidden;
  padding: 0;
  transition: background .15s, border-color .15s, box-shadow .15s;
  -webkit-app-region: no-drag;
  position: relative;
}
.nav-quick-student:hover {
  background: rgba(230, 126, 34, .18);
  border-color: rgba(230, 126, 34, .6);
  box-shadow: 0 0 0 2px rgba(230, 126, 34, .2);
}
.nav-quick-student.simulating {
  background: rgba(230, 126, 34, .2);
  border-color: #E67E22;
  animation: pulse-orange 2s ease-in-out infinite;
}
@keyframes pulse-orange {
  0%, 100% { box-shadow: 0 0 0 0 rgba(230, 126, 34, .4); }
  50%       { box-shadow: 0 0 0 4px rgba(230, 126, 34, 0); }
}
.nqs-stop-icon { color: #E67E22; }
.nqs-photo {
  width: 100%;
  height: 100%;
}
.nqs-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.nqs-initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0;
}

/* Avatar circulaire en bas du rail */
.nav-avatar-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin: 4px 0 6px;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  outline-offset: 2px;
  transition: box-shadow .15s, transform .15s;
  position: relative;
}

.nav-avatar-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0);
  transition: background .15s;
}

.nav-avatar-btn:hover::after {
  background: rgba(255,255,255,.15);
}

.nav-avatar-btn:hover {
  box-shadow: 0 0 0 2px rgba(255,255,255,.25);
}

.nav-avatar-btn:focus-visible {
  outline: 2px solid var(--accent);
}

.nav-avatar-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
