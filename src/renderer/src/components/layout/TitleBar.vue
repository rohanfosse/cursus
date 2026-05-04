<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Minus, X, Maximize2, Minimize2 } from 'lucide-vue-next'

const isMaximized = ref(false)

// Sur macOS les boutons natifs (traffic lights) gèrent déjà la fenêtre
const isMac = window.api.platform === 'darwin'
const isWeb = window.api.platform === 'web'

async function minimize()       { await window.api.windowMinimize() }
async function toggleMaximize() { await window.api.windowMaximize() }
async function close()          { await window.api.windowClose()    }

let unsubMaximize: (() => void) | null = null

onMounted(async () => {
  const res = await window.api.windowIsMaximized()
  if (res?.ok) isMaximized.value = res.data

  unsubMaximize = window.api.onMaximizeChange((maximized) => {
    isMaximized.value = maximized
  })
})

onUnmounted(() => { unsubMaximize?.() })
</script>

<template>
  <!-- Masqué sur macOS (traffic lights natifs dans le coin) -->
  <div v-if="!isMac && !isWeb" class="titlebar" :class="{ maximized: isMaximized }">
    <!-- Zone draggable (toute la largeur sauf les boutons) -->
    <div class="titlebar-drag" aria-hidden="true" />

    <!-- Boutons de contrôle fenêtre -->
    <div class="titlebar-controls">
      <button
        class="wctrl-btn wctrl-min"
        title="Réduire"
        aria-label="Réduire la fenêtre"
        @click.stop="minimize"
      >
        <Minus :size="10" stroke-width="2.5" />
      </button>

      <button
        class="wctrl-btn wctrl-max"
        :title="isMaximized ? 'Restaurer' : 'Agrandir'"
        :aria-label="isMaximized ? 'Restaurer la fenêtre' : 'Agrandir la fenêtre'"
        @click.stop="toggleMaximize"
      >
        <Minimize2 v-if="isMaximized" :size="10" stroke-width="2.5" />
        <Maximize2 v-else             :size="10" stroke-width="2.5" />
      </button>

      <button
        class="wctrl-btn wctrl-close"
        title="Fermer"
        aria-label="Fermer la fenêtre"
        @click.stop="close"
      >
        <X :size="11" stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── Barre de titre ── */
.titlebar {
  height: var(--titlebar-height, 32px);
  width: 100%;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  /* Fond en dégradé hard-stop : chaque tranche matche la colonne du dessous */
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
  /* Zone de déplacement Electron sur toute la barre */
  -webkit-app-region: drag;
  user-select: none;
  position: relative;
  z-index: 100;
}

/* Zone draggable - occupe l'espace restant */
.titlebar-drag {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}

/* ── Groupe de boutons ── */
.titlebar-controls {
  display: flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

/* ── Bouton générique ── */
.wctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out);
  -webkit-app-region: no-drag;
  padding: 0;
  border-radius: 0;
  outline: none;
}
.wctrl-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* Hover neutre pour min/max */
.wctrl-min:hover,
.wctrl-max:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

/* Hover rouge (style Windows 11) pour close */
.wctrl-close:hover {
  background: #C42B1C;
  color: #fff;
}
.wctrl-close:active { background: #a01b0e; }

/* Active pour min/max */
.wctrl-min:active,
.wctrl-max:active { background: var(--bg-hover); }

/* Themes clairs (light, sepia, cursus) — la titlebar suit le gradient via
   var(--bg-rail / sidebar / main). Plus d'override hardcode qui creait
   les taches sombres en haut a gauche / droite (v2.273.1). */
body.light .titlebar,
body.sepia .titlebar,
body.cursus .titlebar {
  border-bottom-color: rgba(0, 0, 0, .08);
}
body.light .wctrl-btn,
body.sepia .wctrl-btn,
body.cursus .wctrl-btn {
  color: rgba(0, 0, 0, .5);
}
body.light .wctrl-min:hover,
body.light .wctrl-max:hover,
body.sepia .wctrl-min:hover,
body.sepia .wctrl-max:hover,
body.cursus .wctrl-min:hover,
body.cursus .wctrl-max:hover {
  background: rgba(0, 0, 0, .06);
  color: rgba(0, 0, 0, .85);
}
</style>
