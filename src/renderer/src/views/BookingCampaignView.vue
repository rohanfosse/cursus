<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Calendar, Clock, User, Mail, Building2, Check, ArrowLeft, Video, AlertCircle } from 'lucide-vue-next'
import { useCampaignBooking, type Slot } from '@/composables/useCampaignBooking'

const route = useRoute()
const token = route.params.token as string

const {
  info, selectedSlot, step, loading, error, errorCode, result,
  slotsByDate, sortedDates,
  fetchInfo, fetchSlots, selectSlot, backToCalendar, book,
} = useCampaignBooking(token)

const tutorName = ref('')
const tutorEmail = ref('')
const submitting = ref(false)

const errorTitle = computed(() => {
  switch (errorCode.value) {
    case 'closed':         return 'Campagne cloturee'
    case 'not_found':      return 'Lien introuvable'
    case 'already_booked': return 'Tu as deja reserve'
    default:               return 'Lien invalide'
  }
})

function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

async function onSubmit() {
  if (!info.value) return
  if (info.value.withTutor && (!tutorName.value.trim() || !tutorEmail.value.trim())) return
  submitting.value = true
  await book({
    tutorName: info.value.withTutor ? tutorName.value.trim() : undefined,
    tutorEmail: info.value.withTutor ? tutorEmail.value.trim() : undefined,
  })
  submitting.value = false
}

function onSlotClick(s: Slot) { selectSlot(s) }

onMounted(async () => {
  await fetchInfo()
  if (info.value && !result.value) await fetchSlots()
})
</script>

<template>
  <div class="campaign-shell">
    <div class="card" :style="info ? { '--accent': info.color } : {}">

      <div v-if="error && !info" class="state error">
        <AlertCircle :size="32" />
        <h1>{{ errorTitle }}</h1>
        <p>{{ error }}</p>
      </div>

      <div v-else-if="loading && !info" class="state">Chargement...</div>

      <template v-else-if="info">
        <header class="header">
          <div class="accent-bar" />
          <h1 class="title">{{ info.campaignTitle }}</h1>
          <div class="meta">
            <span><User :size="13" /> {{ info.teacherName }}</span>
            <span><Clock :size="13" /> {{ info.durationMinutes }} min</span>
          </div>
          <p class="hello">
            Bonjour <strong>{{ info.studentName }}</strong>, choisis ton creneau.
          </p>
          <p v-if="info.description" class="desc">{{ info.description }}</p>
        </header>

        <section v-if="step === 'calendar'" class="step">
          <div v-if="!sortedDates.length && !loading" class="empty">
            Aucun creneau disponible. Contacte ton enseignant.
          </div>
          <div v-for="d in sortedDates" :key="d" class="day-block">
            <h3 class="day-name">{{ fmtDay(d) }}</h3>
            <div class="slots">
              <button v-for="s in slotsByDate[d]" :key="s.start" class="slot" @click="onSlotClick(s)">
                {{ s.time }}
              </button>
            </div>
          </div>
        </section>

        <section v-else-if="step === 'details' && selectedSlot" class="step">
          <button class="back" @click="backToCalendar">
            <ArrowLeft :size="14" /> Changer de creneau
          </button>
          <div class="selected-slot">
            <Calendar :size="16" />
            <span>{{ fmtDateLong(selectedSlot.start) }}</span>
            <Clock :size="16" />
            <span>{{ fmtTime(selectedSlot.start) }} - {{ fmtTime(selectedSlot.end) }}</span>
          </div>

          <form class="form" @submit.prevent="onSubmit">
            <p class="hint">
              Tu seras automatiquement ajoute(e) au RDV en tant qu'<strong>{{ info.studentName }}</strong>
              ({{ info.studentEmail }}).
            </p>

            <template v-if="info.withTutor">
              <p class="form-section-title">Tuteur entreprise</p>
              <div class="field">
                <label for="tutor-name"><Building2 :size="12" /> Nom du tuteur</label>
                <input id="tutor-name" v-model="tutorName" autocomplete="name" required maxlength="200"
                  placeholder="Prenom Nom" />
              </div>
              <div class="field">
                <label for="tutor-email"><Mail :size="12" /> Email du tuteur</label>
                <input id="tutor-email" v-model="tutorEmail" type="email" autocomplete="email" required
                  placeholder="prenom.nom@entreprise.fr" />
              </div>
            </template>

            <p v-if="error" class="form-error">{{ error }}</p>
            <button class="submit" type="submit"
              :disabled="submitting || (info.withTutor && (!tutorName.trim() || !tutorEmail.trim()))">
              <Check :size="16" /> {{ submitting ? 'Reservation...' : 'Confirmer le rendez-vous' }}
            </button>
          </form>
        </section>

        <section v-else-if="step === 'confirmation' && result" class="step confirmation">
          <div class="success-icon"><Check :size="32" /></div>
          <h2>Rendez-vous confirme</h2>
          <p class="conf-detail">{{ fmtDateLong(result.startDatetime) }}</p>
          <p class="conf-time">{{ fmtTime(result.startDatetime) }} - {{ fmtTime(result.endDatetime) }}</p>
          <p class="conf-info">
            Une invitation calendrier a ete envoyee
            <span v-if="info.withTutor">a toi, a ton tuteur entreprise et a ton enseignant.</span>
            <span v-else>a toi et a ton enseignant.</span>
            Ouvre le fichier .ics pour l'ajouter a ton agenda.
          </p>
          <a v-if="result.joinUrl" :href="result.joinUrl" target="_blank" class="action-btn join">
            <Video :size="16" /> Lien visio (a garder)
          </a>
        </section>
      </template>

    </div>
  </div>
