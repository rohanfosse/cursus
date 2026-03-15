<script setup lang="ts">
  import { toastState } from '@/composables/useToast'
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toastState.visible"
        :id="'app-toast'"
        :class="`toast-${toastState.type}`"
      >
        <span class="toast-msg">{{ toastState.message }}</span>
        <button
          v-if="toastState.type === 'undo' && toastState.onUndo"
          class="toast-undo-btn"
          @click="toastState.onUndo?.()"
        >
          Annuler
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.2s, transform 0.2s;
  }
  .toast-enter-from,
  .toast-leave-to {
    opacity: 0;
    transform: translateY(8px);
  }
</style>
