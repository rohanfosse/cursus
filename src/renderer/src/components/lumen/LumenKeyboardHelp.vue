<script setup lang="ts">
/**
 * Overlay "?" qui liste tous les raccourcis clavier disponibles dans
 * Lumen. Ouvert via la touche ? (shift+/) sur le viewport ou via un
 * bouton help dans la topbar. Groupe par contexte (reader, editor, tree).
 */
import { Keyboard, X } from 'lucide-vue-next'

defineProps<{ open: boolean }>()
defineEmits<(e: 'close') => void>()

interface Shortcut {
  keys: string[]
  description: string
}

// v2.75 : liste des raccourcis reels implementes dans Lumen (reflet
// de handleKeydown dans LumenView.vue + onLumenKeyboard dans
// LumenChapterViewer.vue).
const SHORTCUTS: Record<string, Shortcut[]> = {
  Navigation: [
    { keys: ['←'], description: 'Chapitre precedent' },
    { keys: ['→'], description: 'Chapitre suivant' },
    { keys: ['/'], description: 'Focus la barre de recherche' },
  ],
  'Lecture markdown': [
    { keys: ['E'], description: 'Modifier le chapitre (teacher uniquement)' },
    { keys: ['Esc'], description: 'Fermer une modale ou un popover' },
  ],
  Slides: [
    { keys: ['←'], description: 'Slide precedente (sur un Marp)' },
    { keys: ['→'], description: 'Slide suivante' },
    { keys: ['Space'], description: 'Slide suivante' },
    { keys: ['Home'], description: 'Premiere slide' },
    { keys: ['End'], description: 'Derniere slide' },
    { keys: ['Esc'], description: 'Quitter le plein-ecran' },
  ],
  Edition: [
    { keys: ['Ctrl', 'Z'], description: 'Annuler (CodeMirror)' },
    { keys: ['Ctrl', 'Y'], description: 'Refaire' },
    { keys: ['Ctrl', 'F'], description: 'Rechercher dans le fichier' },
    { keys: ['Tab'], description: 'Indenter' },
  ],
  General: [
    { keys: ['?'], description: 'Afficher cette aide' },
  ],
}
</script>

<template>
  <Teleport to="body">
    <Transition name="khelp-fade">
      <div
        v-if="open"
        class="khelp-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="khelp-title"
        @click.self="$emit('close')"
      >
        <div class="khelp-modal">
          <header class="khelp-head">
            <Keyboard :size="15" />
            <h2 id="khelp-title" class="khelp-title">Raccourcis clavier</h2>
            <button
              type="button"
              class="khelp-close"
              aria-label="Fermer"
              title="Fermer (Esc)"
              @click="$emit('close')"
            >
              <X :size="15" />
            </button>
          </header>
          <div class="khelp-body">
            <section v-for="(shortcuts, group) in SHORTCUTS" :key="group" class="khelp-group">
              <h3 class="khelp-group-title">{{ group }}</h3>
              <ul class="khelp-list">
                <li v-for="(sc, i) in shortcuts" :key="i" class="khelp-row">
                  <span class="khelp-keys">
                    <template v-for="(k, ki) in sc.keys" :key="ki">
                      <kbd>{{ k }}</kbd>
                      <span v-if="ki < sc.keys.length - 1" class="khelp-plus">+</span>
                    </template>
                  </span>
                  <span class="khelp-desc">{{ sc.description }}</span>
                </li>
              </ul>
            </section>
          </div>
          <footer class="khelp-foot">
            <span>Astuce : appuie sur <kbd>?</kbd> depuis n'importe ou dans Lumen</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.khelp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.khelp-modal {
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-4);
  max-width: 560px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.khelp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.khelp-title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.khelp-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.khelp-close:hover { color: var(--text-primary); background: var(--bg-hover); }

.khelp-body {
  padding: 14px 18px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.khelp-group + .khelp-group { margin-top: 18px; }
.khelp-group-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 0 0 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.khelp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.khelp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.khelp-keys {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  min-width: 110px;
}
.khelp-row kbd {
  display: inline-block;
  padding: 2px 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  color: var(--text-primary);
  min-width: 20px;
  text-align: center;
}
.khelp-plus { color: var(--text-muted); font-size: 11px; }
.khelp-desc { color: var(--text-secondary); flex: 1; }

.khelp-foot {
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}
.khelp-foot kbd {
  padding: 1px 5px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  margin: 0 2px;
}

.khelp-fade-enter-active,
.khelp-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.khelp-fade-enter-from,
.khelp-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .khelp-fade-enter-active,
  .khelp-fade-leave-active { transition: none; }
  .khelp-overlay { backdrop-filter: none; }
}
</style>
