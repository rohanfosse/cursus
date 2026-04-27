<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Calendar, Plus, Send, Trash2, X, Check, Clock, Users, BellRing, ChevronDown, ChevronRight, AlertCircle } from 'lucide-vue-next'
import { useCampaigns, type Campaign, type HebdoRule } from '@/composables/useCampaigns'
import { useToast } from '@/composables/useToast'

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

const expandedId = ref<number | null>(null)
const showCreate = ref(false)
const submitting = ref(false)

// ── Form state ─────────────────────────────────────────────────────────
const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const todayStr = new Date().toISOString().slice(0, 10)
const inThreeWeeks = new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().slice(0, 10)

const form = ref({
  title: '',
  description: '',
  durationMinutes: 30,
  bufferMinutes: 0,
  color: '#6366f1',
  startDate: todayStr,
  endDate: inThreeWeeks,
  hebdoRules: [
    { dayOfWeek: 2, startTime: '14:00', endTime: '17:00' },
  ] as HebdoRule[],
  excludedDates: [] as string[],
  promoId: null as number | null,
  withTutor: true,
  notifyEmail: props.defaultNotifyEmail || '',
  useJitsi: true,
})

const newExclusion = ref('')

function resetForm() {
  form.value = {
    title: '', description: '', durationMinutes: 30, bufferMinutes: 0, color: '#6366f1',
    startDate: todayStr, endDate: inThreeWeeks,
    hebdoRules: [{ dayOfWeek: 2, startTime: '14:00', endTime: '17:00' }],
    excludedDates: [],
    promoId: null, withTutor: true, notifyEmail: props.defaultNotifyEmail || '', useJitsi: true,
  }
  newExclusion.value = ''
}

