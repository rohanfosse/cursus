import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/types'
import { useToast } from '@/composables/useToast'

const SESSION_KEY = 'cc_session'

export const useAppStore = defineStore('app', () => {
  const { showToast } = useToast()

  // ── État ──────────────────────────────────────────────────────────────────
  const isOnline          = ref<boolean>(navigator.onLine)
  const currentUser       = ref<User | null>(null)
  const teacherUser       = ref<User | null>(null)   // sauvegarde pendant simulation
  const activeChannelId   = ref<number | null>(null)
  const activeDmStudentId = ref<number | null>(null)
  const activePromoId     = ref<number | null>(null)
  const activeChannelType = ref<'chat' | 'annonce'>('chat')
  const activeChannelName = ref<string>('')
  const activeProject            = ref<string | null>(null)   // filtre projet Devoirs
  const pendingChannelCategory   = ref<string | null>(null)   // pré-remplissage CreateChannelModal
  const rightPanel        = ref<'travaux' | 'profil' | null>(null)
  const currentTravailId  = ref<number | null>(null)
  const pendingNoteDepotId = ref<number | null>(null)
  const rubricDepotId     = ref<number | null>(null)   // null = édition rubric, number = scoring dépôt
  const unread            = ref<Record<number, number>>({})
  const mentionChannels   = ref<Record<number, number>>({})

  // ── Calculs ───────────────────────────────────────────────────────────────
  const isStudent    = computed(() => currentUser.value?.type === 'student')
  const isTeacher    = computed(() => currentUser.value?.type === 'teacher')
  const isStaff      = computed(() => currentUser.value?.type === 'teacher' || currentUser.value?.type === 'ta')
  const isSimulating = computed(() => teacherUser.value !== null)
  const isReadonly   = computed(
    () => activeChannelType.value === 'annonce' && isStudent.value,
  )

  // ── Session ───────────────────────────────────────────────────────────────
  function restoreSession(): boolean {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) { currentUser.value = JSON.parse(raw); return true }
    } catch {}
    return false
  }

  function login(user: User): void {
    currentUser.value = user
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
  }

  function logout(): void {
    currentUser.value = null
    activeChannelId.value   = null
    activeDmStudentId.value = null
    try { localStorage.removeItem(SESSION_KEY) } catch {}
  }

  // Impersonnification (prof → étudiant) : pas de sauvegarde en session
  function impersonate(user: User): void {
    currentUser.value = user
  }

  // Simulation vue étudiant (prof voit l'app comme un étudiant donné)
  function startSimulation(student: User): void {
    teacherUser.value   = currentUser.value
    currentUser.value   = student
    activeChannelId.value   = null
    activeDmStudentId.value = null
    activeChannelName.value = ''
    activePromoId.value = student.promo_id
  }

  function stopSimulation(): void {
    if (!teacherUser.value) return
    currentUser.value   = teacherUser.value
    teacherUser.value   = null
    activeChannelId.value   = null
    activeDmStudentId.value = null
    activeChannelName.value = ''
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function openChannel(id: number, promoId: number, name: string, type: 'chat' | 'annonce' = 'chat') {
    activeChannelId.value   = id
    activeDmStudentId.value = null
    activePromoId.value     = promoId
    activeChannelType.value = type
    activeChannelName.value = name
    markRead(id)
  }

  function openDm(studentId: number, promoId: number, name: string) {
    activeDmStudentId.value = studentId
    activeChannelId.value   = null
    activePromoId.value     = promoId
    activeChannelType.value = 'chat'
    activeChannelName.value = name
  }

  // ── Non-lus ───────────────────────────────────────────────────────────────
  function markRead(channelId: number) {
    const next = { ...unread.value }
    delete next[channelId]
    unread.value = next
    // Effacer aussi les pings de mention pour ce canal
    const nextM = { ...mentionChannels.value }
    delete nextM[channelId]
    mentionChannels.value = nextM
  }

  // ── Statut réseau ─────────────────────────────────────────────────────────
  function initOnlineListener(): () => void {
    const onOnline  = () => { isOnline.value = true  }
    const onOffline = () => { isOnline.value = false }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }

  // Listener temps-réel — appelé une seule fois au démarrage (App.vue onMounted)
  function initUnreadListener(): () => void {
    return window.api.onNewMessage(({ channelId, authorName, mentionEveryone, mentionNames }) => {
      if (!channelId) return
      // Ne pas compter ses propres messages
      if (authorName && authorName === currentUser.value?.name) return

      // Badge unread standard — uniquement si on n'est pas dans ce canal
      if (channelId !== activeChannelId.value) {
        unread.value = { ...unread.value, [channelId]: (unread.value[channelId] ?? 0) + 1 }
      }

      // Badge mention @ — détecte si l'utilisateur courant est mentionné
      if (currentUser.value) {
        const myName = currentUser.value.name.toLowerCase()
        // Vérifie @everyone OU si l'un des noms mentionnés correspond (match partiel sur les mots du nom)
        const isMentioned =
          mentionEveryone ||
          mentionNames.some((n) => {
            const lowerN = n.toLowerCase()
            return myName.split(/\s+/).some((part) => part.startsWith(lowerN))
          })
        if (isMentioned) {
          mentionChannels.value = {
            ...mentionChannels.value,
            [channelId]: (mentionChannels.value[channelId] ?? 0) + 1,
          }
        }
      }
    })
  }

  // ── API helper ────────────────────────────────────────────────────────────
  async function api<T>(
    call: () => Promise<{ ok: boolean; data: T; error?: string }>,
    errorMsg?: string,
  ): Promise<T | null> {
    try {
      const res = await call()
      if (!res.ok) { showToast(res.error ?? errorMsg ?? 'Erreur serveur'); return null }
      return res.data
    } catch (e) {
      showToast(errorMsg ?? 'Erreur réseau')
      console.error(e)
      return null
    }
  }

  return {
    // état
    isOnline, currentUser, activeChannelId, activeDmStudentId, activePromoId,
    activeChannelType, activeChannelName, activeProject, pendingChannelCategory, rightPanel, currentTravailId,
    pendingNoteDepotId, rubricDepotId, unread, mentionChannels,
    // calculs
    isStudent, isTeacher, isStaff, isSimulating, isReadonly,
    // actions
    restoreSession, login, logout, impersonate,
    startSimulation, stopSimulation,
    openChannel, openDm, markRead, initUnreadListener, initOnlineListener,
    api,
  }
})
