/**
 * FileDropZone — zone de drop prete a l'emploi, stylee, accessible.
 *
 * Cas d'usage : tu veux une drop-zone rectangulaire classique (fichier unique
 * ou multiple, avec click fallback) sans reecrire le HTML/CSS/keyboard
 * handlers. Pour des layouts atypiques (avatar circulaire, overlay plein
 * ecran) : utilise directement `useSimpleFileDrop`.
 *
 * Exemple :
 *   <FileDropZone
 *     accept="image/*"
 *     :max-bytes="5 * 1024 * 1024"
 *     label="Glisser une image ou cliquer"
 *     hint="JPG, PNG... max 5 Mo"
 *     @drop="onDrop"
 *   />
 *
 * Slot optionnel pour remplacer l'icone par defaut :
 *   <FileDropZone @drop="onDrop">
 *     <template #icon><MyIcon :size="24" /></template>
 *   </FileDropZone>
 */
<script setup lang="ts">
import { computed } from 'vue'
import { Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-vue-next'
import { useSimpleFileDrop, type FileDropItem } from '@/composables/useSimpleFileDrop'

interface Props {
  /** MIME accept pattern ('image/*', 'application/pdf', etc.). */
  accept?: string
  /** Extensions sans le point ('csv', 'txt', etc.). */
  allowedExtensions?: string[]
  /** Taille max en octets. Defaut 50 Mo. */
  maxBytes?: number
  /** Accepte plusieurs fichiers. */
  multiple?: boolean
  /** Desactive la zone. */
  disabled?: boolean
  /** Label affiche en etat idle. */
  label?: string
  /** Texte d'aide plus petit sous le label. */
  hint?: string
  /** Label affiche pendant le drag-over. Defaut "Relacher pour deposer". */
  dragOverLabel?: string
  /** Label affiche pendant le processing (async). */
  processingLabel?: string
  /** Label affiche sur succes. */
  successLabel?: string
  /** Variante visuelle : 'default' (grande zone) ou 'compact' (ligne). */
  variant?: 'default' | 'compact'
  /** Demande un path Electron valide sur chaque item. Defaut false. */
  requireElectronPath?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Glisser un fichier ou cliquer pour choisir',
  hint: '',
  dragOverLabel: 'Relacher pour deposer',
  processingLabel: 'Traitement en cours...',
  successLabel: 'Depot recu',
  variant: 'default',
  multiple: false,
  disabled: false,
  requireElectronPath: false,
})

const emit = defineEmits<{
  drop: [items: FileDropItem[]]
  click: []
}>()

const drop = useSimpleFileDrop({
  accept: props.accept,
  allowedExtensions: props.allowedExtensions,
  maxBytes: props.maxBytes,
  multiple: props.multiple,
  disabled: computed(() => props.disabled),
  requireElectronPath: props.requireElectronPath,
  onDrop: (items) => emit('drop', items),
})

const currentLabel = computed(() => {
  switch (drop.status.value) {
    case 'drag-over':  return props.dragOverLabel
    case 'processing': return props.processingLabel
    case 'success':    return props.successLabel
    case 'error':      return 'Echec du depot'
    default:           return props.label
  }
})

function onClick() {
  if (props.disabled || drop.isProcessing.value) return
  emit('click')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  onClick()
}
</script>

<template>
  <div
    class="fdz"
    :class="[
      `fdz--${variant}`,
      `fdz--${drop.status.value}`,
      { 'fdz--disabled': disabled },
    ]"
    :data-state="drop.status.value"
    role="button"
    :aria-disabled="disabled || undefined"
    :aria-busy="drop.isProcessing.value || undefined"
    tabindex="0"
    v-bind="drop.bindings"
    @click="onClick"
    @keydown="onKeydown"
  >
    <div class="fdz-icon">
      <slot name="icon">
        <Loader2 v-if="drop.isProcessing.value" :size="20" class="fdz-spin" />
        <CheckCircle2 v-else-if="drop.isSuccess.value" :size="20" />
        <AlertCircle v-else-if="drop.isError.value" :size="20" />
        <Upload v-else :size="20" />
      </slot>
    </div>
    <span class="fdz-label">{{ currentLabel }}</span>
    <span v-if="hint && drop.status.value === 'idle'" class="fdz-hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.fdz {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 14px;
  border: 1.5px dashed var(--border-input);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: center;
  transition: border-color .15s, background-color .15s, box-shadow .15s, transform .15s;
  outline: none;
  user-select: none;
  font-family: inherit;
}
.fdz:hover:not(.fdz--disabled):not(.fdz--processing) {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--text-primary);
}
.fdz:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.fdz--compact {
  flex-direction: row;
  gap: 10px;
  padding: 10px 14px;
}

/* État drag-over : bordure pleine + halo + micro-scale */
.fdz--drag-over {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-subtle);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .18);
  color: var(--text-primary);
  transform: scale(1.01);
}

/* État processing : bordure pleine neutre, icone tourne */
.fdz--processing {
  cursor: wait;
  border-style: solid;
  border-color: var(--border);
  background: var(--bg-elevated);
}

/* État success : bordure verte + flash */
.fdz--success {
  border-style: solid;
  border-color: var(--color-success);
  background: rgba(var(--color-success-rgb, 34, 197, 94), .1);
  color: var(--color-success);
  animation: fdz-success-flash .45s ease;
}

/* État error : bordure rouge */
.fdz--error {
  border-style: solid;
  border-color: var(--color-danger);
  background: rgba(var(--color-danger-rgb, 239, 68, 68), .08);
  color: var(--color-danger);
  animation: fdz-error-shake .35s cubic-bezier(.36, .07, .19, .97);
}

.fdz--disabled {
  opacity: .5;
  cursor: not-allowed;
}

.fdz-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  opacity: .9;
}

.fdz-label {
  font-size: 13px;
  font-weight: 600;
  color: inherit;
}

.fdz-hint {
  font-size: 11px;
  color: var(--text-muted);
  opacity: .7;
}

/* Icone Loader2 spin */
.fdz-spin {
  animation: fdz-spin 1s linear infinite;
}

@keyframes fdz-spin {
  to { transform: rotate(360deg); }
}

@keyframes fdz-success-flash {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.02); }
  100% { transform: scale(1); }
}

@keyframes fdz-error-shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-4px); }
  40%      { transform: translateX(4px); }
  60%      { transform: translateX(-2px); }
  80%      { transform: translateX(2px); }
}

@media (prefers-reduced-motion: reduce) {
  .fdz,
  .fdz--drag-over,
  .fdz--success,
  .fdz--error,
  .fdz-spin { animation: none; transform: none; transition: none; }
}
</style>
