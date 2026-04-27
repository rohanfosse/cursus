<script setup lang="ts">
/**
 * CampaignManager — gestion des campagnes de RDV (visites tripartites).
 *
 * Refonte UX/UI v2.251.0 : passe sur les composants UI partages (UiCard,
 * UiButton, UiPill, EmptyState, Modal) + tokens design system. Plus de hex
 * hardcode, plus de modal/badge custom. Confirmation via useConfirm pour
 * matcher le reste de l'app. Voir design-system/cursus/MASTER.md.
 */
import { ref, computed, onMounted } from 'vue'
import {
  Calendar, Plus, Send, Trash2, X, Check, Clock, Users, BellRing,
  ChevronDown, ChevronRight, AlertCircle, Copy, MailCheck, Sparkles,
  CalendarRange, CalendarOff, Briefcase, Video, Eye,
} from 'lucide-vue-next'
import { useCampaigns, type Campaign, type HebdoRule } from '@/composables/useCampaigns'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import UiCard from '@/components/ui/UiCard.vue'
import UiPill from '@/components/ui/UiPill.vue'
import UiButton from '@/components/ui/UiButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Modal from '@/components/ui/Modal.vue'
import BookingPreviewModal from '@/components/booking/BookingPreviewModal.vue'
import type { BookingFlowInfo } from '@/components/booking/bookingFlow.types'

const props = defineProps<{
  defaultNotifyEmail?: string
}>()

const promos = ref<Array<{ id: number; name: string }>>([])

async function loadPromos() {
  try {
    const res = await window.api.getPromotions()
    if (res.ok && res.data) promos.value = res.data as Array<{ id: number; name: string }>
  } catch { /* ignore */ }
}

const {
  campaigns, loading, fetchAll,
  createCampaign, deleteCampaign, launchCampaign, remindCampaign, closeCampaign,
} = useCampaigns()
const { showToast } = useToast()
const { confirm } = useConfirm()

const expandedId = ref<number | null>(null)
const showCreate = ref(false)
const submitting = ref(false)

// ── Form state ─────────────────────────────────────────────────────────
// Lundi=1, Mardi=2... Dimanche=0 (compatibilite Date.getDay()).
// On affiche L-M-M-J-V-S-D pour suivre la convention FR.
const dayShort   = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const dayLong    = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const dayIsoToFr = [1, 2, 3, 4, 5, 6, 0] // index FR -> dayOfWeek (0=dim)

const todayStr = new Date().toISOString().slice(0, 10)
const inThreeWeeks = new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().slice(0, 10)

// Palette restreinte calee sur les tokens semantiques (cf. base.css).
const COLOR_PALETTE = [
  { value: '#4A90D9', label: 'Bleu' },
  { value: '#9B87F5', label: 'Violet' },
  { value: '#2ECC71', label: 'Vert' },
  { value: '#E8891A', label: 'Orange' },
  { value: '#E5A842', label: 'Or' },
  { value: '#E74C3C', label: 'Rouge' },
]

interface FormState {
  title: string
  description: string
  durationMinutes: number
  bufferMinutes: number
  color: string
  startDate: string
  endDate: string
  hebdoRules: HebdoRule[]
  excludedDates: string[]
  promoId: number | null
  withTutor: boolean
  notifyEmail: string
  useJitsi: boolean
}

function emptyForm(): FormState {
  return {
    title: '',
    description: '',
    durationMinutes: 30,
    bufferMinutes: 0,
    color: COLOR_PALETTE[1].value,
    startDate: todayStr,
    endDate: inThreeWeeks,
    hebdoRules: [{ dayOfWeek: 2, startTime: '14:00', endTime: '17:00' }],
    excludedDates: [],
    promoId: null,
    withTutor: true,
    notifyEmail: props.defaultNotifyEmail || '',
    useJitsi: true,
  }
}

const form = ref<FormState>(emptyForm())
const newExclusion = ref('')

function resetForm() {
  form.value = emptyForm()
  newExclusion.value = ''
}

