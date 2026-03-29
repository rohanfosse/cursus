<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  MessageCircle,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Rocket,
  Camera,
  Hash,
  Megaphone,
  ChevronRight,
  ChevronLeft,
} from 'lucide-vue-next'
import { avatarColor } from '@/utils/format'

// ── Props / Emits ───────────────────────────────────────────────────────────
const props = defineProps<{
  user: {
    name: string
    avatar_initials: string
    photo_data: string | null
    id: number
    promo_name: string | null
  }
  channels: Array<{
    id: number
    name: string
    type: string
    description?: string | null
  }>
}>()

const emit = defineEmits<{
  complete: []
}>()

// ── State ───────────────────────────────────────────────────────────────────
const step = ref(1)
const totalSteps = 5
const pendingPhoto = ref<string | null>(props.user.photo_data)
const savingPhoto = ref(false)
const direction = ref<'forward' | 'backward'>('forward')

// ── Computed ────────────────────────────────────────────────────────────────
const displayPhoto = computed(() => pendingPhoto.value)

const avatarBg = computed(() => avatarColor(props.user.name))

const chatChannels = computed(() =>
  props.channels.filter((c) => c.type === 'chat'),
)

const annonceChannels = computed(() =>
  props.channels.filter((c) => c.type === 'annonce'),
)

const features = [
  {
    icon: MessageCircle,
    title: 'Chat',
    description: 'Discute avec ta promo en temps reel',
  },
  {
    icon: FileText,
    title: 'Devoirs',
    description: 'Retrouve tes devoirs et soumets en un clic',
  },
  {
    icon: FolderOpen,
    title: 'Documents',
    description: 'Tous tes supports de cours au meme endroit',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Ton tableau de bord pour savoir ou tu en es',
  },
] as const

// ── Navigation ──────────────────────────────────────────────────────────────
function goNext() {
  if (step.value >= totalSteps) return
  direction.value = 'forward'
  if (step.value === 2 && pendingPhoto.value !== props.user.photo_data) {
    savePhoto()
  }
  step.value = step.value + 1
}

function goBack() {
  if (step.value <= 1) return
  direction.value = 'backward'
  step.value = step.value - 1
}

function finish() {
  emit('complete')
}

// ── Photo ───────────────────────────────────────────────────────────────────
async function pickPhoto() {
  const res = await window.api.openImageDialog()
  if (res?.ok && res.data) {
    pendingPhoto.value = res.data
  }
}

