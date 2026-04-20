<script setup lang="ts">
/**
 * AgendaTimeGrid : grille Jour/Semaine custom (remplace VueCal pour ces vues).
 * - 1 colonne (day) ou 7 colonnes (week)
 * - Plage horaire paramétrable (default 7h-22h, step 30min)
 * - Header sticky, all-day strip conditionnelle, now-line, drag & drop
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { CalendarEvent } from '@/types'

type GridEvent = {
  start: string
  end: string
  title: string
  allDay: boolean
  draggable: boolean
  class: string
  style: string
  _meta: CalendarEvent
}

const props = withDefaults(defineProps<{
  view: 'day' | 'week'
  selectedDate: string
  events: GridEvent[]
  isTeacher: boolean
  timeFrom?: number
  timeTo?: number
  timeStep?: number
  cellHeight?: number
}>(), {
  timeFrom: 7 * 60,
  timeTo: 22 * 60,
  timeStep: 30,
  cellHeight: 28,
})

const emit = defineEmits<{
  (e: 'cell-click', date: Date): void
  (e: 'cell-dblclick', date: Date): void
  (e: 'event-click', event: GridEvent): void
  (e: 'event-contextmenu', mouseEvent: MouseEvent, event: GridEvent): void
  (e: 'cell-contextmenu', mouseEvent: MouseEvent, date: Date): void
  (e: 'event-drop', event: GridEvent, newDate: Date): void
}>()

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const TODAY_ISO = () => new Date().toISOString().slice(0, 10)

function pad(n: number): string { return String(n).padStart(2, '0') }
function toIso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function parseIso(iso: string): Date { return new Date(`${iso}T00:00:00`) }

function parseEventStart(s: string): { iso: string; minutes: number } {
  const iso = s.slice(0, 10)
  const m = s.match(/(\d{2}):(\d{2})/)
  const minutes = m ? Number(m[1]) * 60 + Number(m[2]) : 0
  return { iso, minutes }
}

function parseEventEnd(e: string, fallback: { iso: string; minutes: number }): { iso: string; minutes: number } {
  const iso = e.slice(0, 10) || fallback.iso
  const m = e.match(/(\d{2}):(\d{2})/)
  const minutes = m ? Number(m[1]) * 60 + Number(m[2]) : fallback.minutes + 60
  return { iso, minutes }
}

// ── Jours visibles ────────────────────────────────────────────────────────
const days = computed(() => {
  const base = parseIso(props.selectedDate)
  if (props.view === 'day') return [base]
  const day = base.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
})

const dayInfos = computed(() => days.value.map(d => {
  const iso = toIso(d)
  const today = TODAY_ISO()
  return {
    date: d,
    iso,
    name: WEEKDAY_SHORT[(d.getDay() + 6) % 7],
    num: d.getDate(),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }),
    isToday: iso === today,
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
    isPast: iso < today,
  }
}))

// ── Slots horaires ────────────────────────────────────────────────────────
const hourLabels = computed(() => {
  const out: { minutes: number; label: string }[] = []
  for (let m = props.timeFrom; m < props.timeTo; m += 60) {
    out.push({ minutes: m, label: `${pad(Math.floor(m / 60))}:${pad(m % 60)}` })
  }
  return out
})

const slotsPerDay = computed(() => Math.floor((props.timeTo - props.timeFrom) / props.timeStep))
const bodyHeight = computed(() => slotsPerDay.value * props.cellHeight)

// ── Évènements répartis : all-day vs timed ───────────────────────────────
type PositionedEvent = {
  ev: GridEvent
  topPx: number
  heightPx: number
  timeLabel: string
  colStart: number
  colSpan: number
}

const allDayEvents = computed(() => {
  const isoSet = new Set(dayInfos.value.map(d => d.iso))
  const out: { ev: GridEvent; colStart: number; colSpan: number; rowIndex: number; hideTitle: boolean }[] = []
  const rows: string[][] = []
  const sorted = [...props.events].filter(e => e.allDay)
    .sort((a, b) => a.start.localeCompare(b.start))
  for (const ev of sorted) {
    const sIso = ev.start.slice(0, 10)
    const eIso = (ev.end || ev.start).slice(0, 10)
    // Trouve la plage visible
    const startIdx = dayInfos.value.findIndex(d => d.iso >= sIso)
    let endIdx = -1
    for (let i = dayInfos.value.length - 1; i >= 0; i--) {
      if (dayInfos.value[i].iso <= eIso) { endIdx = i; break }
    }
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) continue
    if (!isoSet.has(dayInfos.value[startIdx].iso) && !isoSet.has(dayInfos.value[endIdx].iso)) continue
    // Assign row (pack)
    let rowIndex = 0
    while (true) {
      const row = rows[rowIndex] ?? (rows[rowIndex] = [])
      const span = dayInfos.value.slice(startIdx, endIdx + 1).map(d => d.iso)
      if (span.every(iso => !row.includes(iso))) {
        row.push(...span)
        break
      }
      rowIndex++
    }
    // En vue Jour : toujours afficher le titre (sinon l'event multi-jours est muet).
    // En vue Semaine : masquer quand l'event a demarre avant la fenetre (continuation).
    const hideTitle = props.view !== 'day' && sIso < dayInfos.value[startIdx].iso
    out.push({ ev, colStart: startIdx + 1, colSpan: endIdx - startIdx + 1, rowIndex, hideTitle })
  }
  return out
})

const hasAllDay = computed(() => allDayEvents.value.length > 0)
const allDayRowCount = computed(() => {
  return allDayEvents.value.reduce((m, e) => Math.max(m, e.rowIndex + 1), 0) || 1
})

const timedEventsByDay = computed(() => {
  const map = new Map<string, PositionedEvent[]>()
  for (const info of dayInfos.value) map.set(info.iso, [])
  for (const ev of props.events) {
    if (ev.allDay) continue
    const s = parseEventStart(ev.start)
    const e = parseEventEnd(ev.end || ev.start, s)
    if (!map.has(s.iso)) continue
    const startClamped = Math.max(s.minutes, props.timeFrom)
    const endClamped = Math.min(e.minutes, props.timeTo)
    if (endClamped <= startClamped) continue
    const topPx = ((startClamped - props.timeFrom) / props.timeStep) * props.cellHeight
    const heightPx = Math.max(((endClamped - startClamped) / props.timeStep) * props.cellHeight, 20)
    const timeLabel = `${pad(Math.floor(s.minutes / 60))}:${pad(s.minutes % 60)}`
    map.get(s.iso)!.push({ ev, topPx, heightPx, timeLabel, colStart: 0, colSpan: 1 })
  }
  // Overlap resolution per jour (split in columns)
  for (const [, list] of map) {
    list.sort((a, b) => a.topPx - b.topPx)
    const cols: number[] = [] // end px par col
    for (const p of list) {
      let placed = -1
      for (let c = 0; c < cols.length; c++) {
        if (cols[c] <= p.topPx) { placed = c; cols[c] = p.topPx + p.heightPx; break }
      }
      if (placed === -1) { placed = cols.length; cols.push(p.topPx + p.heightPx) }
      p.colStart = placed
    }
    const totalCols = Math.max(cols.length, 1)
    for (const p of list) p.colSpan = totalCols
  }
  return map
})

// ── Now line ──────────────────────────────────────────────────────────────
const now = ref(new Date())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { nowTimer = setInterval(() => { now.value = new Date() }, 60_000) })
onBeforeUnmount(() => { if (nowTimer) clearInterval(nowTimer) })

const nowLineInfo = computed(() => {
  const iso = toIso(now.value)
  const colIndex = dayInfos.value.findIndex(d => d.iso === iso)
  if (colIndex === -1) return null
  const minutes = now.value.getHours() * 60 + now.value.getMinutes()
  if (minutes < props.timeFrom || minutes > props.timeTo) return null
  const topPx = ((minutes - props.timeFrom) / props.timeStep) * props.cellHeight
  return { colIndex, topPx }
})

// ── Auto-scroll vers 8h au mount/changement de vue ────────────────────────
const bodyRef = ref<HTMLElement | null>(null)
function scrollToMorning() {
  if (!bodyRef.value) return
  const target = ((8 * 60 - props.timeFrom) / props.timeStep) * props.cellHeight
  bodyRef.value.scrollTop = Math.max(0, target - 20)
}
onMounted(scrollToMorning)
watch(() => [props.view, props.selectedDate], scrollToMorning)

// ── Interactions : click cellule, dblclick, contextmenu ──────────────────
function slotDateFromEvent(e: MouseEvent, dayDate: Date): Date {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const y = e.clientY - rect.top
  const slotIndex = Math.max(0, Math.min(slotsPerDay.value - 1, Math.floor(y / props.cellHeight)))
  const minutes = props.timeFrom + slotIndex * props.timeStep
  const d = new Date(dayDate)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return d
}

function onColumnClick(e: MouseEvent, dayDate: Date) {
  emit('cell-click', slotDateFromEvent(e, dayDate))
}
function onColumnDblClick(e: MouseEvent, dayDate: Date) {
  emit('cell-dblclick', slotDateFromEvent(e, dayDate))
}
function onColumnContextMenu(e: MouseEvent, dayDate: Date) {
  if (!props.isTeacher) return
  const target = (e.target as HTMLElement)
  if (target.closest('.tg-event')) return
  e.preventDefault()
  emit('cell-contextmenu', e, slotDateFromEvent(e, dayDate))
}

function onEventClick(e: MouseEvent, ev: GridEvent) {
  e.stopPropagation()
  emit('event-click', ev)
}
function onEventCtx(e: MouseEvent, ev: GridEvent) {
  e.preventDefault()
  e.stopPropagation()
  emit('event-contextmenu', e, ev)
}

// ── Drag & drop ───────────────────────────────────────────────────────────
const draggingId = ref<string | null>(null)
const dragOverDay = ref<string | null>(null)

function onDragStart(e: DragEvent, ev: GridEvent) {
  if (!ev.draggable) { e.preventDefault(); return }
  draggingId.value = ev._meta.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ev._meta.id)
  }
}
function onDragEnd() { draggingId.value = null; dragOverDay.value = null }

function onColumnDragOver(e: DragEvent, iso: string) {
  if (!draggingId.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverDay.value = iso
}
function onColumnDrop(e: DragEvent, dayDate: Date) {
  if (!draggingId.value) return
  e.preventDefault()
  const id = draggingId.value
  const ev = props.events.find(x => x._meta.id === id)
  draggingId.value = null
  dragOverDay.value = null
  if (!ev) return
  const dropDate = slotDateFromEvent(e as unknown as MouseEvent, dayDate)
  emit('event-drop', ev, dropDate)
}

function allDayColor(ev: GridEvent): string {
  return ev._meta.color || 'var(--accent)'
}

function parseStyle(str: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!str) return out
  for (const part of str.split(';')) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k && v) {
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      out[camel] = v
    }
  }
  return out
}

// Offsets CSS dérivés (off-hours shading dynamique selon timeFrom/timeTo).
const offHoursAmHeight = computed(() => Math.max(0, ((8 * 60 - props.timeFrom) / props.timeStep) * props.cellHeight))
const offHoursPmTop = computed(() => Math.max(0, ((18 * 60 - props.timeFrom) / props.timeStep) * props.cellHeight))
</script>

<template>
  <div class="tg-root" :class="`tg-root--${view}`">
    <!-- ══ Header : jours ══ -->
    <div class="tg-header">
      <div class="tg-gutter" aria-hidden="true" />
      <div
        v-for="info in dayInfos"
        :key="info.iso"
        class="tg-day-head"
        :class="{
          'tg-day-head--today': info.isToday,
          'tg-day-head--weekend': info.isWeekend,
          'tg-day-head--past': info.isPast,
        }"
      >
        <span class="tg-day-name">{{ info.name }}</span>
        <span class="tg-day-num">{{ info.num }}</span>
      </div>
    </div>

    <!-- ══ All-day strip (uniquement si events) ══ -->
    <div v-if="hasAllDay" class="tg-allday" :style="{ '--ad-rows': allDayRowCount }">
      <div class="tg-gutter tg-gutter--allday">Journée</div>
      <div class="tg-allday-grid" :style="{ gridTemplateColumns: `repeat(${dayInfos.length}, 1fr)`, gridTemplateRows: `repeat(${allDayRowCount}, 22px)` }">
        <div
          v-for="ad in allDayEvents"
          :key="ad.ev._meta.id"
          class="tg-allday-ev"
          :style="{
            gridColumn: `${ad.colStart} / span ${ad.colSpan}`,
            gridRow: ad.rowIndex + 1,
            background: `color-mix(in srgb, ${allDayColor(ad.ev)} 18%, var(--bg-main))`,
            color: `color-mix(in srgb, ${allDayColor(ad.ev)} 88%, var(--text-primary))`,
            borderLeftColor: allDayColor(ad.ev),
          }"
          :title="ad.ev.title"
          :draggable="ad.ev.draggable"
          @click="onEventClick($event, ad.ev)"
          @contextmenu="onEventCtx($event, ad.ev)"
          @dragstart="onDragStart($event, ad.ev)"
          @dragend="onDragEnd"
        >
          <span v-if="!ad.hideTitle" class="tg-allday-title">{{ ad.ev.title }}</span>
        </div>
      </div>
    </div>

    <!-- ══ Body : grille horaire ══ -->
    <div ref="bodyRef" class="tg-body">
      <!-- Colonne des heures -->
      <div class="tg-time-col" :style="{ height: `${bodyHeight}px` }">
        <div
          v-for="(h, i) in hourLabels"
          :key="h.minutes"
          class="tg-time-label"
          :style="{ top: `${i * (props.cellHeight * 2)}px` }"
        >{{ h.label }}</div>
      </div>

      <!-- Grille jours -->
      <div
        class="tg-grid"
        :style="{
          gridTemplateColumns: `repeat(${dayInfos.length}, 1fr)`,
          height: `${bodyHeight}px`,
          '--tg-offhours-am-h': `${offHoursAmHeight}px`,
          '--tg-offhours-pm-top': `${offHoursPmTop}px`,
        }"
      >
        <div
          v-for="info in dayInfos"
          :key="info.iso"
          class="tg-col"
          :class="{
            'tg-col--today': info.isToday,
            'tg-col--weekend': info.isWeekend,
            'tg-col--drop': dragOverDay === info.iso,
          }"
          @click="onColumnClick($event, info.date)"
          @dblclick="onColumnDblClick($event, info.date)"
          @contextmenu="onColumnContextMenu($event, info.date)"
          @dragover="onColumnDragOver($event, info.iso)"
          @drop="onColumnDrop($event, info.date)"
        >
          <!-- Off-hours shading (avant 8h + apres 18h) -->
          <div class="tg-offhours tg-offhours--am" />
          <div class="tg-offhours tg-offhours--pm" />

          <!-- Quadrillage horaire -->
          <div
            v-for="(h, idx) in hourLabels"
            :key="`h-${h.minutes}`"
            class="tg-hline tg-hline--hour"
            :style="{ top: `${idx * (props.cellHeight * 2)}px` }"
          />
          <div
            v-for="(h, idx) in hourLabels"
            :key="`hh-${h.minutes}`"
            class="tg-hline tg-hline--half"
            :style="{ top: `${idx * (props.cellHeight * 2) + props.cellHeight}px` }"
          />

          <!-- Events timed -->
          <div
            v-for="p in timedEventsByDay.get(info.iso) || []"
            :key="p.ev._meta.id"
            class="tg-event"
            :class="p.ev.class"
            :style="{
              top: `${p.topPx}px`,
              height: `${p.heightPx}px`,
              left: `${(p.colStart / p.colSpan) * 100}%`,
              width: `calc(${100 / p.colSpan}% - 4px)`,
              ...parseStyle(p.ev.style),
            }"
            :draggable="p.ev.draggable"
            @click="onEventClick($event, p.ev)"
            @contextmenu="onEventCtx($event, p.ev)"
            @dragstart="onDragStart($event, p.ev)"
            @dragend="onDragEnd"
          >
            <span class="tg-event-time">{{ p.timeLabel }}</span>
            <span class="tg-event-title">{{ p.ev.title }}</span>
            <span v-if="p.ev._meta.organizer" class="tg-event-sub">{{ p.ev._meta.organizer }}</span>
            <span v-else-if="p.ev._meta.promoName" class="tg-event-sub">{{ p.ev._meta.promoName }}</span>
          </div>

          <!-- Now line si c'est aujourd'hui et dans la colonne -->
          <div
            v-if="nowLineInfo && dayInfos[nowLineInfo.colIndex].iso === info.iso"
            class="tg-now"
            :style="{ top: `${nowLineInfo.topPx}px` }"
          >
            <span class="tg-now-label">Maintenant</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tg-root {
  display: flex; flex-direction: column;
  height: 100%;
  background: var(--bg-main);
  overflow: hidden;
  --tg-gutter: 60px;
  --tg-border: color-mix(in srgb, var(--border) 80%, transparent);
  --tg-border-soft: color-mix(in srgb, var(--border) 40%, transparent);
}

/* ══ Header ══ */
.tg-header {
  display: grid;
  grid-template-columns: var(--tg-gutter) repeat(auto-fit, minmax(0, 1fr));
  flex: 0 0 auto;
  height: 64px;
  border-bottom: 1px solid var(--tg-border);
  background: var(--bg-elevated);
  position: sticky; top: 0; z-index: 4;
}
.tg-root--day .tg-header { grid-template-columns: var(--tg-gutter) 1fr; }
.tg-root--week .tg-header { grid-template-columns: var(--tg-gutter) repeat(7, 1fr); }

