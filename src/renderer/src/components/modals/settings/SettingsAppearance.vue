/** SettingsAppearance — section apparence du modal Settings. */
<script setup lang="ts">
import { Palette, Type, Maximize2, MessageSquare, Zap, Circle, RotateCcw, Pipette, Eye } from 'lucide-vue-next'
import { useSettingsAppearance } from '@/composables/useSettingsAppearance'

const {
  currentTheme, fontSize, density, msgSpacing, showTimestamps, compactImages,
  animationsEnabled, borderRadius, customAccent, highContrast,
  THEMES, setTheme, resetAllAppearance,
} = useSettingsAppearance()

const ACCENT_PRESETS = [
  { color: '', label: 'Theme par defaut' },
  { color: '#6366F1', label: 'Indigo' },
  { color: '#3b82f6', label: 'Bleu' },
  { color: '#059669', label: 'Emeraude' },
  { color: '#22c55e', label: 'Vert' },
  { color: '#f59e0b', label: 'Ambre' },
  { color: '#ef4444', label: 'Rouge' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#ec4899', label: 'Rose' },
  { color: '#14b8a6', label: 'Teal' },
]

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

    <!-- Couleur d'accent -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Pipette :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Couleur d'accent</h4>
      </div>
      <p class="stg-group-desc">
        Personnalise la couleur principale de l'interface — boutons, liens,
        surlignages. Le choix par defaut suit la couleur du theme.
      </p>

      <!-- Grille presets : tile + label, sans hover-tooltip seulement -->
      <div class="sa-accent-grid">
        <button
          v-for="preset in ACCENT_PRESETS"
          :key="preset.color || 'default'"
          type="button"
          class="sa-accent-tile"
          :class="{ active: customAccent === preset.color }"
          @click="customAccent = preset.color"
        >
          <span
            v-if="preset.color"
            class="sa-accent-dot"
            :style="{ background: preset.color }"
          />
          <RotateCcw v-else :size="14" class="sa-accent-default-icon" />
          <span class="sa-accent-name">{{ preset.label }}</span>
        </button>
      </div>

      <!-- Color picker custom : input natif pour aller au-dela des presets -->
      <div class="sa-accent-custom-row">
        <label class="sa-accent-custom-label">
          <input
            type="color"
            class="sa-accent-custom-input"
            :value="customAccent || '#6366F1'"
            aria-label="Choisir une couleur personnalisee"
            @input="(e) => customAccent = (e.target as HTMLInputElement).value"
          />
          <span class="sa-accent-custom-text">
            <span class="sa-accent-custom-title">Couleur personnalisee</span>
            <span class="sa-accent-custom-value">{{ customAccent || 'aucune' }}</span>
          </span>
        </label>
      </div>

      <!-- Apercu live : montre l'effet sur des elements typiques -->
      <div class="sa-accent-preview" aria-label="Apercu de la couleur d'accent">
        <span class="sa-accent-preview-label">Apercu</span>
        <button type="button" class="sa-accent-preview-btn" tabindex="-1">Bouton</button>
        <a class="sa-accent-preview-link" tabindex="-1">Un lien</a>
        <span class="sa-accent-preview-mark">surligne</span>
      </div>
    </div>

    <!-- Accessibilite -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Eye :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Accessibilite</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Contraste eleve</span>
          <span class="stg-toggle-desc">Renforce les bordures et les contrastes pour une meilleure lisibilite.</span>
        </div>
        <div class="stg-switch" :class="{ on: highContrast }" role="switch" :aria-checked="highContrast || undefined" tabindex="0" @click="highContrast = !highContrast" @keydown.enter.prevent="highContrast = !highContrast" @keydown.space.prevent="highContrast = !highContrast">
          <div class="stg-switch-thumb" />
        </div>
      </label>
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
  border-radius: var(--radius-sm);
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
  transition: font-size var(--motion-base) var(--ease-out);
}

/* ── Accent color presets (refonte v2.286) ──
   Tile 64x64 avec dot + nom dessous, plus lisible que la grille de 32px
   ronds sans labels. Sept colonnes responsive, gap aere. */
.sa-accent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
}
.sa-accent-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
}
.sa-accent-tile:hover {
  background: var(--bg-hover);
  border-color: var(--text-muted);
}
.sa-accent-tile.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
}
.sa-accent-tile:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.sa-accent-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .15);
}
.sa-accent-default-icon {
  color: var(--text-muted);
  width: 24px;
  height: 24px;
}
.sa-accent-name {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}
.sa-accent-tile.active .sa-accent-name {
  color: var(--accent);
}

/* Color picker custom : input type=color natif + label texte hex courant */
.sa-accent-custom-row {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.sa-accent-custom-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.sa-accent-custom-input {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}
.sa-accent-custom-input::-webkit-color-swatch-wrapper {
  padding: 2px;
}
.sa-accent-custom-input::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}
.sa-accent-custom-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sa-accent-custom-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}
.sa-accent-custom-value {
  font-size: 11px;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  color: var(--text-muted);
  text-transform: lowercase;
}

/* Preview live : montre comment la couleur impacte les composants types */
.sa-accent-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
}
.sa-accent-preview-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
}
.sa-accent-preview-btn {
  padding: 5px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: default;
  transition: background var(--motion-fast) var(--ease-out);
}
.sa-accent-preview-btn:hover {
  background: var(--accent-hover);
}
.sa-accent-preview-link {
  font-size: 12px;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: default;
}
.sa-accent-preview-mark {
  font-size: 12px;
  color: var(--accent);
  background: rgba(var(--accent-rgb), .14);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
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
  transition: border-radius var(--motion-base) var(--ease-out);
}
</style>
