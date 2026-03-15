<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Pin, ChevronDown, ChevronUp } from '@lucide/vue-next'
  import { useMessagesStore } from '@/stores/messages'
  import { renderMessageContent } from '@/utils/html'

  const store    = useMessagesStore()
  const expanded = ref(false)

  const hasPinned = computed(() => store.pinned.length > 0)
</script>

<template>
  <div v-if="hasPinned" id="pinned-messages-banner" class="pinned-messages-banner">
    <div class="pinned-header" @click="expanded = !expanded">
      <Pin :size="14" />
      <span>{{ store.pinned.length }} message{{ store.pinned.length > 1 ? 's' : '' }} épinglé{{ store.pinned.length > 1 ? 's' : '' }}</span>
      <ChevronUp v-if="expanded" :size="14" style="margin-left:auto" />
      <ChevronDown v-else :size="14" style="margin-left:auto" />
    </div>
    <ul v-if="expanded" id="pinned-messages-list" class="pinned-list">
      <li v-for="m in store.pinned" :key="m.id" class="pinned-item">
        <strong class="pinned-author">{{ m.author_name }}</strong>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="pinned-text" v-html="renderMessageContent(m.content)" />
      </li>
    </ul>
  </div>
</template>
