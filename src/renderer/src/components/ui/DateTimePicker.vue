/**
 * DateTimePicker — calendrier visuel + heure + presets rapides.
 * Remplace input[type=datetime-local] par une UX riche et accessible.
 * Popup via Teleport pour eviter le clipping par overflow:hidden des modales.
 */
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { isoForDatetimeLocal } from '@/utils/date'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  required?: boolean
  min?: string | null
  max?: string | null
  presets?: boolean
}>(), { presets: true })

const emit = defineEmits<{ 'update:modelValue': [val: string | null] }>()

// ── State ───────────────────────────────────────────────────────────────────
const open = ref(false)
const pickerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({})

const selectedDate = ref(new Date())
const hours = ref(23)
const minutes = ref(59)

const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())

// ── Sync from modelValue ────────────────────────────────────────────────────
watch(() => props.modelValue, (v) => {
  if (!v) return
  const d = new Date(v)
  if (isNaN(d.getTime())) return
  selectedDate.value = d
  hours.value = d.getHours()
  minutes.value = d.getMinutes()
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}, { immediate: true })

// ── Computed ────────────────────────────────────────────────────────────────
const displayText = computed(() => {
  if (!props.modelValue) return ''
  const d = new Date(props.modelValue)
  if (isNaN(d.getTime())) return ''
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${datePart} a ${timePart}`
})

const monthLabel = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

const calendarDays = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const lastDay = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  let startDay = first.getDay() - 1
  if (startDay < 0) startDay = 6

  const days: { day: number; current: boolean; date: Date }[] = []

  const prevLastDay = new Date(viewYear.value, viewMonth.value, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(viewYear.value, viewMonth.value - 1, prevLastDay - i)
    days.push({ day: prevLastDay - i, current: false, date: d })
  }

  for (let i = 1; i <= lastDay; i++) {
    const d = new Date(viewYear.value, viewMonth.value, i)
    days.push({ day: i, current: true, date: d })
  }

  // Fill to 42 = 6 rows for stable height
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(viewYear.value, viewMonth.value + 1, i)
    days.push({ day: i, current: false, date: d })
  }

  return days
})

const todayStr = new Date().toDateString()

function isToday(d: Date): boolean { return d.toDateString() === todayStr }
function isSelected(d: Date): boolean { return d.toDateString() === selectedDate.value.toDateString() }

function isDisabled(d: Date): boolean {
  if (props.min && d < new Date(props.min)) return true
  if (props.max && d > new Date(props.max)) return true
  return false
}

// ── Actions ─────────────────────────────────────────────────────────────────
function selectDay(d: Date) {
  if (isDisabled(d)) return
  selectedDate.value = d
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
  emitValue()
}

function emitValue() {
  const d = new Date(selectedDate.value)
  d.setHours(hours.value, minutes.value, 0, 0)
  emit('update:modelValue', isoForDatetimeLocal(d))
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}

function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

function adjustHours(delta: number) {
  hours.value = (hours.value + delta + 24) % 24
  emitValue()
}

function adjustMinutes(delta: number) {
  const snapped = Math.round(minutes.value / 5) * 5
  minutes.value = (snapped + delta + 60) % 60
  emitValue()
}

// ── Presets ──────────────────────────────────────────────────────────────────
function applyPreset(daysFromNow: number, h = 23, m = 59) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(h, m, 0, 0)
  selectedDate.value = d
  hours.value = h
  minutes.value = m
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
  emitValue()
  open.value = false
}

function applyEndOfMonth() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 0, 0)
  selectedDate.value = d
  hours.value = 23
  minutes.value = 59
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
  emitValue()
  open.value = false
}

function clear() {
  emit('update:modelValue', null)
  open.value = false
}

// ── Toggle & position ───────────────────────────────────────────────────────
function toggle() {
  if (open.value) { open.value = false; return }
  // Position popup relative to trigger via fixed positioning (avoids overflow clipping)
  const rect = triggerRef.value?.getBoundingClientRect()
  if (rect) {
    popupStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${rect.left}px`,
      zIndex: '9999',
    }
  }
  open.value = true
}

