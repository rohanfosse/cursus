<script setup lang="ts">
/**
 * MessageLightbox : visionneuse plein ecran pour une image de message.
 * Nulle si url == null. Emit 'close' sur clic fond / bouton X.
 */
import { Download, Flame, X } from 'lucide-vue-next'
import { authUrl } from '@/utils/auth'
import { useOpenExternal } from '@/composables/useOpenExternal'

interface Props { url: string | null }
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { openExternal } = useOpenExternal()

function onOpenExternal() {
  if (props.url) openExternal(props.url)
}
</script>

<template>
  <Transition name="lightbox-fade">
    <div v-if="url" class="lightbox-overlay" @click.self="emit('close')">
      <div class="lightbox-toolbar">
        <a :href="authUrl(url)" download class="lightbox-btn" title="Telecharger" aria-label="Telecharger l'image" @click.stop>
          <Download :size="18" />
        </a>
        <button class="lightbox-btn" title="Ouvrir dans le navigateur" aria-label="Ouvrir dans le navigateur" @click.stop="onOpenExternal">
          <Flame :size="18" />
        </button>
        <button class="lightbox-btn" title="Fermer" aria-label="Fermer la visionneuse" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>
      <img :src="authUrl(url)" class="lightbox-img" alt="Image agrandie" />
    </div>
  </Transition>
</template>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, .85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.lightbox-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: var(--radius);
  box-shadow: var(--elevation-4);
  cursor: default;
}
.lightbox-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: var(--space-sm);
  z-index: 1;
}
.lightbox-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  background: var(--bg-active);
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--motion-fast) var(--ease-out);
  text-decoration: none;
}
.lightbox-btn:hover { background: rgba(255, 255, 255, .25); }
.lightbox-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity var(--motion-fast) var(--ease-out);
}
.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lightbox-btn,
  .lightbox-fade-enter-active,
  .lightbox-fade-leave-active {
    transition: none !important;
  }
}
</style>
