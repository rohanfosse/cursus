<script setup lang="ts">
/**
 * BookingTeacherView.vue — Page profil public d'un enseignant.
 *
 * Route /book/u/:slug. Pattern Calendly : URL stable a partager en
 * signature mail. Affiche le nom du prof + la liste de ses event-types
 * actifs ET publics. Click sur un type -> redirige vers /book/e/:slug
 * (le flow de reservation existant).
 *
 * Aligne sur le design landing : background gradient lavande, cards
 * radius 24, accent color du type sur la border-left, hover lift.
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Calendar, Clock, ChevronRight, AlertCircle, Loader2 } from 'lucide-vue-next'

interface EventType {
  slug: string
  title: string
  description: string | null
  durationMinutes: number
  color: string
}
interface Profile {
  teacher: { name: string; slug: string }
  eventTypes: EventType[]
}

const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string

const SERVER_URL = (import.meta.env?.VITE_SERVER_URL as string | undefined) || 'http://localhost:3001'

type Phase = 'loading' | 'ready' | 'empty' | 'not_found' | 'error'
const phase = ref<Phase>('loading')
const data = ref<Profile | null>(null)
const error = ref('')

function teacherInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?'
}

function pickEventType(et: EventType) {
  router.push({ name: 'booking-public-event', params: { slug: et.slug } })
}

onMounted(async () => {
  try {
    const res = await fetch(`${SERVER_URL}/api/bookings/public/teacher/${encodeURIComponent(slug)}`)
    const body = await res.json()
    if (!res.ok || !body.ok) {
      if (body?.code === 'not_found' || res.status === 404) {
        phase.value = 'not_found'
      } else {
        error.value = body?.error || 'Erreur lors du chargement du profil.'
        phase.value = 'error'
      }
      return
    }
    data.value = body.data as Profile
    phase.value = data.value.eventTypes.length === 0 ? 'empty' : 'ready'
  } catch {
    error.value = 'Erreur de connexion au serveur.'
    phase.value = 'error'
  }
})
</script>

<template>
  <div class="btv-shell">
    <div class="btv-card">
      <!-- Loading -->
      <div v-if="phase === 'loading'" class="btv-loading">
        <Loader2 :size="20" class="btv-spin" />
        <span>Chargement du profil...</span>
      </div>

      <!-- Ready : header profil + liste types -->
      <template v-else-if="phase === 'ready' && data">
        <header class="btv-header">
          <div class="btv-avatar" aria-hidden="true">{{ teacherInitials(data.teacher.name) }}</div>
          <p class="btv-eyebrow">Prendre rendez-vous</p>
          <h1 class="btv-title">{{ data.teacher.name }}</h1>
          <p class="btv-sub">Choisissez un type de rendez-vous ci-dessous pour voir les disponibilites.</p>
        </header>

        <ul class="btv-list" role="list">
          <li v-for="et in data.eventTypes" :key="et.slug">
            <button
              type="button"
              class="btv-type"
              :style="{ '--type-accent': et.color || '#6366F1' }"
              :aria-label="`Reserver ${et.title}, ${et.durationMinutes} minutes`"
              @click="pickEventType(et)"
            >
              <span class="btv-type-dot" aria-hidden="true" />
              <span class="btv-type-body">
                <span class="btv-type-title">{{ et.title }}</span>
                <span class="btv-type-meta">
                  <Clock :size="12" />
                  {{ et.durationMinutes }} min
                </span>
                <span v-if="et.description" class="btv-type-desc">{{ et.description }}</span>
              </span>
              <ChevronRight :size="18" class="btv-type-chev" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </template>

      <!-- Empty (profil existe mais aucun event-type publie) -->
      <template v-else-if="phase === 'empty' && data">
        <div class="btv-icon btv-icon--warn">
          <Calendar :size="34" />
        </div>
        <h1 class="btv-title">Aucun creneau public</h1>
        <p class="btv-sub">
          {{ data.teacher.name }} n'a pas encore publie de type de rendez-vous accessible publiquement.
          Essayez plus tard ou contactez-le directement.
        </p>
      </template>

      <!-- Not found -->
      <template v-else-if="phase === 'not_found'">
        <div class="btv-icon btv-icon--warn">
          <AlertCircle :size="34" />
        </div>
        <h1 class="btv-title">Profil introuvable</h1>
        <p class="btv-sub">Ce lien ne correspond a aucun enseignant. Verifiez l'URL ou contactez la personne qui vous l'a partagee.</p>
      </template>

      <!-- Error -->
      <template v-else>
        <div class="btv-icon btv-icon--error">
          <AlertCircle :size="34" />
        </div>
        <h1 class="btv-title">Erreur</h1>
        <p class="btv-sub">{{ error }}</p>
      </template>
    </div>
    <p class="btv-brand">cursus.school</p>
  </div>
</template>

<style scoped>
/* Tokens & layout : strict miroir de BookingShell + BookingCancelView
   pour la coherence des pages publiques. */