function addRule() {
  form.value.hebdoRules.push({ dayOfWeek: 2, startTime: '14:00', endTime: '17:00' })
}
function removeRule(i: number) {
  form.value.hebdoRules.splice(i, 1)
}
function setRuleDay(i: number, dayOfWeek: number) {
  form.value.hebdoRules[i].dayOfWeek = dayOfWeek
}
function addExclusion() {
  if (!newExclusion.value) return
  if (!form.value.excludedDates.includes(newExclusion.value)) {
    form.value.excludedDates.push(newExclusion.value)
    form.value.excludedDates.sort()
  }
  newExclusion.value = ''
}
function removeExclusion(d: string) {
  form.value.excludedDates = form.value.excludedDates.filter(x => x !== d)
}

const validationErrors = computed(() => {
  const errs: string[] = []
  if (!form.value.title.trim()) errs.push('titre')
  if (!form.value.promoId)      errs.push('promo')
  if (form.value.startDate > form.value.endDate) errs.push('periode')
  if (!form.value.hebdoRules.length) errs.push('plage hebdomadaire')
  if (form.value.hebdoRules.some(r => r.startTime >= r.endTime)) errs.push('plage coherente')
  return errs
})
const canSubmit = computed(() => validationErrors.value.length === 0)

async function onSubmit() {
  if (!canSubmit.value || !form.value.promoId) return
  submitting.value = true
  const c = await createCampaign({
    title: form.value.title.trim(),
    description: form.value.description.trim() || undefined,
    durationMinutes: form.value.durationMinutes,
    bufferMinutes: form.value.bufferMinutes,
    color: form.value.color,
    startDate: form.value.startDate,
    endDate: form.value.endDate,
    hebdoRules: form.value.hebdoRules,
    excludedDates: form.value.excludedDates,
    promoId: form.value.promoId,
    withTutor: form.value.withTutor,
    notifyEmail: form.value.notifyEmail.trim() || undefined,
    useJitsi: form.value.useJitsi,
  })
  submitting.value = false
  if (c) {
    showCreate.value = false
    expandedId.value = c.id
    resetForm()
  }
}

// ── Helpers UI ─────────────────────────────────────────────────────────

type StatusTone = 'warning' | 'success' | 'muted'
function statusTone(s: Campaign['status']): StatusTone {
  return s === 'draft' ? 'warning' : s === 'active' ? 'success' : 'muted'
}
function statusLabel(s: Campaign['status']): string {
  return s === 'draft' ? 'Brouillon' : s === 'active' ? 'Active' : 'Cloturee'
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
function fmtDatetime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' a ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function bookedRatio(c: Campaign) {
  const total = c.invite_count ?? 0
  const booked = c.booked_count ?? 0
  return { total, booked, label: total ? `${booked}/${total}` : '0/0' }
}
function progressPct(c: Campaign) {
  const { total, booked } = bookedRatio(c)
  return total ? Math.round((booked / total) * 100) : 0
}
function progressTone(c: Campaign): 'warning' | 'success' | 'muted' {
  const pct = progressPct(c)
  if (pct >= 75) return 'success'
  if (pct >= 25) return 'warning'
  return 'muted'
}

// Stats agreges affiches en bandeau haut.
const totalsStats = computed(() => {
  const t = { drafts: 0, active: 0, closed: 0, invitedTotal: 0, bookedTotal: 0 }
  for (const c of campaigns.value) {
    if (c.status === 'draft')  t.drafts++
    if (c.status === 'active') t.active++
    if (c.status === 'closed') t.closed++
    t.invitedTotal += c.invite_count ?? 0
    t.bookedTotal  += c.booked_count ?? 0
  }
  return t
})
const totalsBookedPct = computed(() => {
  const { invitedTotal, bookedTotal } = totalsStats.value
  return invitedTotal ? Math.round((bookedTotal / invitedTotal) * 100) : 0
})

