<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Send, Type } from '@lucide/vue-next'
  import { useAppStore }      from '@/stores/app'
  import { useMessagesStore } from '@/stores/messages'
  import FormatToolbar from './FormatToolbar.vue'

  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()

  const inputEl       = ref<HTMLTextAreaElement | null>(null)
  const content       = ref('')
  const showToolbar   = ref(false)
  const sending       = ref(false)

  const placeholder = computed(() => {
    if (appStore.isReadonly) return 'Canal d\'annonces — lecture seule'
    if (appStore.activeChannelName) return `Envoyer dans #${appStore.activeChannelName}`
    return 'Votre message…'
  })

  function autoResize() {
    if (!inputEl.value) return
    inputEl.value.style.height = 'auto'
    inputEl.value.style.height = inputEl.value.scrollHeight + 'px'
  }

  async function send() {
    if (!content.value.trim() || sending.value || appStore.isReadonly) return
    sending.value = true
    try {
      await messagesStore.sendMessage(content.value)
      content.value = ''
      if (inputEl.value) inputEl.value.style.height = 'auto'
    } finally {
      sending.value = false
      inputEl.value?.focus()
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }
</script>

<template>
  <div id="message-input-area" class="message-input-area" :class="{ readonly: appStore.isReadonly }">
    <template v-if="!appStore.isReadonly">
      <!-- Barre de formatage -->
      <FormatToolbar v-if="showToolbar" :input-el="inputEl" />

      <div id="message-input-wrapper" class="message-input-wrapper">
        <button
          id="btn-toggle-format"
          class="btn-icon"
          :class="{ active: showToolbar }"
          title="Mise en forme"
          aria-label="Afficher la barre de mise en forme"
          style="flex-shrink:0"
          @click="showToolbar = !showToolbar"
        >
          <Type :size="16" />
        </button>

        <textarea
          id="message-input"
          ref="inputEl"
          v-model="content"
          class="message-input"
          :placeholder="placeholder"
          rows="1"
          @input="autoResize"
          @keydown="onKeydown"
        />

        <button
          id="btn-send"
          class="btn-primary"
          :disabled="!content.trim() || sending"
          aria-label="Envoyer le message"
          @click="send"
        >
          <Send :size="16" />
        </button>
      </div>
    </template>

    <p v-else class="readonly-notice">Ce canal est en lecture seule.</p>
  </div>
</template>
