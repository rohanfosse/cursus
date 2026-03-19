<script setup lang="ts">
  import { ref, toRef, onMounted, onUnmounted } from 'vue'
  import { X } from 'lucide-vue-next'
  import { useFocusTrap } from '@/composables/useFocusTrap'

  interface Props {
    modelValue: boolean
    title?: string
    maxWidth?: string
  }

  const props = withDefaults(defineProps<Props>(), { maxWidth: '540px' })
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const modalBoxRef = ref<HTMLElement | null>(null)
  useFocusTrap(modalBoxRef, toRef(props, 'modelValue'))

  function close() { emit('update:modelValue', false) }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && props.modelValue) close()
  }

  onMounted(()   => document.addEventListener('keydown', onKey))
  onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" role="dialog" aria-modal="true" @click.self="close">
        <div ref="modalBoxRef" class="modal-box" :style="{ maxWidth }">
          <div v-if="title" class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close" aria-label="Fermer" @click="close">
              <X :size="16" />
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.15s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
  .modal-enter-active .modal-box,
  .modal-leave-active .modal-box {
    transition: transform 0.15s ease;
  }
  .modal-enter-from .modal-box,
  .modal-leave-to .modal-box {
    transform: translateY(-8px) scale(0.98);
  }
</style>
