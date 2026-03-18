<script setup lang="ts">
  import { computed } from 'vue'
  import { Lock } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'

  interface Props {
    channelId:  number
    name:       string
    prefix?:    string
    type?:      'chat' | 'annonce' | 'dm'
    muted?:     boolean
    isPrivate?: boolean
  }

  const props  = withDefaults(defineProps<Props>(), { prefix: '#', type: 'chat', muted: false, isPrivate: false })
  const emit   = defineEmits<{ click: []; contextmenu: [e: MouseEvent] }>()
  const appStore = useAppStore()

  const isActive    = computed(() => appStore.activeChannelId === props.channelId)
  const unread      = computed(() => (props.muted ? 0 : appStore.unread[props.channelId] ?? 0))
  const mentionPing = computed(() => (props.muted ? 0 : appStore.mentionChannels[props.channelId] ?? 0))
</script>

<template>
  <button
    class="sidebar-item"
    :class="{
      active: isActive,
      'has-unread': unread > 0,
      'has-mention': mentionPing > 0,
      'is-muted': muted,
    }"
    @click="emit('click')"
    @contextmenu.prevent="emit('contextmenu', $event)"
  >
    <span class="channel-prefix">{{ muted ? '🔇' : prefix }}</span>
    <span class="channel-name">{{ name }}</span>
    <Lock v-if="isPrivate" :size="10" class="channel-lock" />

    <!-- Badge mention @ — prioritaire sur le badge unread -->
    <span v-if="mentionPing > 0" class="mention-ping-badge" aria-label="Vous êtes mentionné">@</span>
    <span v-else-if="unread > 0" class="unread-badge">{{ unread > 9 ? '9+' : unread }}</span>
  </button>
</template>

<style scoped>
.is-muted { opacity: .55; }
.is-muted:hover { opacity: .8; }

/* Cadenas canal privé */
.channel-lock {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: .6;
  margin-left: 2px;
}
.sidebar-item.active .channel-lock { opacity: .9; color: var(--accent-light); }

/* Badge mention @ */
.mention-ping-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-danger, #e74c3c);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -.5px;
  line-height: 1;
  flex-shrink: 0;
  animation: mention-pulse 2.2s ease-in-out infinite;
}

@keyframes mention-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, .55); }
  50%       { box-shadow: 0 0 0 5px rgba(231, 76, 60, 0);  }
}

.has-mention .channel-name {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