async function onLaunch(c: Campaign) {
  const ok = await confirm({
    message: `Envoyer ${c.invite_count ?? 0} mails d'invitation maintenant ? Les etudiants recevront leur lien personnel.`,
    confirmLabel: 'Envoyer les mails',
    variant: 'info',
  })
  if (!ok) return
  await launchCampaign(c.id)
}
async function onRemind(c: Campaign) {
  await remindCampaign(c.id)
}
async function onClose(c: Campaign) {
  const ok = await confirm({
    message: 'Cloturer la campagne ? Les liens etudiants ne seront plus accessibles.',
    confirmLabel: 'Cloturer',
    variant: 'warning',
  })
  if (!ok) return
  await closeCampaign(c.id)
}
async function onDelete(c: Campaign) {
  await deleteCampaign(c.id)
}

function copyInviteLink(token: string) {
  const url = `${window.location.origin}/#/book/c/${token}`
  navigator.clipboard.writeText(url).then(() => showToast('Lien copie', 'success'))
}

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

// ── Apercu invitation etudiant ───────────────────────────────────────────

const previewOpen = ref(false)
const previewInfo = ref<BookingFlowInfo | null>(null)

/**
 * Construit la BookingFlowInfo a partir d'une campagne pour montrer au prof
 * exactement ce que verra un etudiant invite (avec tuteur si tripartite).
 * Le nom de l'etudiant est generique car la preview n'est pas attachee a
 * une invitation precise.
 */
function openPreview(c: Campaign) {
  previewInfo.value = {
    title: c.title,
    description: c.description,
    durationMinutes: c.duration_minutes,
    color: c.color,
    hostName: 'Toi (apercu)',
    timezone: c.timezone,
    attendeeName: 'Etudiant invite',
    attendeeEmail: 'etudiant@exemple.fr',
    withTutor: c.with_tutor === 1,
  }
  previewOpen.value = true
}

onMounted(() => {
  fetchAll()
  loadPromos()
})
</script>

