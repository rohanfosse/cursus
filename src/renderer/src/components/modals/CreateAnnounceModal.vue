<script setup lang="ts">
/**
 * CreateAnnounceModal - builder pour la commande slash /annonce.
 *
 * Remplace le template trivial "**Annonce** - " par un vrai bloc typé :
 *   - Type de message (5 types : Annonce / Info / Avertissement / Important
 *     / Astuce) avec emoji + couleur visuel.
 *   - Titre optionnel (ligne 1 en gras).
 *   - Message multiline rendu en blockquote markdown (> ...) pour creer
 *     un bloc visuellement distinct dans la conversation, sans dependre
 *     d'une extension custom du renderer (blockquote est GFM standard).
 *
 * Choix design : plutot que d'introduire un plugin "admonition" custom
 * (complexite renderer + securite), on exploite emoji + bold + blockquote
 * -- deja supportes nativement par marked/hljs. Lisible partout, meme
 * dans les notifications push ou les exports copie-colles.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { X, Megaphone, Send, Info, Pin, Bell } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'submit': [payload: { markdown: string }]
  'submit-send': [payload: { markdown: string }]
}>()

// ── Types d'annonce ───────────────────────────────────────────────────────
// `emoji` injecte dans le markdown (compat universelle), `hue` utilise pour
// la preview et la bordure de couleur dans le modal.
interface AnnounceType {
  id: string
  label: string
  emoji: string
  icon: any
  hue: 'accent' | 'info' | 'success' | 'warning' | 'danger'
  /** Libelle prefixe par defaut : "**Info**", "**Avertissement**"... */
  prefix: string
}
// 3 types suffisent : Annonce (neutre), Info (complement), Important (urgent).
// Avertissement et Astuce retires en v2 : differenciation visuelle trop subtile
// et choix cognitif inutile pour un etudiant presse.
const TYPES: readonly AnnounceType[] = [
  { id: 'announce',  label: 'Annonce',   emoji: '📣', icon: Bell, hue: 'accent', prefix: 'Annonce' },
  { id: 'info',      label: 'Info',      emoji: 'ℹ️', icon: Info, hue: 'info',   prefix: 'Info' },
  { id: 'important', label: 'Important', emoji: '📌', icon: Pin,  hue: 'danger', prefix: 'Important' },
]

// ── Etat ──────────────────────────────────────────────────────────────────
const selectedType = ref<AnnounceType>(TYPES[0])
const title   = ref('')
const message = ref('')
const titleEl = ref<HTMLInputElement | null>(null)
const messageEl = ref<HTMLTextAreaElement | null>(null)

// Reset a l'ouverture
watch(() => props.modelValue, (open) => {
  if (!open) return
  selectedType.value = TYPES[0]
  title.value = ''
  message.value = ''
  nextTick(() => titleEl.value?.focus())
})

function selectType(t: AnnounceType) {
  selectedType.value = t
  // Focus soft : si on change de type sans avoir encore saisi de texte,
  // remonter au titre (flow naturel) ; sinon rester ou on est.
  if (!title.value && !message.value) nextTick(() => titleEl.value?.focus())
}

// ── Generation du markdown ────────────────────────────────────────────────
// Format : premiere ligne = emoji + **prefix[+": " + titre]**
//          lignes suivantes = blockquote du message (> ...)
// Resultat lu en clair :
//   📣 **Annonce : Sortie jeudi**
//   > Rendez-vous à 9h00 salle 204.
//   > Prévoir une tenue adaptée.
const markdownPreview = computed(() => {
  const t = selectedType.value
  const titleStr = title.value.trim()
  const header = titleStr
    ? `${t.emoji} **${t.prefix} : ${titleStr}**`
    : `${t.emoji} **${t.prefix}**`
  const body = message.value.trim()
  if (!body) return header
  const quoted = body.split('\n').map(l => `> ${l}`).join('\n')
  return `${header}\n${quoted}`
})

// ── Validation ────────────────────────────────────────────────────────────
// Un message est requis ; titre optionnel (une annonce sans message = juste
// un pictogramme qui n'apporte rien).
const canSubmit = computed(() => message.value.trim().length > 0)

function onMessageKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (!canSubmit.value) return
    // Ctrl+Enter = envoyer direct (action la plus courante pour une annonce).
    // Shift+Ctrl+Enter = inserer dans le textarea pour ajouter du texte autour.
    if (e.shiftKey) submit()
    else submitAndSend()
  }
}

function close() { emit('update:modelValue', false) }

function submit() {
  if (!canSubmit.value) return
  emit('submit', { markdown: markdownPreview.value })
  close()
}
function submitAndSend() {
  if (!canSubmit.value) return
  emit('submit-send', { markdown: markdownPreview.value })
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="can-modal" role="dialog" aria-modal="true" aria-label="Créer une annonce">
          <!-- Header -->
          <div class="can-header">
            <Megaphone :size="18" class="can-header-icon" />
            <div class="can-header-text">
              <h2 class="can-title">Nouvelle annonce</h2>
              <p class="can-sub">Mettez en avant un message important dans la conversation</p>
            </div>
            <button class="btn-icon can-close" aria-label="Fermer" @click="close">
              <X :size="16" />
            </button>
          </div>

          <!-- Body -->
          <div class="can-body">
            <!-- Selecteur de type : 5 chips colorees -->
            <div class="can-field">
              <label class="can-label">Type</label>
              <div class="can-types" role="radiogroup" aria-label="Type d'annonce">
                <button
                  v-for="t in TYPES"
                  :key="t.id"
                  type="button"
                  role="radio"
                  class="can-type"
                  :class="[`can-type--${t.hue}`, { 'is-active': selectedType.id === t.id }]"
                  :aria-checked="selectedType.id === t.id"
                  @click="selectType(t)"
                >
                  <span class="can-type-emoji" aria-hidden="true">{{ t.emoji }}</span>
                  <span class="can-type-label">{{ t.label }}</span>
                </button>
              </div>
            </div>

            <!-- Titre -->
            <div class="can-field">
              <label class="can-label" for="can-title">
                Titre <span class="can-label-hint">(optionnel)</span>
              </label>
              <input
                id="can-title"
                ref="titleEl"
                v-model="title"
                type="text"
                class="can-input"
                maxlength="120"
                :placeholder="`Ex : ${selectedType.label === 'Annonce' ? 'Rendu de projet reporté' : 'Salle modifiée pour demain'}`"
                @keydown.escape="close"
                @keydown.enter.prevent="messageEl?.focus()"
              />
            </div>

            <!-- Message -->
            <div class="can-field">
              <label class="can-label" for="can-message">Message</label>
              <textarea
                id="can-message"
                ref="messageEl"
                v-model="message"
                class="can-input can-textarea"
                rows="4"
                maxlength="1000"
                placeholder="Expliquez en quelques lignes ce qui est important."
                @keydown="onMessageKeydown"
              />
              <span class="can-counter">{{ message.length }} / 1000</span>
            </div>

            <!-- Preview : rendu de la forme finale dans le message -->
            <div class="can-field">
              <label class="can-label">Aperçu</label>
              <div class="can-preview" :class="`can-preview--${selectedType.hue}`">
                <div class="can-preview-header">
                  <span class="can-preview-emoji" aria-hidden="true">{{ selectedType.emoji }}</span>
                  <span class="can-preview-prefix">
                    {{ selectedType.prefix }}<template v-if="title.trim()"> : {{ title.trim() }}</template>
                  </span>
                </div>
                <div v-if="message.trim()" class="can-preview-body">
                  <template v-for="(line, i) in message.trim().split('\n')" :key="i">
                    <span class="can-preview-line">{{ line || ' ' }}</span>
                  </template>
                </div>
                <div v-else class="can-preview-empty">
                  Le message apparaîtra ici…
                </div>
              </div>
            </div>

            <!-- Hints raccourcis -->
            <div class="can-hints">
              <span><kbd>Enter</kbd> dans le titre : aller au message</span>
              <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> envoyer</span>
            </div>
          </div>

          <!-- Footer : CTA primaire = envoyer direct, secondaire = inserer -->
          <div class="can-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button
              type="button"
              class="can-btn-secondary"
              :disabled="!canSubmit"
              title="Insérer dans le message pour ajouter du texte autour"
              @click="submit"
            >
              Insérer dans le message
            </button>
            <button
              type="button"
              class="can-btn-primary"
              :disabled="!canSubmit"
              title="Envoyer directement dans le canal"
              @click="submitAndSend"
            >
              <Send :size="14" /> Envoyer l'annonce
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, .45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }

