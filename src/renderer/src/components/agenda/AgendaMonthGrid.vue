<script setup lang="ts">
/**
 * AgendaMonthGrid : vue mois custom (remplace VueCal pour le mois).
 * 6 rangees x 7 colonnes, multi-day events en bandes, "+N" si cellule pleine.
 */
import { ref, computed } from 'vue'
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

const props = defineProps<{
  selectedDate: string
  events: GridEvent[]
  isTeacher: boolean
}>()

const emit = defineEmits<{
  (e: 'cell-click', date: Date): void
  (e: 'cell-dblclick', date: Date): void
  (e: 'event-click', event: GridEvent): void
  (e: 'event-contextmenu', mouseEvent: MouseEvent, event: GridEvent): void
  (e: 'cell-contextmenu', mouseEvent: MouseEvent, date: Date): void
  (e: 'event-drop', event: GridEvent, newDate: Date): void
}>()

const WEEKDAY_SHORT = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MAX_VISIBLE_PER_CELL = 3

function pad(n: number): string { return String(n).padStart(2, '0') }
function toIso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function parseIso(iso: string): Date { return new Date(`${iso}T00:00:00`) }

// ── Grille 42 cellules (6x7) ──────────────────────────────────────────────
const cells = computed(() => {
  const base = parseIso(props.selectedDate)
  const firstOfMonth = new Date(base.getFullYear(), base.getMonth(), 1)
  const day = firstOfMonth.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() + mondayOffset)

  const today = toIso(new Date())
  const out: Array<{
    date: Date
    iso: string
    num: number
    isToday: boolean
    isWeekend: boolean
    isCurrentMonth: boolean
    dayOfWeek: number
  }> = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    out.push({
      date: d,
      iso: toIso(d),
      num: d.getDate(),
      isToday: toIso(d) === today,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isCurrentMonth: d.getMonth() === base.getMonth(),
      dayOfWeek: (d.getDay() + 6) % 7, // Lun=0 .. Dim=6
    })
  }
  return out
})

// Decoupage en rangees (semaines) pour rendu des bandes all-day
const weekRows = computed(() => {
  const rows: (typeof cells.value)[] = []
  for (let i = 0; i < 6; i++) rows.push(cells.value.slice(i * 7, i * 7 + 7))
  return rows
})

// ── Repartition des events par rangee + packing ───────────────────────────
type PositionedBand = {
  ev: GridEvent
  colStart: number // 1..7
  colSpan: number
  rowIndex: number
  hideTitle: boolean
}

type DayEvents = {
  bands: PositionedBand[] // all-day events demarrant ce jour ou continuant
  timed: GridEvent[]       // events timed (single-day pill avec heure)
  overflowCount: number
}

