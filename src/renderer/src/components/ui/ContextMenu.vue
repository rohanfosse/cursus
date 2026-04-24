<script setup lang="ts">
import { onMounted, onBeforeUnmount, nextTick, ref } from 'vue'
import type { Component } from 'vue'

export interface ContextMenuItem {
  label:      string
  icon?:      Component
  action?:    () => void
  danger?:    boolean
  separator?: boolean   // si true, affiche un séparateur avant cet item
  disabled?:  boolean
}

export interface ContextMenuQuickEmoji {
  emoji:  string
  label?: string
  action: () => void
}

const props = defineProps<{
  x:           number
  y:           number
  items:       ContextMenuItem[]
  quickEmojis?: ContextMenuQuickEmoji[]
}>()

const emit = defineEmits<{ close: [] }>()

function runEmoji(q: ContextMenuQuickEmoji) {
  q.action()
  emit('close')
}

const menuEl = ref<HTMLElement | null>(null)
// Position ajustée pour rester dans le viewport
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

onMounted(async () => {
  await nextTick()
  if (!menuEl.value) return
  const rect = menuEl.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  adjustedX.value = props.x + rect.width  > vw ? props.x - rect.width  : props.x
  adjustedY.value = props.y + rect.height > vh ? props.y - rect.height  : props.y

  document.addEventListener('mousedown', onOutside, { capture: true })
  document.addEventListener('keydown',   onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onOutside, { capture: true })
  document.removeEventListener('keydown',   onKey)
})

function onOutside(e: MouseEvent) {
  if (menuEl.value && !menuEl.value.contains(e.target as Node)) emit('close')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function run(item: ContextMenuItem) {
  if (item.disabled) return
  item.action?.()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuEl"
      class="ctx-menu"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
      role="menu"
    >
      <!-- Quick emojis : rangee de reactions rapides tout en haut -->
      <div v-if="quickEmojis && quickEmojis.length" class="ctx-emoji-row" role="group" aria-label="Réactions rapides">
        <button
          v-for="(q, qi) in quickEmojis"
          :key="qi"
          type="button"
          class="ctx-emoji-btn"
          :title="q.label || 'Réagir'"
          :aria-label="q.label || `Réagir avec ${q.emoji}`"
          @click.stop="runEmoji(q)"
        >{{ q.emoji }}</button>
      </div>
      <div v-if="quickEmojis && quickEmojis.length" class="ctx-separator" />

      <template v-for="(item, i) in items" :key="i">
        <div v-if="item.separator" class="ctx-separator" />
        <button
          class="ctx-item"
          :class="{ 'ctx-item--danger': item.danger, 'ctx-item--disabled': item.disabled }"
          role="menuitem"
          :tabindex="item.disabled ? -1 : 0"
          @click.stop="run(item)"
          @keydown.enter.stop="run(item)"
        >
          <component :is="item.icon" v-if="item.icon" :size="13" class="ctx-icon" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  background: var(--bg-secondary);
  border: 1px solid var(--border, var(--bg-hover));
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,.4), 0 2px 8px rgba(0,0,0,.3);
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: ctx-in .1s ease;
}

@keyframes ctx-in {
  from { opacity: 0; transform: scale(.96) translateY(-4px); }
  to   { opacity: 1; transform: none; }
}

.ctx-separator {
  height: 1px;
  background: var(--border, rgba(255,255,255,.08));
  margin: 3px 4px;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font, sans-serif);
  font-size: 13px;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
  transition: background .1s, color .1s;
  white-space: nowrap;
}
.ctx-item:hover:not(.ctx-item--disabled) {
  background: var(--bg-hover, rgba(255,255,255,.07));
  color: var(--text-primary);
}
.ctx-item--danger       { color: var(--color-danger); }
.ctx-item--danger:hover { background: rgba(var(--color-danger-rgb),.12); }
.ctx-item--disabled     { opacity: .4; cursor: not-allowed; }

.ctx-icon { flex-shrink: 0; }

/* ── Quick emojis row (aligne sur le hover pill .pill-emoji-btn) ── */
.ctx-emoji-row {
  display: flex;
  gap: 1px;
  padding: 3px 2px;
  align-items: center;
  justify-content: space-between;
}
.ctx-emoji-btn {
  flex: 1 1 0;
  min-width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-primary);
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  transition: background .1s, transform .1s;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}
.ctx-emoji-btn:hover {
  background: var(--bg-hover, rgba(255,255,255,.08));
  transform: scale(1.25);
}
.ctx-emoji-btn:active {
  transform: scale(0.92);
}
.ctx-emoji-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .ctx-emoji-btn { transition: background .1s; }
  .ctx-emoji-btn:hover { transform: none; }
  .ctx-emoji-btn:active { transform: none; }
}
</style>
