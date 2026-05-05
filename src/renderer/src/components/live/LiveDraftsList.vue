<script setup lang="ts">
/**
 * LiveDraftsList — section "Brouillons a reprendre" sur la home prof.
 * Extrait de TeacherLiveView.vue (v2.282).
 *
 * Affiche les sessions en status `waiting` que le prof n'a pas encore
 * lancees. Click -> emit('resume', session). Boutons cloner / supprimer
 * en actions secondaires.
 */
import { PencilLine, Play, Copy, Trash2 } from 'lucide-vue-next'
import UiCard from '@/components/ui/UiCard.vue'
import { relativeTime } from '@/utils/date'
import type { LiveSession } from '@/types'

defineProps<{
  drafts: LiveSession[]
  draftActivityCount: (s: LiveSession) => number
}>()

defineEmits<{
  (e: 'resume', s: LiveSession): void
  (e: 'clone', s: LiveSession): void
  (e: 'delete', s: LiveSession): void
}>()
</script>

<template>
  <section v-if="drafts.length > 0" class="live-section" aria-labelledby="live-drafts-title">
    <header class="live-section-head">
      <h2 id="live-drafts-title" class="live-section-title">
        <PencilLine :size="16" aria-hidden="true" />
        Brouillons a reprendre
        <span class="live-section-count">{{ drafts.length }}</span>
      </h2>
    </header>
    <div class="live-drafts-grid">
      <UiCard
        v-for="s in drafts"
        :key="s.id"
        interactive
        :elevated="1"
        padding="md"
        class="live-draft-card"
        @click="$emit('resume', s)"
      >
        <div class="ldc-body">
          <span class="ldc-title">{{ s.title }}</span>
          <div class="ldc-meta">
            <span>{{ draftActivityCount(s) }} activite{{ draftActivityCount(s) > 1 ? 's' : '' }}</span>
            <span class="ldc-sep" aria-hidden="true">·</span>
            <span>cree {{ relativeTime(s.created_at) }}</span>
          </div>
        </div>
        <div class="ldc-actions">
          <button
            type="button"
            class="ldc-resume"
            :title="`Reprendre « ${s.title} »`"
            @click.stop="$emit('resume', s)"
          >
            <Play :size="13" aria-hidden="true" />
            Reprendre
          </button>
          <button
            type="button"
            class="ldc-clone"
            :title="`Dupliquer « ${s.title} »`"
            aria-label="Dupliquer"
            @click.stop="$emit('clone', s)"
          >
            <Copy :size="13" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="ldc-delete"
            :title="`Supprimer « ${s.title} »`"
            aria-label="Supprimer le brouillon"
            @click.stop="$emit('delete', s)"
          >
            <Trash2 :size="13" aria-hidden="true" />
          </button>
        </div>
      </UiCard>
    </div>
  </section>
</template>

<style scoped>
/* Section title aligne sur LiveCategoryGrid (display 22px / -0.03em). */
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

/* Drafts cards (extracted v2.282). UiCard fournit bg/border/radius. */
.live-drafts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-md);
}
.live-draft-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.ldc-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ldc-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ldc-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.ldc-sep { opacity: .6; }
.ldc-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: auto;
  padding-top: var(--space-sm);
  border-top: 1px dashed var(--border);
}
.ldc-resume {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 12px;
  border: none;
  border-radius: var(--radius);
  background: var(--color-live);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: filter var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
}
.ldc-resume:hover { filter: brightness(1.1); transform: translateY(-1px); }
.ldc-resume:active { transform: translateY(0); }
.ldc-clone,
.ldc-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.ldc-clone:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--color-live) 40%, var(--border));
}
.ldc-delete:hover {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .ldc-resume, .ldc-clone, .ldc-delete { transition: none !important; }
  .ldc-resume:hover { transform: none; }
}
</style>