function addRule() {
  form.value.hebdoRules.push({ dayOfWeek: 2, startTime: '14:00', endTime: '17:00' })
}
function removeRule(i: number) {
  form.value.hebdoRules.splice(i, 1)
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

const canSubmit = computed(() => {
  return form.value.title.trim()
    && form.value.promoId
    && form.value.startDate <= form.value.endDate
    && form.value.hebdoRules.length > 0
    && form.value.hebdoRules.every(r => r.startTime < r.endTime)
})

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

function statusLabel(s: string) {
  return s === 'draft' ? 'Brouillon' : s === 'active' ? 'Active' : 'Cloturee'
}
function statusClass(s: string) {
  return s === 'draft' ? 'badge-warn' : s === 'active' ? 'badge-success' : 'badge-muted'
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

async function onLaunch(c: Campaign) {
  if (!confirm(`Envoyer ${c.invite_count ?? 0} mails d'invitation maintenant ?`)) return
  await launchCampaign(c.id)
}
async function onRemind(c: Campaign) {
  await remindCampaign(c.id)
}
async function onClose(c: Campaign) {
  if (!confirm('Cloturer la campagne ? Les liens etudiants ne seront plus accessibles.')) return
  await closeCampaign(c.id)
}
async function onDelete(c: Campaign) {
  await deleteCampaign(c.id)
}

function copyInviteLink(token: string) {
  const url = `${window.location.origin}/#/book/c/${token}`
  navigator.clipboard.writeText(url).then(() => showToast('Lien copie', 'success'))
}

onMounted(() => {
  fetchAll()
  loadPromos()
})
</script>

<template>
  <section class="campaigns">
    <div class="campaigns-header">
      <div class="campaigns-title">
        <Calendar :size="16" />
        <span>Campagnes de RDV</span>
        <span class="hint">Visites tripartites planifiees sur une periode</span>
      </div>
      <button class="btn-primary btn-sm" @click="showCreate = true">
        <Plus :size="12" /> Nouvelle campagne
      </button>
    </div>

    <div v-if="loading && !campaigns.length" class="empty">Chargement...</div>
    <div v-else-if="!campaigns.length" class="empty">
      Aucune campagne pour le moment. Cree-en une pour planifier des visites tripartites.
    </div>

    <div v-else class="campaign-list">
      <div v-for="c in campaigns" :key="c.id" class="campaign-card" :style="{ borderLeftColor: c.color }">
        <div class="campaign-row" @click="expandedId = expandedId === c.id ? null : c.id">
          <component :is="expandedId === c.id ? ChevronDown : ChevronRight" :size="14" />
          <span class="campaign-title">{{ c.title }}</span>
          <span class="campaign-period"><Clock :size="11" /> {{ fmtDate(c.start_date) }} - {{ fmtDate(c.end_date) }}</span>
          <span class="campaign-stats" :title="'Reservations'">
            <Users :size="11" /> {{ bookedRatio(c).label }}
            <span class="progress-bar"><span class="progress-fill" :style="{ width: progressPct(c) + '%' }" /></span>
          </span>
          <span class="badge" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
        </div>

        <div v-if="expandedId === c.id" class="campaign-detail">
          <div v-if="c.description" class="campaign-desc">{{ c.description }}</div>

          <div class="actions">
            <button v-if="c.status === 'draft'" class="btn-primary btn-sm" @click="onLaunch(c)">
              <Send :size="12" /> Lancer ({{ c.invite_count }} mails)
            </button>
            <button v-if="c.status === 'active'" class="btn-sm" @click="onRemind(c)">
              <BellRing :size="12" /> Relancer les non-reserves
            </button>
            <button v-if="c.status === 'active'" class="btn-sm" @click="onClose(c)">
              <X :size="12" /> Cloturer
            </button>
            <button v-if="c.status !== 'active'" class="btn-sm btn-danger" @click="onDelete(c)">
              <Trash2 :size="12" /> Supprimer
            </button>
          </div>

          <div v-if="c.invites && c.invites.length" class="invites-table">
            <div class="invites-header">
              <span>Etudiant</span>
              <span>Statut</span>
              <span>Creneau</span>
              <span>Lien</span>
            </div>
            <div v-for="inv in c.invites" :key="inv.id" class="invite-row" :class="{ 'invite-booked': inv.booking_id }">
              <span class="invite-name">{{ inv.student_name }}</span>
              <span v-if="inv.booking_id" class="invite-status booked">Reserve</span>
              <span v-else-if="inv.invited_at" class="invite-status pending">Invite</span>
              <span v-else class="invite-status draft">A inviter</span>
              <span class="invite-slot">
                <template v-if="inv.start_datetime">{{ fmtDatetime(inv.start_datetime) }}</template>
                <template v-else>—</template>
              </span>
              <button class="btn-mini" @click="copyInviteLink(inv.token)" title="Copier le lien personnel">Copier</button>
            </div>
          </div>
          <div v-else class="empty-small">Aucun etudiant pre-invite (verifie la promo cible).</div>
        </div>
      </div>
    </div>

    <!-- Modal de creation -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-header">
          <h2>Nouvelle campagne</h2>
          <button class="btn-icon" @click="showCreate = false"><X :size="16" /></button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full-width">
              <label class="field-label">Titre</label>
              <input v-model="form.title" class="input-field" placeholder="ex: Visite mi-parcours A4" />
            </div>
            <div class="form-field full-width">
              <label class="field-label">Description (optionnel — mail aux etudiants)</label>
              <textarea v-model="form.description" class="input-field textarea" rows="2"
                placeholder="ex: Bilan mi-parcours du stage. Le tuteur entreprise est invite." />
            </div>
            <div class="form-field">
              <label class="field-label">Promo cible</label>
              <select v-model="form.promoId" class="input-field">
                <option :value="null" disabled>-- Choisir --</option>
                <option v-for="p in promos" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">Duree d'un RDV</label>
              <select v-model.number="form.durationMinutes" class="input-field">
                <option :value="15">15 min</option>
                <option :value="30">30 min</option>
                <option :value="45">45 min</option>
                <option :value="60">60 min</option>
                <option :value="90">90 min</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">Du</label>
              <input v-model="form.startDate" type="date" class="input-field" :min="todayStr" />
            </div>
            <div class="form-field">
              <label class="field-label">Au</label>
              <input v-model="form.endDate" type="date" class="input-field" :min="form.startDate" />
            </div>

            <div class="form-field full-width">
              <label class="field-label">Plages hebdomadaires</label>
              <div v-for="(rule, i) in form.hebdoRules" :key="i" class="rule-row">
                <select v-model.number="rule.dayOfWeek" class="input-field rule-day">
                  <option v-for="(name, idx) in dayNames" :key="idx" :value="idx">{{ name }}</option>
                </select>
                <input v-model="rule.startTime" type="time" class="input-field" />
                <span class="dash">—</span>
                <input v-model="rule.endTime" type="time" class="input-field" />
                <button class="btn-icon btn-danger" @click="removeRule(i)" :disabled="form.hebdoRules.length === 1">
                  <Trash2 :size="12" />
                </button>
              </div>
              <button class="btn-sm" @click="addRule"><Plus :size="12" /> Ajouter une plage</button>
              <p class="hint-small">
                Cursus genere des creneaux de {{ form.durationMinutes }} min sur ces plages, pendant la periode.
              </p>
            </div>

            <div class="form-field full-width">
              <label class="field-label">Dates exclues (vacances, jours feries...)</label>
              <div class="exclusion-row">
                <input v-model="newExclusion" type="date" class="input-field"
                  :min="form.startDate" :max="form.endDate" />
                <button class="btn-sm" @click="addExclusion" :disabled="!newExclusion">Ajouter</button>
              </div>
              <div v-if="form.excludedDates.length" class="exclusions">
                <span v-for="d in form.excludedDates" :key="d" class="exclusion-chip">
                  {{ fmtDate(d) }}
                  <button class="chip-remove" @click="removeExclusion(d)"><X :size="10" /></button>
                </span>
              </div>
            </div>

            <div class="form-field full-width">
              <label class="checkbox-row">
                <input type="checkbox" v-model="form.withTutor" />
                <span>Visite tripartite — l'etudiant saisit aussi le nom + email de son tuteur entreprise</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" v-model="form.useJitsi" />
                <span>Generer un lien Jitsi Meet unique par RDV</span>
              </label>
            </div>

            <div class="form-field full-width">
              <label class="field-label">
                Email pour recevoir les invitations calendrier
                <span class="hint-inline">(adresse pro ou perso)</span>
              </label>
              <input v-model="form.notifyEmail" type="email" class="input-field"
                placeholder="ex: rfosse@cesi.fr" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-sm" @click="showCreate = false">Annuler</button>
          <button class="btn-primary btn-sm" :disabled="!canSubmit || submitting" @click="onSubmit">
            <Check :size="12" />
            {{ submitting ? 'Creation...' : 'Creer la campagne' }}
          </button>
        </div>
        <div v-if="!canSubmit" class="form-hint">
          <AlertCircle :size="12" /> Renseigne titre, promo, periode coherente et au moins une plage hebdo.
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.campaigns { display: flex; flex-direction: column; gap: 10px; }
.campaigns-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0;
}
.campaigns-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: var(--text-primary); }
.hint { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 6px; }

