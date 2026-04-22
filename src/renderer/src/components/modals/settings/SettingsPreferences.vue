/** SettingsPreferences — section Preferences du modal Settings. */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Settings, MousePointer, FileText, RotateCcw, Lock, Smile } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useSettingsPreferences } from '@/composables/useSettingsPreferences'
import { useSettingsAccount } from '@/composables/useSettingsAccount'
import { usePrefs } from '@/composables/usePrefs'
import { useQuickReacts } from '@/composables/useQuickReacts'
import { STORAGE_KEYS } from '@/constants'

const appStore = useAppStore()
const { docsDefault, enterToSend } = useSettingsPreferences()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()
const { resetting, resetDemoData } = useSettingsAccount(emit)
const { getPref, setPref } = usePrefs()

const rememberMe = ref(getPref('rememberMe') ?? false)
watch(rememberMe, (v) => {
  setPref('rememberMe', v)
  if (!v) localStorage.removeItem(STORAGE_KEYS.REMEMBER_TOKEN)
})

// ── Reactions rapides personnalisables ─────────────────────────────────────
const {
  quickReacts,
  quickReactTypes,
  AVAILABLE_REACTS,
  MAX_SLOTS,
  toggleQuickReact,
  resetQuickReacts,
} = useQuickReacts()

function isSelected(type: string): boolean {
  return quickReactTypes.value.includes(type)
}

