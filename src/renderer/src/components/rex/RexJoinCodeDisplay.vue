/** RexJoinCodeDisplay — Affichage grand format du code de session REX, palette teal. */
<script setup lang="ts">
  import { ref } from 'vue'
  import { Copy, Check } from 'lucide-vue-next'

  const props = defineProps<{ code: string }>()

  const copied = ref(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(props.code)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch { /* clipboard not available */ }
  }
</script>

<template>
  <div class="rex-code-card">
    <span class="rex-code-label">Code de session REX</span>
    <div class="rex-code-value">
      <span v-for="(ch, i) in code.split('')" :key="i" class="rex-code-char" :style="{ animationDelay: `${i * 60}ms` }">
        {{ ch }}
      </span>
    </div>
    <button class="rex-code-copy" :class="{ copied }" @click="copyCode">
      <Check v-if="copied" :size="16" />
      <Copy v-else :size="16" />
      {{ copied ? 'Copie !' : 'Copier' }}
    </button>
  </div>
</template>

<style scoped>
.rex-code-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 40px;
  background: rgba(13, 148, 136, 0.08);
  border: 1px solid rgba(13, 148, 136, 0.25);
  border-radius: var(--radius, 12px);
}
.rex-code-label {
  font-size: 13px;
  font-weight: 600;
  color: #14b8a6;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.rex-code-value {
  display: flex;
  gap: 8px;
}
.rex-code-char {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 48px;
  font-weight: 800;
  color: #0d9488;
  background: rgba(13, 148, 136, 0.06);
  border: 1px solid rgba(13, 148, 136, 0.2);
  border-radius: 10px;
  width: 60px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: rex-char-pop 0.4s ease both;
}
@keyframes rex-char-pop {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.rex-code-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: rgba(13, 148, 136, 0.1);
  color: #14b8a6;
  border: 1px solid rgba(13, 148, 136, 0.25);
  cursor: pointer;
  transition: all 0.4s ease;
}
.rex-code-copy:hover {
  background: rgba(13, 148, 136, 0.18);
  color: #2dd4bf;
}
.rex-code-copy.copied {
  color: #2dd4bf;
  border-color: rgba(45, 212, 191, 0.4);
}
</style>