.empty, .empty-small {
  text-align: center; font-size: 12px; color: var(--text-muted);
  padding: 16px; background: var(--bg-elevated); border: 1px dashed var(--border); border-radius: 8px;
}

.campaign-list { display: flex; flex-direction: column; gap: 8px; }
.campaign-card {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-left: 3px solid #6366f1; border-radius: 8px; overflow: hidden;
}
.campaign-row {
  display: grid; grid-template-columns: auto 1fr auto auto auto; gap: 10px;
  align-items: center; padding: 10px 12px; cursor: pointer; transition: background 0.15s;
}
.campaign-row:hover { background: var(--bg-hover); }
.campaign-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.campaign-period { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); }
.campaign-stats { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); }
.progress-bar {
  display: inline-block; width: 50px; height: 4px; background: var(--border);
  border-radius: 2px; overflow: hidden;
}
.progress-fill { display: block; height: 100%; background: #22c55e; transition: width 0.3s; }
.badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.badge-warn { background: rgba(234, 179, 8, 0.15); color: #eab308; }
.badge-success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.badge-muted { background: var(--bg-main); color: var(--text-muted); }

.campaign-detail {
  border-top: 1px solid var(--border); padding: 12px;
  display: flex; flex-direction: column; gap: 12px;
  background: var(--bg-main);
}
.campaign-desc { font-size: 12px; color: var(--text-secondary); padding: 8px 12px; background: var(--bg-elevated); border-radius: 6px; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }

.invites-table {
  display: flex; flex-direction: column; gap: 2px;
  background: var(--bg-elevated); border-radius: 6px; overflow: hidden;
}
.invites-header, .invite-row {
  display: grid; grid-template-columns: 1.5fr 1fr 1.5fr auto;
  gap: 8px; align-items: center; padding: 6px 10px; font-size: 11px;
}
.invites-header { background: var(--bg-main); font-weight: 600; color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.invite-row:not(:last-child) { border-bottom: 1px solid var(--border); }
.invite-booked { background: color-mix(in srgb, #22c55e 5%, transparent); }
.invite-name { font-weight: 600; color: var(--text-primary); }
.invite-status { font-weight: 600; }
.invite-status.booked { color: #22c55e; }
.invite-status.pending { color: #eab308; }
.invite-status.draft { color: var(--text-muted); }
.invite-slot { color: var(--text-secondary); }

.btn-mini {
  font-family: var(--font); font-size: 10px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border);
  background: var(--bg-main); color: var(--text-secondary); cursor: pointer;
}
.btn-mini:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
}
.modal {
  background: var(--bg-elevated); border-radius: 12px; max-width: 640px; width: 100%;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.modal-header h2 { margin: 0; font-size: 16px; }
.modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 20px; border-top: 1px solid var(--border);
}
.form-hint {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 20px; font-size: 11px; color: #f59e0b;
  border-top: 1px solid var(--border); background: color-mix(in srgb, #f59e0b 5%, transparent);
}

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field.full-width { grid-column: 1 / -1; }
.field-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
.hint-inline { font-weight: 400; color: var(--text-muted); }
.hint-small { font-size: 10px; color: var(--text-muted); margin: 4px 0 0; font-style: italic; }
.textarea { min-height: 50px; resize: vertical; }

.rule-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.rule-day { width: 70px; }
.dash { color: var(--text-muted); }

.exclusion-row { display: flex; gap: 6px; }
.exclusions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.exclusion-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 2px 4px 2px 8px; border-radius: 4px;
  background: rgba(239, 68, 68, 0.1); color: #ef4444;
}
.chip-remove { background: none; border: none; color: #ef4444; cursor: pointer; padding: 0 2px; display: flex; }

.checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; padding: 4px 0; }
.checkbox-row input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; }

.input-field {
  background: var(--bg-input); border: 1px solid var(--border-input); border-radius: 6px;
  font-family: var(--font); font-size: 12px; color: var(--text-primary);
  padding: 6px 10px; outline: none; transition: border-color 0.15s;
}
.input-field:focus { border-color: var(--accent); }
.btn-sm {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font); font-size: 11px; font-weight: 600;
  padding: 5px 10px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); cursor: pointer; transition: all 0.15s;
}
.btn-sm:hover:not(:disabled) { background: var(--bg-hover); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-danger { color: #f87171; }
.btn-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border: none; background: none;
  cursor: pointer; border-radius: 4px; color: var(--text-muted);
}
.btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
</style>
