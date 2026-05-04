<script setup lang="ts">
/**
 * TabBookingAvailability.vue — section "Disponibilites" de TabBooking.
 *
 * Grille hebdomadaire (Lundi -> Dimanche). Pour chaque jour, liste des
 * regles de creneaux deja sauvegardes + un input pour en ajouter une.
 * Le bouton "Enregistrer" envoie l'ensemble au backend.
 */
import { ref, computed } from 'vue'
import { Settings, Trash2, Plus, Check } from 'lucide-vue-next'
import { type BookingHandle } from '@/composables/useBooking'

const props = defineProps<{ booking: BookingHandle }>()

const totalRules = computed(() => props.booking.availability.value.length)

const DAY_NAMES: Record<number, string> = {
  1: 'Lundi', 2: 'Mardi', 3: 'Mercredi',
  4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 0: 'Dimanche',
}
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 0] as const

const newSlots = ref<Record<number, { start: string; end: string }>>({
  0: { start: '09:00', end: '10:00' },
  1: { start: '09:00', end: '10:00' },
  2: { start: '09:00', end: '10:00' },
  3: { start: '09:00', end: '10:00' },
  4: { start: '09:00', end: '10:00' },
  5: { start: '09:00', end: '10:00' },
  6: { start: '09:00', end: '10:00' },
})

function onAddSlot(day: number) {
  const s = newSlots.value[day]
  if (props.booking.addSlot(day, s.start, s.end)) {
    newSlots.value = { ...newSlots.value, [day]: { start: '09:00', end: '10:00' } }
  }
}
</script>

<template>
  <div class="col col-availability">
    <div class="col-header">
      <Settings :size="14" aria-hidden="true" />
      <span>Disponibilites</span>
      <span
        v-if="totalRules > 0"
        class="col-count"
        :title="`${totalRules} creneau(x) recurrent(s)`"
      >
        {{ totalRules }}
      </span>
    </div>

    <div class="week-grid">
      <div v-for="day in DAY_NUMBERS" :key="day" class="day-block">
        <div class="day-name">{{ DAY_NAMES[day] }}</div>
        <div class="day-rules">
          <div v-for="rule in (booking.rulesByDay.value[day] ?? [])" :key="rule.id" class="rule-row">
            <span class="rule-time">
              {{ booking.formatTime(rule.start_time) }} – {{ booking.formatTime(rule.end_time) }}
            </span>
            <button
              type="button"
              class="btn-icon btn-danger"
              :aria-label="`Supprimer le creneau ${booking.formatTime(rule.start_time)} - ${booking.formatTime(rule.end_time)}`"
              @click="booking.removeSlot(rule)"
            >
              <Trash2 :size="11" />
            </button>
          </div>
          <div v-if="(booking.rulesByDay.value[day] ?? []).length === 0" class="no-rules">
            Aucun creneau
          </div>
        </div>
        <div class="add-slot-row">
          <input
            v-model="newSlots[day].start"
            type="time"
            class="input-field time-input"
            :aria-label="`Heure de debut ${DAY_NAMES[day]}`"
          />
          <span class="slot-sep" aria-hidden="true">–</span>
          <input
            v-model="newSlots[day].end"
            type="time"
            class="input-field time-input"
            :aria-label="`Heure de fin ${DAY_NAMES[day]}`"
          />
          <button
            type="button"
            class="btn-icon btn-add"
            :aria-label="`Ajouter un creneau ${DAY_NAMES[day]}`"
            @click="onAddSlot(day)"
          >
            <Plus :size="12" />
          </button>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="btn-sm btn-primary save-avail-btn"
      :disabled="booking.savingAvailability.value"
      :aria-busy="booking.savingAvailability.value || undefined"
      @click="booking.saveAvailability"
    >
      <Check :size="12" />
      {{ booking.savingAvailability.value ? 'Sauvegarde...' : 'Enregistrer' }}
    </button>
  </div>
</template>

<style scoped>
.col {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}
.col-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border);
}
.col-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 7px;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

/* v2.273.7 — alignement sur landing .rdv-day :
   label LUN/MAR/etc. uppercase color-rex a gauche, slots en pills
   monospace, card en bg-elevated avec border. */
.week-grid { display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 2px; }
.day-block {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px var(--space-md);
  transition: border-color var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out);
}
.day-block:hover {
  border-color: color-mix(in srgb, var(--color-rex) 30%, transparent);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--color-rex) 10%, transparent);
}
.day-name {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--color-rex);
  margin-bottom: 6px;
}
.day-rules { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: var(--space-sm); }
.rule-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--color-rex) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-rex) 18%, transparent);
  border-radius: 999px;
  transition: background var(--motion-fast) var(--ease-out);
}
.rule-row:hover { background: color-mix(in srgb, var(--color-rex) 14%, transparent); }
.rule-time {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-rex);
}
.no-rules {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  padding: 4px 0;
}
.add-slot-row { display: flex; align-items: center; gap: 4px; }
.time-input { width: 80px; font-size: 11px; padding: 3px 6px; font-family: var(--font-mono); }
.slot-sep { font-size: 11px; color: var(--text-muted); }
.btn-add { color: var(--color-rex); }
.save-avail-btn { align-self: flex-end; }

.input-field {
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 12px;
  color: var(--text-primary);
  padding: 5px 8px;
  outline: none;
  transition: border-color var(--motion-fast) var(--ease-out);
}
.input-field:focus { border-color: var(--accent); }

.btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-out);
}
.btn-sm:hover:not(:disabled) { background: var(--bg-hover); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover:not(:disabled) { filter: brightness(1.06); }

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all var(--motion-fast) var(--ease-out);
}
.btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-icon.btn-danger { color: var(--color-danger); }
.btn-icon:focus-visible { outline: none; box-shadow: var(--focus-ring); }
</style>
