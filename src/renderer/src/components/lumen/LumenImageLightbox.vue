<script setup lang="ts">
/**
 * LumenImageLightbox : overlay plein ecran pour les images markdown.
 *
 * Teleporte sur body pour eviter les conflits de stacking context. Click
 * sur le fond ou sur la croix pour fermer. Compatible avec les themes
 * (l'overlay est noir + blur quel que soit le theme app).
 */
import { X } from 'lucide-vue-next'

interface Props {
  src: string | null
  alt?: string
}
interface Emits {
  (e: 'close'): void
}
defineProps<Props>()
defineEmits<Emits>()
</script>

<template>
  <Teleport to="body">
    <Transition name="lumen-lightbox-fade">
      <div
        v-if="src"
        class="lumen-lightbox"
        role="dialog"
        aria-modal="true"
        :aria-label="alt || 'Image agrandie'"
        @click="$emit('close')"
      >
        <img
          :src="src"
          :alt="alt"
          class="lumen-lightbox-img"
          @click.stop
        />
        <button
          type="button"
          class="lumen-lightbox-close"
          aria-label="Fermer l'image"
          @click="$emit('close')"
        >
          <X :size="20" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lumen-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  padding: 32px;
}
.lumen-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  cursor: default;
}
.lumen-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--motion-fast) var(--ease-out);
}
.lumen-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
.lumen-lightbox-close:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.lumen-lightbox-fade-enter-active,
.lumen-lightbox-fade-leave-active {
  transition: opacity var(--motion-base) var(--ease-out);
}
.lumen-lightbox-fade-enter-from,
.lumen-lightbox-fade-leave-to { opacity: 0; }
</style>
