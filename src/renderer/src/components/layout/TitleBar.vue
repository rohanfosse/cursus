<script setup lang="ts">
/*
 * TitleBar - barre de titre custom pour les plateformes desktop.
 *
 * Sur Windows : Electron utilise `titleBarOverlay` (cf. main/index.ts) qui
 *   affiche les VRAIS boutons natifs reduire/agrandir/fermer en haut a
 *   droite. Ils gerent eux-memes : hover Mica/Acrylic, snap layouts, preview
 *   au survol, animations, comportement window inactive. On ne les
 *   reimplemente PAS — toute tentative custom donne au mieux 80% de
 *   l'experience native, au pire un doublon.
 *
 *   Cette barre n'est qu'une zone draggable + le gradient de fond qui
 *   prolonge visuellement les colonnes du dessous (rail / sidebar / main).
 *   Hauteur = `--titlebar-height` (32px), alignee sur l'overlay (36px de
 *   reservation Windows + 4px de drag).
 *
 * Sur macOS : les "traffic lights" natifs sont dans la BrowserWindow
 *   (`titleBarStyle: 'hiddenInset'` ou equivalent) -> on cache la barre.
 *
 * Sur Web : pas de chrome de fenetre -> on cache.
 */
const isMac = window.api.platform === 'darwin'
const isWeb = window.api.platform === 'web'
</script>

<template>
  <div v-if="!isMac && !isWeb" class="titlebar" />
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-height, 32px);
  width: 100%;
  flex-shrink: 0;
  /* Fond en degrade hard-stop : chaque tranche matche la colonne du dessous
     (rail puis sidebar puis main). Evite les "taches sombres" en haut a
     gauche/droite quand on change de theme. */
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
  /* Toute la barre est draggable (Electron). L'overlay reserve l'espace en
     haut-droit pour les boutons natifs ; le clic y est intercepte par
     Windows, donc pas de conflit avec ce drag. */
  -webkit-app-region: drag;
  user-select: none;
  position: relative;
  z-index: 100;
}

/* Themes clairs : juste la border qui s'adoucit. Le gradient suit
   les variables --bg-* deja redefinies par les classes body. */
body.light .titlebar,
body.sepia .titlebar,
body.cursus .titlebar {
  border-bottom-color: rgba(0, 0, 0, .08);
}
</style>
