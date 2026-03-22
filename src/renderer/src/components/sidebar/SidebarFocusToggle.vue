/**
 * SidebarFocusToggle — Bottom bar with Target icon + "Mode Focus" + toggle switch.
 */
<script setup lang="ts">
import { Target } from 'lucide-vue-next'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <div class="sb-focus-toggle">
    <Target :size="13" class="sb-focus-icon" />
    <span class="sb-focus-label">Mode Focus</span>
    <label class="sb-toggle">
      <input
        type="checkbox"
        :checked="modelValue"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span class="sb-toggle-track" />
    </label>
  </div>
</template>

<style scoped>
.sb-focus-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.sb-focus-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.sb-focus-label {
  flex: 1;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Toggle switch */
.sb-toggle {
  position: relative;
  display: inline-block;
  width: 30px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}
.sb-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.sb-toggle-track {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sb-toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sb-toggle input:checked + .sb-toggle-track {
  background: var(--accent, #6366f1);
}
.sb-toggle input:checked + .sb-toggle-track::after {
  left: 16px;
  background: #fff;
}
</style>