.tg-gutter {
  border-right: 1px solid var(--tg-border);
  display: flex; align-items: center; justify-content: flex-end;
  padding-right: 10px;
  font-size: 10px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
  box-sizing: border-box;
}
.tg-gutter--allday { align-items: center; }

.tg-day-head {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px; padding: 10px 6px;
  border-right: 1px solid var(--tg-border-soft);
  box-sizing: border-box;
}
.tg-day-head:last-child { border-right: none; }
.tg-day-name {
  font-family: var(--font-display);
  font-size: 10px; font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px;
}
.tg-day-num {
  font-family: var(--font-display);
  font-size: 22px; font-weight: 600;
  color: var(--text-primary);
  line-height: 1; font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.tg-day-head--weekend .tg-day-name,
.tg-day-head--weekend .tg-day-num { color: var(--text-muted); }
.tg-day-head--past .tg-day-num { opacity: 0.55; }
.tg-day-head--today .tg-day-name { color: var(--accent); }
.tg-day-head--today .tg-day-num {
  background: var(--accent); color: #fff;
  width: 32px; height: 32px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), 0.35);
}

/* ══ All-day strip ══ */
.tg-allday {
  display: grid;
  grid-template-columns: var(--tg-gutter) 1fr;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--tg-border);
  background: var(--bg-main);
  padding: 4px 0;
  max-height: 120px;
  overflow-y: auto;
  position: sticky; top: 64px; z-index: 3;
}
.tg-allday-grid {
  display: grid; gap: 2px 2px;
  padding: 0 2px;
}
.tg-allday-ev {
  display: flex; align-items: center;
  padding: 0 8px;
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  font-size: 11px; font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition: filter 0.14s;
}
.tg-allday-ev:hover { filter: brightness(1.08); }
.tg-allday-title {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ══ Body scrollable ══ */
.tg-body {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: var(--tg-gutter) 1fr;
  overflow-y: auto;
  position: relative;
}

/* Colonne heures */
.tg-time-col {
  position: relative;
  border-right: 1px solid var(--tg-border);
}
.tg-time-label {
  position: absolute; right: 8px;
  transform: translateY(-50%);
  font-size: 10.5px; font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

/* Grille colonnes jours */
.tg-grid {
  display: grid;
  position: relative;
}
.tg-col {
  position: relative;
  border-right: 1px solid var(--tg-border-soft);
  cursor: pointer;
}
.tg-col:last-child { border-right: none; }
.tg-col--today {
  background: rgba(var(--accent-rgb), 0.04);
}
.tg-col--weekend {
  background: color-mix(in srgb, var(--bg-elevated) 35%, transparent);
}
.tg-col--weekend.tg-col--today {
  background: rgba(var(--accent-rgb), 0.05);
}
.tg-col--drop {
  background: rgba(var(--accent-rgb), 0.12) !important;
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}

/* Off-hours shading */
.tg-offhours {
  position: absolute; left: 0; right: 0;
  background: color-mix(in srgb, var(--bg-elevated) 55%, transparent);
  pointer-events: none;
}
.tg-offhours--am { top: 0; height: var(--tg-offhours-am-h, 56px); }
.tg-offhours--pm { top: var(--tg-offhours-pm-top, 616px); bottom: 0; }

/* Quadrillage */
.tg-hline {
  position: absolute; left: 0; right: 0;
  pointer-events: none;
}
.tg-hline--hour { border-top: 1px solid var(--tg-border-soft); }
.tg-hline--half { border-top: 1px dashed var(--tg-border-soft); opacity: 0.5; }

/* ══ Events timed ══ */
.tg-event {
  position: absolute;
  box-sizing: border-box;
  margin-left: 2px;
  padding: 4px 8px;
  border-radius: 8px;
  border-left: 3px solid var(--accent);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
  overflow: hidden;
  display: flex; flex-direction: column; gap: 1px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;
  z-index: 1;
}
.tg-event:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  filter: brightness(1.05);
  z-index: 5;
}
.tg-event[draggable="true"] { cursor: grab; }
.tg-event[draggable="true"]:active { cursor: grabbing; }
.tg-event-time {
  font-size: 9.5px; font-weight: 700; opacity: 0.8;
  font-variant-numeric: tabular-nums;
}
.tg-event-title {
  font-size: 11px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tg-event-sub {
  font-size: 9.5px; font-weight: 500; opacity: 0.75; font-style: italic;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Status indicators (repris de l'ancien CSS VueCal) */
.tg-event.ag-event--submitted { opacity: 0.55; text-decoration: line-through; }
.tg-event.ag-event--submitted::after {
  content: ''; position: absolute; right: 5px; top: 5px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 0 2px var(--bg-main);
}
.tg-event.ag-event--late {
  animation: tg-pulse-late 2.4s infinite;
}
.tg-event.ag-event--late::after {
  content: ''; position: absolute; right: 5px; top: 5px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 0 2px var(--bg-main), 0 0 8px rgba(239,68,68,0.55);
}
@keyframes tg-pulse-late {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
  50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
}

/* ══ Now-line ══ */
.tg-now {
  position: absolute; left: -2px; right: 0;
  height: 0;
  border-top: 2px solid var(--color-danger);
  pointer-events: none;
  z-index: 10;
}
.tg-now::before {
  content: ''; position: absolute; left: -6px; top: -6px;
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 0 3px rgba(239,68,68,0.2);
}
.tg-now-label {
  position: absolute; left: 8px; top: -10px;
  font-size: 9.5px; font-weight: 700; color: var(--color-danger);
  background: var(--bg-main);
  padding: 1px 5px; border-radius: 3px;
  letter-spacing: 0.3px;
}
</style>
