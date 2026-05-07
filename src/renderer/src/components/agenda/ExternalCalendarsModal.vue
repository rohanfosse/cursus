<script setup lang="ts">
/**
 * ExternalCalendarsModal — gestion des abonnements ICS publies.
 *
 * Cas d'usage : un prof publie un calendrier dans Outlook via "Publier un
 * calendrier" (URL `outlook.office365.com/owa/calendar/.../calendar.ics`),
 * colle l'URL ici en l'attachant a une promo. Cursus poll toutes les 30 min,
 * les events apparaissent dans l'agenda etudiant + prof.
 *
 * Lecture seule : on ne modifie pas l'agenda Outlook depuis Cursus, on
 * affiche uniquement.
 */
import { ref, onMounted, computed } from 'vue'
import { Plus, Trash2, RefreshCw, AlertCircle, Check, ExternalLink, X } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import { useToast } from '@/composables/useToast'

interface Promo { id: number; name: string; color: string }

interface Subscription {
  id: number
  promo_id: number
  teacher_id: number
  label: string
  color: string | null
  ics_url_masked: string
  is_active: number
  last_fetched_at: string | null
  last_error: string | null
  last_event_count: number
  promo_name?: string
  promo_color?: string
}

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; 'changed': [] }>()

const { showToast } = useToast()

const subscriptions = ref<Subscription[]>([])
const promos = ref<Promo[]>([])
const loading = ref(false)
const refreshingId = ref<number | null>(null)

// Form state
const formPromoId = ref<number | ''>('')
const formLabel = ref('')
const formIcsUrl = ref('')
const formColor = ref('#0ea5e9')
const submitting = ref(false)

const formValid = computed(() =>
  Boolean(formPromoId.value) &&
  formLabel.value.trim().length > 0 &&
  /^https?:\/\//i.test(formIcsUrl.value.trim()),
)

async function load() {
  loading.value = true
  try {
    const [sRes, pRes] = await Promise.all([
      window.api.listPromoCalendarSubscriptions(),
      window.api.getPromotions(),
    ])
    if (sRes?.ok && Array.isArray(sRes.data)) subscriptions.value = sRes.data as Subscription[]
    if (pRes?.ok && Array.isArray(pRes.data)) promos.value = pRes.data as Promo[]
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!formValid.value || submitting.value) return
  submitting.value = true
  try {
    const res = await window.api.createPromoCalendarSubscription({
      promo_id: Number(formPromoId.value),
      label: formLabel.value.trim(),
      ics_url: formIcsUrl.value.trim(),
      color: formColor.value || null,
    })
    if (res.ok) {
      const eventCount = (res.data as { last_event_count?: number } | undefined)?.last_event_count ?? 0
      const lastError = (res.data as { last_error?: string | null } | undefined)?.last_error
      if (lastError) {
        showToast(`Abonnement cree mais echec import : ${lastError}`, 'error')
      } else {
        showToast(`Abonnement cree (${eventCount} events importes)`, 'success')
      }
      formPromoId.value = ''
      formLabel.value = ''
      formIcsUrl.value = ''
      formColor.value = '#0ea5e9'
      await load()
      emit('changed')
    } else {
      showToast(res.error || "Echec de l'import", 'error')
    }
  } catch (e) {
    showToast(`Erreur: ${(e as Error).message}`, 'error')
  } finally {
    submitting.value = false
  }
}

async function refresh(id: number) {
  refreshingId.value = id
  try {
    const res = await window.api.refreshPromoCalendarSubscription(id)
    if (res.ok) {
      showToast('Calendrier rafraichi', 'success')
      await load()
      emit('changed')
    } else {
      showToast(res.error || 'Echec refresh', 'error')
    }
  } finally {
    refreshingId.value = null
  }
}

async function remove(sub: Subscription) {
  if (!confirm(`Supprimer l'abonnement "${sub.label}" ? Les events n'apparaitront plus dans l'agenda.`)) return
  const res = await window.api.deletePromoCalendarSubscription(sub.id)
  if (res.ok) {
    showToast('Abonnement supprime', 'success')
    await load()
    emit('changed')
  } else {
    showToast(res.error || 'Echec suppression', 'error')
  }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return 'jamais'
  const t = Date.parse(iso + (iso.endsWith('Z') ? '' : 'Z'))
  if (isNaN(t)) return iso
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return 'a l\'instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return `il y a ${Math.floor(diff / 86400)} j`
}

