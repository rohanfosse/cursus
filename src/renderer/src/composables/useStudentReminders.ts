/**
 * useStudentReminders - rappels de deadline etudiants.
 * Stocke en localStorage, verifie au mount et programme les notifications.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

interface Reminder {
  devoirId: number
  devoirTitle: string
  deadline: string
  remindAt: number  // timestamp
  notified: boolean
}

const STORAGE_KEY = 'cc_student_reminders'

function loadReminders(): Reminder[] {
  return safeGetJSON<Reminder[]>(STORAGE_KEY, [])
}

function saveReminders(reminders: Reminder[]) {
  safeSetJSON(STORAGE_KEY, reminders)
}

export function useStudentReminders() {
  const reminders = ref<Reminder[]>(loadReminders())
  const { showToast } = useToast()

  let checkInterval: ReturnType<typeof setInterval> | null = null

  function addReminder(devoirId: number, devoirTitle: string, deadline: string, hoursBeforeDeadline = 24) {
    // Remove existing reminder for this devoir
    reminders.value = reminders.value.filter(r => r.devoirId !== devoirId)

    const deadlineTs = new Date(deadline).getTime()
    const remindAt = deadlineTs - hoursBeforeDeadline * 3600_000

    if (remindAt <= Date.now()) {
      showToast('La deadline est trop proche pour un rappel.', 'info')
      return false
    }

    reminders.value.push({
      devoirId,
      devoirTitle,
      deadline,
      remindAt,
      notified: false,
    })
    saveReminders(reminders.value)
    showToast(`Rappel programmé ${hoursBeforeDeadline}h avant la deadline.`, 'success')
    return true
  }

  function removeReminder(devoirId: number) {
    reminders.value = reminders.value.filter(r => r.devoirId !== devoirId)
    saveReminders(reminders.value)
  }

  function hasReminder(devoirId: number): boolean {
    return reminders.value.some(r => r.devoirId === devoirId && !r.notified)
  }

  function checkReminders() {
    const now = Date.now()
    let changed = false
    for (const r of reminders.value) {
      if (!r.notified && r.remindAt <= now) {
        r.notified = true
        changed = true
        showToast(`Rappel : "${r.devoirTitle}" a rendre bientôt !`, 'info')

        // Browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Cursus - Rappel', {
            body: `"${r.devoirTitle}" a rendre bientôt !`,
            icon: '/assets/icon-192.png',
          })
        }
      }
    }
    // Clean old (notified + past deadline)
    reminders.value = reminders.value.filter(r =>
      !r.notified || new Date(r.deadline).getTime() > now,
    )
    if (changed) saveReminders(reminders.value)
  }

  onMounted(() => {
    checkReminders()
    checkInterval = setInterval(checkReminders, 60_000) // check every minute
  })

  onUnmounted(() => {
    if (checkInterval) clearInterval(checkInterval)
  })

  return { reminders, addReminder, removeReminder, hasReminder }
}