const weekData = computed(() => {
  return weekRows.value.map(row => {
    const isoList = row.map(c => c.iso)
    const weekStart = isoList[0]
    const weekEnd = isoList[6]

    // 1. All-day events qui touchent cette semaine → bandes horizontales
    const bands: PositionedBand[] = []
    const packing: string[][] = [] // rows[rowIdx] = list of iso occupied

    const allDayInWeek = props.events
      .filter(e => {
        if (!e.allDay) return false
        const s = e.start.slice(0, 10)
        const ed = (e.end || e.start).slice(0, 10)
        return !(ed < weekStart || s > weekEnd)
      })
      .sort((a, b) => {
        // Multi-day en premier (ordre decroissant de longueur)
        const aLen = (a.end || a.start).localeCompare(a.start)
        const bLen = (b.end || b.start).localeCompare(b.start)
        if (aLen !== bLen) return bLen - aLen
        return a.start.localeCompare(b.start)
      })

    for (const ev of allDayInWeek) {
      const sIso = ev.start.slice(0, 10)
      const eIso = (ev.end || ev.start).slice(0, 10)
      const startIdx = Math.max(0, isoList.findIndex(iso => iso >= sIso))
      let endIdx = 6
      for (let i = 6; i >= 0; i--) {
        if (isoList[i] <= eIso) { endIdx = i; break }
      }
      if (startIdx > endIdx) continue
      // Packing
      let rowIdx = 0
      while (true) {
        const row = packing[rowIdx] ?? (packing[rowIdx] = [])
        const span = isoList.slice(startIdx, endIdx + 1)
        if (span.every(iso => !row.includes(iso))) {
          row.push(...span)
          break
        }
        rowIdx++
      }
      bands.push({
        ev,
        colStart: startIdx + 1,
        colSpan: endIdx - startIdx + 1,
        rowIndex: rowIdx,
        hideTitle: sIso < weekStart && startIdx === 0,
      })
    }

    // 2. Events timed par jour
    const timedByDay = new Map<string, GridEvent[]>()
    for (const iso of isoList) timedByDay.set(iso, [])
    for (const ev of props.events) {
      if (ev.allDay) continue
      const iso = ev.start.slice(0, 10)
      if (timedByDay.has(iso)) timedByDay.get(iso)!.push(ev)
    }
    for (const list of timedByDay.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start))
    }

    // 3. Calcul du nombre de bandes all-day actives par colonne + overflow
    const bandsCountByCol = Array(7).fill(0)
    for (const b of bands) {
      for (let c = b.colStart - 1; c < b.colStart - 1 + b.colSpan; c++) bandsCountByCol[c]++
    }

    const days: DayEvents[] = isoList.map((iso, idx) => {
      const timed = timedByDay.get(iso) ?? []
      const bandsHere = bandsCountByCol[idx]
      const slotsAvailable = Math.max(0, MAX_VISIBLE_PER_CELL - bandsHere)
      const visible = timed.slice(0, slotsAvailable)
      const overflow = timed.length - visible.length
      return { bands: [], timed: visible, overflowCount: overflow }
    })

    const bandRowCount = packing.length

    return { row, bands, days, bandRowCount }
  })
})

// ── Interactions ──────────────────────────────────────────────────────────
function onCellClick(e: MouseEvent, iso: string) {
  const target = e.target as HTMLElement
  if (target.closest('.mg-event, .mg-band, .mg-more')) return
  emit('cell-click', parseIso(iso))
}
function onCellDblClick(e: MouseEvent, iso: string) {
  const target = e.target as HTMLElement
  if (target.closest('.mg-event, .mg-band')) return
  emit('cell-dblclick', parseIso(iso))
}
function onCellContextMenu(e: MouseEvent, iso: string) {
  if (!props.isTeacher) return
  const target = e.target as HTMLElement
  if (target.closest('.mg-event, .mg-band')) return
  e.preventDefault()
  emit('cell-contextmenu', e, parseIso(iso))
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
function onMoreClick(e: MouseEvent, iso: string) {
  e.stopPropagation()
  emit('cell-click', parseIso(iso))
}

// ── Drag & drop ───────────────────────────────────────────────────────────
const draggingId = ref<string | null>(null)
const dragOverIso = ref<string | null>(null)

function onDragStart(e: DragEvent, ev: GridEvent) {
  if (!ev.draggable) { e.preventDefault(); return }
  draggingId.value = ev._meta.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ev._meta.id)
  }
}
function onDragEnd() { draggingId.value = null; dragOverIso.value = null }

