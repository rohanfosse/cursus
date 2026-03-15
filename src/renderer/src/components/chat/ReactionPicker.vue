<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'
  import { Smile } from '@lucide/vue-next'
  import { useMessagesStore } from '@/stores/messages'

  interface Props { msgId: number }
  const props = defineProps<Props>()
  const messagesStore = useMessagesStore()

  const REACT_TYPES = [
    { type: 'check',    emoji: '✅' },
    { type: 'thumb',    emoji: '👍' },
    { type: 'bulb',     emoji: '💡' },
    { type: 'question', emoji: '❓' },
    { type: 'eye',      emoji: '👁️' },
  ]

  const open = ref(false)

  function toggle() { open.value = !open.value }

  function pick(type: string) {
    messagesStore.toggleReaction(props.msgId, type)
    open.value = false
  }

  function onDocClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest('.reaction-picker-root')
    if (!el) open.value = false
  }

  onMounted(()   => document.addEventListener('click', onDocClick))
  onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="reaction-picker-root" style="position:relative;display:inline-flex">
    <button
      class="btn-icon msg-action-btn add-reaction-btn"
      title="Ajouter une réaction"
      aria-label="Ajouter une réaction"
      @click.stop="toggle"
    >
      <Smile :size="14" />
    </button>
    <div v-if="open" class="reaction-picker" style="position:absolute;bottom:28px;left:0;z-index:200">
      <button
        v-for="r in REACT_TYPES"
        :key="r.type"
        class="reaction-picker-btn"
        :aria-label="r.type"
        @click.stop="pick(r.type)"
      >
        {{ r.emoji }}
      </button>
    </div>
  </div>
</template>
