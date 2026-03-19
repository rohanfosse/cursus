<script setup lang="ts">
import { ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { useConfirm } from '@/composables/useConfirm'
import { useFocusTrap } from '@/composables/useFocusTrap'

const { visible, options, resolve } = useConfirm()

const cfmBoxRef = ref<HTMLElement | null>(null)
useFocusTrap(cfmBoxRef, visible)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="visible"
        class="cfm-overlay"
        @click.self="resolve(false)"
      >
        <div ref="cfmBoxRef" class="cfm-box" role="alertdialog" aria-modal="true">
          <div class="cfm-icon" :class="options.variant ?? 'danger'">
            <AlertTriangle :size="20" />
          </div>
          <p class="cfm-message">{{ options.message }}</p>
          <div class="cfm-actions">
            <button class="btn-ghost cfm-cancel" @click="resolve(false)">
              {{ options.cancelLabel ?? 'Annuler' }}
            </button>
            <button
              class="btn-primary cfm-confirm"
              :class="options.variant ?? 'danger'"
              @click="resolve(true)"
            >
              {{ options.confirmLabel ?? 'Confirmer' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cfm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, .5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cfm-box {
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  max-width: 380px;
  width: 90%;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.cfm-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cfm-icon.danger  { background: rgba(231,76,60,.15);  color: #e74c3c; }
.cfm-icon.warning { background: rgba(241,196,15,.15); color: #f1c40f; }
.cfm-icon.info    { background: rgba(74,144,217,.15); color: var(--accent); }

.cfm-message {
  font-size: 14px;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

.cfm-actions {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
}

.cfm-cancel {
  flex: 1;
  justify-content: center;
}

.cfm-confirm {
  flex: 1;
  justify-content: center;
}
.cfm-confirm.danger  { background: #e74c3c; }
.cfm-confirm.danger:hover { background: #c0392b; }
.cfm-confirm.warning { background: #e67e22; }
.cfm-confirm.warning:hover { background: #d35400; }

.confirm-fade-enter-active, .confirm-fade-leave-active { transition: opacity .15s ease; }
.confirm-fade-enter-from, .confirm-fade-leave-to       { opacity: 0; }
.confirm-fade-enter-active .cfm-box,
.confirm-fade-leave-active .cfm-box { transition: transform .15s ease; }
.confirm-fade-enter-from .cfm-box,
.confirm-fade-leave-to .cfm-box     { transform: translateY(-8px) scale(.97); }
</style>
