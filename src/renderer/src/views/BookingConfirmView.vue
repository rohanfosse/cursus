<script setup lang="ts">
/**
 * BookingConfirmView.vue — Page publique de confirmation de presence.
 *
 * Decision pilote (deep interview Q4) : un attendee qui clique sur
 * "Confirmer ma presence" dans le mail tripartite atterit ici. Le clic
 * declenche un POST idempotent ; le 2eme clic affiche "Deja confirmee".
 *
 * Le `cancel_token` sert de token opaque (deja unique par booking, deja
 * distribue dans le mail). Pas besoin d'un nouveau token dedie.
 *
 * Refonte v2.319 : design strict miroir de BookingCancelView pour la
 * coherence visuelle de toutes les pages publiques.
 */
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Check, X, Calendar, Clock, User } from 'lucide-vue-next'

const route = useRoute()
const cancelToken = route.params.token as string

const SERVER_URL = (import.meta.env?.VITE_SERVER_URL as string | undefined) || 'http://localhost:3001'

interface ConfirmData {
  bookingId: number
  eventTitle: string
  startDatetime: string
  endDatetime: string
  teacherName: string
  confirmedAt: string | null
  alreadyConfirmed: boolean
}

type Phase = 'loading' | 'done' | 'cancelled' | 'error'
const phase = ref<Phase>('loading')
const data = ref<ConfirmData | null>(null)
const error = ref('')

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