async function savePhoto() {
  if (pendingPhoto.value === props.user.photo_data) return
  savingPhoto.value = true
  try {
    await window.api.updateStudentPhoto({
      studentId: props.user.id,
      photoData: pendingPhoto.value,
    })
  } finally {
    savingPhoto.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="ob-overlay">
      <div class="ob-card" role="dialog" aria-modal="true" aria-label="Assistant de bienvenue">
        <!-- Step indicator -->
        <div class="ob-steps">
          <button
            v-for="s in totalSteps"
            :key="s"
            class="ob-dot"
            :class="{ active: s === step, done: s < step }"
            :aria-label="`Etape ${s} sur ${totalSteps}`"
            :disabled="true"
          />
        </div>

        <!-- Content area with transitions -->
        <div class="ob-content">
          <Transition :name="direction === 'forward' ? 'slide-left' : 'slide-right'" mode="out-in">

            <!-- Step 1: Bienvenue -->
            <div v-if="step === 1" key="step1" class="ob-step">
              <div class="ob-icon-large">
                <MessageCircle :size="48" />
              </div>
              <h2 class="ob-heading">Bienvenue sur Cursus</h2>
              <p class="ob-tagline">Tout ton cursus. Une seule app.</p>
              <p v-if="user.promo_name" class="ob-promo-badge">
                {{ user.promo_name }}
              </p>
              <button class="ob-btn-primary" @click="goNext">
                <span>Commencer</span>
                <ChevronRight :size="16" />
              </button>
            </div>

            <!-- Step 2: Photo de profil -->
            <div v-else-if="step === 2" key="step2" class="ob-step">
              <h2 class="ob-heading">Ta photo de profil</h2>
              <p class="ob-description">
                Ajoute une photo pour que tes camarades te reconnaissent facilement.
              </p>

              <div class="ob-avatar-section">
                <div class="ob-avatar" :style="{ background: displayPhoto ? 'none' : avatarBg }">
                  <img
                    v-if="displayPhoto"
                    :src="displayPhoto"
                    alt="Photo de profil"
                    class="ob-avatar-img"
                  />
                  <span v-else class="ob-avatar-initials">{{ user.avatar_initials }}</span>
                </div>
                <button class="ob-btn-secondary" @click="pickPhoto">
                  <Camera :size="15" />
                  <span>Choisir une photo</span>
                </button>
              </div>

              <div class="ob-nav-row">
                <button class="ob-btn-ghost" @click="goBack">
                  <ChevronLeft :size="16" />
                  <span>Retour</span>
                </button>
                <div class="ob-nav-right">
                  <button class="ob-btn-link" @click="goNext">Passer</button>
                  <button
                    v-if="pendingPhoto && pendingPhoto !== user.photo_data"
                    class="ob-btn-primary"
                    @click="goNext"
                  >
                    <span>Suivant</span>
                    <ChevronRight :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Step 3: Tes espaces -->
            <div v-else-if="step === 3" key="step3" class="ob-step">
              <h2 class="ob-heading">Decouvre tes espaces</h2>
              <p class="ob-description">
                Voici les canaux disponibles dans ta promotion.
              </p>

              <div class="ob-channels-list">
                <div v-if="chatChannels.length" class="ob-channel-group">
                  <span class="ob-channel-group-label">Canaux de discussion</span>
                  <div
                    v-for="ch in chatChannels"
                    :key="ch.id"
                    class="ob-channel-item"
                  >
                    <Hash :size="14" class="ob-channel-icon" />
                    <span class="ob-channel-name">{{ ch.name }}</span>
                  </div>
                </div>

                <div v-if="annonceChannels.length" class="ob-channel-group">
                  <span class="ob-channel-group-label">Canaux d'annonces</span>
                  <div
                    v-for="ch in annonceChannels"
                    :key="ch.id"
                    class="ob-channel-item"
                  >
                    <Megaphone :size="14" class="ob-channel-icon" />
                    <span class="ob-channel-name">{{ ch.name }}</span>
                  </div>
                </div>

                <p v-if="!chatChannels.length && !annonceChannels.length" class="ob-empty">
                  Aucun canal pour le moment.
                </p>
              </div>

              <p class="ob-hint">
                Tu pourras personnaliser tes notifications plus tard.
              </p>

              <div class="ob-nav-row">
                <button class="ob-btn-ghost" @click="goBack">
                  <ChevronLeft :size="16" />
                  <span>Retour</span>
                </button>
                <button class="ob-btn-primary" @click="goNext">
                  <span>Suivant</span>
                  <ChevronRight :size="16" />
                </button>
              </div>
            </div>

            <!-- Step 4: Les essentiels -->
            <div v-else-if="step === 4" key="step4" class="ob-step">
              <h2 class="ob-heading">Les essentiels</h2>
              <p class="ob-description">
                Tout ce dont tu as besoin, au meme endroit.
              </p>

              <div class="ob-features-grid">
                <div
                  v-for="feat in features"
                  :key="feat.title"
                  class="ob-feature-card"
                >
                  <div class="ob-feature-icon">
                    <component :is="feat.icon" :size="22" />
                  </div>
                  <h3 class="ob-feature-title">{{ feat.title }}</h3>
                  <p class="ob-feature-desc">{{ feat.description }}</p>
                </div>
              </div>

              <div class="ob-nav-row">
                <button class="ob-btn-ghost" @click="goBack">
                  <ChevronLeft :size="16" />
                  <span>Retour</span>
                </button>
                <button class="ob-btn-primary" @click="goNext">
                  <span>Suivant</span>
                  <ChevronRight :size="16" />
                </button>
              </div>
            </div>

            <!-- Step 5: C'est parti ! -->
            <div v-else-if="step === 5" key="step5" class="ob-step">
              <div class="ob-icon-large ob-icon-success">
                <Rocket :size="48" />
              </div>
              <h2 class="ob-heading">C'est parti !</h2>
              <p class="ob-tagline">Ton espace est pret. Bonne rentree !</p>

              <button class="ob-btn-primary ob-btn-finish" @click="finish">
                <span>Entrer dans Cursus</span>
                <ChevronRight :size="16" />
              </button>
            </div>

          </Transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────────── */
.ob-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Card ────────────────────────────────────────────────────────────────── */
.ob-card {
  width: 100%;
  max-width: 560px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 90vh;
}

/* ── Step dots ───────────────────────────────────────────────────────────── */
.ob-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 20px 0;
}

.ob-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--border);
  cursor: default;
  padding: 0;
  transition: background 0.2s ease, transform 0.2s ease;
}

