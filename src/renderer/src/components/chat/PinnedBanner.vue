<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Pin, ChevronDown, X } from 'lucide-vue-next'
  import { useMessagesStore } from '@/stores/messages'
  import { renderMessageContent } from '@/utils/html'
  import { formatTime } from '@/utils/date'

  const emit = defineEmits<{ (e: 'jump-to', id: number): void }>()

  const store    = useMessagesStore()
  const expanded = ref(false)

  const hasPinned = computed(() => store.pinned.length > 0)

  // Message épinglé le plus récent — affiché en aperçu en permanence
  const preview = computed(() => store.pinned[store.pinned.length - 1] ?? null)

  function jump(id: number) {
    emit('jump-to', id)
    expanded.value = false
  }
</script>

<template>
  <div v-if="hasPinned" class="pinned-wrap">

    <!-- Barre d'aperçu toujours visible -->
    <div class="pinned-bar">
      <Pin :size="12" class="pinned-bar-icon" />

      <!-- Aperçu du dernier message épinglé — cliquable -->
      <button
        v-if="preview"
        class="pinned-bar-preview"
        :title="`Aller au message de ${preview.author_name}`"
        @click="jump(preview.id)"
      >
        <span class="pinned-bar-author">{{ preview.author_name }}</span>
        <span class="pinned-bar-sep">·</span>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="pinned-bar-text" v-html="renderMessageContent(preview.content)" />
      </button>

      <!-- Compteur + toggle liste -->
      <button
        v-if="store.pinned.length > 1"
        class="pinned-bar-count"
        :title="expanded ? 'Réduire' : `Voir les ${store.pinned.length} messages épinglés`"
        @click="expanded = !expanded"
      >
        {{ store.pinned.length }}
        <ChevronDown :size="12" class="pinned-chevron" :class="{ rotated: expanded }" />
      </button>
    </div>

    <!-- Liste dépliable quand plusieurs messages épinglés -->
    <Transition name="pinned-expand">
      <ul v-if="expanded && store.pinned.length > 1" class="pinned-list">
        <li
          v-for="m in store.pinned"
          :key="m.id"
          class="pinned-item"
        >
          <button class="pinned-item-btn" @click="jump(m.id)">
            <Pin :size="10" class="pinned-item-icon" />
            <div class="pinned-item-body">
              <span class="pinned-item-author">{{ m.author_name }}</span>
              <span class="pinned-item-time">{{ formatTime(m.created_at) }}</span>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="pinned-item-text" v-html="renderMessageContent(m.content)" />
            </div>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Wrapper racine ── */
.pinned-wrap {
  flex-shrink: 0;
  background: rgba(232,137,26,.055);
  border-bottom: 1px solid rgba(232,137,26,.16);
}

/* ── Barre d'aperçu ── */
.pinned-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px 6px 20px;
  min-height: 34px;
}

.pinned-bar-icon {
  color: rgba(232,137,26,.9);
  flex-shrink: 0;
}

/* Bouton aperçu — prend tout l'espace disponible */
.pinned-bar-preview {
  display: flex;
  align-items: baseline;
  gap: 5px;
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--font);
  text-align: left;
  padding: 0;
  border-radius: 4px;
  transition: opacity .12s;
}
.pinned-bar-preview:hover { opacity: .8; }

.pinned-bar-author {
  font-size: 12px;
  font-weight: 700;
  color: rgba(232,137,26,.95);
  white-space: nowrap;
  flex-shrink: 0;
}
.pinned-bar-sep {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.pinned-bar-text {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  /* Supprimer les styles forts du contenu markdown dans la preview */
}
.pinned-bar-text :deep(strong) { font-weight: 700; }
.pinned-bar-text :deep(code)   { font-size: .9em; }
.pinned-bar-text :deep(p)      { display: inline; }
.pinned-bar-text :deep(pre), .pinned-bar-text :deep(blockquote) { display: none; }

/* Bouton compteur + chevron */
.pinned-bar-count {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(232,137,26,.12);
  border: 1px solid rgba(232,137,26,.25);
  border-radius: 10px;
  color: rgba(232,137,26,.9);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px 1px 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .12s, border-color .12s;
}
.pinned-bar-count:hover {
  background: rgba(232,137,26,.2);
  border-color: rgba(232,137,26,.4);
}

.pinned-chevron {
  transition: transform .2s cubic-bezier(.34,1.56,.64,1);
}
.pinned-chevron.rotated { transform: rotate(-180deg); }

/* ── Liste dépliée ── */
.pinned-expand-enter-active,
.pinned-expand-leave-active {
  transition: max-height .2s ease, opacity .15s ease;
  overflow: hidden;
}
.pinned-expand-enter-from,
.pinned-expand-leave-to  { max-height: 0; opacity: 0; }
.pinned-expand-enter-to,
.pinned-expand-leave-from{ max-height: 260px; opacity: 1; }

.pinned-list {
  list-style: none;
  border-top: 1px solid rgba(232,137,26,.12);
  padding: 4px 0;
  max-height: 260px;
  overflow-y: auto;
}

.pinned-item-btn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 7px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--font);
  text-align: left;
  border-radius: 0;
  transition: background .1s;
}
.pinned-item-btn:hover { background: rgba(232,137,26,.07); }

.pinned-item-icon {
  color: rgba(232,137,26,.7);
  flex-shrink: 0;
  margin-top: 3px;
}

.pinned-item-body {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.pinned-item-author {
  font-size: 12.5px;
  font-weight: 700;
  color: rgba(232,137,26,.9);
  white-space: nowrap;
}

.pinned-item-time {
  font-size: 10.5px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.pinned-item-text {
  font-size: 12.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 120px;
}
.pinned-item-text :deep(p) { display: inline; }
.pinned-item-text :deep(pre), .pinned-item-text :deep(blockquote) { display: none; }
</style>
