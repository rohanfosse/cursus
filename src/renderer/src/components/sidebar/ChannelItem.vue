<script setup lang="ts">
  import { computed } from 'vue'
  import { useAppStore } from '@/stores/app'

  interface Props {
    channelId: number
    name: string
    prefix?: string
    type?: 'chat' | 'annonce' | 'dm'
  }

  const props  = withDefaults(defineProps<Props>(), { prefix: '#', type: 'chat' })
  const emit   = defineEmits<{ click: [] }>()
  const appStore = useAppStore()

  const isActive = computed(() => appStore.activeChannelId === props.channelId)
  const unread   = computed(() => appStore.unread[props.channelId] ?? 0)
</script>

<template>
  <button
    class="sidebar-item"
    :class="{ active: isActive, 'has-unread': unread > 0 }"
    @click="emit('click')"
  >
    <span class="channel-prefix">{{ prefix }}</span>
    <span class="channel-name">{{ name }}</span>
    <span v-if="unread > 0" class="unread-badge">{{ unread > 9 ? '9+' : unread }}</span>
  </button>
</template>
