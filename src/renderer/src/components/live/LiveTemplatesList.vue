<script setup lang="ts">
/**
 * LiveTemplatesList — section "Modeles enregistres" sur la home prof.
 * Extrait de TeacherLiveView.vue (v2.282).
 *
 * Affiche les templates locaux sauvegardes (10 max) que le prof peut
 * recharger dans une nouvelle session. Boutons utiliser / supprimer.
 */
import { Bookmark, Plus, Trash2 } from 'lucide-vue-next'
import type { LiveTemplate } from '@/composables/useLiveTemplates'

defineProps<{
  templates: LiveTemplate[]
}>()

defineEmits<{
  (e: 'load', id: string): void
  (e: 'delete', id: string, name: string): void
}>()
</script>

<template>
  <section v-if="templates.length > 0" class="live-section" aria-labelledby="live-templates-title">
    <header class="live-section-head">
      <h2 id="live-templates-title" class="live-section-title">
        <Bookmark :size="16" aria-hidden="true" />
        Modeles enregistres
        <span class="live-section-count">{{ templates.length }}</span>
      </h2>
    </header>
    <div class="live-templates-list">
      <div v-for="tpl in templates" :key="tpl.id" class="live-template-card">
        <div class="ltc-body">
          <span class="ltc-name">{{ tpl.name }}</span>
          <span class="ltc-meta">{{ tpl.activities.length }} activite{{ tpl.activities.length > 1 ? 's' : '' }}</span>
        </div>
        <div class="ltc-actions">
          <button
            class="ltc-load"
            :title="`Charger « ${tpl.name} » dans une nouvelle session`"
            @click="$emit('load', tpl.id)"
          >
            <Plus :size="12" /> Utiliser
          </button>
          <button
            class="ltc-del"
            :title="`Supprimer ${tpl.name}`"
            aria-label="Supprimer le modele"
            @click="$emit('delete', tpl.id, tpl.name)"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Section title aligne sur LiveCategoryGrid (display 22 / -0.03em). */
.live-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.live-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.live-section-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.live-section-title :deep(svg),
.live-section-title svg {
  color: var(--color-live);
  flex-shrink: 0;
}
.live-section-count {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-live) 12%, transparent);
  color: var(--color-live);
  margin-left: 2px;
  border: 1px solid color-mix(in srgb, var(--color-live) 25%, transparent);
}

/* Templates list (extracted v2.282). Cards radius lg + barre live-red
   sticky-left + hover lift. */
.live-templates-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-md);
}
.live-template-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition:
    border-color var(--motion-fast) var(--ease-out),
    transform 0.22s var(--ease-spring),
    box-shadow 0.22s var(--ease-spring);
}
.live-template-card::before {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--color-live);
  opacity: 0.4;
  transition: opacity var(--motion-fast) var(--ease-out);
}
.live-template-card:hover {
  border-color: color-mix(in srgb, var(--color-live) 40%, var(--border));
  transform: translateY(-2px);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-live) 14%, transparent);
}
.live-template-card:hover::before { opacity: 1; }
.ltc-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ltc-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ltc-meta { font-size: 11px; color: var(--text-muted); }
.ltc-actions { display: flex; gap: 6px; flex-shrink: 0; }
.ltc-load {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-live) 12%, transparent);
  color: var(--color-live);
  border: 1px solid color-mix(in srgb, var(--color-live) 30%, transparent);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
}
.ltc-load:hover {
  background: color-mix(in srgb, var(--color-live) 22%, transparent);
  transform: translateY(-1px);
}
.ltc-del {
  width: 28px; height: 28px;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--motion-fast) var(--ease-out);
}
.ltc-del:hover {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .live-template-card,
  .live-template-card:hover,
  .ltc-load:hover { transform: none; }
}
</style>
