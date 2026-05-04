<!-- JoinCodeDisplay.vue - Code de session Live + URL partageable -->
<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Copy, Check, Share2 } from 'lucide-vue-next'
  import QrCode from './QrCode.vue'

  const props = defineProps<{ code: string }>()

  const codeCopied = ref(false)
  const urlCopied = ref(false)

  const shareUrl = computed(() => `cursus://live/join/${props.code}`)

  async function copyTarget(text: string, flag: 'code' | 'url') {
    try {
      await navigator.clipboard.writeText(text)
      if (flag === 'code') {
        codeCopied.value = true
        setTimeout(() => { codeCopied.value = false }, 1800)
      } else {
        urlCopied.value = true
        setTimeout(() => { urlCopied.value = false }, 1800)
      }
    } catch { /* clipboard not available */ }
  }
</script>

<template>
  <div class="join-code-card" role="region" aria-label="Code de connexion à la session">
    <span class="join-code-label">Code de session</span>
    <button
      class="join-code-value"
      :aria-label="`Copier le code ${code}`"
      @click="copyTarget(code, 'code')"
    >
      <span v-for="(ch, i) in code.split('')" :key="i" class="join-code-char" :style="{ animationDelay: `${i * 55}ms` }">
        {{ ch }}
      </span>
      <span class="join-code-copy-hint">
        <Check v-if="codeCopied" :size="14" />
        <Copy v-else :size="14" />
        {{ codeCopied ? 'Copié' : 'Copier' }}
      </span>
    </button>

    <QrCode :value="shareUrl" :size="120" class="join-code-qr" />

    <div class="join-code-share">
      <code class="join-code-url">{{ shareUrl }}</code>
      <button
        class="join-code-share-btn"
        :class="{ copied: urlCopied }"
        :aria-label="urlCopied ? 'URL copiée' : 'Copier l\'URL de partage'"
        @click="copyTarget(shareUrl, 'url')"
      >
        <Check v-if="urlCopied" :size="13" />
        <Share2 v-else :size="13" />
        {{ urlCopied ? 'Lien copié' : 'Partager' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.join-code-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 36px;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--color-live) 8%, transparent) 0%, transparent 60%),
    var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius, 14px);
  position: relative;
  overflow: hidden;
}
.join-code-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-live), transparent);
  opacity: .55;
}
.join-code-label {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  color: var(--color-live);
  text-transform: uppercase;
  letter-spacing: .08em;
}
.join-code-value {
  display: flex;
  gap: 8px;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
  position: relative;
}
.join-code-char {
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-size: 52px;
  font-weight: 800;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 64px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: char-pop .3s cubic-bezier(.34,1.56,.64,1) both;
  transition: transform .15s, border-color .15s;
}
.join-code-value:hover .join-code-char {
  border-color: color-mix(in srgb, var(--color-live) 40%, var(--border));
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-live) 14%, transparent);
}
.join-code-value:active .join-code-char {
  transform: scale(.97);
}
@keyframes char-pop {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.join-code-copy-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity .15s;
  white-space: nowrap;
}
.join-code-value:hover .join-code-copy-hint,
.join-code-copy-hint:has(~ *),
.join-code-value:focus-visible .join-code-copy-hint {
  opacity: 1;
}

.join-code-qr {
  margin-top: 4px;
  border: 4px solid #fff;
  border-radius: var(--radius);
  box-shadow: 0 2px 12px rgba(0,0,0,.08);
}
.join-code-share {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 6px 6px 6px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 999px;
  max-width: 100%;
}
.join-code-url {
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}
.join-code-share-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  background: var(--color-live);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background .15s, transform .1s;
  flex-shrink: 0;
}
.join-code-share-btn:hover { filter: brightness(1.08); }
.join-code-share-btn:active { transform: scale(.97); }
.join-code-share-btn.copied {
  background: var(--color-success);
}

@media (max-width: 500px) {
  .join-code-card { padding: 20px 16px; }
  .join-code-char {
    font-size: 36px;
    width: 48px;
    height: 58px;
  }
  .join-code-url { max-width: 140px; }
}
</style>