<template>
  <section class="cm">
    <!-- Header : titre + CTA principal -->
    <header class="cm-header">
      <div class="cm-title-block">
        <h2 class="cm-title">
          <Calendar :size="16" />
          Campagnes de RDV
        </h2>
        <p class="cm-subtitle">Visites tripartites planifiees sur une periode donnee.</p>
      </div>
      <UiButton variant="primary" size="sm" @click="showCreate = true">
        <template #leading><Plus :size="14" /></template>
        Nouvelle campagne
      </UiButton>
    </header>

    <!-- Bandeau stats (uniquement si au moins une campagne) -->
    <div v-if="campaigns.length" class="cm-stats">
      <div class="cm-stat">
        <span class="cm-stat-label">Brouillons</span>
        <span class="cm-stat-value">{{ totalsStats.drafts }}</span>
      </div>
      <div class="cm-stat cm-stat--accent">
        <span class="cm-stat-label">Actives</span>
        <span class="cm-stat-value">{{ totalsStats.active }}</span>
      </div>
      <div class="cm-stat">
        <span class="cm-stat-label">Cloturees</span>
        <span class="cm-stat-value">{{ totalsStats.closed }}</span>
      </div>
      <div class="cm-stat cm-stat--wide">
        <span class="cm-stat-label">Reservations</span>
        <span class="cm-stat-value">
          {{ totalsStats.bookedTotal }} / {{ totalsStats.invitedTotal }}
          <span class="cm-stat-pct">({{ totalsBookedPct }}%)</span>
        </span>
      </div>
    </div>

    <!-- Liste -->
    <div v-if="loading && !campaigns.length" class="cm-loading" aria-busy="true">
      <div v-for="n in 2" :key="n" class="cm-skeleton" />
    </div>

    <EmptyState
      v-else-if="!campaigns.length"
      :icon="CalendarRange"
      tone="accent"
      title="Aucune campagne pour le moment"
      subtitle="Crees-en une pour planifier des visites tripartites avec ta promotion. Cursus genere les creneaux et envoie les invitations en un clic."
    >
      <UiButton variant="primary" size="md" @click="showCreate = true">
        <template #leading><Plus :size="14" /></template>
        Creer ma premiere campagne
      </UiButton>
    </EmptyState>

    <ul v-else class="cm-list" role="list">
      <li v-for="c in campaigns" :key="c.id">
        <UiCard
          :accent-color="c.color"
          padding="sm"
          :elevated="1"
          class="cm-card"
        >
          <button
            type="button"
            class="cm-row"
            :aria-expanded="expandedId === c.id"
            :aria-controls="`cm-detail-${c.id}`"
            @click="toggleExpand(c.id)"
          >
            <component :is="expandedId === c.id ? ChevronDown : ChevronRight" :size="14" class="cm-row-chevron" />
            <span class="cm-row-title">{{ c.title }}</span>
            <span class="cm-row-period">
              <Clock :size="12" aria-hidden="true" />
              <span>{{ fmtDate(c.start_date) }} – {{ fmtDate(c.end_date) }}</span>
            </span>
            <div class="cm-row-progress" :title="`${progressPct(c)}% reserves`">
              <span class="cm-row-progress-label">
                <Users :size="12" aria-hidden="true" />
                {{ bookedRatio(c).label }}
              </span>
              <span class="cm-progress" role="progressbar"
                :aria-valuenow="progressPct(c)" aria-valuemin="0" aria-valuemax="100">
                <span
                  class="cm-progress-fill"
                  :class="`cm-progress-fill--${progressTone(c)}`"
                  :style="{ width: progressPct(c) + '%' }"
                />
              </span>
            </div>
            <UiPill :tone="statusTone(c.status)" size="xs">
              {{ statusLabel(c.status) }}
            </UiPill>
          </button>

          <div v-if="expandedId === c.id" :id="`cm-detail-${c.id}`" class="cm-detail">
            <p v-if="c.description" class="cm-desc">{{ c.description }}</p>

            <!-- Meta-infos rapides -->
            <div class="cm-meta">
              <span class="cm-meta-item">
                <Clock :size="12" /> {{ c.duration_minutes }} min/RDV
              </span>
              <span v-if="c.with_tutor" class="cm-meta-item">
                <Briefcase :size="12" /> Tripartite
              </span>
              <span v-if="c.use_jitsi" class="cm-meta-item">
                <Video :size="12" /> Jitsi auto
              </span>
              <span v-if="c.excluded_dates.length" class="cm-meta-item">
                <CalendarOff :size="12" /> {{ c.excluded_dates.length }} jour(s) exclu(s)
              </span>
            </div>

            <div class="cm-actions">
              <UiButton variant="ghost" size="sm" @click="openPreview(c)">
                <template #leading><Eye :size="12" /></template>
                Apercu invitation
              </UiButton>
              <UiButton v-if="c.status === 'draft'" variant="primary" size="sm" @click="onLaunch(c)">
                <template #leading><Send :size="12" /></template>
                Lancer ({{ c.invite_count ?? 0 }} mails)
              </UiButton>
              <UiButton v-if="c.status === 'active'" variant="ghost" size="sm" @click="onRemind(c)">
                <template #leading><BellRing :size="12" /></template>
                Relancer les non-reserves
              </UiButton>
              <UiButton v-if="c.status === 'active'" variant="ghost" size="sm" @click="onClose(c)">
                <template #leading><X :size="12" /></template>
                Cloturer
              </UiButton>
              <UiButton v-if="c.status !== 'active'" variant="danger" size="sm" @click="onDelete(c)">
                <template #leading><Trash2 :size="12" /></template>
                Supprimer
              </UiButton>
            </div>

            <div v-if="c.invites && c.invites.length" class="cm-invites">
              <div class="cm-invites-head">
                <span>Etudiant</span>
                <span>Statut</span>
                <span>Creneau</span>
                <span class="cm-invites-head-action">Action</span>
              </div>
              <div
                v-for="inv in c.invites"
                :key="inv.id"
                class="cm-invite"
                :class="{ 'cm-invite--booked': inv.booking_id }"
              >
                <span class="cm-invite-name">{{ inv.student_name }}</span>
                <UiPill v-if="inv.booking_id" tone="success" size="xs">
                  <template #leading><Check :size="10" /></template>
                  Reserve
                </UiPill>
                <UiPill v-else-if="inv.invited_at" tone="info" size="xs">
                  <template #leading><MailCheck :size="10" /></template>
                  Invite
                </UiPill>
                <UiPill v-else tone="muted" size="xs">
                  A inviter
                </UiPill>
                <span class="cm-invite-slot">
                  <template v-if="inv.start_datetime">{{ fmtDatetime(inv.start_datetime) }}</template>
                  <template v-else>—</template>
                </span>
                <button
                  type="button"
                  class="cm-copy-btn"
                  :aria-label="`Copier le lien de ${inv.student_name}`"
                  title="Copier le lien personnel"
                  @click="copyInviteLink(inv.token)"
                >
                  <Copy :size="12" />
                  <span>Copier</span>
                </button>
              </div>
            </div>
            <p v-else class="cm-empty-small">
              Aucun etudiant pre-invite — verifie que la promo cible contient bien des etudiants.
            </p>
          </div>
        </UiCard>
      </li>
    </ul>

    <!-- Modal de creation -->
    <Modal v-model="showCreate" title="Nouvelle campagne" max-width="640px">
      <div class="cm-form-body">
        <div class="cm-form-grid">
          <!-- Bloc identite -->
          <div class="cm-field cm-field--full">
            <label class="cm-label" for="cm-title">Titre</label>
            <input
              id="cm-title"
              v-model="form.title"
              class="form-input"
              placeholder="ex. Visite mi-parcours A4"
              maxlength="120"
              required
            />
          </div>

          <div class="cm-field cm-field--full">
            <label class="cm-label" for="cm-desc">
              Description
              <span class="cm-label-hint">Apparaitra dans le mail aux etudiants</span>
            </label>
            <textarea
              id="cm-desc"
              v-model="form.description"
              class="form-textarea"
              rows="2"
              placeholder="ex. Bilan mi-parcours du stage. Le tuteur entreprise est invite."
              maxlength="500"
            />
          </div>

          <div class="cm-field">
            <label class="cm-label" for="cm-promo">Promo cible</label>
            <select id="cm-promo" v-model="form.promoId" class="form-select">
              <option :value="null" disabled>— Choisir —</option>
              <option v-for="p in promos" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <div class="cm-field">
            <label class="cm-label" for="cm-duration">Duree d'un RDV</label>
            <select id="cm-duration" v-model.number="form.durationMinutes" class="form-select">
              <option :value="15">15 min</option>
              <option :value="30">30 min</option>
              <option :value="45">45 min</option>
              <option :value="60">60 min</option>
              <option :value="90">90 min</option>
            </select>
          </div>

          <div class="cm-field">
            <label class="cm-label" for="cm-start">Du</label>
            <input id="cm-start" v-model="form.startDate" type="date" class="form-input" :min="todayStr" />
          </div>
          <div class="cm-field">
            <label class="cm-label" for="cm-end">Au</label>
            <input id="cm-end" v-model="form.endDate" type="date" class="form-input" :min="form.startDate" />
          </div>

          <!-- Couleur -->
          <div class="cm-field cm-field--full">
            <label class="cm-label">Couleur d'identification</label>
            <div class="cm-palette" role="radiogroup" aria-label="Couleur de la campagne">
              <button
                v-for="c in COLOR_PALETTE"
                :key="c.value"
                type="button"
                class="cm-swatch"
                :class="{ 'cm-swatch--active': form.color === c.value }"
                :style="{ background: c.value }"
                :title="c.label"
                :aria-label="c.label"
                :aria-checked="form.color === c.value"
                role="radio"
                @click="form.color = c.value"
              >
                <Check v-if="form.color === c.value" :size="12" />
              </button>
            </div>
          </div>

          <!-- Plages hebdomadaires -->
          <div class="cm-field cm-field--full">
            <label class="cm-label">
              Plages hebdomadaires
              <span class="cm-label-hint">Les jours et heures ou tu es disponible</span>
            </label>
            <div v-for="(rule, i) in form.hebdoRules" :key="i" class="cm-rule">
              <div class="cm-rule-days" role="radiogroup" :aria-label="`Jour de la plage ${i + 1}`">
                <button
                  v-for="(short, idx) in dayShort"
                  :key="idx"
                  type="button"
                  class="cm-day-chip"
                  :class="{ 'cm-day-chip--active': rule.dayOfWeek === dayIsoToFr[idx] }"
                  :aria-checked="rule.dayOfWeek === dayIsoToFr[idx]"
                  :aria-label="dayLong[idx]"
                  :title="dayLong[idx]"
                  role="radio"
                  @click="setRuleDay(i, dayIsoToFr[idx])"
                >
                  {{ short }}
                </button>
              </div>
              <div class="cm-rule-times">
                <input v-model="rule.startTime" type="time" class="form-input cm-time-input" :aria-label="`Debut plage ${i + 1}`" />
                <span class="cm-rule-dash" aria-hidden="true">–</span>
                <input v-model="rule.endTime" type="time" class="form-input cm-time-input" :aria-label="`Fin plage ${i + 1}`" />
              </div>
              <UiButton
                variant="icon"
                size="sm"
                :aria-label="`Supprimer la plage ${i + 1}`"
                :disabled="form.hebdoRules.length === 1"
                @click="removeRule(i)"
              >
                <Trash2 :size="12" />
              </UiButton>
            </div>
            <UiButton variant="ghost" size="sm" @click="addRule">
              <template #leading><Plus :size="12" /></template>
              Ajouter une plage
            </UiButton>
            <p class="cm-hint">
              Cursus genere des creneaux de {{ form.durationMinutes }} min sur ces plages, pendant la periode.
            </p>
          </div>

          <!-- Dates exclues -->
          <div class="cm-field cm-field--full">
            <label class="cm-label" for="cm-exclude">
              Dates exclues
              <span class="cm-label-hint">Vacances, jours feries, deplacements</span>
            </label>
            <div class="cm-exclusion-row">
              <input
                id="cm-exclude"
                v-model="newExclusion"
                type="date"
                class="form-input cm-exclusion-input"
                :min="form.startDate"
                :max="form.endDate"
              />
              <UiButton variant="ghost" size="sm" :disabled="!newExclusion" @click="addExclusion">
                Ajouter
              </UiButton>
            </div>
            <div v-if="form.excludedDates.length" class="cm-exclusion-chips">
              <span v-for="d in form.excludedDates" :key="d" class="cm-exclusion-chip">
                <span>{{ fmtDate(d) }}</span>
                <button
                  type="button"
                  class="cm-chip-remove"
                  :aria-label="`Retirer ${fmtDate(d)}`"
                  @click="removeExclusion(d)"
                >
                  <X :size="10" />
                </button>
              </span>
            </div>
          </div>

          <!-- Options visite + visio -->
          <div class="cm-field cm-field--full">
            <div class="cm-toggle-grid">
              <label class="cm-toggle">
                <input v-model="form.withTutor" type="checkbox" />
                <div class="cm-toggle-text">
                  <span class="cm-toggle-title">
                    <Briefcase :size="13" /> Visite tripartite
                  </span>
                  <span class="cm-toggle-desc">L'etudiant saisit aussi le nom + email de son tuteur entreprise.</span>
                </div>
              </label>
              <label class="cm-toggle">
                <input v-model="form.useJitsi" type="checkbox" />
                <div class="cm-toggle-text">
                  <span class="cm-toggle-title">
                    <Video :size="13" /> Lien Jitsi auto
                  </span>
                  <span class="cm-toggle-desc">Generer un lien Jitsi Meet unique par RDV.</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Email notif -->
          <div class="cm-field cm-field--full">
            <label class="cm-label" for="cm-notify">
              Email pour les invitations calendrier
              <span class="cm-label-hint">Adresse pro ou perso (optionnel)</span>
            </label>
            <input
              id="cm-notify"
              v-model="form.notifyEmail"
              type="email"
              class="form-input"
              placeholder="ex. rfosse@cesi.fr"
            />
          </div>
        </div>

        <div v-if="!canSubmit" class="cm-form-validation">
          <AlertCircle :size="13" />
          <span>
            Renseigne&nbsp;: <strong>{{ validationErrors.join(', ') }}</strong>.
          </span>
        </div>
      </div>
      <footer class="cm-form-footer">
        <UiButton variant="ghost" size="md" @click="showCreate = false">Annuler</UiButton>
        <UiButton
          variant="primary"
          size="md"
          :disabled="!canSubmit"
          :loading="submitting"
          @click="onSubmit"
        >
          <template #leading><Sparkles :size="14" /></template>
          Creer la campagne
        </UiButton>
      </footer>
    </Modal>

    <BookingPreviewModal
      v-model="previewOpen"
      :info="previewInfo"
    />
  </section>
