/** SettingsShortcuts — section Raccourcis clavier du modal Settings. */
<script setup lang="ts">
import { Keyboard } from 'lucide-vue-next'

interface ShortcutGroup {
  title: string
  shortcuts: { keys: string[]; label: string }[]
}

const groups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', '1'], label: 'Aller au Dashboard' },
      { keys: ['Ctrl', '2'], label: 'Aller aux Messages' },
      { keys: ['Ctrl', '3'], label: 'Aller aux Devoirs' },
      { keys: ['Ctrl', '4'], label: 'Aller aux Ressources' },
      { keys: ['Ctrl', 'N'], label: 'Ouvrir la palette de commandes' },
      { keys: ['Ctrl', 'K'], label: 'Recherche rapide' },
      { keys: ['Echap'], label: 'Fermer la modale / annuler' },
    ],
  },
  {
    title: 'Messages',
    shortcuts: [
      { keys: ['Entree'], label: 'Envoyer le message (si active)' },
      { keys: ['Ctrl', 'Entree'], label: 'Envoyer le message (mode alternatif)' },
      { keys: ['Ctrl', 'B'], label: 'Gras' },
      { keys: ['Ctrl', 'I'], label: 'Italique' },
      { keys: ['Ctrl', 'E'], label: 'Code inline' },
      { keys: ['Ctrl', 'Shift', 'C'], label: 'Bloc de code' },
      { keys: ['Ctrl', 'Shift', 'X'], label: 'Barre' },
      { keys: ['Ctrl', 'Shift', '>'], label: 'Citation' },
    ],
  },
  {
    title: 'Spark (Quiz live)',
    shortcuts: [
      { keys: ['Espace'], label: 'Fermer l\'activite en cours / suivante' },
      { keys: ['Entree'], label: 'Lancer l\'activite suivante' },
      { keys: ['Echap'], label: 'Annuler / fermer le leaderboard' },
    ],
  },
  {
    title: 'Pulse (Mode presentation)',
    shortcuts: [
      { keys: ['\u2192'], label: 'Activite suivante' },
      { keys: ['\u2190'], label: 'Activite precedente' },
      { keys: ['Espace'], label: 'Avancer' },
      { keys: ['Echap'], label: 'Quitter la presentation' },
    ],
  },
]
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Keyboard :size="18" />
      <h3 class="stg-section-title">Raccourcis clavier</h3>
    </div>

    <div v-for="g in groups" :key="g.title" class="stg-group">
      <h4 class="stg-group-title" style="margin-bottom: 8px">{{ g.title }}</h4>
      <div class="sk-list">
        <div v-for="s in g.shortcuts" :key="s.label" class="sk-row">
          <span class="sk-label">{{ s.label }}</span>
          <span class="sk-keys">
            <kbd v-for="(k, i) in s.keys" :key="i" class="sk-key">{{ k }}</kbd>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sk-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 7px;
  transition: background 0.1s;
}
.sk-row:hover {
  background: var(--bg-hover);
}
.sk-label {
  font-size: 13px;
  color: var(--text-primary);
}
.sk-keys {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.sk-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-elevated, rgba(255,255,255,0.04));
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font);
  line-height: 1;
}
</style>