async function confirmNow() {
  try {
    const res = await fetch(`${SERVER_URL}/api/bookings/public/confirm/${cancelToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    if (!res.ok || !body.ok) {
      if (body?.code === 'cancelled') {
        phase.value = 'cancelled'
        return
      }
      error.value = body?.error || 'Erreur lors de la confirmation.'
      phase.value = 'error'
      return
    }
    data.value = body.data
    phase.value = 'done'
  } catch {
    error.value = 'Erreur de connexion au serveur.'
    phase.value = 'error'
  }
}

onMounted(() => {
  // Auto-confirm au chargement : le clic vient deja du mail, pas besoin
  // d'une 2e action manuelle. Idempotent cote backend.
  confirmNow()
})
</script>

<template>
  <div class="bcv-shell">
    <div class="bcv-card">
      <div v-if="phase === 'loading'" class="bcv-loading">Confirmation...</div>

      <template v-else-if="phase === 'done' && data">
        <div class="bcv-icon bcv-icon--success">
          <Check :size="34" />
        </div>
        <h1 class="bcv-title">{{ data.alreadyConfirmed ? 'Presence deja confirmee' : 'Presence confirmee' }}</h1>
        <p class="bcv-sub">Merci, l'enseignant est informe que vous serez present.</p>

        <div class="bcv-recap">
          <div class="bcv-recap-row">
            <Calendar :size="16" />
            <span class="bcv-recap-strong">{{ data.eventTitle }}</span>
          </div>
          <div class="bcv-recap-row">
            <Clock :size="16" />
            <span>{{ fmtDate(data.startDatetime) }} · {{ fmtTime(data.startDatetime) }} - {{ fmtTime(data.endDatetime) }}</span>
          </div>
          <div class="bcv-recap-row">
            <User :size="16" />
            <span>{{ data.teacherName }}</span>
          </div>
        </div>

        <p class="bcv-foot">
          Si vous devez annuler ou reporter, utilisez le lien dans votre mail de confirmation.
        </p>
      </template>

      <template v-else-if="phase === 'cancelled'">
        <div class="bcv-icon bcv-icon--warn">
          <X :size="34" />
        </div>
        <h1 class="bcv-title">RDV annule</h1>
        <p class="bcv-sub">Ce rendez-vous a ete annule. Inutile de confirmer la presence.</p>
      </template>

      <template v-else>
        <div class="bcv-icon bcv-icon--error">
          <X :size="34" />
        </div>
        <h1 class="bcv-title">Erreur</h1>
        <p class="bcv-sub">{{ error }}</p>
        <button class="bcv-btn bcv-btn--primary" @click="confirmNow">Reessayer</button>
      </template>
    </div>
    <p class="bcv-brand">cursus.school</p>
  </div>
</template>

<style scoped>
/* Tokens identiques a BookingCancelView pour coherence stricte. */
.bcv-shell {
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
  justify-content: center;
  padding: 56px 16px 32px;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1E1B4B;
}
.bcv-brand {
  margin: 24px 0 0;
  font-size: 11px;
  font-weight: 600;
  color: #94A3B8;
}

.bcv-card {
  background: #FFFFFF;
  border: 1px solid #E0E7FF;
  border-radius: 24px;
  padding: 44px 36px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08), 0 16px 48px rgba(99, 102, 241, 0.12);
  max-width: 460px;
  width: 100%;
  animation: bcvFadeIn 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes bcvFadeIn {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.bcv-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: #fff;
  animation: bcvPopIn 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes bcvPopIn {
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
}
.bcv-icon--success {
  background: #6366F1;
  box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.12), 0 12px 36px rgba(99, 102, 241, 0.30);
}
.bcv-icon--warn {
  background: #F59E0B;
  box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.12), 0 12px 36px rgba(245, 158, 11, 0.30);
}
.bcv-icon--error {
  background: #EF4444;
  box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.12), 0 12px 36px rgba(239, 68, 68, 0.30);
}

.bcv-title {
  font-size: 26px;
  font-weight: 800;
  margin: 0 0 10px;
  color: #1E1B4B;
  letter-spacing: -0.025em;
}
.bcv-sub {
  color: #64748B;
  line-height: 1.6;
  margin: 0 0 24px;
  font-size: 14px;
}

.bcv-recap {
  text-align: left;
  margin: 4px 0 16px;
  padding: 18px 20px;
  background: rgba(245, 243, 255, 0.6);
  border: 1px solid #E0E7FF;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bcv-recap-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #1E1B4B;
}
.bcv-recap-row svg { color: #6366F1; flex-shrink: 0; }
.bcv-recap-strong { font-weight: 700; }

.bcv-foot {
  font-size: 12.5px;
  color: #94A3B8;
  margin: 0;
  line-height: 1.5;
}

.bcv-loading {
  padding: 24px;
  color: #64748B;
  font-size: 14px;
}

.bcv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  border: 1.5px solid transparent;
  cursor: pointer;
  letter-spacing: -0.01em;
  margin-top: 8px;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.18s cubic-bezier(0.22, 1, 0.36, 1),
              background 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.bcv-btn--primary {
  background: #6366F1;
  color: #fff;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.30);
}
.bcv-btn--primary:hover {
  background: #4F46E5;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.40);
}
.bcv-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.30);
}

@media (prefers-color-scheme: dark) {
  .bcv-shell {
    background:
      radial-gradient(ellipse 80% 50% at 50% 25%, rgba(129, 140, 248, 0.10), transparent 70%),
      radial-gradient(ellipse 40% 30% at 70% 60%, rgba(52, 211, 153, 0.05), transparent 60%),
      radial-gradient(circle 1px at center, rgba(129, 140, 248, 0.10) 1px, transparent 1px);
    background-color: #0F0D1A;
    color: #F1F0FF;
  }
  .bcv-card { background: #1A1733; border-color: rgba(129, 140, 248, 0.15); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.30), 0 16px 48px rgba(0, 0, 0, 0.45); }
  .bcv-title { color: #F1F0FF; }
  .bcv-sub, .bcv-foot { color: #94A3B8; }
  .bcv-recap { background: rgba(15, 13, 26, 0.5); border-color: rgba(129, 140, 248, 0.15); }
  .bcv-recap-row { color: #F1F0FF; }
  .bcv-recap-row svg { color: #818CF8; }
  .bcv-brand { color: #475569; }
}

@media (max-width: 640px) {
  .bcv-shell { padding: 24px 12px; }
  .bcv-card { padding: 36px 24px; }
  .bcv-brand { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .bcv-card, .bcv-icon { animation: none; }
}
</style>