</template>

<style scoped>
/* ── Layout principal ─────────────────────────────────────────────────── */
.cm {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* Header */
.cm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}
.cm-title-block { display: flex; flex-direction: column; gap: 2px; }
.cm-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.cm-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ── Stats bandeau ────────────────────────────────────────────────────── */
.cm-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 2fr;
  gap: var(--space-sm);
}
@media (max-width: 640px) {
  .cm-stats { grid-template-columns: repeat(2, 1fr); }
  .cm-stat--wide { grid-column: 1 / -1; }
}
.cm-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.cm-stat--accent {
  border-color: rgba(var(--accent-rgb), .35);
  background: rgba(var(--accent-rgb), .06);
}
.cm-stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
}
.cm-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.cm-stat-pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-left: var(--space-xs);
}

/* ── Loading skeleton ─────────────────────────────────────────────────── */
.cm-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.cm-skeleton {
  height: 56px;
  border-radius: var(--radius-lg);
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 0%,
    var(--bg-hover) 50%,
    var(--bg-elevated) 100%
  );
  background-size: 200% 100%;
  animation: cm-shimmer 1.4s linear infinite;
}
@keyframes cm-shimmer {
  to { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .cm-skeleton { animation: none; }
}

/* ── Liste / cartes ──────────────────────────────────────────────────── */
.cm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.cm-card { padding: 0 !important; overflow: hidden; }

.cm-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: inherit;
  transition: background var(--motion-fast) var(--ease-out);
}
.cm-row:hover { background: var(--bg-hover); }
.cm-row:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: var(--radius-sm); }
.cm-row-chevron { color: var(--text-muted); flex-shrink: 0; }
.cm-row-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cm-row-period {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cm-row-progress {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 11px;
  color: var(--text-secondary);
}
.cm-row-progress-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.cm-progress {
  display: inline-block;
  width: 56px;
  height: 4px;
  background: var(--border);
  border-radius: 999px;
  overflow: hidden;
}
.cm-progress-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width var(--motion-base) var(--ease-out);
}
.cm-progress-fill--success { background: var(--color-success); }
.cm-progress-fill--warning { background: var(--color-warning); }
.cm-progress-fill--muted   { background: var(--text-muted); }