onMounted(load)
</script>

<template>
  <Modal :model-value="modelValue" max-width="640px" @update:model-value="emit('update:modelValue', $event)">
    <div class="ecm">
      <header class="ecm-head">
        <div>
          <h2 class="ecm-title">Calendriers externes</h2>
          <p class="ecm-subtitle">Importer un calendrier Outlook publie ou Google public dans une promo (lecture seule).</p>
        </div>
        <button class="ecm-close" aria-label="Fermer" @click="emit('update:modelValue', false)"><X :size="16" /></button>
      </header>

      <!-- Form : nouvelle souscription -->
      <section class="ecm-form">
        <div class="ecm-form-row">
          <label class="ecm-label">
            Promo
            <select v-model="formPromoId" class="ecm-input">
              <option value="">Choisir...</option>
              <option v-for="p in promos" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label class="ecm-label">
            Couleur
            <input v-model="formColor" type="color" class="ecm-color" />
          </label>
        </div>
        <label class="ecm-label">
          Nom du calendrier
          <input v-model="formLabel" type="text" class="ecm-input" placeholder="Ex: Cours promo CPIA2 25/26" maxlength="120" />
        </label>
        <label class="ecm-label">
          URL ICS
          <input v-model="formIcsUrl" type="url" class="ecm-input ecm-input--mono" placeholder="https://outlook.office365.com/owa/calendar/.../calendar.ics" />
          <span class="ecm-hint">
            Outlook Web : Parametres &gt; Calendrier &gt; Calendriers partages &gt; Publier un calendrier &gt; copier l'URL "ICS".
          </span>
        </label>
        <button type="button" class="ecm-btn ecm-btn--primary" :disabled="!formValid || submitting" @click="submit">
          <Plus :size="14" />
          {{ submitting ? 'Import en cours...' : 'Ajouter ce calendrier' }}
        </button>
      </section>

      <!-- Liste des abonnements -->
      <section class="ecm-list">
        <h3 class="ecm-section-title">Abonnements actifs ({{ subscriptions.length }})</h3>
        <div v-if="loading" class="ecm-empty">Chargement...</div>
        <div v-else-if="subscriptions.length === 0" class="ecm-empty">
          Aucun abonnement. Ajoutez-en un ci-dessus pour afficher des cours dans le calendrier de vos etudiants.
        </div>
        <ul v-else class="ecm-subs">
          <li v-for="s in subscriptions" :key="s.id" class="ecm-sub" :style="{ borderLeftColor: s.color || s.promo_color || 'var(--accent)' }">
            <div class="ecm-sub-main">
              <div class="ecm-sub-row">
                <span class="ecm-sub-label">{{ s.label }}</span>
                <span class="ecm-sub-promo" :style="{ background: s.promo_color, color: '#fff' }">{{ s.promo_name }}</span>
              </div>
              <div class="ecm-sub-meta">
                <span class="ecm-sub-url">{{ s.ics_url_masked }}</span>
              </div>
              <div class="ecm-sub-stats">
                <span class="ecm-sub-stat">
                  <Check v-if="!s.last_error" :size="12" aria-hidden="true" />
                  <AlertCircle v-else :size="12" aria-hidden="true" class="ecm-stat-error-icon" />
                  {{ s.last_event_count }} event{{ s.last_event_count > 1 ? 's' : '' }}
                </span>
                <span class="ecm-sub-stat">
                  Sync : {{ fmtRelative(s.last_fetched_at) }}
                </span>
                <span v-if="s.last_error" class="ecm-sub-error" :title="s.last_error">
                  Erreur : {{ s.last_error }}
                </span>
              </div>
            </div>
            <div class="ecm-sub-actions">
              <button
                class="ecm-icon-btn"
                :disabled="refreshingId === s.id"
                title="Rafraichir maintenant"
                aria-label="Rafraichir"
                @click="refresh(s.id)"
              >
                <RefreshCw :size="14" :class="{ 'ecm-spin': refreshingId === s.id }" />
              </button>
              <button
                class="ecm-icon-btn ecm-icon-btn--danger"
                title="Supprimer"
                aria-label="Supprimer"
                @click="remove(s)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <footer class="ecm-foot">
        <a href="https://support.microsoft.com/fr-fr/office/publier-votre-calendrier-dans-outlook-aa7b2e85-6c2b-414a-9af4-69b71091b596" target="_blank" rel="noopener" class="ecm-help">
          <ExternalLink :size="12" /> Aide : publier un calendrier Outlook
        </a>
      </footer>
    </div>
  </Modal>
