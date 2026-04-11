<script setup lang="ts">
  // Bouton unifie. Wrapper sur les classes globales .btn-primary/.btn-ghost/
  // .btn-danger/.btn-icon (cf. design-system/cursus/MASTER.md §7).
  //
  // Ajoute par-dessus :
  //  - etat loading avec spinner et disable automatique
  //  - icone leading/trailing via slot
  //  - aria-label requis si icon-only
  //  - variante "icon" : 32px carre, sans label visible
  import { computed } from 'vue'
  import { Loader2 } from 'lucide-vue-next'

  type Variant = 'primary' | 'ghost' | 'danger' | 'icon'
  type Size = 'sm' | 'md' | 'lg'

  const props = withDefaults(defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    ariaLabel?: string
  }>(), {
    variant: 'primary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
  })

  defineEmits<{ (e: 'click', ev: MouseEvent): void }>()

  const klass = computed(() => {
    if (props.variant === 'icon') return 'btn-icon'
    return {
      primary: 'btn-primary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
      icon: 'btn-icon',
    }[props.variant]
  })

  const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <button
    :type="type"
    :class="[klass, `ui-btn--${size}`, { 'ui-btn--loading': loading }]"
    :disabled="isDisabled"
    :aria-label="ariaLabel"
    :aria-busy="loading || undefined"
    @click="(ev) => !isDisabled && $emit('click', ev)"
  >
    <Loader2 v-if="loading" :size="14" class="ui-btn__spinner" />
    <slot v-else name="leading" />
    <slot v-if="variant !== 'icon'" />
    <slot v-else />
    <slot name="trailing" />
  </button>
</template>

<style scoped>
/* Tailles (override des classes globales pour standardiser).
   sm = 28px, md = 36px (defaut), lg = 44px (touch target full mobile). */
.ui-btn--sm { font-size: 12px; padding: var(--space-xs) var(--space-md); min-height: 28px; }
.ui-btn--md { min-height: 36px; }
.ui-btn--lg { font-size: 14px; padding: var(--space-md) var(--space-xl); min-height: 44px; }

.ui-btn--loading { cursor: progress; pointer-events: none; }
.ui-btn__spinner {
  animation: ui-btn-spin 0.8s linear infinite;
}
@keyframes ui-btn-spin {
  to { transform: rotate(360deg); }
}
</style>
