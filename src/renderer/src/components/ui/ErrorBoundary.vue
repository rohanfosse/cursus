<script setup lang="ts">
  // ErrorBoundary -- capture les erreurs Vue dans ses enfants et affiche un fallback.
  import { ref, onErrorCaptured } from 'vue'
  import { AlertTriangle, RotateCcw } from 'lucide-vue-next'

  const props = defineProps<{
    label?: string
  }>()

  const error = ref<Error | null>(null)

  onErrorCaptured((err) => {
    error.value = err instanceof Error ? err : new Error(String(err))
    if (import.meta.env.DEV) console.error(`[ErrorBoundary:${props.label ?? 'unknown'}]`, err)
    return false
  })

  function retry() {
    error.value = null
  }
</script>

<template>
  <slot v-if="!error" />
  <div v-else class="eb-fallback">
    <div class="eb-icon"><AlertTriangle :size="32" /></div>
    <h3 class="eb-title">Une erreur est survenue</h3>
    <p v-if="label" class="eb-label">{{ label }}</p>
    <p class="eb-detail">{{ error.message }}</p>
    <button class="btn-ghost eb-retry" @click="retry">
      <RotateCcw :size="14" /> Reessayer
    </button>
  </div>
</template>

<style scoped>
.eb-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
  min-height: 200px;
}

.eb-icon { color: var(--color-warning); }
.eb-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.eb-label { font-size: 13px; color: var(--text-muted); }
.eb-detail { font-size: 12px; color: var(--text-muted); max-width: 400px; word-break: break-word; }
.eb-retry { margin-top: 8px; }
</style>
