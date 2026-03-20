<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'

const emit = defineEmits<{ pick: [emoji: string] }>()

const search = ref('')
const activeCategory = ref('frequent')

const CATEGORIES = [
  { id: 'frequent', label: '⏱️', title: 'Fréquents' },
  { id: 'smileys',  label: '😊', title: 'Smileys' },
  { id: 'gestures', label: '👋', title: 'Gestes' },
  { id: 'people',   label: '👤', title: 'Personnes' },
  { id: 'nature',   label: '🌿', title: 'Nature' },
  { id: 'food',     label: '🍕', title: 'Nourriture' },
  { id: 'objects',  label: '💡', title: 'Objets' },
  { id: 'symbols',  label: '✅', title: 'Symboles' },
]

const EMOJIS: Record<string, string[]> = {
  frequent: ['👍', '❤️', '😂', '🔥', '✅', '👏', '🎉', '🚀', '👀', '🤔', '💯', '⭐'],
  smileys:  ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😜', '🤪', '😎', '🤓', '🧐', '😏', '😒', '😞', '😔', '😟', '😕', '😤', '😠', '😡', '🤬', '😱', '😨', '😰', '😥', '😢', '😭', '😩', '🥺', '😴', '🤮', '🤧', '🥵', '🥶'],
  gestures: ['👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🤝', '🙏', '💪'],
  people:   ['👤', '👥', '🧑‍💻', '👨‍🏫', '👩‍🎓', '🧑‍🎓', '👨‍💼', '👩‍💼', '🦸', '🧙', '🤷', '🙋', '💁', '🙅', '🙆', '🤦', '🧑‍🤝‍🧑'],
  nature:   ['🌿', '🌱', '🌲', '🌳', '🍀', '🌸', '🌺', '🌻', '🌞', '🌙', '⭐', '🌈', '☀️', '⛅', '🌧️', '❄️', '🐶', '🐱', '🐻', '🦊', '🐸', '🐧', '🦋', '🐝'],
  food:     ['🍕', '🍔', '🌮', '🍜', '🍣', '🍰', '🎂', '🍩', '🍪', '☕', '🍵', '🧃', '🍺', '🍷', '🍹'],
  objects:  ['💡', '📚', '📖', '📝', '✏️', '📌', '📎', '📁', '💻', '🖥️', '📱', '⌨️', '🔧', '🔨', '⚙️', '🎯', '🏆', '🎓', '📅', '⏰', '🔔', '📢', '💬', '💭', '🔗', '📊', '📈'],
  symbols:  ['✅', '❌', '⚠️', '❓', '❗', '💯', '🔥', '⚡', '💥', '🎉', '🎊', '✨', '💫', '🚀', '🏁', '🔴', '🟢', '🔵', '🟡', '⬆️', '⬇️', '➡️', '⬅️', '↩️', '🔄', '➕', '➖', '✖️', '➗', '♻️'],
}

const FREQ_KEY = 'cc_emoji_freq'
function getFrequent(): string[] {
  try { return JSON.parse(localStorage.getItem(FREQ_KEY) || '[]').slice(0, 12) }
  catch { return [] }
}
function addFrequent(emoji: string) {
  const list = getFrequent().filter(e => e !== emoji)
  list.unshift(emoji)
  localStorage.setItem(FREQ_KEY, JSON.stringify(list.slice(0, 12)))
}

const filteredEmojis = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q) {
    // Recherche dans toutes les catégories
    const all = Object.values(EMOJIS).flat()
    const unique = [...new Set(all)]
    return unique // pour les emojis, pas de recherche textuelle avancée, on retourne tout
  }
  if (activeCategory.value === 'frequent') {
    const freq = getFrequent()
    return freq.length ? freq : EMOJIS.frequent
  }
  return EMOJIS[activeCategory.value] ?? []
})

function pick(emoji: string) {
  addFrequent(emoji)
  emit('pick', emoji)
}
</script>

<template>
  <div class="ep-container" @click.stop>
    <!-- Barre de catégories -->
    <div class="ep-categories">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        class="ep-cat-btn"
        :class="{ active: activeCategory === cat.id }"
        :title="cat.title"
        @click="activeCategory = cat.id"
      >{{ cat.label }}</button>
    </div>

    <!-- Recherche -->
    <div class="ep-search">
      <Search :size="13" class="ep-search-icon" />
      <input v-model="search" type="text" placeholder="Rechercher..." class="ep-search-input" />
    </div>

    <!-- Grille d'emojis -->
    <div class="ep-grid">
      <button
        v-for="emoji in filteredEmojis"
        :key="emoji"
        class="ep-emoji"
        :title="emoji"
        @click="pick(emoji)"
      >{{ emoji }}</button>
    </div>
  </div>
</template>

<style scoped>
.ep-container {
  width: 320px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.ep-categories {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 4px;
  gap: 2px;
}
.ep-cat-btn {
  flex: 1;
  padding: 6px 0;
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  border-radius: 6px;
  transition: background .12s;
}
.ep-cat-btn:hover { background: var(--bg-hover); }
.ep-cat-btn.active { background: var(--accent-subtle); }

.ep-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.ep-search-icon { color: var(--text-muted); flex-shrink: 0; }
.ep-search-input {
  flex: 1; border: none; background: transparent;
  color: var(--text-primary); font-size: 12px; outline: none;
  font-family: var(--font);
}

.ep-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.1) transparent;
}
.ep-emoji {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: background .1s, transform .1s;
}
.ep-emoji:hover {
  background: var(--bg-hover);
  transform: scale(1.2);
}
</style>
