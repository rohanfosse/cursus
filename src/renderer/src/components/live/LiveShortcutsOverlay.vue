<!-- Overlay raccourcis clavier pour le Live (touche ?). -->
<script setup lang="ts">
import { Keyboard, X } from 'lucide-vue-next'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['?'],              label: 'Afficher / fermer ce panneau' },
  { keys: ['Esc'],            label: 'Annuler ou fermer la vue courante' },
  { keys: ['Espace', 'Entrée'], label: 'Fermer l\'activité en cours / lancer la suivante' },
  { keys: ['→'],              label: 'Activité suivante (ferme + lance la suivante)' },
  { keys: ['P'],              label: 'Mode projection plein écran' },
  { keys: ['T'],              label: 'Basculer le mode aperçu étudiant' },
  { keys: ['N'],              label: 'Ajouter une nouvelle activité' },
]
</script>

<template>
  <Transition name="shortcuts">
    <div
      v-if="open"
      class="sho-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Raccourcis clavier"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <div class="sho-panel">
        <header class="sho-head">
          <div class="sho-head-title">
            <Keyboard :size="16" />
            <span>Raccourcis clavier</span>
          </div>
          <button class="sho-close" aria-label="Fermer" @click="emit('close')">
            <X :size="16" />
          </button>
        </header>
        <ul class="sho-list">
          <li v-for="(s, i) in SHORTCUTS" :key="i" class="sho-row">
            <div class="sho-keys">
              <kbd v-for="k in s.keys" :key="k">{{ k }}</kbd>
            </div>
            <span class="sho-label">{{ s.label }}</span>
          </li>
        </ul>
        <p class="sho-foot">Astuce : les raccourcis sont désactivés quand vous éditez un champ.</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sho-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}
.sho-panel {
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--elevation-3);
  padding: 20px 22px;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sho-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sho-head-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.sho-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all .15s;
}
.sho-close:hover { color: var(--text-primary); border-color: var(--border-input); }
.sho-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sho-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
}
.sho-keys {
  display: inline-flex;
  gap: 4px;
  min-width: 100px;
  flex-shrink: 0;
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 26px;
  padding: 0 7px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 5px;
}
.sho-label {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.sho-foot {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
  padding-top: 4px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-style: italic;
}

.shortcuts-enter-active, .shortcuts-leave-active {
  transition: opacity .18s var(--ease-out);
}
.shortcuts-enter-active .sho-panel, .shortcuts-leave-active .sho-panel {
  transition: transform .22s var(--ease-out), opacity .22s var(--ease-out);
}
.shortcuts-enter-from, .shortcuts-leave-to { opacity: 0; }
.shortcuts-enter-from .sho-panel, .shortcuts-leave-to .sho-panel {
  opacity: 0;
  transform: scale(.96) translateY(8px);
}
</style>
