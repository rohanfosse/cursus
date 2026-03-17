<script setup lang="ts">
  import { computed } from 'vue'
  import { Pin, PinOff } from 'lucide-vue-next'
  import { useAppStore }      from '@/stores/app'
  import { useMessagesStore } from '@/stores/messages'
  import Avatar from '@/components/ui/Avatar.vue'
  import ReactionPicker from './ReactionPicker.vue'
  import { avatarColor }          from '@/utils/format'
  import { formatTime }           from '@/utils/date'
  import { renderMessageContent } from '@/utils/html'
  import { useOpenExternal }      from '@/composables/useOpenExternal'
  import type { Message } from '@/types'

  interface Props {
    msg: Message
    grouped?: boolean
    searchTerm?: string
  }

  const props = withDefaults(defineProps<Props>(), { grouped: false, searchTerm: '' })

  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  const { openExternal } = useOpenExternal()

  const content = computed(() =>
    renderMessageContent(props.msg.content, props.searchTerm, appStore.currentUser?.name ?? ''),
  )
  const color   = computed(() => avatarColor(props.msg.author_name))
  const isPinned = computed(() => !!props.msg.is_pinned)

  function togglePin() {
    messagesStore.togglePin(props.msg.id, !isPinned.value)
  }

  const REACT_TYPES = [
    { type: 'check',    icon: 'check'       },
    { type: 'thumb',    icon: 'thumbs-up'   },
    { type: 'bulb',     icon: 'lightbulb'   },
    { type: 'question', icon: 'help-circle' },
    { type: 'eye',      icon: 'eye'         },
  ]

  function onMsgClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a[data-url]') as HTMLAnchorElement | null
    if (!a) return
    e.preventDefault()
    const url = a.dataset.url
    if (url) openExternal(url)
  }

  const reactionsToShow = computed(() => {
    const r    = messagesStore.reactions[props.msg.id] ?? {}
    const mine = messagesStore.userVotes[props.msg.id] ?? new Set()
    return REACT_TYPES.filter((t) => (r[t.type] ?? 0) > 0).map((t) => ({
      ...t,
      count: r[t.type],
      isMine: mine.has(t.type),
    }))
  })
</script>

<template>
  <div
    class="msg-row"
    :class="{ grouped, pinned: isPinned }"
    :data-msg-id="msg.id"
  >
    <!-- Avatar — masqué si message groupé -->
    <template v-if="!grouped">
      <Avatar
        :initials="msg.author_initials || msg.author_name.slice(0, 2).toUpperCase()"
        :color="color"
        :photo-data="msg.author_photo"
      />
    </template>
    <div v-else class="msg-avatar-placeholder" />

    <!-- Corps -->
    <div class="msg-body">
      <template v-if="!grouped">
        <span class="msg-author">{{ msg.author_name }}</span>
        <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
        <span v-if="isPinned" class="pin-badge" title="Message épinglé">📌</span>
      </template>

      <!-- eslint-disable vue/no-v-html -->
      <p class="msg-text" v-html="content" @click="onMsgClick" />
      <!-- eslint-enable vue/no-v-html -->

      <!-- Réactions affichées -->
      <div v-if="reactionsToShow.length" class="msg-reactions">
        <button
          v-for="r in reactionsToShow"
          :key="r.type"
          class="msg-reaction-pill"
          :class="{ mine: r.isMine }"
          :aria-label="`Réaction ${r.type}`"
          @click="messagesStore.toggleReaction(msg.id, r.type)"
        >
          <span>{{ r.count }}</span>
        </button>
      </div>
    </div>

    <!-- Actions au survol -->
    <div class="msg-actions">
      <ReactionPicker :msg-id="msg.id" />
      <button
        v-if="appStore.isTeacher"
        class="btn-icon msg-action-btn"
        :title="isPinned ? 'Désépingler' : 'Épingler'"
        :aria-label="isPinned ? 'Désépingler le message' : 'Épingler le message'"
        @click="togglePin"
      >
        <PinOff v-if="isPinned" :size="14" />
        <Pin v-else :size="14" />
      </button>
    </div>
  </div>
</template>