// ── Dynamic listeners (only when open) ──────────────────────────────────────
function onClickOutside(e: MouseEvent) {
  if (!pickerRef.value?.contains(e.target as Node) && !triggerRef.value?.contains(e.target as Node)) {
    open.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false
    triggerRef.value?.focus()
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onClickOutside)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="dtp">
    <label v-if="label" class="dtp-label">
      {{ label }}
      <span v-if="required" class="dtp-required">*</span>
    </label>

    <button
      ref="triggerRef"
      type="button"
      class="dtp-trigger"
      :class="{ 'dtp-trigger--open': open, 'dtp-trigger--empty': !modelValue }"
      @click="toggle"
    >
      <Calendar :size="15" class="dtp-trigger-icon" />
      <span class="dtp-trigger-text">{{ displayText || 'Choisir une date...' }}</span>
      <button v-if="modelValue && !required" type="button" class="dtp-clear" @click.stop="clear" aria-label="Effacer la date">
        <X :size="14" />
      </button>
    </button>

    <Teleport to="body">
      <Transition name="dtp-pop">
        <div v-if="open" ref="pickerRef" class="dtp-popup" :style="popupStyle" role="dialog" aria-label="Calendrier">
          <div class="dtp-month-nav">
            <button type="button" class="dtp-nav-btn" @click="prevMonth" aria-label="Mois precedent">
              <ChevronLeft :size="16" />
            </button>
            <span class="dtp-month-label">{{ monthLabel }}</span>
            <button type="button" class="dtp-nav-btn" @click="nextMonth" aria-label="Mois suivant">
              <ChevronRight :size="16" />
            </button>
          </div>

          <div class="dtp-grid dtp-day-headers">
            <span v-for="d in DAYS" :key="d" class="dtp-day-header">{{ d }}</span>
          </div>

          <div class="dtp-grid dtp-calendar">
            <button
              v-for="(cell, i) in calendarDays" :key="i"
              type="button"
              class="dtp-cell"
              :class="{
                'dtp-cell--other': !cell.current,
                'dtp-cell--today': isToday(cell.date),
                'dtp-cell--selected': isSelected(cell.date),
                'dtp-cell--disabled': isDisabled(cell.date),
              }"
              :disabled="isDisabled(cell.date)"
              @click="selectDay(cell.date)"
            >{{ cell.day }}</button>
          </div>

          <div class="dtp-time">
            <Clock :size="14" class="dtp-time-icon" />
            <div class="dtp-time-spinner">
              <button type="button" class="dtp-spin-btn" @click="adjustHours(1)" aria-label="+1 heure">&#9650;</button>
              <span class="dtp-time-value">{{ String(hours).padStart(2, '0') }}</span>
              <button type="button" class="dtp-spin-btn" @click="adjustHours(-1)" aria-label="-1 heure">&#9660;</button>
            </div>
            <span class="dtp-time-sep">:</span>
            <div class="dtp-time-spinner">
              <button type="button" class="dtp-spin-btn" @click="adjustMinutes(5)" aria-label="+5 minutes">&#9650;</button>
              <span class="dtp-time-value">{{ String(minutes).padStart(2, '0') }}</span>
              <button type="button" class="dtp-spin-btn" @click="adjustMinutes(-5)" aria-label="-5 minutes">&#9660;</button>
            </div>
          </div>

          <div v-if="presets" class="dtp-presets">
            <button type="button" class="dtp-preset" @click="applyPreset(7)">Dans 1 sem.</button>
            <button type="button" class="dtp-preset" @click="applyPreset(14)">Dans 2 sem.</button>
            <button type="button" class="dtp-preset" @click="applyEndOfMonth()">Fin du mois</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dtp { position: relative; display: flex; flex-direction: column; gap: 4px; }

