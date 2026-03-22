/**
 * Groupe de devoirs étudiant : header avec icône + compteur, puis liste de StudentDevoirCard.
 */
<script setup lang="ts">
import { ref, onMounted, type Component } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import type { Devoir, Rubric } from '@/types'
import { isExpired as _isExpired } from '@/utils/devoir'
import StudentDevoirCard from './StudentDevoirCard.vue'

const props = defineProps<{
  devoirs: Devoir[]
  variant: 'overdue' | 'urgent' | 'pending' | 'event' | 'submitted'
  headerClass: string
  icon: Component
  label: string
  count: string | number
  subtitle?: string
  title?: string
  now: number
  // deposit state (forwarded)
  depositingDevoirId: number | null
  depositMode: 'file' | 'link'
  depositLink: string
  depositFile: string | null
  depositFileName: string | null
  depositing: boolean
  rubricPreview: Rubric | null
  startDeposit: (t: Devoir) => void
  cancelDeposit: () => void
  pickFile: () => void
  clearDepositFile: () => void
  submitDeposit: (t: Devoir) => void
}>()

defineEmits<{
  (e: 'update:depositMode', v: 'file' | 'link'): void
  (e: 'update:depositLink', v: string): void
}>()

const storageKey = `cc_devoir_group_${props.variant}`
const collapsed = ref(false)

onMounted(() => {
  const saved = localStorage.getItem(storageKey)
  if (saved === '1') collapsed.value = true
})

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem(storageKey, collapsed.value ? '1' : '0')
}

function isExpired(deadline: string | null | undefined): boolean {
  return _isExpired(deadline, props.now)
}
</script>

<template>
  <template v-if="devoirs.length">
    <button class="group-header" :class="[headerClass, { 'group-header--clickable': true }]" :title="title" :aria-expanded="!collapsed" :aria-label="`${label} — ${count} devoir${typeof count === 'number' && count > 1 ? 's' : ''}`" @click="toggleCollapse">
      <component :is="icon" :size="12" /> {{ label }}
      <span class="group-count">{{ count }}</span>
      <ChevronDown :size="12" class="group-chevron" :class="{ 'group-chevron--collapsed': collapsed }" />
      <span v-if="subtitle" class="group-subtitle">{{ subtitle }}</span>
    </button>
    <div v-show="!collapsed" class="devoirs-list">
      <StudentDevoirCard
        v-for="t in devoirs"
        :key="t.id"
        :devoir="t"
        :variant="variant"
        :expired="isExpired(t.deadline)"
        :depositing-devoir-id="depositingDevoirId"
        :deposit-mode="depositMode"
        :deposit-link="depositLink"
        :deposit-file="depositFile"
        :deposit-file-name="depositFileName"
        :depositing="depositing"
        :rubric-preview="rubricPreview"
        :start-deposit="startDeposit"
        :cancel-deposit="cancelDeposit"
        :pick-file="pickFile"
        :clear-deposit-file="clearDepositFile"
        :submit-deposit="submitDeposit"
        @update:deposit-mode="$emit('update:depositMode', $event)"
        @update:deposit-link="$emit('update:depositLink', $event)"
      />
    </div>
  </template>
</template>

<style scoped>
.devoirs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 780px;
  margin: 0 auto;
}

.group-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  font-family: var(--font);
  text-align: left;
}
.group-subtitle {
  width: 100%;
  font-size: 11.5px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-muted);
  margin-top: -2px;
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
}

.group-header--clickable { cursor: pointer; user-select: none; }
.group-chevron { transition: transform .2s ease; margin-left: auto; }
.group-chevron--collapsed { transform: rotate(-90deg); }
.group-header--danger  { color: var(--color-danger); }
.group-header--warning { color: var(--color-warning); }
.group-header--accent  { color: var(--accent-light); }
.group-header--success { color: var(--color-success); }
.group-header--purple  { color: var(--color-cctl); }
</style>