@media (max-width: 720px) {
  .cm-row { grid-template-columns: auto 1fr auto; }
  .cm-row-period, .cm-row-progress { display: none; }
}

/* ── Detail (panneau deplie) ─────────────────────────────────────────── */
.cm-detail {
  border-top: 1px solid var(--border);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  background: var(--bg-main);
}
.cm-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  line-height: 1.5;
}

.cm-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}
.cm-meta-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px var(--space-sm);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.cm-actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

/* ── Liste invites ────────────────────────────────────────────────────── */
.cm-invites {
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.cm-invites-head, .cm-invite {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1.6fr auto;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  font-size: 11px;
}
.cm-invites-head {
  background: var(--bg-main);
  font-weight: 700;
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.cm-invites-head-action { text-align: right; }
.cm-invite:not(:last-child) { border-bottom: 1px solid var(--border); }
.cm-invite--booked { background: color-mix(in srgb, var(--color-success) 4%, transparent); }
.cm-invite-name { font-weight: 600; color: var(--text-primary); }
.cm-invite-slot { color: var(--text-secondary); font-variant-numeric: tabular-nums; }

.cm-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 4px var(--space-sm);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  background: var(--bg-main);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-out);
  justify-self: end;
}
.cm-copy-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--accent);
}
.cm-copy-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.cm-empty-small {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
}