/* ── Modal ───────────────────────────────────────────────────────────── */
.can-modal {
  width: 100%;
  max-width: 560px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--elevation-4);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.can-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.can-header-icon {
  color: var(--accent);
  padding: 6px;
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  background: rgba(var(--accent-rgb), .12);
  flex-shrink: 0;
  box-sizing: content-box;
}
.can-header-text { flex: 1; min-width: 0; }
.can-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.can-sub { font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0; }
.can-close {
  width: 28px; height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.can-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Body ────────────────────────────────────────────────────────────── */
.can-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.can-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.can-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.can-label-hint {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  font-style: italic;
  color: var(--text-muted);
  margin-left: 4px;
}

/* ── Selecteur de type : 5 chips colorees ───────────────────────────── */
.can-types {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.can-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-main);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.can-type:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-input);
}
.can-type-emoji { font-size: 15px; line-height: 1; }
.can-type-label { line-height: 1; }

/* Couleur par hue quand actif (reflete la couleur du bloc final) */
.can-type.is-active { color: #fff; }
.can-type--accent.is-active  { background: var(--accent);        border-color: var(--accent); }
.can-type--info.is-active    { background: var(--color-info);    border-color: var(--color-info); }
.can-type--warning.is-active { background: var(--color-warning); border-color: var(--color-warning); }
.can-type--danger.is-active  { background: var(--color-danger);  border-color: var(--color-danger); }
.can-type--success.is-active { background: var(--color-success); border-color: var(--color-success); }

/* ── Champs input / textarea ─────────────────────────────────────────── */
.can-input {
  width: 100%;
  padding: 9px 12px;
  font-family: var(--font);
  font-size: 13px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.can-input::placeholder { color: var(--text-muted); }
.can-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}
.can-textarea {
  resize: vertical;
  min-height: 90px;
  line-height: 1.5;
  font-family: var(--font);
}
.can-counter {
  position: absolute;
  right: 6px;
  bottom: 6px;
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  background: var(--bg-elevated);
  padding: 1px 6px;
  border-radius: 8px;
  pointer-events: none;
  opacity: .75;
}

/* ── Preview : rendu visuel du bloc final ────────────────────────────── */
.can-preview {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-left-width: 3px;
  position: relative;
  overflow: hidden;
}
.can-preview--accent  { border-left-color: var(--accent);        background: rgba(var(--accent-rgb), .06); }
.can-preview--info    { border-left-color: var(--color-info);    background: rgba(var(--color-info-rgb), .06); }
.can-preview--warning { border-left-color: var(--color-warning); background: rgba(var(--color-warning-rgb), .06); }
.can-preview--danger  { border-left-color: var(--color-danger);  background: rgba(var(--color-danger-rgb), .06); }
.can-preview--success { border-left-color: var(--color-success); background: rgba(var(--color-success-rgb), .06); }

.can-preview-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.can-preview-emoji { font-size: 16px; line-height: 1; flex-shrink: 0; }
.can-preview-prefix {
  line-height: 1.35;
  min-width: 0;
  overflow-wrap: anywhere;
}
.can-preview-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  padding-left: 24px;
  border-left: 2px solid var(--border);
  margin-left: 2px;
  padding-top: 2px;
  padding-bottom: 2px;
}
.can-preview-line { min-height: 1em; overflow-wrap: anywhere; }
.can-preview-empty {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  padding-left: 24px;
}

/* ── Hints raccourcis clavier ────────────────────────────────────────── */
.can-hints {
  display: flex;
  gap: 14px;
  justify-content: center;
  font-size: 10.5px;
  color: var(--text-muted);
  flex-wrap: wrap;
  padding-top: 2px;
}
.can-hints kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9.5px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  font-family: var(--font);
  margin: 0 2px;
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.can-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}

.can-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.can-btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.can-btn-secondary:disabled { opacity: .45; cursor: not-allowed; }

.can-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  transition: background var(--t-fast), transform var(--t-fast);
}
.can-btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 88%, black);
  transform: translateY(-1px);
}
.can-btn-primary:disabled {
  opacity: .45;
  cursor: not-allowed;
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
  box-shadow: none;
}
</style>