function canToggle(type: string): boolean {
  // Peut toujours deselectionner (sauf si c'est le dernier), peut selectionner
  // uniquement si on est en-dessous de la limite.
  if (isSelected(type)) return quickReactTypes.value.length > 1
  return quickReactTypes.value.length < MAX_SLOTS
}
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Settings :size="18" />
      <h3 class="stg-section-title">Preferences</h3>
    </div>

    <!-- Connexion -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Lock :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Connexion</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Se souvenir de moi</span>
          <span class="stg-toggle-desc">Remplir automatiquement l'adresse e-mail lors de la prochaine connexion.</span>
        </div>
        <div class="stg-switch" :class="{ on: rememberMe }" role="switch" :aria-checked="rememberMe" tabindex="0" @click="rememberMe = !rememberMe" @keydown.enter.prevent="rememberMe = !rememberMe" @keydown.space.prevent="rememberMe = !rememberMe">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>

    <!-- Saisie -->
    <div class="stg-group">
      <div class="stg-group-header">
        <MousePointer :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Saisie</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Entree pour envoyer</span>
          <span class="stg-toggle-desc">Appuyer sur Entree envoie le message. Desactive : Ctrl+Entree pour envoyer.</span>
        </div>
        <div class="stg-switch" :class="{ on: enterToSend }" role="switch" :aria-checked="enterToSend" tabindex="0" @click="enterToSend = !enterToSend" @keydown.enter.prevent="enterToSend = !enterToSend" @keydown.space.prevent="enterToSend = !enterToSend">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>

    <!-- Réactions rapides -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Smile :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Réactions rapides</h4>
      </div>
      <div class="stg-toggle-info stg-reacts-intro">
        <span class="stg-toggle-label">Tes 4 réactions favorites</span>
        <span class="stg-toggle-desc">
          Apparaissent au survol d'un message, dans l'ordre choisi. Clique sur un emoji pour l'ajouter ou le retirer ({{ quickReactTypes.length }}/{{ MAX_SLOTS }}).
        </span>
      </div>

      <!-- Aperçu des 4 slots dans l'ordre choisi -->
      <div class="stg-reacts-preview" aria-label="Aperçu des réactions rapides">
        <div
          v-for="r in quickReacts"
          :key="r.type"
          class="stg-reacts-slot"
          :title="r.label"
        >{{ r.emoji }}</div>
        <div
          v-for="n in (MAX_SLOTS - quickReacts.length)"
          :key="`empty-${n}`"
          class="stg-reacts-slot stg-reacts-slot--empty"
          aria-hidden="true"
        >+</div>
      </div>

      <!-- Grille de toutes les réactions disponibles -->
      <div class="stg-reacts-grid" role="group" aria-label="Liste des réactions disponibles">
        <button
          v-for="r in AVAILABLE_REACTS"
          :key="r.type"
          type="button"
          class="stg-react-chip"
          :class="{ 'stg-react-chip--on': isSelected(r.type) }"
          :disabled="!canToggle(r.type)"
          :aria-pressed="isSelected(r.type)"
          :title="canToggle(r.type) ? (isSelected(r.type) ? `Retirer ${r.label}` : `Ajouter ${r.label}`) : `Désélectionne un autre emoji d'abord`"
          @click="toggleQuickReact(r.type)"
        >
          <span class="stg-react-chip-emoji">{{ r.emoji }}</span>
          <span class="stg-react-chip-label">{{ r.label }}</span>
        </button>
      </div>

      <div class="stg-action-row">
        <button type="button" class="stg-btn-reset" @click="resetQuickReacts">
          <RotateCcw :size="12" />
          Réinitialiser les favoris
        </button>
      </div>
    </div>

    <!-- Ressources -->
    <div class="stg-group">
      <div class="stg-group-header">
        <FileText :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Ressources</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Ouvrir dans l'explorateur par defaut</span>
          <span class="stg-toggle-desc">Double-clic sur un fichier l'ouvre directement avec l'application systeme.</span>
        </div>
        <div class="stg-switch" :class="{ on: docsDefault }" role="switch" :aria-checked="docsDefault" tabindex="0" @click="docsDefault = !docsDefault" @keydown.enter.prevent="docsDefault = !docsDefault" @keydown.space.prevent="docsDefault = !docsDefault">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>

    <!-- Demo (profs) -->
    <div v-if="appStore.isTeacher" class="stg-group">
      <div class="stg-group-header">
        <RotateCcw :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Donnees de demonstration</h4>
      </div>
      <div class="stg-action-row stg-action-danger">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Reinitialiser les donnees</span>
          <span class="stg-toggle-desc">Recharge les promotions d'exemple avec devoirs, depots et documents de test.</span>
        </div>
        <button class="stg-btn stg-btn-danger" :disabled="resetting" @click="resetDemoData">
          <RotateCcw :size="13" />
          {{ resetting ? 'En cours...' : 'Reinitialiser' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Éditeur de réactions rapides ───────────────────────────────────── */
.stg-reacts-intro { margin-bottom: var(--space-md); }

.stg-reacts-preview {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-md);
}
.stg-reacts-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 22px;
  line-height: 1;
  border-radius: var(--radius);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: var(--elevation-1);
  transition: transform var(--motion-base) var(--ease-spring);
}
.stg-reacts-slot--empty {
  background: transparent;
  color: var(--text-muted);
  border-style: dashed;
  font-size: 18px;
  font-weight: 600;
  box-shadow: none;
}

.stg-reacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.stg-react-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--motion-fast) var(--ease-out),
              background   var(--motion-fast) var(--ease-out),
              color        var(--motion-fast) var(--ease-out),
              transform    var(--motion-fast) var(--ease-spring);
}
.stg-react-chip:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: var(--bg-hover);
  transform: translateY(-1px);
}
.stg-react-chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.stg-react-chip:disabled {
  opacity: .35;
  cursor: not-allowed;
}
.stg-react-chip--on {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  color: var(--accent);
}
.stg-react-chip--on:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: var(--accent);
}

.stg-react-chip-emoji {
  font-size: 20px;
  line-height: 1;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}
.stg-react-chip-label {
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.stg-btn-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.stg-btn-reset:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.stg-btn-reset:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

@media (prefers-reduced-motion: reduce) {
  .stg-react-chip, .stg-btn-reset, .stg-reacts-slot { transition: none !important; }
  .stg-react-chip:hover:not(:disabled) { transform: none; }
}
</style>