.dtp-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); letter-spacing: .02em; }
.dtp-required { color: var(--color-danger, #ef4444); margin-left: 2px; }

.dtp-trigger {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: 8px;
  border: 1px solid var(--border-input, var(--border));
  background: var(--bg-input, var(--bg-elevated));
  color: var(--text-primary); font-size: 13px; font-family: var(--font);
  cursor: pointer; transition: border-color .15s, box-shadow .15s;
  width: 100%; text-align: left;
}
.dtp-trigger:hover { border-color: var(--text-muted); }
.dtp-trigger:focus-visible, .dtp-trigger--open {
  border-color: var(--accent); outline: none;
  box-shadow: 0 0 0 3px rgba(74,144,217,.12);
}
.dtp-trigger--empty .dtp-trigger-text { color: var(--text-muted); }
.dtp-trigger-icon { color: var(--accent); flex-shrink: 0; }
.dtp-trigger-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtp-clear {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; border: none;
  background: var(--bg-hover); color: var(--text-muted); cursor: pointer; transition: background .12s;
}
.dtp-clear:hover { background: var(--bg-active); color: var(--text-primary); }
</style>

<style>
/* Popup styles unscoped — rendered via Teleport outside component root */
.dtp-popup {
  width: 280px; padding: 12px;
  background: var(--bg-modal, var(--bg-elevated)); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.18);
  display: flex; flex-direction: column; gap: 8px;
}

.dtp-month-nav { display: flex; align-items: center; justify-content: space-between; padding: 0 2px; }
.dtp-month-label { font-size: 13px; font-weight: 700; color: var(--text-primary); text-transform: capitalize; }
.dtp-nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; transition: background .12s, color .12s;
}
.dtp-nav-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.dtp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.dtp-day-headers { margin-bottom: 2px; }
.dtp-day-header {
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-align: center; padding: 4px 0; text-transform: uppercase; letter-spacing: .04em;
}

.dtp-cell {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 8px;
  border: none; background: transparent; color: var(--text-primary);
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: background .12s, color .12s, transform .1s;
}
.dtp-cell:hover:not(:disabled) { background: var(--bg-hover); }
.dtp-cell:active:not(:disabled) { transform: scale(0.92); }
.dtp-cell--other { color: var(--text-muted); opacity: .4; }
.dtp-cell--today { background: rgba(74,144,217,.1); color: var(--accent); font-weight: 700; }
.dtp-cell--selected { background: var(--accent) !important; color: #fff !important; font-weight: 700; }
.dtp-cell--disabled { opacity: .25; cursor: not-allowed; }

.dtp-time {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 0 4px; border-top: 1px solid var(--border);
}
.dtp-time-icon { color: var(--text-muted); }
.dtp-time-spinner { display: flex; flex-direction: column; align-items: center; gap: 0; }
.dtp-spin-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 18px; border: none; background: transparent;
  color: var(--text-muted); font-size: 9px; cursor: pointer;
  border-radius: 4px; transition: background .12s;
}
.dtp-spin-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.dtp-time-value {
  font-size: 18px; font-weight: 700; color: var(--text-primary);
  font-variant-numeric: tabular-nums; min-width: 28px; text-align: center;
  font-family: 'JetBrains Mono', monospace;
}
.dtp-time-sep { font-size: 18px; font-weight: 700; color: var(--text-muted); }

.dtp-presets { display: flex; gap: 4px; padding-top: 4px; border-top: 1px solid var(--border); }
.dtp-preset {
  flex: 1; padding: 6px 4px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-secondary); font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: var(--font); transition: all .12s; white-space: nowrap;
}
.dtp-preset:hover { background: rgba(74,144,217,.08); border-color: var(--accent); color: var(--accent); }

.dtp-pop-enter-active { transition: opacity .15s ease, transform .15s ease; }
.dtp-pop-leave-active { transition: opacity .1s ease, transform .1s ease; }
.dtp-pop-enter-from { opacity: 0; transform: translateY(-4px) scale(.97); }
.dtp-pop-leave-to { opacity: 0; transform: translateY(-4px) scale(.97); }

@media (prefers-reduced-motion: reduce) {
  .dtp-pop-enter-active, .dtp-pop-leave-active { transition: none; }
  .dtp-cell { transition: none; }
}

@media (max-width: 600px) {
  .dtp-popup { width: calc(100vw - 48px); }
}
</style>
