<script setup lang="ts">
  import { computed, watch, nextTick, ref } from 'vue'
  import { useMessagesStore } from '@/stores/messages'
  import MessageBubble from './MessageBubble.vue'
  import { formatDateSeparator } from '@/utils/date'
  import type { Message } from '@/types'

  const store = useMessagesStore()
  const listEl = ref<HTMLElement | null>(null)

  // Initialiser les réactions à chaque changement de liste
  watch(
    () => store.messages,
    (msgs) => msgs.forEach((m) => store.initReactions(m.id, m.reactions)),
    { immediate: true },
  )

  // Auto-scroll vers le bas à chaque nouveau message
  watch(
    () => store.messages.length,
    () => nextTick(() => {
      if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
    }),
  )

  // Regrouper les messages par date + calculer grouped
  interface GroupedMessage { msg: Message; grouped: boolean }
  interface DateGroup { date: string; messages: GroupedMessage[] }

  const dateGroups = computed<DateGroup[]>(() => {
    const groups: DateGroup[] = []
    let lastDate = ''
    let lastMsg: Message | null = null

    for (const msg of store.messages) {
      const date = new Date(msg.created_at).toDateString()
      if (date !== lastDate) {
        lastDate = date
        lastMsg  = null
        groups.push({ date: formatDateSeparator(msg.created_at), messages: [] })
      }
      const grp = groups[groups.length - 1]
      grp.messages.push({ msg, grouped: store.isGrouped(msg, lastMsg) })
      lastMsg = msg
    }
    return groups
  })
</script>

<template>
  <div ref="listEl" id="messages-list" class="messages-list">
    <!-- Squelette de chargement -->
    <template v-if="store.loading">
      <div v-for="i in 5" :key="i" class="skel-msg-row">
        <div class="skel skel-avatar" />
        <div class="skel-msg-body">
          <div class="skel skel-line skel-w30" />
          <div class="skel skel-line skel-w90" />
          <div class="skel skel-line skel-w70" />
        </div>
      </div>
    </template>

    <!-- Messages -->
    <template v-else-if="store.messages.length">
      <template v-for="group in dateGroups" :key="group.date">
        <div class="date-separator"><span>{{ group.date }}</span></div>
        <MessageBubble
          v-for="{ msg, grouped } in group.messages"
          :key="msg.id"
          :msg="msg"
          :grouped="grouped"
          :search-term="store.searchTerm"
        />
      </template>
    </template>

    <!-- État vide -->
    <div v-else class="empty-state">
      <p>{{ store.searchTerm ? 'Aucun message ne correspond à cette recherche.' : "Aucun message pour l'instant." }}</p>
    </div>
  </div>
</template>
