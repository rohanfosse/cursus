/**
 * AccueilStatTile — tuile stat 1x1 generique du bento prof.
 *
 * Factorise les 4 tuiles stat historiquement inlinees dans TabAccueil
 * (stat-soumis / stat-noter / stat-moyenne / stat-online) :
 *   - affichage valeur + label + icone Lucide
 *   - variante "ring" pour un pourcentage (ex: % soumis)
 *   - variante "grade" pour une lettre (A/B/C/D) colorisee
 *   - variante "online-dot" pour un indicateur de connexion
 *   - bouton X en mode edition
 *
 * Pas de state interne : purement presentational.
 */
<script setup lang="ts">
import type { Component } from 'vue'
import { X } from 'lucide-vue-next'
import { gradeClass } from '@/utils/format'

type Variant = 'plain' | 'ring' | 'grade' | 'online-dot'

withDefaults(defineProps<{
  label:       string
  value:       number | string
  icon:        Component
  /** Style visuel : plain = chiffre brut, ring = cercle SVG %, grade = lettre, online-dot = point + chiffre. */
  variant?:    Variant
  /** Pour variant="ring" : pourcentage 0-100 qui pilote le remplissage. */
  ringPct?:    number
  /** Active le fond d alerte si la valeur merite l oeil du prof. */
  alert?:      boolean
  editMode?:   boolean
  ariaLabel?:  string
}>(), {
  variant:   'plain',
  ringPct:   0,
  alert:     false,
  editMode:  false,
  ariaLabel: undefined,
})

defineEmits<{ remove: [] }>()
</script>

<template>
  <div
    class="dashboard-card bento-tile bento-stat"
    :class="{ 'stat--alert': alert, 'bento-tile--editing': editMode }"
  >
    <button
      v-if="editMode"
      class="bento-tile-remove"
      :aria-label="ariaLabel ?? `Masquer ${label}`"
      @click="$emit('remove')"
    >
      <X :size="14" />
    </button>

    <!-- Ring pour %, ex: soumissions -->
    <div v-if="variant === 'ring'" class="stat-ring">
      <svg viewBox="0 0 36 36" class="stat-ring-svg">
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-active)" stroke-width="3" />
        <circle
          cx="18" cy="18" r="15" fill="none"
          stroke="var(--accent)" stroke-width="3"
          stroke-linecap="round"
          :stroke-dasharray="`${ringPct * 0.942} 94.2`"
          transform="rotate(-90 18 18)"
          style="transition: stroke-dasharray .6s ease"
        />
      </svg>
    </div>

    <!-- Point vert connecte -->
    <span v-if="variant === 'online-dot'" class="stat-online-dot" />

    <!-- Valeur principale -->
    <span
      class="stat-number"
      :class="{ 'stat-grade': variant === 'grade', ...(variant === 'grade' ? { [gradeClass(String(value))]: true } : {}) }"
    >{{ value }}</span>
    <span class="stat-label">{{ label }}</span>
    <component :is="icon" :size="14" class="stat-icon" />
  </div>
</template>
