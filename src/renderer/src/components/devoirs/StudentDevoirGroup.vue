/**
 * Groupe de devoirs étudiant : header avec icône + compteur, puis liste de StudentDevoirCard.
 */
<script setup lang="ts">
import type { Component } from 'vue'
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

function isExpired(deadline: string | null | undefined): boolean {
  return _isExpired(deadline, props.now)
}
</script>

<template>
  <template v-if="devoirs.length">
    <div class="group-header" :class="headerClass" :title="title">
      <component :is="icon" :size="12" /> {{ label }}
      <span class="group-count">{{ count }}</span>
      <span v-if="subtitle" class="group-subtitle">{{ subtitle }}</span>
    </div>
    <div class="devoirs-list">
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
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 4px;
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

.group-header--danger  { color: var(--color-danger); }
.group-header--warning { color: var(--color-warning); }
.group-header--accent  { color: var(--accent-light); }
.group-header--success { color: var(--color-success); }
.group-header--purple  { color: #9b87f5; }
</style>
