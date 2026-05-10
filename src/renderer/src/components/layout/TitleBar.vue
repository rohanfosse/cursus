<script setup lang="ts">
/*
 * TitleBar - barre de titre custom Windows / Linux. Sur macOS, les
 * "traffic lights" natifs gerent la fenetre, on n'affiche rien.
 *
 * Style aligne sur Windows 11 Fluent :
 *  - Boutons 46x32 (proportions exactes Win11)
 *  - Icones SVG inline 10x10, stroke 1px (rendu crisp ; lucide-vue
 *    a un stroke-width 2.5 trop epais a cette taille et flou)
 *  - Pas de transition au hover (Win11 = instant feedback)
 *  - Etat "inactive" : quand la fenetre perd le focus, les boutons
 *    grisent (matche le comportement natif des autres apps Windows)
 *  - Hover close = #C42B1C (rouge Fluent), texte blanc
 *  - Hover min/max = surface +5% opacity sur fond
 */
import { ref, onMounted, onUnmounted } from 'vue'

const isMaximized = ref(false)
const isWindowFocused = ref(true)

const isMac = window.api.platform === 'darwin'
const isWeb = window.api.platform === 'web'

async function minimize()       { await window.api.windowMinimize() }
async function toggleMaximize() { await window.api.windowMaximize() }
async function close()          { await window.api.windowClose()    }

let unsubMaximize: (() => void) | null = null

function onWindowFocus(): void { isWindowFocused.value = true }
function onWindowBlur():  void { isWindowFocused.value = false }

onMounted(async () => {
  const res = await window.api.windowIsMaximized()
  if (res?.ok) isMaximized.value = res.data

  unsubMaximize = window.api.onMaximizeChange((maximized) => {
    isMaximized.value = maximized
  })

  // Suit le focus de la fenetre Electron : window perd/regagne le focus
  // quand l'utilisateur passe a une autre app. Permet de griser les
  // boutons comme Win11 le fait nativement pour les apps inactives.
  isWindowFocused.value = document.hasFocus()
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('blur',  onWindowBlur)
})

onUnmounted(() => {
  unsubMaximize?.()
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('blur',  onWindowBlur)
})
</script>

<template>
  <div
    v-if="!isMac && !isWeb"
    class="titlebar"
    :class="{ maximized: isMaximized, 'titlebar--inactive': !isWindowFocused }"
  >
    <div class="titlebar-drag" aria-hidden="true" />

    <div class="titlebar-controls">
      <!-- Reduire (─) -->
      <button
        class="wctrl-btn wctrl-min"
        title="Réduire"
        aria-label="Réduire la fenêtre"
        @click.stop="minimize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5 H10" stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges" />
        </svg>
      </button>

      <!-- Agrandir / Restaurer -->
      <button
        class="wctrl-btn wctrl-max"
        :title="isMaximized ? 'Restaurer' : 'Agrandir'"
        :aria-label="isMaximized ? 'Restaurer la fenêtre' : 'Agrandir la fenêtre'"
        @click.stop="toggleMaximize"
      >
        <!-- Restaurer : deux carres superposes (Win11 E923) -->
        <svg v-if="isMaximized" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2.5 2.5 H7.5 V7.5 H2.5 Z M0.5 0.5 H8.5 V1.5 M9.5 1.5 V8.5 H8.5"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
            shape-rendering="crispEdges"
          />
        </svg>
        <!-- Agrandir : carre simple (Win11 E922) -->
        <svg v-else width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M0.5 0.5 H9.5 V9.5 H0.5 Z"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
            shape-rendering="crispEdges"
          />
        </svg>
      </button>

      <!-- Fermer (X) -->
      <button
        class="wctrl-btn wctrl-close"
        title="Fermer"
        aria-label="Fermer la fenêtre"
        @click.stop="close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M1 1 L9 9 M9 1 L1 9"
            stroke="currentColor"
            stroke-width="1"
            stroke-linecap="square"
            fill="none"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-height, 32px);
  width: 100%;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background:
    linear-gradient(
      to right,
      var(--bg-rail)    0px,
      var(--bg-rail)    var(--rail-width),
      var(--bg-sidebar) var(--rail-width),
      var(--bg-sidebar) calc(var(--rail-width) + var(--sidebar-width)),
      var(--bg-main)    calc(var(--rail-width) + var(--sidebar-width))
    );
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  user-select: none;
  position: relative;
  z-index: 100;
}

.titlebar-drag {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}

.titlebar-controls {
  display: flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

/* Bouton de controle Win11 : 46x32, icone 10x10 centree, pas de
   transition au hover (feedback instantane comme l'OS natif). */
.wctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  -webkit-app-region: no-drag;
  padding: 0;
  margin: 0;
  border-radius: 0;
  outline: none;
  /* Anti-aliasing crisp pour les SVG en pixel-perfect */
  -webkit-font-smoothing: antialiased;
  font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif;
}
.wctrl-btn :deep(svg) {
  display: block;
  flex-shrink: 0;
  /* Force un rendu nettement plus crisp sur ecrans non HiDPI */
  shape-rendering: geometricPrecision;
}

.wctrl-btn:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

/* Hover min/max : surface plus claire (Win11 Mica/Acrylic indiscernable
   d'un fond uni en HTML, on simule avec une opacite fixe). */
.wctrl-min:hover,
.wctrl-max:hover {
  background: rgba(255, 255, 255, .08);
}
.wctrl-min:active,
.wctrl-max:active {
  background: rgba(255, 255, 255, .04);
}

/* Hover close : rouge Fluent UI (#C42B1C) avec icone blanche. */
.wctrl-close:hover {
  background: #C42B1C;
  color: #fff;
}
.wctrl-close:active {
  background: #B32613;
  color: #fff;
}

/* Etat inactif : la fenetre n'a pas le focus -> boutons grises
   (matche le comportement Win11 natif des autres apps). */
.titlebar--inactive .wctrl-btn {
  color: var(--text-muted);
  opacity: .65;
}
.titlebar--inactive .wctrl-btn:hover {
  /* Au hover, retour au comportement actif (clarte UX). */
  opacity: 1;
}

/* ─── Themes clairs (light, sepia, cursus) ─── */
body.light .titlebar,
body.sepia .titlebar,
body.cursus .titlebar {
  border-bottom-color: rgba(0, 0, 0, .08);
}
body.light .wctrl-btn,
body.sepia .wctrl-btn,
body.cursus .wctrl-btn {
  color: rgba(0, 0, 0, .75);
}
body.light .wctrl-min:hover,
body.light .wctrl-max:hover,
body.sepia .wctrl-min:hover,
body.sepia .wctrl-max:hover,
body.cursus .wctrl-min:hover,
body.cursus .wctrl-max:hover {
  background: rgba(0, 0, 0, .06);
  color: rgba(0, 0, 0, .9);
}
body.light .wctrl-min:active,
body.light .wctrl-max:active,
body.sepia .wctrl-min:active,
body.sepia .wctrl-max:active,
body.cursus .wctrl-min:active,
body.cursus .wctrl-max:active {
  background: rgba(0, 0, 0, .03);
}
body.light .titlebar--inactive .wctrl-btn,
body.sepia .titlebar--inactive .wctrl-btn,
body.cursus .titlebar--inactive .wctrl-btn {
  color: rgba(0, 0, 0, .35);
}
</style>
