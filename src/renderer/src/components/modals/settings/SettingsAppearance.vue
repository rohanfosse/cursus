/** SettingsAppearance — section apparence du modal Settings. */
<script setup lang="ts">
import { Palette, Type, Maximize2, MessageSquare, Zap, Circle, RotateCcw } from 'lucide-vue-next'
import { useSettingsAppearance } from '@/composables/useSettingsAppearance'

const {
  currentTheme, fontSize, density, msgSpacing, showTimestamps, compactImages,
  animationsEnabled, borderRadius,
  THEMES, setTheme, resetAllAppearance,
} = useSettingsAppearance()

/** Synchronise density et msgSpacing en un seul controle. */
function setDensity(d: string) {
  density.value = d
  const map: Record<string, string> = { compact: 'compact', default: 'normal', cozy: 'aere' }
  msgSpacing.value = map[d] ?? 'normal'
}

const fontSizePreview: Record<string, string> = { small: '13px', default: '14px', large: '16px' }
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Palette :size="18" />
      <h3 class="stg-section-title">Apparence</h3>
      <button class="stg-reset-btn" title="Reinitialiser l'apparence" @click="resetAllAppearance">
        <RotateCcw :size="12" />
        Reinitialiser
      </button>
    </div>

    <!-- Themes -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Palette :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Theme</h4>
      </div>
      <div class="stg-theme-grid">
        <button
          v-for="t in THEMES" :key="t.id"
          class="stg-theme-card" :class="{ active: currentTheme === t.id }"
          :aria-pressed="currentTheme === t.id"
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

    <!-- Taille du texte avec preview -->
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
      <div class="sa-preview" :style="{ fontSize: fontSizePreview[fontSize] }">
        Bonjour, ceci est un apercu de la taille du texte choisie.
      </div>
    </div>

    <!-- Densite d'affichage (controle unifie) -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Maximize2 :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Densite d'affichage</h4>
      </div>
      <p class="stg-group-desc">Ajuste l'espacement global des composants et des messages.</p>
      <div class="stg-segmented">
        <button v-for="d in [{ id: 'compact', label: 'Compact' }, { id: 'default', label: 'Normal' }, { id: 'cozy', label: 'Confortable' }]"
          :key="d.id" class="stg-segmented-btn" :class="{ active: density === d.id }" @click="setDensity(d.id)">
          {{ d.label }}
        </button>
      </div>
    </div>

    <!-- Coins arrondis -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Circle :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Coins arrondis</h4>
      </div>
      <div class="stg-segmented">
        <button v-for="r in [{ id: 'sharp', label: 'Anguleux' }, { id: 'default', label: 'Normal' }, { id: 'round', label: 'Arrondis' }]"
          :key="r.id" class="stg-segmented-btn" :class="{ active: borderRadius === r.id }" @click="borderRadius = r.id">
          {{ r.label }}
        </button>
      </div>
      <div class="sa-radius-preview">
        <div class="sa-radius-card" :style="{ borderRadius: { sharp: '4px', default: '12px', round: '20px' }[borderRadius] }">
          Apercu
        </div>
      </div>
    </div>

    <!-- Animations -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Zap :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Animations et transitions</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Activer les animations</span>
          <span class="stg-toggle-desc">Desactiver pour reduire les mouvements a l'ecran.</span>
        </div>
        <div class="stg-switch" :class="{ on: animationsEnabled }" role="switch" :aria-checked="animationsEnabled" tabindex="0" @click="animationsEnabled = !animationsEnabled" @keydown.enter.prevent="animationsEnabled = !animationsEnabled" @keydown.space.prevent="animationsEnabled = !animationsEnabled">
          <div class="stg-switch-thumb" />
        </div>
      </label>
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
        <div class="stg-switch" :class="{ on: showTimestamps }" role="switch" :aria-checked="showTimestamps" tabindex="0" @click="showTimestamps = !showTimestamps" @keydown.enter.prevent="showTimestamps = !showTimestamps" @keydown.space.prevent="showTimestamps = !showTimestamps">
          <div class="stg-switch-thumb" />
        </div>
      </label>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Images compactes</span>
          <span class="stg-toggle-desc">Reduire la taille des apercus d'images dans les messages.</span>
        </div>
        <div class="stg-switch" :class="{ on: compactImages }" role="switch" :aria-checked="compactImages" tabindex="0" @click="compactImages = !compactImages" @keydown.enter.prevent="compactImages = !compactImages" @keydown.space.prevent="compactImages = !compactImages">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>
  </section>
</template>

<style scoped>
.stg-reset-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: all 0.12s;
}
.stg-reset-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-color: var(--text-muted);
}

/* ── Preview texte ── */
.sa-preview {
  margin-top: 8px;
  padding: 10px 14px;
  background: var(--bg-elevated, rgba(255,255,255,0.03));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  color: var(--text-secondary);
  line-height: 1.5;
  transition: font-size 0.2s ease;
}

/* ── Preview border-radius ── */
.sa-radius-preview {
  margin-top: 8px;
  display: flex;
  gap: 10px;
}
.sa-radius-card {
  padding: 10px 20px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  transition: border-radius 0.2s ease;
}
</style>
