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
        <Bold :size="14" />
      </button>
      <button class="mi-fmt-btn" title="Italique (Ctrl+I)" aria-label="Italique" @mousedown.prevent="emit('fmtWrap', '*', '*')">
        <Italic :size="14" />
      </button>
      <button class="mi-fmt-btn" title="Code inline" aria-label="Code inline" @mousedown.prevent="emit('fmtWrap', '`', '`')">
        <Code :size="14" />
      </button>
      <button class="mi-fmt-btn" title="Bloc de code" aria-label="Bloc de code" @mousedown.prevent="emit('fmtInsertBlock')">
        <SquareCode :size="14" />
      </button>
      <button class="mi-fmt-btn" title="Barre" aria-label="Barre" @mousedown.prevent="emit('fmtWrap', '~~', '~~')">
        <Strikethrough :size="14" />
      </button>
      <div class="mi-fmt-divider" />
      <button class="mi-fmt-btn" title="Citation" aria-label="Citation" @mousedown.prevent="emit('fmtLinePrefix', '> ')">
        <Quote :size="14" />
      </button>
      <button class="mi-fmt-btn" title="Liste a puces" aria-label="Liste a puces" @mousedown.prevent="emit('fmtLinePrefix', '- ')">
        <List :size="14" />
      </button>
      <button class="mi-fmt-btn" title="Liste numerotee" aria-label="Liste numerotee" @mousedown.prevent="emit('fmtLinePrefix', '1. ')">
        <ListOrdered :size="14" />
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
          <Smile :size="15" />
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
        <EyeOff v-if="showPreview" :size="15" />
        <Eye v-else :size="15" />
      </button>
      <button
        class="mi-icon-btn"
        :class="{ attaching }"
        title="Joindre un fichier"
        :disabled="attaching"
        @click="emit('attachFile')"
      >
        <Loader2 v-if="attaching" :size="15" class="mi-spinner" />
        <Paperclip v-else :size="15" />
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

<style scoped>
/* ── Barre d'actions ── */
.mi-actions-row {
  display: flex;
  align-items: center;
  padding: 3px 6px 3px 8px;
  border-top: 1px solid var(--border);
  margin-top: 2px;
  height: 32px;
  flex-wrap: nowrap;
}

/* Groupe formatage */
.mi-fmt-group {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.mi-fmt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 26px;
  padding: 0 3px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  transition: background .12s, color .12s;
}
.mi-fmt-btn:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.mi-fmt-mention {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -.3px;
}

.mi-fmt-divider {
  width: 1px;
  height: 14px;
  background: var(--border);
  margin: 0 2px;
  flex-shrink: 0;
  opacity: .4;
}

/* Emoji picker */
.mi-emoji-wrapper { position: relative; }
.mi-emoji-panel {
  position: absolute;
  bottom: 32px;
  right: 0;
  background: var(--bg-modal);
  border: 1px solid var(--border-input);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  z-index: 500;
  width: 210px;
}
.mi-emoji-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  transition: background .1s, transform .1s;
}
.mi-emoji-btn:hover {
  background: var(--bg-hover);
  transform: scale(1.15);
}

/* Actions droite */
.mi-actions-right {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
}

.mi-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
  transition: background .12s, color .12s;
}
.mi-icon-btn:hover:not(:disabled) {
  background: var(--bg-active);
  color: var(--text-primary);
}
.mi-icon-btn:disabled { opacity: .35; cursor: not-allowed; }
.mi-icon-btn.active { color: var(--accent); background: rgba(59,130,246,.12); }

/* Bouton Envoyer */
.mi-char-count {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  padding: 0 3px;
}
.mi-char-count.over { color: #f87171; font-weight: 600; }

.mi-send-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px 4px 8px;
  border: none;
  border-radius: 6px;
  background: var(--accent, #4a90d9);
  color: #fff;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s, background .15s, transform .12s;
  white-space: nowrap;
  line-height: 1;
}
.mi-send-btn:not(:disabled):hover {
  background: var(--accent-hover, #5a9fe6);
  transform: scale(1.02);
}
.mi-send-btn:not(:disabled):active {
  transform: scale(.97);
}
.mi-send-btn:disabled {
  opacity: .35;
  cursor: not-allowed;
  transform: none;
}

/* Spinner */
@keyframes mi-spin { to { transform: rotate(360deg); } }
.mi-spinner { animation: mi-spin .65s linear infinite; flex-shrink: 0; }
</style>
