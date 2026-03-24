/** SettingsAppearance — section apparence du modal Settings. */
<script setup lang="ts">
import { Palette, Type, Maximize2, AlignJustify, MessageSquare } from 'lucide-vue-next'
import { useSettingsAppearance } from '@/composables/useSettingsAppearance'

const {
  currentTheme, fontSize, density, msgSpacing, showTimestamps, compactImages,
  THEMES, setTheme,
} = useSettingsAppearance()
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Palette :size="18" />
      <h3 class="stg-section-title">Apparence</h3>
    </div>

    <!-- Themes -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Palette :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Thème</h4>
      </div>
      <div class="stg-theme-grid">
        <button
          v-for="t in THEMES" :key="t.id"
          class="stg-theme-card" :class="{ active: currentTheme === t.id }"
          :title="t.label" @click="setTheme(t.id)"
        >
          <div class="stg-theme-preview">
            <div class="stg-theme-rail"   :style="{ background: t.colors[0] }" />
            <div class="stg-theme-sidebar" :style="{ background: t.colors[1] }" />
            <div class="stg-theme-main"    :style="{ background: t.colors[2] }">
              <div class="stg-theme-accent" :style="{ background: t.accent }" />
            </div>
          </div>
          <div class="stg-theme-footer">
            <component :is="t.icon" :size="12" />
            <span class="stg-theme-label">{{ t.label }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Taille du texte -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Type :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Taille du texte</h4>
      </div>
      <div class="stg-segmented">
        <button v-for="s in [{ id: 'small', label: 'Petit' }, { id: 'default', label: 'Normal' }, { id: 'large', label: 'Grand' }]"
          :key="s.id" class="stg-segmented-btn" :class="{ active: fontSize === s.id }" @click="fontSize = s.id">
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Densité -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Maximize2 :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Densité d'affichage</h4>
      </div>
      <div class="stg-segmented">
        <button v-for="d in [{ id: 'compact', label: 'Compact' }, { id: 'default', label: 'Normal' }, { id: 'cozy', label: 'Confortable' }]"
          :key="d.id" class="stg-segmented-btn" :class="{ active: density === d.id }" @click="density = d.id">
          {{ d.label }}
        </button>
      </div>
    </div>

    <!-- Messages aérés -->
    <div class="stg-group">
      <div class="stg-group-header">
        <AlignJustify :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Espacement des messages</h4>
      </div>
      <div class="stg-segmented">
        <button v-for="ms in [{ id: 'compact', label: 'Compact' }, { id: 'normal', label: 'Normal' }, { id: 'aere', label: 'Aéré' }]"
          :key="ms.id" class="stg-segmented-btn" :class="{ active: msgSpacing === ms.id }" @click="msgSpacing = ms.id">
          {{ ms.label }}
        </button>
      </div>
    </div>

    <!-- Toggles messages -->
    <div class="stg-group">
      <div class="stg-group-header">
        <MessageSquare :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Messages</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Afficher les horodatages</span>
          <span class="stg-toggle-desc">Montrer l'heure d'envoi sur chaque message.</span>
        </div>
        <div class="stg-switch" :class="{ on: showTimestamps }" @click="showTimestamps = !showTimestamps">
          <div class="stg-switch-thumb" />
        </div>
      </label>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Images compactes</span>
          <span class="stg-toggle-desc">Réduire la taille des aperçus d'images dans les messages.</span>
        </div>
        <div class="stg-switch" :class="{ on: compactImages }" @click="compactImages = !compactImages">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>
  </section>
</template>