function onCellDragOver(e: DragEvent, iso: string) {
  if (!draggingId.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIso.value = iso
}
function onCellDrop(e: DragEvent, iso: string) {
  if (!draggingId.value) return
  e.preventDefault()
  const id = draggingId.value
  const ev = props.events.find(x => x._meta.id === id)
  draggingId.value = null
  dragOverIso.value = null
  if (!ev) return
  emit('event-drop', ev, parseIso(iso))
}

// ── Styles helpers ────────────────────────────────────────────────────────
function eventColor(ev: GridEvent): string { return ev._meta.color || 'var(--accent)' }

function parseEventTime(s: string): string {
  const m = s.match(/(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : ''
}
</script>

<template>
  <div class="mg-root">
    <!-- Header : noms des jours -->
    <div class="mg-header">
      <div v-for="(name, idx) in WEEKDAY_SHORT" :key="name" class="mg-head" :class="{ 'mg-head--weekend': idx >= 5 }">
        {{ name }}
      </div>
    </div>

    <!-- Body : 6 semaines -->
    <div class="mg-body">
      <div
        v-for="(wk, wIdx) in weekData"
        :key="wIdx"
        class="mg-week"
        :style="{ '--mg-band-rows': wk.bandRowCount }"
      >
        <!-- Couche 1 : cellules (numero jour + background + hover) -->
        <div
          v-for="(c, dIdx) in wk.row"
          :key="`cell-${c.iso}`"
          class="mg-cell"
          :class="{
            'mg-cell--today': c.isToday,
            'mg-cell--weekend': c.isWeekend,
            'mg-cell--out': !c.isCurrentMonth,
            'mg-cell--drop': dragOverIso === c.iso,
          }"
          :style="{ gridColumn: dIdx + 1 }"
          @click="onCellClick($event, c.iso)"
          @dblclick="onCellDblClick($event, c.iso)"
          @contextmenu="onCellContextMenu($event, c.iso)"
          @dragover="onCellDragOver($event, c.iso)"
          @drop="onCellDrop($event, c.iso)"
        >
          <div class="mg-cell-head">
            <span class="mg-cell-num">{{ c.num }}</span>
          </div>
        </div>

        <!-- Couche 2 : bandes all-day (multi-day) -->
        <div
          v-for="band in wk.bands"
          :key="`band-${band.ev._meta.id}-${band.colStart}`"
          class="mg-band"
          :style="{
            gridColumn: `${band.colStart} / span ${band.colSpan}`,
            gridRow: band.rowIndex + 1,
            background: `color-mix(in srgb, ${eventColor(band.ev)} 18%, var(--bg-main))`,
            color: `color-mix(in srgb, ${eventColor(band.ev)} 88%, var(--text-primary))`,
            borderLeftColor: eventColor(band.ev),
          }"
          :title="band.ev.title"
          :draggable="band.ev.draggable"
          @click="onEventClick($event, band.ev)"
          @contextmenu="onEventCtx($event, band.ev)"
          @dragstart="onDragStart($event, band.ev)"
          @dragend="onDragEnd"
        >
          <span v-if="!band.hideTitle" class="mg-band-title">{{ band.ev.title }}</span>
        </div>

        <!-- Couche 3 : events timed par jour (pilules) + "+N more" -->
        <div
          v-for="(day, dIdx) in wk.days"
          :key="`timed-${wk.row[dIdx].iso}`"
          class="mg-timed"
          :style="{ gridColumn: dIdx + 1 }"
        >
          <div
            v-for="ev in day.timed"
            :key="ev._meta.id"
            class="mg-event"
            :class="ev.class"
            :style="{
              background: `color-mix(in srgb, ${eventColor(ev)} 18%, var(--bg-main))`,
              color: `color-mix(in srgb, ${eventColor(ev)} 88%, var(--text-primary))`,
              borderLeftColor: eventColor(ev),
            }"
            :title="`${parseEventTime(ev.start)} ${ev.title}`"
            :draggable="ev.draggable"
            @click="onEventClick($event, ev)"
            @contextmenu="onEventCtx($event, ev)"
            @dragstart="onDragStart($event, ev)"
            @dragend="onDragEnd"
          >
            <span class="mg-event-time">{{ parseEventTime(ev.start) }}</span>
            <span class="mg-event-title">{{ ev.title }}</span>
          </div>
          <button
            v-if="day.overflowCount > 0"
            type="button"
            class="mg-more"
            @click="onMoreClick($event, wk.row[dIdx].iso)"
          >+ {{ day.overflowCount }} de plus</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mg-root {
  display: flex; flex-direction: column;
  height: 100%;
  background: var(--bg-main);
  overflow: hidden;
  --mg-border: color-mix(in srgb, var(--border) 70%, transparent);
  --mg-border-soft: color-mix(in srgb, var(--border) 35%, transparent);
}

/* Header */
.mg-header {
  display: grid; grid-template-columns: repeat(7, 1fr);
  flex: 0 0 auto;
  height: 36px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--mg-border);
}
.mg-head {
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.6px;
  border-right: 1px solid var(--mg-border-soft);
}
.mg-head:last-child { border-right: none; }
.mg-head--weekend { color: var(--text-muted); }

/* Body */
.mg-body {
  flex: 1; min-height: 0;
  display: grid; grid-template-rows: repeat(6, 1fr);
}

