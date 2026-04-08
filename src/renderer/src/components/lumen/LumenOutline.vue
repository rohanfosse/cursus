<script setup lang="ts">
import { computed } from 'vue'
import { ListTree } from 'lucide-vue-next'

interface Props {
  content: string
}
interface Emits {
  (e: 'navigate', line: number): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

// Parse le markdown ligne par ligne pour extraire les headers.
// Ignore les headers dans les blocs de code (entre ```).
interface Heading {
  level: number
  text: string
  line: number  // 1-indexed
}

const headings = computed<Heading[]>(() => {
  const out: Heading[] = []
  const lines = props.content.split('\n')
  let inCode = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    const match = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line)
    if (match) {
      out.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      })
    }
  }
  return out
})
</script>

<template>
  <aside class="lumen-outline">
    <header class="lumen-outline-head">
      <ListTree :size="13" />
      <span>Plan du cours</span>
    </header>
    <nav v-if="headings.length > 0" class="lumen-outline-nav">
      <button
        v-for="h in headings"
        :key="`${h.line}-${h.text}`"
        class="lumen-outline-item"
        :class="`lumen-outline-item--h${h.level}`"
        :title="h.text"
        @click="$emit('navigate', h.line)"
      >
        {{ h.text }}
      </button>
    </nav>
    <p v-else class="lumen-outline-empty">
      Ajoute des titres (# Titre) pour générer le plan.
    </p>
  </aside>
</template>

<style scoped>
.lumen-outline {
  width: 240px;
  flex-shrink: 0;
  border-left: 1px solid var(--border, rgba(0, 0, 0, .08));
  background: var(--bg, #f8fafc);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lumen-outline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, rgba(0, 0, 0, .08));
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3, #94a3b8);
}

.lumen-outline-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.lumen-outline-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-2, #64748b);
  padding: 5px 16px;
  border-left: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 150ms ease;
}

.lumen-outline-item:hover {
  background: var(--bg-card, #fff);
  color: var(--text, #1e293b);
  border-left-color: rgba(180, 83, 9, 0.5);
}
.lumen-outline-item:focus-visible {
  outline: 2px solid #b45309;
  outline-offset: -2px;
}

.lumen-outline-item--h1 { font-weight: 700; color: var(--text, #1e293b); }
.lumen-outline-item--h2 { padding-left: 26px; }
.lumen-outline-item--h3 { padding-left: 36px; font-size: 12px; }
.lumen-outline-item--h4 { padding-left: 46px; font-size: 12px; }
.lumen-outline-item--h5 { padding-left: 56px; font-size: 12px; color: var(--text-3, #94a3b8); }
.lumen-outline-item--h6 { padding-left: 66px; font-size: 12px; color: var(--text-3, #94a3b8); }

.lumen-outline-empty {
  padding: 24px 16px;
  font-size: 12px;
  color: var(--text-3, #94a3b8);
  text-align: center;
  line-height: 1.5;
}
</style>