@media (max-width: 720px) {
  .cm-invites-head, .cm-invite {
    grid-template-columns: 1fr auto;
    row-gap: var(--space-xs);
  }
  .cm-invites-head { display: none; }
  .cm-invite-slot { grid-column: 1 / 3; font-size: 10px; }
  .cm-copy-btn { grid-column: 2; }
}

/* ── Formulaire (modal) ──────────────────────────────────────────────── */
.cm-form-body {
  padding: var(--space-lg);
  overflow-y: auto;
  max-height: calc(80vh - 120px);
}
.cm-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}
.cm-field { display: flex; flex-direction: column; gap: var(--space-xs); }
.cm-field--full { grid-column: 1 / -1; }

.cm-label {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .08em;
}
.cm-label-hint {
  font-size: 11px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-muted);
}

.cm-hint {
  margin: var(--space-xs) 0 0;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  line-height: 1.5;
}

/* Palette couleurs */
.cm-palette {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.cm-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: transform var(--motion-fast) var(--ease-spring), border-color var(--motion-fast) var(--ease-out);
}
.cm-swatch:hover { transform: scale(1.1); }
.cm-swatch--active { border-color: var(--text-primary); transform: scale(1.05); }
.cm-swatch:focus-visible { outline: none; box-shadow: var(--focus-ring); }

