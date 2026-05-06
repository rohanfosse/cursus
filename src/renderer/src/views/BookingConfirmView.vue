/**
 * BookingConfirmView.vue — Page publique de confirmation de presence.
 *
 * Decision pilote (deep interview Q4) : un attendee qui clique sur
 * "Confirmer ma presence" dans le mail tripartite atterit ici. Le clic
 * declenche un POST idempotent ; le 2eme clic affiche "Deja confirmee".
 *
 * Le `cancel_token` sert de token opaque (deja unique par booking, deja
 * distribue dans le mail). Pas besoin d'un nouveau token dedie.
 */
<script setup lang="ts">
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
  // Auto-confirm au chargement de la page : le clic vient deja du mail,
  // pas besoin d'une 2e action manuelle. Idempotent cote backend, donc
  // un refresh n'a aucun effet de bord.
  confirmNow()
})
</script>

<template>
  <div class="confirm-shell">
    <div class="confirm-card">
      <div v-if="phase === 'loading'" class="confirm-loading">Confirmation...</div>

      <template v-else-if="phase === 'done' && data">
        <div class="confirm-icon confirm-icon--success">
          <Check :size="36" />
        </div>
        <h1>{{ data.alreadyConfirmed ? 'Presence deja confirmee' : 'Presence confirmee' }}</h1>
        <p class="confirm-sub">
          Merci, l'enseignant est informe que vous serez present.
        </p>

        <div class="confirm-recap">
          <div class="confirm-row">
            <Calendar :size="16" />
            <span>{{ fmtDate(data.startDatetime) }}</span>
          </div>
          <div class="confirm-row">
            <Clock :size="16" />
            <span>{{ fmtTime(data.startDatetime) }} - {{ fmtTime(data.endDatetime) }}</span>
          </div>
          <div class="confirm-row">
            <User :size="16" />
            <span>{{ data.teacherName }}</span>
          </div>
        </div>

        <p class="confirm-foot">
          Si vous devez annuler ou reporter, utilisez le lien dans votre mail de confirmation.
        </p>
      </template>

      <template v-else-if="phase === 'cancelled'">
        <div class="confirm-icon confirm-icon--warn">
          <X :size="36" />
        </div>
        <h1>RDV annule</h1>
        <p>Ce rendez-vous a ete annule. Inutile de confirmer la presence.</p>
      </template>

      <template v-else>
        <div class="confirm-icon confirm-icon--error">
          <X :size="36" />
        </div>
        <h1>Erreur</h1>
        <p>{{ error }}</p>
        <button class="btn-retry" @click="confirmNow">Reessayer</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.confirm-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 16px;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.confirm-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.12);
  max-width: 460px;
  width: 100%;
}
.confirm-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
  color: #fff;
}
.confirm-icon--success { background: #6366F1; }
.confirm-icon--warn    { background: #F59E0B; }
.confirm-icon--error   { background: #EF4444; }
h1 {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 10px;
  color: #1E1B4B;
  letter-spacing: -0.02em;
}
p {
  color: #475569;
  line-height: 1.6;
  margin: 0 0 8px;
  font-size: 14px;
}
.confirm-sub { color: #64748B; margin-bottom: 24px; }

.confirm-recap {
  text-align: left;
  margin: 12px 0 20px;
  padding: 16px 18px;
  background: #F5F3FF;
  border: 1px solid #E0E7FF;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.confirm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: #1E1B4B;
}
.confirm-row svg { color: #6366F1; flex-shrink: 0; }

.confirm-foot {
  font-size: 12px;
  color: #94A3B8;
  margin-top: 12px;
}

.confirm-loading { padding: 20px; color: #64748B; font-size: 14px; }

.btn-retry {
  margin-top: 14px;
  padding: 10px 20px;
  border-radius: 10px;
  background: #6366F1;
  color: #fff;
  font-family: inherit;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-retry:hover { background: #4F46E5; }
</style>