/* Une semaine = grille empilee de 3 couches (cells, bands, timed) */
.mg-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows:
    28px                                       /* numero du jour */
    repeat(var(--mg-band-rows, 0), 20px)       /* bandes all-day */
    1fr                                        /* events timed + overflow */;
  position: relative;
  border-bottom: 1px solid var(--mg-border-soft);
  min-height: 0;
}
.mg-week:last-child { border-bottom: none; }

/* Cellule */
.mg-cell {
  grid-row: 1 / -1;
  border-right: 1px solid var(--mg-border-soft);
  cursor: pointer;
  position: relative;
  transition: background 0.14s;
  min-height: 0;
  overflow: hidden;
}
.mg-cell:last-child { border-right: none; }
.mg-cell:hover { background: var(--bg-hover); }
.mg-cell--today { background: rgba(var(--accent-rgb), 0.06); }
.mg-cell--today:hover { background: rgba(var(--accent-rgb), 0.10); }
.mg-cell--weekend:not(.mg-cell--today) {
  background: color-mix(in srgb, var(--bg-elevated) 30%, transparent);
}
.mg-cell--out { opacity: 0.45; }
.mg-cell--drop {
  background: rgba(var(--accent-rgb), 0.15) !important;
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}

/* Numero du jour (coin en haut a gauche) */
.mg-cell-head {
  grid-row: 1;
  padding: 5px 8px 0;
  display: flex; justify-content: flex-start;
}
.mg-cell-num {
  font-family: var(--font-display);
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.02em;
}
.mg-cell--today .mg-cell-num {
  background: var(--accent); color: #fff;
  width: 22px; height: 22px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  box-shadow: 0 1px 4px rgba(var(--accent-rgb), 0.35);
}
.mg-cell--out .mg-cell-num { color: var(--text-muted); }

/* Bandes all-day : pleine largeur au dessus des cellules */
.mg-band {
  height: 18px;
  margin: 1px 2px;
  padding: 0 8px;
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  font-size: 11px; font-weight: 600;
  display: flex; align-items: center;
  overflow: hidden;
  cursor: pointer;
  z-index: 2;
  transition: filter 0.14s, transform 0.12s;
  min-width: 0;
}
.mg-band:hover { filter: brightness(1.08); transform: translateY(-1px); }
.mg-band-title {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mg-band[draggable="true"] { cursor: grab; }
.mg-band[draggable="true"]:active { cursor: grabbing; }

/* Events timed par jour (pilules sous les bandes) */
.mg-timed {
  grid-row: calc(2 + var(--mg-band-rows, 0)) / -1;
  padding: 2px 4px 4px;
  display: flex; flex-direction: column; gap: 2px;
  min-height: 0;
  overflow: hidden;
  z-index: 2;
  pointer-events: none; /* laisse le click passer vers mg-cell ; events reactivent */
}
.mg-event, .mg-more { pointer-events: auto; }

.mg-event {
  display: flex; align-items: center; gap: 5px;
  padding: 2px 6px;
  border-radius: 4px;
  border-left: 3px solid var(--accent);
  font-size: 10.5px; font-weight: 600;
  line-height: 1.25;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  transition: filter 0.14s, transform 0.12s;
  min-width: 0;
}
.mg-event:hover { filter: brightness(1.08); transform: translateY(-1px); }
.mg-event[draggable="true"] { cursor: grab; }
.mg-event[draggable="true"]:active { cursor: grabbing; }
.mg-event-time {
  font-size: 9px; font-weight: 700; opacity: 0.75;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.mg-event-title {
  overflow: hidden; text-overflow: ellipsis;
}

.mg-more {
  background: transparent; border: none;
  padding: 2px 6px;
  text-align: left;
  font-size: 10px; font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 3px;
  font-family: inherit;
  transition: background 0.12s, color 0.12s;
}
.mg-more:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Status indicators (submitted/late) : dots en coin */
.mg-event.ag-event--submitted { opacity: 0.55; text-decoration: line-through; }
.mg-event.ag-event--late { animation: mg-pulse-late 2.4s infinite; }
@keyframes mg-pulse-late {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
  50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
}
</style>