.ob-dot.active {
  background: var(--accent);
  transform: scale(1.3);
}

.ob-dot.done {
  background: var(--color-success, #27ae60);
}

/* ── Content ─────────────────────────────────────────────────────────────── */
.ob-content {
  padding: 28px 32px 32px;
  overflow-y: auto;
}

.ob-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}

/* ── Typography ──────────────────────────────────────────────────────────── */
.ob-heading {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.ob-tagline {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 16px;
  line-height: 1.5;
}

.ob-description {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 16px;
  line-height: 1.5;
  max-width: 400px;
}

.ob-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 12px 0 0;
  font-style: italic;
}

.ob-promo-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(74, 144, 217, 0.12);
  padding: 4px 12px;
  border-radius: 20px;
  margin: 0 0 20px;
}

/* ── Icon large ──────────────────────────────────────────────────────────── */
.ob-icon-large {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: rgba(74, 144, 217, 0.12);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.ob-icon-success {
  background: rgba(39, 174, 96, 0.12);
  color: var(--color-success, #27ae60);
}

/* ── Avatar (Step 2) ─────────────────────────────────────────────────────── */
.ob-avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 8px 0 20px;
}

.ob-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 3px solid var(--border);
  flex-shrink: 0;
}

.ob-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ob-avatar-initials {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
}

/* ── Channels (Step 3) ───────────────────────────────────────────────────── */
.ob-channels-list {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;
  max-height: 220px;
  overflow-y: auto;
  padding: 2px;
}

.ob-channel-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ob-channel-group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.ob-channel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
}

.ob-channel-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.ob-channel-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.ob-empty {
  font-size: 13px;
  color: var(--text-muted);
}

/* ── Features grid (Step 4) ──────────────────────────────────────────────── */
.ob-features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
  max-width: 440px;
  margin-bottom: 8px;
}

.ob-feature-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 16px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  transition: border-color 0.15s ease;
}

.ob-feature-card:hover {
  border-color: var(--accent);
}

.ob-feature-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(74, 144, 217, 0.12);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ob-feature-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.ob-feature-desc {
  font-size: 11.5px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.ob-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.ob-btn-primary:hover {
  opacity: 0.9;
}

.ob-btn-primary:active {
  transform: scale(0.97);
}

.ob-btn-finish {
  padding: 12px 28px;
  font-size: 15px;
  margin-top: 8px;
}

.ob-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ob-btn-secondary:hover {
  background: rgba(74, 144, 217, 0.08);
}

.ob-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: transparent;
  color: var(--text-muted);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.ob-btn-ghost:hover {
  color: var(--text-primary);
}

.ob-btn-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  padding: 8px 12px;
  transition: color 0.15s ease;
}

.ob-btn-link:hover {
  color: var(--text-primary);
}

/* ── Navigation row ──────────────────────────────────────────────────────── */
.ob-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 20px;
}

.ob-nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Slide transitions ───────────────────────────────────────────────────── */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-left-enter-from {
  transform: translateX(30px);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-30px);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .ob-card {
    max-width: calc(100vw - 24px);
    border-radius: 12px;
  }

  .ob-content {
    padding: 20px 20px 24px;
  }

  .ob-features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