</template>

<style scoped>
.campaign-shell {
  min-height: 100vh; background: #f8fafc;
  display: flex; align-items: flex-start; justify-content: center;
  padding: 32px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .campaign-shell { background: #0f172a; color: #e2e8f0; }
}

.card {
  --accent: #6366f1;
  max-width: 600px; width: 100%;
  background: #fff; border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
@media (prefers-color-scheme: dark) {
  .card { background: #1e293b; color: #e2e8f0; }
}

.state {
  padding: 64px 32px; text-align: center; color: #64748b;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.state.error { color: #ef4444; }
.state h1 { margin: 8px 0 4px; font-size: 18px; color: inherit; }

.header { padding: 24px 24px 16px; position: relative; }
.accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--accent); }
.title { font-size: 22px; font-weight: 800; margin: 0 0 8px; color: #111827; }
@media (prefers-color-scheme: dark) { .title { color: #f1f5f9; } }
.meta { display: flex; gap: 16px; font-size: 13px; color: #64748b; margin-bottom: 12px; }
.meta span { display: flex; align-items: center; gap: 4px; }
.hello { font-size: 14px; color: #374151; margin: 8px 0 0; }
@media (prefers-color-scheme: dark) { .hello { color: #cbd5e1; } }
.desc { font-size: 13px; color: #64748b; margin: 8px 0 0; line-height: 1.5; }

.step { padding: 0 24px 24px; }
.empty { text-align: center; padding: 32px 0; color: #94a3b8; font-size: 13px; }

.day-block { margin-bottom: 16px; }
.day-name {
  font-size: 12px; font-weight: 700; text-transform: capitalize;
  color: #6b7280; margin: 12px 0 8px;
  border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
}
@media (prefers-color-scheme: dark) {
  .day-name { color: #94a3b8; border-color: #334155; }
}
.slots { display: flex; flex-wrap: wrap; gap: 6px; }
.slot {
  padding: 10px 16px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #fff; font-size: 13px; font-weight: 600; color: #374151;
  cursor: pointer; transition: all 0.12s; font-family: inherit;
  min-width: 70px; min-height: 40px;
}
.slot:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, #fff); color: var(--accent); }
@media (prefers-color-scheme: dark) {
  .slot { background: #334155; border-color: #475569; color: #e2e8f0; }
  .slot:hover { background: color-mix(in srgb, var(--accent) 20%, #334155); }
}

.back {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 600; color: #64748b;
  background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 12px;
  font-family: inherit;
}
.back:hover { color: var(--accent); }

.selected-slot {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  background: color-mix(in srgb, var(--accent) 8%, #fff);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, #e2e8f0);
  border-radius: 10px; margin-bottom: 16px;
  font-size: 13px; font-weight: 600; color: var(--accent);
  flex-wrap: wrap;
}

.form { display: flex; flex-direction: column; gap: 12px; }
.form-section-title { font-size: 12px; font-weight: 700; color: #475569; margin: 8px 0 0; }
.hint { font-size: 12px; color: #64748b; margin: 0; line-height: 1.4; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 12px; font-weight: 600; color: #64748b; display: flex; align-items: center; gap: 4px; }
.field input {
  padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 14px; color: #111827; outline: none; transition: border-color 0.15s;
  font-family: inherit;
}
.field input:focus { border-color: var(--accent); }
@media (prefers-color-scheme: dark) {
  .field input { background: #334155; border-color: #475569; color: #e2e8f0; }
}

.form-error { font-size: 12px; color: #ef4444; margin: 0; }

.submit {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: 10px; border: none;
  background: var(--accent); color: #fff; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.submit:hover:not(:disabled) { filter: brightness(1.08); }
.submit:disabled { opacity: 0.5; cursor: not-allowed; }

.confirmation { text-align: center; padding-top: 24px; }
.success-icon {
  width: 64px; height: 64px; border-radius: 50%; background: #22c55e;
  color: #fff; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.confirmation h2 { font-size: 18px; margin: 0 0 8px; color: #111827; }
@media (prefers-color-scheme: dark) { .confirmation h2 { color: #f1f5f9; } }
.conf-detail { font-size: 15px; font-weight: 600; color: #374151; margin: 0; }
.conf-time { font-size: 16px; font-weight: 700; color: #111827; margin: 4px 0 16px; }
.conf-info { font-size: 13px; color: #64748b; margin: 0 0 20px; line-height: 1.5; }

.action-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;
  border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;
  transition: all 0.12s; font-family: inherit;
}
.action-btn.join { background: var(--accent); color: #fff; }
.action-btn.join:hover { filter: brightness(1.1); }
</style>