</template>

<style scoped>
.ecm { display: flex; flex-direction: column; gap: 16px; padding: 18px 22px; font-family: var(--font); color: var(--text-primary); }

.ecm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.ecm-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
.ecm-subtitle { margin: 4px 0 0; font-size: 12.5px; color: var(--text-secondary); line-height: 1.4; }
.ecm-close {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border: none; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer;
}
.ecm-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Form */
.ecm-form {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px; background: var(--bg-elevated);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.ecm-form-row { display: flex; gap: 8px; }
.ecm-form-row > .ecm-label { flex: 1; }
.ecm-form-row > .ecm-label:last-child { flex: 0 0 auto; }
.ecm-label {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-muted);
}
.ecm-input {
  padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg-main);
  color: var(--text-primary); font-size: 13px; font-family: inherit;
  outline: none; transition: border-color 0.12s;
}
.ecm-input--mono { font-family: var(--font-mono); font-size: 11.5px; }
.ecm-input:focus, .ecm-input:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--accent); outline-offset: 1px;
}
.ecm-color {
  width: 48px; height: 36px; padding: 0;
  border-radius: var(--radius-sm); border: 1px solid var(--border);
  cursor: pointer; background: transparent;
}
.ecm-hint { font-size: 11px; color: var(--text-muted); font-weight: 500; text-transform: none; letter-spacing: 0; line-height: 1.4; }

/* Buttons */
.ecm-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--radius-sm);
  font-family: inherit; font-size: 12.5px; font-weight: 700;
  cursor: pointer; border: 1px solid transparent;
  transition: filter 0.12s, transform 0.06s;
}
.ecm-btn--primary {
  background: var(--accent); color: #fff;
  align-self: flex-start;
}
.ecm-btn--primary:hover:not(:disabled) { filter: brightness(1.06); }
.ecm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* List */
.ecm-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted); margin: 0 0 8px;
}
.ecm-empty {
  text-align: center; padding: 24px 12px;
  font-size: 13px; color: var(--text-muted);
  background: var(--bg-elevated); border-radius: var(--radius);
  border: 1px dashed var(--border);
}
.ecm-subs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ecm-sub {
  display: flex; gap: 10px; align-items: stretch;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
}
.ecm-sub-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ecm-sub-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ecm-sub-label { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.ecm-sub-promo {
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.ecm-sub-meta { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
.ecm-sub-url { word-break: break-all; }
.ecm-sub-stats { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
.ecm-sub-stat { display: inline-flex; align-items: center; gap: 4px; }
.ecm-stat-error-icon { color: var(--color-danger); }
.ecm-sub-error { color: var(--color-danger); font-weight: 600; }
.ecm-sub-actions { display: flex; gap: 4px; align-items: flex-start; }
.ecm-icon-btn {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-main); color: var(--text-secondary);
  cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.ecm-icon-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.ecm-icon-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.ecm-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ecm-spin { animation: ecm-spin 1s linear infinite; }
@keyframes ecm-spin { to { transform: rotate(360deg); } }

.ecm-foot { display: flex; justify-content: flex-end; padding-top: 4px; border-top: 1px solid var(--border); }
.ecm-help {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-muted);
  text-decoration: none;
  padding: 6px 0;
}
.ecm-help:hover { color: var(--accent); text-decoration: underline; }
</style>
