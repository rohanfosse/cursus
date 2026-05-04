/**
 * En-tete de la vue Devoirs : breadcrumb projet, hamburger mobile, bouton "Nouveau".
 * Utilise UiPageHeader pour partager la base visuelle avec les autres sections
 * (Messages, Lumen, Agenda, Documents). Cf. design-system/cursus/MASTER.md §7.
 */
<script setup lang="ts">
import { BookOpen, Plus, Menu } from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'

defineProps<{
  toggleSidebar?: () => void
}>()

const appStore = useAppStore()
const modals   = useModalsStore()
</script>

<template>
  <UiPageHeader section="devoirs">
    <template #leading>
      <button v-if="toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="toggleSidebar">
        <Menu :size="22" />
      </button>
    </template>

    <template #title>
      <div class="dh-title">
        <BookOpen :size="18" />
        <template v-if="appStore.activeProject">
          <button
            type="button"
            class="dh-back"
            title="Voir tous les projets"
            @click="appStore.activeProject = null"
          >Devoirs</button>
          <span class="dh-sep">&rsaquo;</span>
          <span class="dh-project" :title="appStore.activeProject">{{ appStore.activeProject }}</span>
          <button class="dh-project-clear" title="Voir tous les projets" @click="appStore.activeProject = null">&times;</button>
        </template>
        <template v-else>
          <span class="dh-title-text">Devoirs</span>
        </template>
      </div>
    </template>

    <template #actions>
      <button v-if="appStore.isTeacher" class="btn-cta dh-new" @click="modals.newDevoir = true">
        <Plus :size="14" /> Nouveau devoir
      </button>
    </template>
  </UiPageHeader>
</template>

<style scoped>
.dh-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 0;
}
.dh-title-text { flex-shrink: 0; }

.dh-back {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--motion-fast) var(--ease-out);
}
.dh-back:hover { color: var(--text-primary); }

.dh-channel {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-sep {
  font-size: 13px;
  color: var(--text-muted);
  opacity: .5;
}

.dh-project {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-cctl);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.dh-project-clear {
  font-size: 10px;
  line-height: 1;
  padding: 2px 5px;
  border: 1px solid rgba(155,135,245,.3);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font);
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
  flex-shrink: 0;
}
.dh-project-clear:hover {
  background: rgba(155,135,245,.15);
  color: var(--color-cctl);
  border-color: rgba(155,135,245,.6);
}

.dh-new {
  font-size: 13px;
  padding: var(--space-xs) var(--space-md);
}
</style>