.btv-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 80% 50% at 50% 25%, rgba(99, 102, 241, 0.12), transparent 70%),
    radial-gradient(ellipse 40% 30% at 70% 60%, rgba(5, 150, 105, 0.06), transparent 60%),
    radial-gradient(circle 1px at center, rgba(99, 102, 241, 0.18) 1px, transparent 1px);
  background-color: #F5F3FF;
  background-size: 100% 100%, 100% 100%, 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 56px 16px 32px;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1E1B4B;
}
.btv-brand {
  margin: 28px 0 0;
  font-size: 11px;
  font-weight: 600;
  color: #94A3B8;
}

.btv-card {
  background: #FFFFFF;
  border: 1px solid #E0E7FF;
  border-radius: 24px;
  padding: 44px 36px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08), 0 16px 48px rgba(99, 102, 241, 0.12);
  max-width: 540px;
  width: 100%;
  animation: btvFadeIn 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes btvFadeIn {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Header profil */
.btv-header {
  margin-bottom: 28px;
}
.btv-avatar {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366F1 0%, #818CF8 100%);
  color: #fff;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.10), 0 12px 36px rgba(99, 102, 241, 0.30);
  animation: btvAvatarIn 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes btvAvatarIn {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
.btv-eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6366F1;
}
.btv-title {
  margin: 0 0 10px;
  font-size: 26px;
  font-weight: 800;
  color: #1E1B4B;
  letter-spacing: -0.025em;
  line-height: 1.2;
}
.btv-sub {
  margin: 0;
  font-size: 14px;
  color: #64748B;
  line-height: 1.6;
}

/* Liste de types */
.btv-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}
.btv-type {
  --type-accent: #6366F1;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 18px;
  border: 1.5px solid #E0E7FF;
  border-left: 4px solid var(--type-accent);
  border-radius: 14px;
  background: #FFFFFF;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: inherit;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
              border-color 0.18s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.btv-type:hover {
  transform: translateY(-2px);
  border-color: var(--type-accent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--type-accent) 20%, transparent);
}
.btv-type:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--type-accent) 30%, transparent);
}

.btv-type-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--type-accent);
  flex-shrink: 0;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--type-accent) 18%, transparent);
}
.btv-type-body {
  flex: 1;
  display: grid;
  gap: 4px;
  min-width: 0;
}
.btv-type-title {
  font-size: 15px;
  font-weight: 700;
  color: #1E1B4B;
  letter-spacing: -0.015em;
}
.btv-type-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--type-accent);
  font-weight: 600;
  width: fit-content;
}
.btv-type-desc {
  font-size: 13px;
  color: #64748B;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.btv-type-chev {
  color: #94A3B8;
  flex-shrink: 0;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), color 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.btv-type:hover .btv-type-chev { color: var(--type-accent); transform: translateX(2px); }

/* Etats fallback (empty / not found / error) reusing design BookingCancelView */
.btv-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: #fff;
  animation: btvPopIn 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes btvPopIn {
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
}
.btv-icon--warn {
  background: #F59E0B;
  box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.12), 0 12px 36px rgba(245, 158, 11, 0.30);
}
.btv-icon--error {
  background: #EF4444;
  box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.12), 0 12px 36px rgba(239, 68, 68, 0.30);
}

.btv-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: #64748B;
  font-size: 14px;
}
.btv-spin { animation: btvSpin 1s linear infinite; }
@keyframes btvSpin { to { transform: rotate(360deg); } }

@media (prefers-color-scheme: dark) {
  .btv-shell {
    background:
      radial-gradient(ellipse 80% 50% at 50% 25%, rgba(129, 140, 248, 0.10), transparent 70%),
      radial-gradient(ellipse 40% 30% at 70% 60%, rgba(52, 211, 153, 0.05), transparent 60%),
      radial-gradient(circle 1px at center, rgba(129, 140, 248, 0.10) 1px, transparent 1px);
    background-color: #0F0D1A;
    color: #F1F0FF;
  }
  .btv-card { background: #1A1733; border-color: rgba(129, 140, 248, 0.15); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.30), 0 16px 48px rgba(0, 0, 0, 0.45); }
  .btv-title { color: #F1F0FF; }
  .btv-sub { color: #94A3B8; }
  .btv-type { background: rgba(255, 255, 255, 0.03); border-color: rgba(129, 140, 248, 0.20); color: #F1F0FF; }
  .btv-type-title { color: #F1F0FF; }
  .btv-type-desc { color: #94A3B8; }
  .btv-brand { color: #475569; }
}

@media (max-width: 640px) {
  .btv-shell { padding: 24px 12px; }
  .btv-card { padding: 36px 24px; }
  .btv-brand { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .btv-card, .btv-icon, .btv-avatar { animation: none; }
}
</style>
