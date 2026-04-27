<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Bookmark, Plus, X, Pencil } from 'lucide-vue-next'
import { STORAGE_KEYS } from '@/constants'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'

interface QuickLink { name: string; url: string }

const STORAGE_KEY = STORAGE_KEYS.QUICKLINKS
const DEFAULT_LINKS: QuickLink[] = [
  { name: 'Moodle', url: 'https://moodle.cesi.fr' },
]

const links = ref<QuickLink[]>([])
const editing = ref(false)
const newName = ref('')
const newUrl = ref('')

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    links.value = raw ? JSON.parse(raw) : [...DEFAULT_LINKS]
  } catch (err) {
    console.warn('[WidgetQuickLinks] Erreur lecture localStorage', err)
    links.value = [...DEFAULT_LINKS]
  }
})

watch(links, (val) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
}, { deep: true })

function openLink(url: string) {
  if (!url.startsWith('https://') && !url.startsWith('http://')) return
  if (window.api?.openExternal) {
    window.api.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

function addLink() {
  const name = newName.value.trim()
  const url = newUrl.value.trim()
  if (!name || !url || links.value.length >= 6) return
  links.value.push({ name, url })
  newName.value = ''
  newUrl.value = ''
}

function removeLink(idx: number) {
  links.value.splice(idx, 1)
}
</script>

<template>
  <UiWidgetCard :icon="Bookmark" label="Liens rapides">
    <template #header-extra>
      <button
        type="button"
        class="wql-edit"
        :aria-label="editing ? 'Terminer l’édition' : 'Modifier les liens'"
        @click="editing = !editing"
      >
        <Pencil :size="12" />
      </button>
    </template>

    <div class="wql-pills">
      <span
        v-for="(link, i) in links"
        :key="i"
        class="wql-pill"
        role="button"
        tabindex="0"
        @click="!editing && openLink(link.url)"
        @keydown.enter="!editing && openLink(link.url)"
        @keydown.space.prevent="!editing && openLink(link.url)"
      >
        {{ link.name }}
        <button
          v-if="editing"
          class="wql-remove"
          :aria-label="`Supprimer ${link.name}`"
          @click.stop="removeLink(i)"
        >
          <X :size="10" />
        </button>
      </span>
    </div>

    <div v-if="editing && links.length < 6" class="wql-add">
      <input v-model="newName" class="wql-input" placeholder="Nom" maxlength="20" @keydown.enter="addLink" />
      <input v-model="newUrl" class="wql-input wql-input--url" placeholder="URL" @keydown.enter="addLink" />
      <button type="button" class="wql-add-btn" aria-label="Ajouter le lien" @click="addLink">
        <Plus :size="12" />
      </button>
    </div>
  </UiWidgetCard>
</template>

<style scoped>
.wql-edit {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  transition: color var(--motion-fast) var(--ease-out);
}
.wql-edit:hover { color: var(--accent); }
.wql-edit:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wql-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.wql-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 4px var(--space-sm);
  border-radius: 14px;
  background: rgba(var(--accent-rgb), .1);
  color: var(--accent);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out);
  user-select: none;
}
.wql-pill:hover { background: rgba(var(--accent-rgb), .18); }
.wql-pill:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wql-remove {
  background: none;
  border: none;
  color: var(--color-danger);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

.wql-add {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

.wql-input {
  flex: 1;
  font-size: var(--text-xs);
  padding: 3px var(--space-xs);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: inherit;
  min-width: 0;
}
.wql-input--url { flex: 2; }

.wql-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 3px var(--space-sm);
  cursor: pointer;
  font-family: inherit;
}
.wql-add-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