/* Plages hebdo */
.cm-rule {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}
.cm-rule-days {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
}
.cm-day-chip {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-out);
}
.cm-day-chip:hover { color: var(--text-primary); background: var(--bg-hover); }
.cm-day-chip--active {
  background: var(--accent);
  color: #fff;
}
.cm-day-chip:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.cm-rule-times {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}
.cm-time-input {
  width: auto;
  min-width: 96px;
  padding: 6px var(--space-sm);
  font-size: 12px;
}
.cm-rule-dash { color: var(--text-muted); font-weight: 600; }

/* Exclusions */
.cm-exclusion-row {
  display: flex;
  gap: var(--space-sm);
  align-items: stretch;
}
.cm-exclusion-input { flex: 1; max-width: 200px; }
.cm-exclusion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}
.cm-exclusion-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 11px;
  padding: 3px 4px 3px var(--space-sm);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger);
  font-weight: 600;
}
.cm-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  border: 0;
  color: var(--color-danger);
  cursor: pointer;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  transition: background var(--motion-fast) var(--ease-out);
}
.cm-chip-remove:hover { background: color-mix(in srgb, var(--color-danger) 30%, transparent); }
.cm-chip-remove:focus-visible { outline: none; box-shadow: var(--focus-ring); }

/* Toggles options */
.cm-toggle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}
@media (max-width: 540px) {
  .cm-toggle-grid { grid-template-columns: 1fr; }
}
.cm-toggle {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--ease-out), background var(--motion-fast) var(--ease-out);
}
.cm-toggle:hover { border-color: rgba(var(--accent-rgb), .35); background: rgba(var(--accent-rgb), .04); }
.cm-toggle:has(input:checked) {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb), .08);
}
.cm-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: var(--accent);
  flex-shrink: 0;
}
.cm-toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cm-toggle-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.cm-toggle-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Validation banner + footer */
.cm-form-validation {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  font-size: 12px;
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-top: 1px solid var(--border);
}

.cm-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--border);
  background: var(--bg-modal);
}

/* Responsive form */
@media (max-width: 540px) {
  .cm-form-grid { grid-template-columns: 1fr; }
  .cm-rule { flex-direction: column; align-items: stretch; }
  .cm-rule-days { justify-content: space-between; }
  .cm-day-chip { flex: 1; }
}
</style>
