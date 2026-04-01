<script setup lang="ts">
  // Barre de formatage + actions du MessageInput
  import { ref } from 'vue'
  import {
    Send, Paperclip, Loader2,
    Bold, Italic, Code, SquareCode, Strikethrough, Quote, List, ListOrdered,
    Smile, Eye, EyeOff,
  } from 'lucide-vue-next'

  const showEmojiPicker = ref(false)

  const EMOJIS = ['😊','😂','🤣','😍','🤔','😮','😢','👍','👏','🔥','❤️','✅','🎉','💯','🙏','👋','⭐','💡','🎯','⚡']

  defineProps<{
    content: string
    sending: boolean
    attaching: boolean
    showPreview: boolean
    showCharCount: boolean
    charCount: number
    charCountOver: boolean
    isOfflineOrDisconnected: boolean
    maxMessageLength: number
    showSignatureToggle: boolean
    requestSignature: boolean
  }>()

  const emit = defineEmits<{
    fmtWrap: [open: string, close: string]
    fmtLinePrefix: [prefix: string]
    fmtInsertBlock: []
    triggerMention: []
    triggerChannel: []
    triggerDevoir: []
    attachFile: []
    send: []
    'update:showPreview': [v: boolean]
    'update:requestSignature': [v: boolean]
    insertEmoji: [emoji: string]
  }>()
</script>

<template>
  <div class="mi-actions-row">
    <!-- Boutons de formatage -->
    <div class="mi-fmt-group" role="toolbar" aria-label="Mise en forme">
      <button class="mi-fmt-btn" title="Gras (Ctrl+B)" aria-label="Gras" @mousedown.prevent="emit('fmtWrap', '**', '**')">
        <Bold :size="13" />
      </button>
      <button class="mi-fmt-btn" title="Italique (Ctrl+I)" aria-label="Italique" @mousedown.prevent="emit('fmtWrap', '*', '*')">
        <Italic :size="13" />
      </button>
      <button class="mi-fmt-btn" title="Code inline" aria-label="Code inline" @mousedown.prevent="emit('fmtWrap', '`', '`')">
        <Code :size="13" />
      </button>
      <button class="mi-fmt-btn" title="Bloc de code" aria-label="Bloc de code" @mousedown.prevent="emit('fmtInsertBlock')">
        <SquareCode :size="13" />
      </button>
      <button class="mi-fmt-btn" title="Barre" aria-label="Barre" @mousedown.prevent="emit('fmtWrap', '~~', '~~')">
        <Strikethrough :size="13" />
      </button>
      <div class="mi-fmt-divider" />
      <button class="mi-fmt-btn" title="Citation" aria-label="Citation" @mousedown.prevent="emit('fmtLinePrefix', '> ')">
        <Quote :size="13" />
      </button>
      <button class="mi-fmt-btn" title="Liste a puces" aria-label="Liste a puces" @mousedown.prevent="emit('fmtLinePrefix', '- ')">
        <List :size="13" />
      </button>
      <button class="mi-fmt-btn" title="Liste numerotee" aria-label="Liste numerotee" @mousedown.prevent="emit('fmtLinePrefix', '1. ')">
        <ListOrdered :size="13" />
      </button>
      <div class="mi-fmt-divider" />
      <button class="mi-fmt-btn mi-fmt-mention" title="Mentionner" aria-label="Mentionner" @mousedown.prevent="emit('triggerMention')">@</button>
      <button class="mi-fmt-btn mi-fmt-mention" title="Canal" aria-label="Canal" @mousedown.prevent="emit('triggerChannel')">#</button>
      <button class="mi-fmt-btn mi-fmt-mention" title="Devoir" aria-label="Devoir" @mousedown.prevent="emit('triggerDevoir')">\</button>
    </div>

    <!-- Actions droite -->
    <div class="mi-actions-right">
      <div class="mi-emoji-wrapper">
        <button class="mi-icon-btn" title="Emoji" aria-label="Emoji" @click="showEmojiPicker = !showEmojiPicker">
          <Smile :size="14" />
        </button>
        <div v-if="showEmojiPicker" class="mi-emoji-panel">
          <button
            v-for="e in EMOJIS" :key="e" class="mi-emoji-btn"
            @mousedown.prevent="emit('insertEmoji', e); showEmojiPicker = false"
          >{{ e }}</button>
        </div>
      </div>
      <button
        class="mi-icon-btn"
        :class="{ active: showPreview }"
        :title="showPreview ? 'Modifier' : 'Apercu'"
        aria-label="Apercu"
        @click="emit('update:showPreview', !showPreview)"
      >
        <EyeOff v-if="showPreview" :size="14" />
        <Eye v-else :size="14" />
      </button>
      <button
        class="mi-icon-btn"
        :class="{ attaching }"
        title="Joindre un fichier"
        :disabled="attaching"
        @click="emit('attachFile')"
      >
        <Loader2 v-if="attaching" :size="14" class="mi-spinner" />
        <Paperclip v-else :size="14" />
      </button>
      <span v-if="showCharCount" class="mi-char-count" :class="{ over: charCountOver }">
        {{ charCount }}/{{ maxMessageLength }}
      </span>
      <button
        id="btn-send"
        class="mi-send-btn"
        :disabled="!content.trim() || sending || isOfflineOrDisconnected || charCountOver"
        :title="isOfflineOrDisconnected ? 'Hors ligne' : charCountOver ? 'Message trop long' : 'Envoyer'"
        aria-label="Envoyer"
        @click="emit('send')"
      >
        <Loader2 v-if="sending" :size="14" class="mi-spinner" />
        <Send v-else :size="14" />
        <span class="mi-send-label">Envoyer</span>
      </button>
    </div>
  </div>
</template>
