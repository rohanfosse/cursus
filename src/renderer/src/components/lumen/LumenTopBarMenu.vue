<script setup lang="ts">
/**
 * Menu overflow de la top bar Lumen (v2.103).
 * Regroupe les actions secondaires : dernier sync, nouveau cours,
 * raccourcis clavier, parametres, et identite GitHub.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  MoreHorizontal, Plus, Keyboard, Settings, Github, LogOut, Clock,
} from 'lucide-vue-next'
import { relativeTime } from '@/utils/date'

interface Props {
  isTeacher: boolean
  githubConnected: boolean
  githubLogin: string | null
  lastSyncedAt: string | null
  syncing: boolean
  promoOrg: string | null
}

interface Emits {
  (e: 'open-new-course'): void
  (e: 'open-settings'): void
  (e: 'show-keyboard-help'): void
  (e: 'disconnect'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function handleAction(action: () => void) {
  action()
  close()
}

function onClickOutside(ev: MouseEvent) {
  if (!open.value) return
  const target = ev.target as Node | null
  if (menuRef.value && target && !menuRef.value.contains(target)) {
    close()
  }
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && open.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside, true)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="menuRef" class="lumen-overflow-wrap">
    <button
      type="button"
      class="lumen-btn ghost lumen-btn-icon"
      title="Plus d'options"
      aria-label="Plus d'options"
      :aria-expanded="open"
      @click="toggle"
    >
      <MoreHorizontal :size="16" />
    </button>

    <Transition name="menu-fade">
      <div v-if="open" class="lumen-overflow-menu" role="menu">
        <!-- Dernier sync (info) -->
        <div v-if="githubConnected && lastSyncedAt" class="lumen-overflow-item lumen-overflow-info">
          <Clock :size="13" />
          <span>Maj {{ relativeTime(lastSyncedAt + 'Z') }}</span>
        </div>

        <!-- Org GitHub (info) -->
        <div v-if="promoOrg" class="lumen-overflow-item lumen-overflow-info">
          <Github :size="13" />
          <span class="lumen-overflow-org">{{ promoOrg }}</span>
        </div>

        <div v-if="githubConnected && (lastSyncedAt || promoOrg)" class="lumen-overflow-sep" />

        <!-- Nouveau cours (teacher) -->
        <button
          v-if="githubConnected && isTeacher"
          type="button"
          class="lumen-overflow-item"
          role="menuitem"
          :disabled="syncing || !promoOrg"
          @click="handleAction(() => emit('open-new-course'))"
        >
          <Plus :size="13" />
          <span>Nouveau cours</span>
        </button>

        <!-- Parametres (teacher) -->
        <button
          v-if="isTeacher"
          type="button"
          class="lumen-overflow-item"
          role="menuitem"
          @click="handleAction(() => emit('open-settings'))"
        >
          <Settings :size="13" />
          <span>Parametres</span>
        </button>

        <!-- Raccourcis clavier -->
        <button
          type="button"
          class="lumen-overflow-item"
          role="menuitem"
          @click="handleAction(() => emit('show-keyboard-help'))"
        >
          <Keyboard :size="13" />
          <span>Raccourcis clavier</span>
        </button>

        <div v-if="githubConnected" class="lumen-overflow-sep" />

        <!-- GitHub user -->
        <div v-if="githubConnected" class="lumen-overflow-item lumen-overflow-user">
          <Github :size="13" />
          <span>{{ githubLogin }}</span>
          <button
            type="button"
            class="lumen-overflow-logout"
            title="Se deconnecter de GitHub"
            @click="handleAction(() => emit('disconnect'))"
          >
            <LogOut :size="11" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.lumen-overflow-wrap {
  position: relative;
}

.lumen-overflow-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 220px;
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--elevation-3, 0 4px 16px rgba(0, 0, 0, 0.25));
  padding: 4px 0;
  z-index: 100;
}

.lumen-overflow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  border-radius: 0;
  transition: background var(--t-fast) ease;
}

button.lumen-overflow-item:hover:not(:disabled) {
  background: var(--bg-hover);
}

button.lumen-overflow-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.lumen-overflow-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.lumen-overflow-info {
  color: var(--text-muted);
  font-size: 11px;
  cursor: default;
}

.lumen-overflow-org {
  font-family: var(--font-mono);
  font-size: 11px;
}

.lumen-overflow-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.lumen-overflow-user {
  cursor: default;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.lumen-overflow-logout {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 3px;
}
.lumen-overflow-logout:hover { color: var(--danger); }

/* Transition */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
