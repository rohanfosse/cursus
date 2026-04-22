<script setup lang="ts">
/**
 * MessageReportDialog : modale de signalement d'un message. Propose 4
 * raisons preremplies + champ libre. Le bouton envoyer est desactive
 * tant que reportReason est vide.
 */
import { AlertTriangle } from 'lucide-vue-next'

interface Props {
  open: boolean
  messagePreview: string
  reason: string
}
defineProps<Props>()
defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'update:reason', v: string): void
  (e: 'submit'): void
}>()

const QUICK_REASONS = ['Harcelement', 'Spam', 'Contenu inapproprie', 'Hors-sujet']
</script>

<template>
  <Transition name="lightbox-fade">
    <div v-if="open" class="lightbox-overlay report-overlay" @click.self="$emit('update:open', false)">
      <div class="report-dialog">
        <h3 class="report-title"><AlertTriangle :size="16" /> Signaler ce message</h3>
        <p class="report-preview">"{{ messagePreview }}"</p>
        <p class="report-hint">Indiquez la raison du signalement :</p>
        <div class="report-quick-reasons">
          <button
            v-for="r in QUICK_REASONS" :key="r"
            class="report-reason-btn"
            :class="{ active: reason === r }"
            @click="$emit('update:reason', r)"
          >{{ r }}</button>
        </div>
        <textarea
          :value="reason"
          class="report-textarea"
          rows="2"
          placeholder="Ou decrivez la raison..."
          @input="$emit('update:reason', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="report-actions">
          <button class="btn-ghost" @click="$emit('update:open', false)">Annuler</button>
          <button class="btn-primary" :disabled="!reason.trim()" @click="$emit('submit')">Envoyer</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Partage l'overlay/transition du lightbox (fixed + blur backdrop). */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, .85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity var(--motion-fast) var(--ease-out);
}
.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}

.report-overlay { align-items: center; justify-content: center; }
.report-dialog {
  background: var(--bg-modal);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  max-width: 420px;
  width: 90%;
  box-shadow: var(--elevation-4);
}
.report-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-danger);
  margin-bottom: 10px;
}
.report-preview {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  padding: var(--space-sm);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-md);
  word-break: break-word;
}
.report-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
}
.report-quick-reasons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: var(--space-sm);
}
.report-reason-btn {
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color      var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
  font-family: inherit;
}
.report-reason-btn.active,
.report-reason-btn:hover {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
}
.report-reason-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.report-textarea {
  width: 100%;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  color: var(--text-primary);
  font-size: 12px;
  resize: vertical;
  margin-bottom: var(--space-md);
  font-family: inherit;
}
.report-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}
.report-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
.report-actions .btn-primary {
  background: var(--color-danger);
  color: white;
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: filter var(--motion-fast) var(--ease-out);
}
.report-actions .btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}
.report-actions .btn-primary:disabled {
  opacity: .4;
  cursor: not-allowed;
}
.report-actions .btn-ghost {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
}

@media (prefers-reduced-motion: reduce) {
  .report-reason-btn,
  .report-actions .btn-primary,
  .lightbox-fade-enter-active,
  .lightbox-fade-leave-active {
    transition: none !important;
  }
}
</style>
