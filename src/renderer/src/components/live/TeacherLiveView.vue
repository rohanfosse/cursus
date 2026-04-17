<!-- TeacherLiveView.vue - Vue enseignant pour le Live Quiz interactif -->
<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    Plus, Play, Square, ChevronRight, Trash2, Users, Zap, Clock,
    LogOut, Pencil, GripVertical, Copy, Download,
    ArrowRight, Eye, EyeOff, Bookmark, BookmarkPlus, Upload, Presentation,
    FileDown, HelpCircle, AlertTriangle,
  } from 'lucide-vue-next'
  import { ACTIVITY_CATEGORIES, activityIcon, activityTypeLabel, getActivityCategory, isSparkType, parseJsonArray } from '@/utils/liveActivity'
  import { useResponseTimer } from '@/composables/useResponseTimer'
  import { useLiveTemplates } from '@/composables/useLiveTemplates'
  import { useToast } from '@/composables/useToast'
  import { useConfirm } from '@/composables/useConfirm'
  import { parseLiveCsv, csvActivityToPayload } from '@/composables/useLiveCsv'
  import type { ActivityCategory } from '@/utils/liveActivity'
  import { useAppStore }  from '@/stores/app'
  import { useLiveStore } from '@/stores/live'
  import type { LiveActivity, LiveSession, LiveV2ActivityType } from '@/types'
  import JoinCodeDisplay from './JoinCodeDisplay.vue'
  import ActivityForm    from './ActivityForm.vue'
  import CountdownTimer  from './CountdownTimer.vue'
  import Leaderboard     from './Leaderboard.vue'
  import Podium          from './Podium.vue'
  import QuizHistoryView      from './QuizHistoryView.vue'
  import QuizStatsView        from './QuizStatsView.vue'
  import LiveCodeEditor       from './LiveCodeEditor.vue'
  import LiveBoard            from './LiveBoard.vue'
  import MessageWall          from './MessageWall.vue'
  import LiveTestPreview      from './LiveTestPreview.vue'
  import LiveShortcutsOverlay from './LiveShortcutsOverlay.vue'
  import LivePresentationMode from './LivePresentationMode.vue'
  import LiveActivityResults  from './LiveActivityResults.vue'

  const appStore  = useAppStore()
  const liveStore = useLiveStore()
  const route     = useRoute()
  const router    = useRouter()

  /** Elapsed time ticker — starts only when a non-Spark activity is live */
  const elapsedTick = ref(0)
  let elapsedInterval: ReturnType<typeof setInterval> | null = null

  function startElapsedTimer() {
    if (elapsedInterval) return
    elapsedInterval = setInterval(() => { elapsedTick.value++ }, 1000)
  }
  function stopElapsedTimer() {
    if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null }
    elapsedTick.value = 0
  }

  watch(() => liveStore.currentActivity, (act: LiveActivity | null) => {
    if (act && act.status === 'live' && !isSparkType(act.type)) startElapsedTimer()
    else stopElapsedTimer()
  }, { immediate: true })
  onUnmounted(stopElapsedTimer)

  /** Secondes ecoulees depuis le lancement de l'activite courante (null si aucune).
   *  Source unique pour la pill .activity-elapsed ET le mode projection.
   *  Normalise started_at : SQLite renvoie sans 'Z' (interprete UTC naif),
   *  Socket peut renvoyer deja avec 'Z'. On ajoute 'Z' seulement si absent. */
  const elapsedSeconds = computed<number | null>(() => {
    elapsedTick.value
    const started = liveStore.currentActivity?.started_at
    if (!started) return null
    const iso = started.endsWith('Z') ? started : started + 'Z'
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  })

  function formatMMSS(s: number): string {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const elapsedTime = computed(() =>
    elapsedSeconds.value === null ? '0:00' : formatMMSS(elapsedSeconds.value),
  )

  /** Filtre categorie dans la vue session (null = toutes) */
  const activeCategoryFilter = ref<ActivityCategory | null>(null)

  /** Activites filtrees par la categorie active */
  const filteredActivities = computed<LiveActivity[]>(() => {
    const acts = liveStore.sessionActivities
    if (!activeCategoryFilter.value) return acts
    return acts.filter(a => (a.category ?? getActivityCategory(a.type)) === activeCategoryFilter.value)
  })

  /** True si la session est majoritairement Spark (>= 80%) → propose mode Kahoot. */
  const isSparkSession = computed(() => {
    const acts = liveStore.sessionActivities
    if (!acts.length) return false
    const sparkCount = acts.filter(a => isSparkType(a.type)).length
    return sparkCount / acts.length >= 0.8
  })

  /** Nombre d'activites par categorie (source unique pour sidebar + pills header) */
  const categoryCountsMap = computed<Record<ActivityCategory, number>>(() => {
    const map: Record<ActivityCategory, number> = { spark: 0, pulse: 0, code: 0, board: 0 }
    for (const a of liveStore.sessionActivities) {
      const cat = (a.category ?? getActivityCategory(a.type)) as ActivityCategory
      map[cat] = (map[cat] ?? 0) + 1
    }
    return map
  })

  const sessionCategoryCounts = computed(() =>
    (Object.entries(categoryCountsMap.value) as [ActivityCategory, number][])
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count })),
  )

  /** Ouvre le formulaire d'ajout scope sur la categorie active */
  function addActivityInCategory(cat: ActivityCategory | null) {
    preSelectedCategory.value = cat
    showActivityForm.value = true
  }

  /** Mode apercu : affiche une preview "etudiant" a cote du prof */
  const previewMode = ref(false)
  function togglePreview() { previewMode.value = !previewMode.value }

  /** Pin/unpin reponse ouverte */
  async function onTogglePin(responseId: number, pinned: boolean) {
    try {
      await window.api.toggleLiveV2Pin(responseId, pinned)
      // Refresh results to reflect new pinned state
      if (liveStore.currentActivity) {
        await liveStore.fetchResults(liveStore.currentActivity.id)
      }
    } catch { /* ignore */ }
  }

  /** Self-paced : nombre d'activites pending */
  const pendingCount = computed(() =>
    liveStore.sessionActivities.filter(a => a.status === 'pending').length,
  )

  /** Self-paced : progression par activite (response counts) */
  const activityProgress = ref<{ id: number; title: string; type: string; responseCount: number }[]>([])
  let progressInterval: ReturnType<typeof setInterval> | null = null

  async function fetchProgress() {
    if (!liveStore.currentSession?.self_paced || !liveStore.currentSession?.id) return
    try {
      const res = await window.api.getLiveV2Progress(liveStore.currentSession.id)
      if (res?.ok && Array.isArray(res.data)) {
        activityProgress.value = res.data
      }
    } catch { /* ignore */ }
  }

  // Poll progress every 3s when self-paced and active
  watch(() => liveStore.currentSession?.self_paced && liveStore.currentSession?.status === 'active', (active) => {
    if (progressInterval) { clearInterval(progressInterval); progressInterval = null }
    if (active) {
      fetchProgress()
      progressInterval = setInterval(fetchProgress, 3000)
    } else {
      activityProgress.value = []
    }
  }, { immediate: true })

  onUnmounted(() => { if (progressInterval) clearInterval(progressInterval) })

  /** Lancer toutes les activites pending d'un coup */
  async function launchAllActivities() {
    if (!liveStore.currentSession) return
    try {
      const res = await window.api.launchAllLiveV2(liveStore.currentSession.id)
      if (res?.ok) {
        // Refresh session to update activity statuses
        await liveStore.fetchSession(liveStore.currentSession.id)
        showToast(`${res.data?.launched ?? 0} activite(s) lancee(s)`, 'success')
        fetchProgress()
      }
    } catch {
      showToast('Erreur lors du lancement', 'error')
    }
  }

  /** Toggle self-paced mode */
  async function toggleSelfPaced() {
    if (!liveStore.currentSession) return
    const newVal = !liveStore.currentSession.self_paced
    try {
      const res = await window.api.toggleLiveV2SelfPaced(liveStore.currentSession.id, newVal)
      if (res?.ok && liveStore.currentSession) {
        liveStore.currentSession = { ...liveStore.currentSession, self_paced: newVal ? 1 : 0 }
      }
    } catch { /* ignore */ }
  }

  /** Confusion signal counter (Wooclap "I'm confused") */
  const confusionCount = ref(0)
  let confusionUnsub: (() => void) | null = null

  watch(() => liveStore.currentSession?.id, async (sessionId) => {
    confusionCount.value = 0
    confusionUnsub?.()
    if (!sessionId) return
    try {
      const res = await window.api.getConfusionCount(sessionId)
      if (res?.ok) confusionCount.value = res.data?.count ?? 0
    } catch { /* ignore */ }
    confusionUnsub = window.api.onLiveConfusionUpdate((data) => {
      if (data.sessionId === sessionId) confusionCount.value = data.count
    })
  }, { immediate: true })

  /** Raccourcis clavier : overlay d'aide (?) */
  const shortcutsOpen = ref(false)

  /** Mode projection plein ecran pour l'activite en cours */
  const presentationOpen = ref(false)
  function openPresentation() {
    if (!liveStore.currentActivity) return
    presentationOpen.value = true
  }
  function closePresentation() { presentationOpen.value = false }

  /** Modeles de session (localStorage) */
  const { templates, save: saveTemplate, remove: removeTemplate } = useLiveTemplates()
  const { showToast, showUndoToast } = useToast()
  const { confirm } = useConfirm()

  async function onSaveAsTemplate() {
    if (!liveStore.currentSession || !liveStore.sessionActivities.length) return
    const name = window.prompt(
      'Nom du modele ?',
      liveStore.currentSession.title,
    )
    if (!name) return
    const saved = saveTemplate(name, liveStore.sessionActivities)
    if (saved) showToast(`Modele "${saved.name}" enregistre`, 'success')
    else showToast('Nom invalide', 'error')
  }

  async function onLoadTemplate(templateId: string) {
    const tpl = templates.value.find(t => t.id === templateId)
    if (!tpl || !promoId.value) return
    const ok = await liveStore.createSession(tpl.name, promoId.value)
    if (!ok || !liveStore.currentSession) {
      showToast('Impossible de creer la session', 'error')
      return
    }
    const sessionId = liveStore.currentSession.id
    let successCount = 0
    for (const act of tpl.activities) {
      const payload = {
        type: act.type,
        title: act.title,
        options: act.options ?? undefined,
        max_words: act.max_words,
        max_rating: act.max_rating,
        timer_seconds: act.timer_seconds ?? undefined,
        correct_answers: act.correct_answers ?? undefined,
        language: act.language ?? undefined,
      }
      const ok = await liveStore.pushActivity(sessionId, payload as Parameters<typeof liveStore.pushActivity>[1])
      if (ok) successCount++
    }
    showToast(`${successCount} activite${successCount > 1 ? 's' : ''} charge${successCount > 1 ? 'es' : 'e'} depuis "${tpl.name}"`, 'success')
  }

  async function onDeleteTemplate(templateId: string, name: string) {
    const ok = await confirm(`Supprimer le modele "${name}" ?`, 'danger', 'Supprimer')
    if (!ok) return
    removeTemplate(templateId)
    showToast('Modele supprime', 'info')
  }

  /** Import CSV (Kahoot-style ou universel) : cree les activites dans la session. */
  const csvInputRef = ref<HTMLInputElement | null>(null)
  const csvImporting = ref(false)
  const csvHelpOpen = ref(false)

  function openCsvPicker() { csvInputRef.value?.click() }

  /** Telecharge un CSV d'exemple universel pour montrer le format. */
  function downloadCsvTemplate() {
    const example = [
      'Type;Question;Options;Extra;Temps',
      'sondage;Quelle couleur preferez-vous ?;Bleu|Rouge|Vert|Jaune;;30',
      'qcm;Capitale de la France ?;Paris|Londres|Rome|Berlin;1;20',
      'vrai_faux;La Terre est ronde;;1;15',
      'nuage;Un mot pour decrire la session ?;;2;45',
      'echelle;Notez la session sur 5;;5;30',
      'question_ouverte;Qu\'avez-vous retenu ?;;;60',
      'humeur;Votre ressenti ?;;;30',
      'priorite;Classez ces themes par interet;Securite|Performance|UX|Innovation;;45',
      'matrice;Evaluez ces criteres sur 5;Clarte|Utilite|Originalite;5;60',
    ].join('\n')
    const blob = new Blob(['\uFEFF' + example], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cursus-live-modele.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function onCsvSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // reset pour pouvoir re-importer le meme fichier
    if (!file || !liveStore.currentSession) return
    if (file.size > 2 * 1024 * 1024) {
      showToast('Fichier trop volumineux (max 2 Mo)', 'error')
      return
    }
    csvImporting.value = true
    try {
      const text = await file.text()
      const { activities, errors, format } = parseLiveCsv(text)
      if (!activities.length) {
        showToast('Aucune question valide trouvee dans le CSV', 'error',
          errors.length ? `${errors.length} ligne(s) en erreur — voir la console.` : undefined)
        if (errors.length) console.warn('[CSV Live] erreurs :', errors)
        return
      }
      if (errors.length) {
        const proceed = await confirm(
          `${activities.length} question(s) a importer (format ${format}), ${errors.length} ligne(s) ignoree(s). Continuer ?`,
          'warning',
          'Importer',
        )
        if (!proceed) return
      }
      const sessionId = liveStore.currentSession.id
      let imported = 0
      for (const a of activities) {
        const payload = csvActivityToPayload(a)
        const ok = await liveStore.pushActivity(sessionId, payload as Parameters<typeof liveStore.pushActivity>[1])
        if (ok) imported++
      }
      showToast(
        `${imported} question${imported > 1 ? 's' : ''} importee${imported > 1 ? 's' : ''} (${format})`,
        'success',
      )
    } catch (err) {
      console.error('[CSV Live] import error', err)
      showToast('Erreur lors de la lecture du CSV', 'error')
    } finally {
      csvImporting.value = false
    }
  }

  /** Temps moyen de reponse pour l'activite en cours */
  const currentResponseCount = computed(() => {
    const r = liveStore.results
    if (!r) return 0
    return r.totalResponses ?? r.total ?? 0
  })
  const currentActivityStartedAt = computed(() => liveStore.currentActivity?.started_at ?? null)
  const responseTimer = useResponseTimer(currentActivityStartedAt, currentResponseCount)
  const responseTimerLabel = computed(() => {
    const med = responseTimer.medianSeconds.value
    if (med === null) return null
    if (med < 60) return `~${Math.round(med)}s`
    const m = Math.floor(med / 60)
    const s = Math.round(med - m * 60)
    return `~${m}m${s.toString().padStart(2, '0')}`
  })

  /** Normalise les counts Pulse en array { text, count } (pour RexSondageResults). */
  const pulseSondageCounts = computed<{ text: string; count: number }[]>(() => {
    const c = liveStore.results?.counts
    if (!c) return []
    if (Array.isArray(c)) return c as { text: string; count: number }[]
    return Object.entries(c).map(([text, count]) => ({ text, count: Number(count) }))
  })

  const activeTab       = ref<'home' | 'history' | 'stats'>('home')

  // Sync tab from route query (sidebar navigation)
  watch(() => route.query.tab, (t) => {
    if (t === 'history' || t === 'stats') activeTab.value = t
    else activeTab.value = 'home'
  }, { immediate: true })

  const newTitle        = ref('')
  const showActivityForm = ref(false)
  const showLeaderboard  = ref(false)
  const showPodium       = ref(false)

  /** Mode Spark auto-chain (Kahoot-like) : apres fermeture, leaderboard + lancement auto de la suivante. */
  const sparkAutoChain = ref(false)
  const autoChainDelaySeconds = ref(5)
  const autoChainCountdown = ref<number | null>(null)
  let autoChainTimer: ReturnType<typeof setInterval> | null = null
  let autoPodiumTimeout: ReturnType<typeof setTimeout> | null = null

  function clearAutoChainTimer() {
    if (autoChainTimer) { clearInterval(autoChainTimer); autoChainTimer = null }
    if (autoPodiumTimeout) { clearTimeout(autoPodiumTimeout); autoPodiumTimeout = null }
    autoChainCountdown.value = null
  }

  function startAutoChainCountdown() {
    clearAutoChainTimer()
    if (!sparkAutoChain.value || !nextPendingActivity.value) return
    autoChainCountdown.value = autoChainDelaySeconds.value
    autoChainTimer = setInterval(() => {
      if (autoChainCountdown.value === null) return
      autoChainCountdown.value -= 1
      if (autoChainCountdown.value <= 0) {
        clearAutoChainTimer()
        launchNext()
      }
    }, 1000)
  }

  function cancelAutoChain() { clearAutoChainTimer() }
  const codeEditorRef    = ref<{ getContent: () => string } | null>(null)
  const editingActivity  = ref<LiveActivity | null>(null)
  const promoId          = computed(() => appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0)

  // Drag & drop state
  const dragSrcId = ref<number | null>(null)

  onMounted(async () => {
    liveStore.initSocketListeners()
    if (promoId.value) await liveStore.fetchDraftSessions(promoId.value)
    window.addEventListener('keydown', onKeydown)
  })
  onUnmounted(() => {
    liveStore.disposeSocketListeners()
    window.removeEventListener('keydown', onKeydown)
    clearAutoChainTimer()
  })

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    // Skip if typing in an input
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    // ? : afficher/fermer overlay raccourcis (prioritaire)
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault()
      shortcutsOpen.value = !shortcutsOpen.value
      return
    }

    // Escape ferme l'overlay shortcuts en priorite
    if (e.code === 'Escape' && shortcutsOpen.value) {
      shortcutsOpen.value = false
      return
    }

    // Space or Enter: close current activity / launch next / dismiss leaderboard
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      if (liveStore.currentActivity && liveStore.currentActivity.status === 'live') {
        closeCurrentActivity()
      } else if (showLeaderboard.value) {
        if (nextPendingActivity.value) {
          launchNext()
        } else {
          dismissLeaderboard()
        }
      } else if (showPodium.value) {
        showPodium.value = false
      }
    }

    // Escape: cancel activity form, dismiss leaderboard
    if (e.code === 'Escape') {
      if (showActivityForm.value) cancelActivityForm()
      else if (showLeaderboard.value) dismissLeaderboard()
      else if (showPodium.value) showPodium.value = false
      else if (selectedCategory.value) selectedCategory.value = null
      else if (previewMode.value) previewMode.value = false
    }

    // T : toggle mode apercu (dans une session)
    if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && liveStore.currentSession) {
      e.preventDefault()
      togglePreview()
    }

    // N : ajouter une activite (dans une session waiting)
    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey
        && liveStore.currentSession && !liveStore.currentActivity && !showActivityForm.value) {
      e.preventDefault()
      addActivityInCategory(activeCategoryFilter.value)
    }

    // P : mode projection (plein ecran) pendant qu'une activite est en direct
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey
        && liveStore.currentActivity) {
      e.preventDefault()
      if (presentationOpen.value) closePresentation()
      else openPresentation()
    }

    // Fleche droite : activite suivante (ferme + lance la suivante pending)
    if (e.code === 'ArrowRight' && liveStore.currentSession
        && (liveStore.currentActivity || showLeaderboard.value)
        && nextPendingActivity.value) {
      e.preventDefault()
      goNext()
    }
  }

  // ── Create / select session ──────────────────────────────────────────────
  async function createSession() {
    if (!newTitle.value.trim() || !promoId.value) return
    await liveStore.createSession(newTitle.value.trim(), promoId.value)
    newTitle.value = ''
  }

  async function selectSession(session: LiveSession) {
    await liveStore.fetchSession(session.id)
    window.api.emitLiveJoin(session.promo_id)
  }

  /** Ouvre la sous-page categorie */
  const selectedCategory = ref<ActivityCategory | null>(null)
  const preSelectedCategory = ref<ActivityCategory | null>(null)

  function openCategory(category: ActivityCategory) {
    selectedCategory.value = category
  }

  function backToHome() {
    selectedCategory.value = null
  }

  /** Cree la session et ouvre le formulaire d'activite avec la bonne categorie */
  async function startFromCategory() {
    if (!selectedCategory.value || !promoId.value) return
    const cat = ACTIVITY_CATEGORIES[selectedCategory.value]
    const title = newTitle.value.trim() || `Session ${cat.label}`
    await liveStore.createSession(title, promoId.value)
    newTitle.value = ''
    showActivityForm.value = true
    preSelectedCategory.value = selectedCategory.value
    selectedCategory.value = null
  }

  async function onCloneSession(session: LiveSession) {
    if (!promoId.value) return
    await liveStore.cloneSession(session.id, promoId.value)
  }

  async function onDeleteDraftSession(session: LiveSession) {
    const ok = await confirm(
      `Supprimer le brouillon "${session.title}" ? Cette action est irreversible.`,
      'danger',
      'Supprimer',
    )
    if (!ok) return
    await liveStore.deleteSession(session.id)
    showToast('Brouillon supprime', 'info')
  }

  // ── Activity management ──────────────────────────────────────────────────
  async function onAddActivity(payload: {
    type: LiveV2ActivityType
    title: string; options?: string[] | string
    max_words?: number; max_rating?: number
    timer_seconds?: number; correct_answers?: number[] | string[]
    language?: string
  }) {
    if (!liveStore.currentSession) return
    if (editingActivity.value) {
      const updatePayload: Partial<LiveActivity> = {
        ...payload,
        correct_answers: payload.correct_answers !== undefined
          ? JSON.stringify(payload.correct_answers)
          : undefined,
      }
      await liveStore.updateActivity(editingActivity.value.id, updatePayload)
      editingActivity.value = null
    } else {
      await liveStore.pushActivity(liveStore.currentSession.id, payload)
    }
    showActivityForm.value = false
    preSelectedCategory.value = null
  }

  function startEditActivity(activity: LiveActivity) {
    editingActivity.value = activity
    showActivityForm.value = true
  }

  function cancelActivityForm() {
    editingActivity.value = null
    showActivityForm.value = false
    preSelectedCategory.value = null
  }

  async function launch(activity: LiveActivity) {
    await liveStore.launchActivity(activity.id)
  }

  const autoCloseEnabled = ref(true)

  function onTeacherTimerExpired() {
    if (autoCloseEnabled.value && liveStore.currentActivity) {
      closeCurrentActivity()
    }
  }

  async function closeCurrentActivity() {
    if (!liveStore.currentActivity) return
    const activity = liveStore.currentActivity
    // Save code snapshot before closing (via exposed ref)
    if (activity.type === 'live_code' && codeEditorRef.value) {
      const content = codeEditorRef.value.getContent()
      if (content) await window.api.saveLiveV2CodeSnapshot(activity.id, content)
    }
    await liveStore.closeActivity(activity.id)
    if (liveStore.currentSession) {
      const hasSpark = liveStore.sessionActivities.some(a => isSparkType(a.type))
      if (hasSpark) {
        await liveStore.fetchLeaderboard(liveStore.currentSession.id)
        showLeaderboard.value = true
        // Kahoot mode : auto-enchainement si toggle active
        if (sparkAutoChain.value && nextPendingActivity.value) {
          startAutoChainCountdown()
        } else if (sparkAutoChain.value && !nextPendingActivity.value) {
          // Derniere question : podium final auto apres 2s. Handle timer pour pouvoir annuler
          // si l'utilisateur interrompt le flow (toggle off, leave session, etc.).
          if (autoPodiumTimeout) clearTimeout(autoPodiumTimeout)
          autoPodiumTimeout = setTimeout(() => {
            autoPodiumTimeout = null
            if (!sparkAutoChain.value || !liveStore.currentSession) return
            showPodium.value = true
            showLeaderboard.value = false
            liveStore.endSession(liveStore.currentSession.id)
          }, 2000)
        }
      }
    }
  }

  async function removeActivity(activity: LiveActivity) {
    // Dialog immediate si l'activite a deja ete lancee (closed) : on perd les reponses
    if (activity.status === 'closed') {
      const ok = await confirm(
        `Supprimer "${activity.title}" ? Les reponses des etudiants seront perdues.`,
        'danger',
        'Supprimer',
      )
      if (!ok) return
      await liveStore.deleteActivity(activity.id)
      showToast('Activite supprimee', 'info')
      return
    }
    // Activite pending : suppression optimiste + toast undo 5s
    const snapshot = { ...activity }
    await liveStore.deleteActivity(activity.id)
    const undone = await showUndoToast(`"${activity.title}" supprimee`, 5000)
    if (undone && liveStore.currentSession) {
      await liveStore.pushActivity(liveStore.currentSession.id, {
        type: snapshot.type,
        title: snapshot.title,
        options: snapshot.options ?? undefined,
        max_words: snapshot.max_words,
        max_rating: snapshot.max_rating,
        timer_seconds: snapshot.timer_seconds ?? undefined,
        correct_answers: snapshot.correct_answers ?? undefined,
        language: snapshot.language ?? undefined,
      } as Parameters<typeof liveStore.pushActivity>[1])
      showToast('Suppression annulee', 'success')
    }
  }

  async function broadcastSession() {
    if (!liveStore.currentSession) return
    await liveStore.startSession(liveStore.currentSession.id)
  }

  async function endSession() {
    if (!liveStore.currentSession) return
    const hasActive = liveStore.sessionActivities.some(a => a.status === 'live')
    const message = hasActive
      ? `Terminer la session ? Une activite est encore en direct (elle sera fermee).`
      : `Terminer la session "${liveStore.currentSession.title}" ?`
    const ok = await confirm(message, hasActive ? 'warning' : 'info', 'Terminer')
    if (!ok) return
    await liveStore.fetchLeaderboard(liveStore.currentSession.id)
    showPodium.value = true
    await liveStore.endSession(liveStore.currentSession.id)
  }

  // ── Drag & drop reorder ──────────────────────────────────────────────────
  function onDragStart(activityId: number) {
    dragSrcId.value = activityId
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  async function onDrop(targetId: number) {
    if (dragSrcId.value === null || dragSrcId.value === targetId) return
    const acts = liveStore.sessionActivities
    const fromIdx = acts.findIndex(a => a.id === dragSrcId.value)
    const toIdx   = acts.findIndex(a => a.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...acts]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await liveStore.reorderActivities(reordered.map(a => a.id))
    dragSrcId.value = null
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const podiumTop3 = computed(() =>
    liveStore.leaderboard.slice(0, 3).map(e => ({ name: e.name, points: e.points })),
  )

  const hasLiveActivity = computed(() => liveStore.sessionActivities.some(a => a.status === 'live'))
  const nextPendingActivity = computed(() => liveStore.sessionActivities.find(a => a.status === 'pending') ?? null)

  /** Position de l'activite en cours dans la session (1-based, 0 si aucune). */
  const currentActivityIndex = computed(() => {
    if (!liveStore.currentActivity) return 0
    return liveStore.sessionActivities.findIndex(a => a.id === liveStore.currentActivity?.id) + 1
  })
  const totalActivities = computed(() => liveStore.sessionActivities.length)

  async function launchNext() {
    if (!nextPendingActivity.value) return
    clearAutoChainTimer()
    showLeaderboard.value = false
    await launch(nextPendingActivity.value)
  }

  /** Ferme l'activite courante si live puis lance la suivante. Core du flow Wooclap. */
  async function goNext() {
    clearAutoChainTimer()
    if (liveStore.currentActivity && liveStore.currentActivity.status === 'live') {
      await closeCurrentActivity()
    }
    if (nextPendingActivity.value) {
      showLeaderboard.value = false
      await launch(nextPendingActivity.value)
    }
  }

  function dismissLeaderboard() {
    clearAutoChainTimer()
    showLeaderboard.value = false
  }

  // ── Activity progress ────────────────────────────────────────────────────
  const closedCount = computed(() => liveStore.sessionActivities.filter(a => a.status === 'closed').length)
  const totalCount  = computed(() => liveStore.sessionActivities.length)

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exporting = ref(false)
  async function exportCsv() {
    if (!liveStore.currentSession) return
    exporting.value = true
    try {
      const csv = await liveStore.exportCsv(liveStore.currentSession.id)
      if (csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `live-${liveStore.currentSession.title.replace(/\s+/g, '-')}.csv`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } finally {
      exporting.value = false
    }
  }

  // ── Duplicate activity ───────────────────────────────────────────────────
  async function duplicateActivity(activity: LiveActivity) {
    if (!liveStore.currentSession) return
    const payload: {
      type: LiveV2ActivityType
      title: string; options?: string[] | string
      max_words?: number; max_rating?: number
      timer_seconds?: number; correct_answers?: number[] | string[]
      language?: string
    } = {
      type: activity.type,
      title: activity.title + ' (copie)',
      timer_seconds: activity.timer_seconds,
    }
    if (activity.language) payload.language = activity.language
    if (activity.options) {
      const parsed = parseJsonArray<string>(activity.options as string | string[] | null)
      if (parsed.length) payload.options = parsed
    }
    if (activity.correct_answers) {
      const parsed = parseJsonArray<string | number>(activity.correct_answers as string | null)
      if (parsed.length) payload.correct_answers = parsed as string[]
    }
    await liveStore.pushActivity(liveStore.currentSession.id, payload)
  }
</script>

<template>
  <div class="teacher-live" :class="{ 'preview-open': previewMode && liveStore.currentSession }">
    <!-- Preview pane flottante (a droite) -->
    <aside
      v-if="previewMode && liveStore.currentSession"
      class="preview-pane"
      role="complementary"
      aria-label="Apercu cote etudiant"
    >
      <LiveTestPreview
        :activities="liveStore.sessionActivities"
        :current-activity="liveStore.currentActivity"
      />
    </aside>
    <!-- ══════════ Pas de session — page d'accueil Live ══════════ -->
    <div v-if="!liveStore.currentSession" class="live-home">

      <!-- Tab: Historique / Stats (accessible via sidebar) -->
      <template v-if="activeTab === 'history'">
        <div class="live-home-sub">
          <button class="live-home-back" @click="activeTab = 'home'; router.replace({ name: 'live' })">
            <ArrowRight :size="14" style="transform: rotate(180deg)" /> Accueil Live
          </button>
          <QuizHistoryView :promo-id="promoId" />
        </div>
      </template>
      <template v-else-if="activeTab === 'stats'">
        <div class="live-home-sub">
          <button class="live-home-back" @click="activeTab = 'home'; router.replace({ name: 'live' })">
            <ArrowRight :size="14" style="transform: rotate(180deg)" /> Accueil Live
          </button>
          <QuizStatsView :promo-id="promoId" />
        </div>
      </template>

      <!-- Sub-page: detail categorie -->
      <template v-else-if="selectedCategory">
        <div class="live-cat-detail" :style="{ '--cat-color': ACTIVITY_CATEGORIES[selectedCategory].color }">
          <button class="live-home-back" @click="backToHome">
            <ArrowRight :size="14" style="transform: rotate(180deg)" /> Accueil Live
          </button>

          <div class="lcd-header">
            <div class="lcd-icon">
              <component :is="ACTIVITY_CATEGORIES[selectedCategory].icon" :size="32" />
            </div>
            <div>
              <h2 class="lcd-title">{{ ACTIVITY_CATEGORIES[selectedCategory].label }}</h2>
              <p class="lcd-desc">{{ ACTIVITY_CATEGORIES[selectedCategory].description }}</p>
            </div>
          </div>

          <!-- Types d'activites disponibles -->
          <div class="lcd-section">
            <h3 class="lcd-section-title">Types d'activites disponibles</h3>
            <div class="lcd-types-grid">
              <div
                v-for="t in ACTIVITY_CATEGORIES[selectedCategory].types"
                :key="t"
                class="lcd-type-card"
              >
                <component :is="activityIcon(t)" :size="20" class="lcd-type-icon" />
                <div class="lcd-type-info">
                  <span class="lcd-type-label">{{ activityTypeLabel(t) }}</span>
                  <span class="lcd-type-id">{{ t }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Infos specifiques par categorie -->
          <div class="lcd-section">
            <h3 class="lcd-section-title">Fonctionnalites</h3>
            <div class="lcd-features">
              <template v-if="selectedCategory === 'spark'">
                <div class="lcd-feat">Scoring et classement en temps reel</div>
                <div class="lcd-feat">Timer par question (optionnel)</div>
                <div class="lcd-feat">Leaderboard et podium final</div>
                <div class="lcd-feat">Correction automatique</div>
                <div class="lcd-feat">Export CSV des resultats</div>
              </template>
              <template v-else-if="selectedCategory === 'pulse'">
                <div class="lcd-feat">Reponses anonymes</div>
                <div class="lcd-feat">Nuage de mots, echelle, sondage, matrice</div>
                <div class="lcd-feat">Resultats agreges en direct</div>
                <div class="lcd-feat">Pas de scoring (feedback libre)</div>
                <div class="lcd-feat">Vote et priorisation</div>
              </template>
              <template v-else-if="selectedCategory === 'code'">
                <div class="lcd-feat">Editeur de code en direct</div>
                <div class="lcd-feat">Coloration syntaxique (JS, Python, Java...)</div>
                <div class="lcd-feat">Broadcast temps reel aux etudiants</div>
                <div class="lcd-feat">Snapshot automatique a la fermeture</div>
              </template>
              <template v-else-if="selectedCategory === 'board'">
                <div class="lcd-feat">Post-its collaboratifs par colonnes</div>
                <div class="lcd-feat">Drag & drop entre colonnes</div>
                <div class="lcd-feat">Votes (max configurable)</div>
                <div class="lcd-feat">Choix de couleur et edition inline</div>
                <div class="lcd-feat">Mode anonyme et export Markdown</div>
              </template>
            </div>
          </div>

          <!-- Zone creation -->
          <div class="lcd-create">
            <input
              v-model="newTitle"
              class="live-home-input"
              :placeholder="`Nom de la session ${ACTIVITY_CATEGORIES[selectedCategory].label} (optionnel)`"
              maxlength="100"
              @keydown.enter="startFromCategory"
            />
            <button
              class="lcd-create-btn"
              :disabled="liveStore.loading"
              @click="startFromCategory"
            >
              <Plus :size="16" />
              {{ liveStore.loading ? 'Creation...' : 'Creer et preparer' }}
            </button>
          </div>
        </div>
      </template>

      <!-- Tab: Accueil (default) -->
      <template v-else>
        <div class="live-hero">
          <Zap :size="40" class="hero-icon" />
          <h1 class="hero-title">Live</h1>
          <p class="hero-desc">Lancez une activite interactive avec vos etudiants</p>
        </div>

        <!-- Grille des 4 categories -->
        <div class="live-cat-grid">
          <button
            v-for="(cat, key) in ACTIVITY_CATEGORIES"
            :key="key"
            class="live-cat-card"
            :style="{ '--cat-color': cat.color }"
            @click="openCategory(key as ActivityCategory)"
          >
            <div class="live-cat-icon">
              <component :is="ACTIVITY_CATEGORIES[key as ActivityCategory].icon" :size="28" />
            </div>
            <div class="live-cat-info">
              <span class="live-cat-label">{{ cat.label }}</span>
              <span class="live-cat-desc">{{ cat.description }}</span>
            </div>
            <div class="live-cat-types">
              <span v-for="t in cat.types.slice(0, 3)" :key="t" class="live-cat-type">{{ t.replace(/_/g, ' ') }}</span>
              <span v-if="cat.types.length > 3" class="live-cat-type live-cat-more">+{{ cat.types.length - 3 }}</span>
            </div>
            <ArrowRight :size="16" class="live-cat-arrow" />
          </button>
        </div>

        <!-- Modeles de session sauvegardes -->
        <div v-if="templates.length > 0" class="live-templates">
          <h3 class="live-templates-title">
            <Bookmark :size="14" />
            Modeles enregistres
          </h3>
          <div class="live-templates-list">
            <div v-for="tpl in templates" :key="tpl.id" class="live-template-card">
              <div class="ltc-body">
                <span class="ltc-name">{{ tpl.name }}</span>
                <span class="ltc-meta">{{ tpl.activities.length }} activite{{ tpl.activities.length > 1 ? 's' : '' }}</span>
              </div>
              <div class="ltc-actions">
                <button class="ltc-load" @click="onLoadTemplate(tpl.id)" title="Charger ce modele dans une nouvelle session">
                  <Plus :size="12" /> Utiliser
                </button>
                <button class="ltc-del" @click="onDeleteTemplate(tpl.id, tpl.name)" :title="`Supprimer ${tpl.name}`" aria-label="Supprimer le modele">
                  <Trash2 :size="12" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Lien brouillons existants -->
        <div v-if="liveStore.draftSessions.length > 0" class="live-home-drafts-hint">
          <span class="live-home-drafts-text">
            {{ liveStore.draftSessions.length }} brouillon(s) dans la sidebar
          </span>
        </div>
      </template>
    </div>

    <!-- ══════════ Podium final ══════════ -->
    <div v-else-if="showPodium && podiumTop3.length > 0" class="live-podium-view">
      <Podium
        :top3="podiumTop3"
        :total-participants="liveStore.leaderboard.length"
        :total-activities="liveStore.currentSession?.activities?.length ?? 0"
        :session-title="liveStore.currentSession?.title"
      />
      <button class="btn-dismiss-podium" @click="showPodium = false">
        Fermer
      </button>
    </div>

    <!-- ══════════ Session en attente ══════════ -->
    <div v-else-if="!liveStore.currentActivity && !showLeaderboard" class="live-session">
      <div class="session-header">
        <div class="session-info">
          <h1 class="session-title">{{ liveStore.currentSession.title }}</h1>
          <div class="session-meta-row">
            <span class="session-status" :class="'status-' + liveStore.currentSession.status">
              {{ liveStore.currentSession.status === 'waiting' ? 'En attente' : liveStore.currentSession.status === 'active' ? 'Active' : 'Terminee' }}
            </span>
            <span v-for="cat in sessionCategoryCounts" :key="cat.name" class="session-cat-pill" :class="`cat--${cat.name}`">
              {{ cat.count }} {{ cat.name }}
            </span>
          </div>
        </div>
        <div class="session-actions">
          <button
            v-if="liveStore.currentSession.status === 'waiting'"
            class="btn-start"
            @click="broadcastSession"
          >
            <Play :size="16" />
            Diffuser aux étudiants
          </button>
          <button
            class="btn-preview"
            :class="{ active: previewMode }"
            @click="togglePreview"
            title="Apercu cote etudiant (sans les etudiants)"
          >
            <component :is="previewMode ? EyeOff : Eye" :size="16" />
            {{ previewMode ? 'Fermer apercu' : 'Mode apercu' }}
          </button>
          <button
            v-if="liveStore.sessionActivities.length > 0"
            class="btn-template"
            @click="onSaveAsTemplate"
            title="Sauvegarder cette session comme modele reutilisable"
          >
            <BookmarkPlus :size="16" />
            Modele
          </button>
          <button class="btn-export" :disabled="exporting" @click="exportCsv" title="Exporter les resultats en CSV">
            <Download :size="16" />
            {{ exporting ? 'Export...' : 'CSV' }}
          </button>
          <button class="btn-end" @click="endSession">
            <LogOut :size="16" />
            Terminer
          </button>
        </div>
      </div>

      <JoinCodeDisplay :code="liveStore.currentSession.join_code" />

      <div class="session-meta-bar">
        <div class="participant-bar">
          <Users :size="16" />
          <span>{{ liveStore.participantCount }} participant{{ liveStore.participantCount > 1 ? 's' : '' }}</span>
        </div>
        <div v-if="confusionCount > 0" class="confusion-counter" :title="`${confusionCount} etudiant${confusionCount > 1 ? 's' : ''} signale${confusionCount > 1 ? 'nt' : ''} une difficulte`">
          <AlertTriangle :size="14" />
          <span>{{ confusionCount }} perdu{{ confusionCount > 1 ? 's' : '' }}</span>
        </div>
        <div v-if="totalCount > 0" class="progress-bar">
          <div class="progress-fill" :style="{ width: (closedCount / totalCount * 100) + '%' }" />
          <span class="progress-text">{{ closedCount }}/{{ totalCount }} terminee{{ closedCount > 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Panneau Mode Spark (Kahoot) : visible si session majoritairement Spark -->
      <div v-if="isSparkSession && liveStore.sessionActivities.length > 0" class="spark-mode-panel">
        <div class="spm-toggle-wrap">
          <label class="spm-toggle">
            <input type="checkbox" v-model="sparkAutoChain" />
            <span class="spm-toggle-track"><span class="spm-toggle-dot" /></span>
            <div class="spm-toggle-meta">
              <span class="spm-toggle-label">Mode Spark (enchainement auto)</span>
              <span class="spm-toggle-desc">Questions enchainees + leaderboard entre chaque + podium final</span>
            </div>
          </label>
          <div v-if="sparkAutoChain" class="spm-delay">
            <span class="spm-delay-label">Pause entre questions</span>
            <div class="spm-delay-btns">
              <button
                v-for="s in [3, 5, 8]" :key="s"
                class="spm-delay-btn"
                :class="{ active: autoChainDelaySeconds === s }"
                @click="autoChainDelaySeconds = s"
              >{{ s }}s</button>
            </div>
          </div>
        </div>

        <!-- Gros bouton Demarrer quand une activite pending existe et aucune live -->
        <button
          v-if="liveStore.currentSession.status === 'active' && nextPendingActivity && !liveStore.currentActivity && !showLeaderboard"
          class="btn-start-spark"
          @click="launchNext"
        >
          <Play :size="22" />
          <span class="bss-label">{{ sparkAutoChain ? 'Demarrer le Spark' : `Lancer : ${nextPendingActivity.title}` }}</span>
          <span class="bss-sub">{{ liveStore.sessionActivities.length }} question{{ liveStore.sessionActivities.length > 1 ? 's' : '' }}</span>
        </button>
      </div>

      <!-- Mode auto-rythme (self-paced) -->
      <div v-if="liveStore.sessionActivities.length > 0" class="self-paced-panel">
        <label class="spm-toggle">
          <input type="checkbox" :checked="!!liveStore.currentSession?.self_paced" @change="toggleSelfPaced" />
          <span class="spm-toggle-track"><span class="spm-toggle-dot" /></span>
          <div class="spm-toggle-meta">
            <span class="spm-toggle-label">Mode auto-rythme</span>
            <span class="spm-toggle-desc">Les etudiants naviguent a leur propre rythme entre les activites</span>
          </div>
        </label>

        <!-- Bouton "Lancer tout" quand self-paced et session active -->
        <div v-if="liveStore.currentSession?.self_paced && liveStore.currentSession?.status === 'active'" class="sp-teacher-controls">
          <button
            v-if="pendingCount > 0"
            class="btn-launch-all"
            @click="launchAllActivities"
          >
            <Play :size="16" />
            Lancer les {{ pendingCount }} activite{{ pendingCount > 1 ? 's' : '' }}
          </button>
          <span v-else class="sp-all-launched">Toutes les activites sont lancees</span>

          <!-- Dashboard progression par activite -->
          <div v-if="activityProgress.length > 0" class="sp-progress-dashboard">
            <div
              v-for="ap in activityProgress" :key="ap.id"
              class="sp-progress-row"
            >
              <span class="sp-progress-title">{{ ap.title }}</span>
              <div class="sp-progress-bar-wrap">
                <div class="sp-progress-bar">
                  <div
                    class="sp-progress-bar-fill"
                    :style="{ width: (liveStore.participantCount > 0 ? Math.min(100, ap.responseCount / liveStore.participantCount * 100) : 0) + '%' }"
                  />
                </div>
                <span class="sp-progress-count">{{ ap.responseCount }}<template v-if="liveStore.participantCount">/{{ liveStore.participantCount }}</template></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity list -->
      <div class="activities-section">
        <div class="activities-header">
          <h2 class="activities-title">Activités</h2>
          <div class="activities-header-actions">
            <div class="csv-group">
              <button
                class="btn-import-csv"
                :disabled="csvImporting"
                title="Importer un CSV (Kahoot ou universel Type;Question;Options;Extra)"
                @click="openCsvPicker"
              >
                <Upload :size="14" />
                {{ csvImporting ? 'Import...' : 'Importer CSV' }}
              </button>
              <button
                class="btn-csv-help"
                :class="{ active: csvHelpOpen }"
                title="Aide format CSV"
                aria-label="Afficher l'aide du format CSV"
                @click="csvHelpOpen = !csvHelpOpen"
              >
                <HelpCircle :size="14" />
              </button>
              <input
                ref="csvInputRef"
                type="file"
                accept=".csv,text/csv,.txt,text/plain"
                style="display:none"
                @change="onCsvSelected"
              />

              <div v-if="csvHelpOpen" class="csv-help" role="region" aria-label="Formats CSV supportes">
                <button class="csv-help-close" aria-label="Fermer" @click="csvHelpOpen = false">&times;</button>
                <h4 class="csv-help-title">Formats CSV supportes</h4>
                <div class="csv-help-section">
                  <span class="csv-help-section-title">Format universel (Wooclap-like)</span>
                  <code class="csv-help-code">Type;Question;Options;Extra;Temps</code>
                  <p class="csv-help-text">
                    Types : <code>sondage, qcm, vrai_faux, nuage, echelle, question_ouverte, sondage_libre, humeur, priorite, matrice</code>.<br>
                    Options separees par <code>|</code>. Extra = bonne reponse (qcm), max_rating (echelle/matrice), max_words (nuage).
                  </p>
                </div>
                <div class="csv-help-section">
                  <span class="csv-help-section-title">Format Kahoot (retro-compat)</span>
                  <code class="csv-help-code">Question;Rep1;Rep2;Rep3;Rep4;Temps;Bonne</code>
                </div>
                <button class="csv-help-download" @click="downloadCsvTemplate">
                  <FileDown :size="13" /> Telecharger un modele
                </button>
              </div>
            </div>
            <button class="btn-add-activity" @click="addActivityInCategory(activeCategoryFilter)">
              <Plus :size="16" />
              Ajouter {{ activeCategoryFilter ? ACTIVITY_CATEGORIES[activeCategoryFilter].label : '' }}
            </button>
          </div>
        </div>

        <!-- Category filter sidebar (horizontal pills) -->
        <div class="cat-filter-bar" role="toolbar" aria-label="Filtrer par categorie">
          <button
            class="cat-filter-pill"
            :class="{ active: !activeCategoryFilter }"
            :aria-pressed="!activeCategoryFilter"
            @click="activeCategoryFilter = null"
          >
            <span class="cfp-label">Tout</span>
            <span class="cfp-count" aria-label="activites au total">{{ liveStore.sessionActivities.length }}</span>
          </button>
          <button
            v-for="(cat, key) in ACTIVITY_CATEGORIES"
            :key="key"
            class="cat-filter-pill"
            :class="{ active: activeCategoryFilter === key, [`cfp--${key}`]: true }"
            :style="{ '--cat-color': cat.color }"
            :aria-pressed="activeCategoryFilter === key"
            :aria-label="`Filtrer ${cat.label} (${categoryCountsMap[key as ActivityCategory]} activite${categoryCountsMap[key as ActivityCategory] > 1 ? 's' : ''})`"
            @click="activeCategoryFilter = (activeCategoryFilter === key ? null : key as ActivityCategory)"
          >
            <component :is="ACTIVITY_CATEGORIES[key as ActivityCategory].icon" :size="14" aria-hidden="true" />
            <span class="cfp-label">{{ cat.label }}</span>
            <span class="cfp-count">{{ categoryCountsMap[key as ActivityCategory] }}</span>
          </button>
        </div>

        <div v-if="showActivityForm" class="activity-form-wrapper">
          <ActivityForm
            :initial-data="editingActivity"
            :locked-category="preSelectedCategory"
            @save="onAddActivity"
            @cancel="cancelActivityForm"
          />
        </div>

        <div v-if="liveStore.sessionActivities.length === 0 && !showActivityForm" class="no-activities">
          <Zap :size="24" class="no-activities-icon" />
          <span class="no-activities-title">Aucune activite</span>
          <span class="no-activities-desc">Spark (quiz), Pulse (feedback), Code (live coding) ou Board (brainstorming)</span>
          <span class="no-activities-tip">Astuce : Espace/Entree pour naviguer rapidement entre les activites</span>
        </div>

        <div v-else-if="filteredActivities.length === 0 && !showActivityForm && activeCategoryFilter" class="no-activities no-activities-filtered">
          <component :is="ACTIVITY_CATEGORIES[activeCategoryFilter].icon" :size="24" class="no-activities-icon" :style="{ color: ACTIVITY_CATEGORIES[activeCategoryFilter].color }" />
          <span class="no-activities-title">Aucune activite {{ ACTIVITY_CATEGORIES[activeCategoryFilter].label }}</span>
          <span class="no-activities-desc">{{ ACTIVITY_CATEGORIES[activeCategoryFilter].description }}</span>
          <button class="btn-add-activity" style="margin-top: 8px" @click="addActivityInCategory(activeCategoryFilter)">
            <Plus :size="14" />
            Ajouter une activite {{ ACTIVITY_CATEGORIES[activeCategoryFilter].label }}
          </button>
        </div>

        <div v-else class="activity-list">
          <div
            v-for="act in filteredActivities"
            :key="act.id"
            class="activity-card"
            :class="{ closed: act.status === 'closed', dragging: dragSrcId === act.id }"
            :draggable="act.status === 'pending' && !hasLiveActivity"
            @dragstart="onDragStart(act.id)"
            @dragover="onDragOver"
            @drop="onDrop(act.id)"
          >
            <div
              v-if="act.status === 'pending' && !hasLiveActivity"
              class="drag-handle"
              title="Réordonner"
            >
              <GripVertical :size="16" />
            </div>
            <div class="activity-card-icon">
              <component :is="activityIcon(act.type)" :size="18" />
            </div>
            <div class="activity-card-body">
              <div class="activity-card-meta">
                <span class="activity-card-type">{{ activityTypeLabel(act.type) }}</span>
                <span class="activity-card-cat" :class="`cat--${act.category ?? getActivityCategory(act.type)}`">
                  {{ (act.category ?? getActivityCategory(act.type)).charAt(0).toUpperCase() + (act.category ?? getActivityCategory(act.type)).slice(1) }}
                </span>
              </div>
              <span class="activity-card-title">{{ act.title }}</span>
            </div>
            <span v-if="act.status === 'closed'" class="activity-card-done">Terminé</span>
            <div class="activity-card-actions">
              <button
                v-if="act.status === 'pending'"
                class="btn-edit-activity"
                title="Modifier"
                @click="startEditActivity(act)"
              >
                <Pencil :size="14" />
              </button>
              <button
                v-if="act.status === 'pending'"
                class="btn-launch"
                title="Lancer"
                @click="launch(act)"
              >
                <Play :size="14" />
                Lancer
              </button>
              <button
                v-if="act.status === 'pending'"
                class="btn-edit-activity"
                title="Dupliquer"
                @click="duplicateActivity(act)"
              >
                <Copy :size="14" />
              </button>
              <button
                v-if="act.status === 'pending'"
                class="btn-delete-activity"
                title="Supprimer"
                @click="removeActivity(act)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ Leaderboard apres fermeture activite ══════════ -->
    <div v-else-if="showLeaderboard && !liveStore.currentActivity" class="live-leaderboard-view">
      <Leaderboard :entries="liveStore.leaderboard" />

      <!-- Countdown auto-chain Spark (Kahoot mode) -->
      <div v-if="autoChainCountdown !== null && nextPendingActivity" class="auto-chain-countdown" role="status" aria-live="polite">
        <div class="acc-ring" :style="{ '--progress': ((autoChainDelaySeconds - autoChainCountdown) / autoChainDelaySeconds * 100) + '%' }">
          <span class="acc-number">{{ autoChainCountdown }}</span>
        </div>
        <div class="acc-text">
          <span class="acc-label">Prochaine question dans</span>
          <span class="acc-next">{{ nextPendingActivity.title }}</span>
        </div>
        <button class="acc-cancel" @click="cancelAutoChain" title="Annuler l'enchainement auto">
          Mettre en pause
        </button>
      </div>

      <div class="lb-actions">
        <button v-if="nextPendingActivity" class="btn-launch-next" @click="launchNext">
          <Play :size="16" />
          {{ autoChainCountdown !== null ? 'Lancer maintenant' : `Lancer : ${nextPendingActivity.title}` }}
        </button>
        <button class="btn-dismiss-lb" @click="dismissLeaderboard">
          <ChevronRight :size="16" />
          {{ nextPendingActivity ? 'Revenir a la liste' : 'Continuer' }}
        </button>
      </div>
    </div>

    <!-- ══════════ Activite en cours (presentation mode) ══════════ -->
    <div v-else-if="liveStore.currentActivity" class="live-activity-view">
      <div class="activity-topbar">
        <div class="activity-topbar-info">
          <component :is="activityIcon(liveStore.currentActivity.type)" :size="20" />
          <span class="activity-topbar-type">{{ activityTypeLabel(liveStore.currentActivity.type) }}</span>
          <span v-if="totalActivities > 1" class="activity-topbar-pos" :title="`Activite ${currentActivityIndex} sur ${totalActivities}`">
            {{ currentActivityIndex }}<span class="pos-sep">/</span>{{ totalActivities }}
          </span>
        </div>
        <h2 class="activity-topbar-title">{{ liveStore.currentActivity.title }}</h2>
        <div class="activity-topbar-actions">
          <button class="btn-project" @click="openPresentation" title="Afficher sur videoprojecteur (plein ecran)">
            <Presentation :size="16" />
            Projection
          </button>
          <button class="btn-close-activity" @click="closeCurrentActivity">
            <Square :size="16" />
            Fermer l'activite
          </button>
          <button class="btn-next" @click="closeCurrentActivity">
            <ChevronRight :size="16" />
            Suivante
          </button>
        </div>
      </div>

      <!-- Timer + response count (Spark only has countdown, Pulse/Code/Board: elapsed time) -->
      <div class="activity-live-bar">
        <!-- Countdown timer (Spark seulement) -->
        <CountdownTimer
          v-if="liveStore.timerStartedAt && isSparkType(liveStore.currentActivity.type)"
          :total-seconds="liveStore.currentActivity.timer_seconds ?? 30"
          :started-at="liveStore.timerStartedAt"
          @expired="onTeacherTimerExpired"
        />
        <!-- Elapsed time (Code/Board/Pulse) -->
        <span v-if="!isSparkType(liveStore.currentActivity.type) && liveStore.currentActivity.started_at" class="activity-elapsed">
          <Clock :size="12" /> {{ elapsedTime }}
        </span>
        <!-- Badge categorie dans la topbar -->
        <span class="activity-topbar-cat" :class="`cat--${getActivityCategory(liveStore.currentActivity.type)}`">
          {{ getActivityCategory(liveStore.currentActivity.type) }}
        </span>
        <!-- Compteur reponses (Spark/Pulse) + barre de progression vs participants -->
        <div v-if="liveStore.results && (liveStore.results.totalResponses || liveStore.results.total)" class="response-count">
          <Users :size="18" />
          <span>{{ liveStore.results.totalResponses ?? liveStore.results.total ?? 0 }}<template v-if="liveStore.participantCount">/{{ liveStore.participantCount }}</template> reponse{{ (liveStore.results.totalResponses ?? liveStore.results.total ?? 0) > 1 ? 's' : '' }}</span>
          <div v-if="liveStore.participantCount > 0" class="response-progress" aria-hidden="true">
            <div
              class="response-progress-fill"
              :style="{ width: Math.min(100, ((liveStore.results.totalResponses ?? liveStore.results.total ?? 0) / liveStore.participantCount) * 100) + '%' }"
            />
          </div>
        </div>
        <!-- Temps median de reponse -->
        <div v-if="responseTimerLabel" class="response-median" :title="`Temps median sur ${responseTimer.sampleSize.value} reponses`">
          <Clock :size="14" />
          <span>{{ responseTimerLabel }}</span>
        </div>
        <!-- Auto-close (Spark seulement) -->
        <label v-if="isSparkType(liveStore.currentActivity.type)" class="auto-close-toggle" title="Fermer automatiquement quand le timer expire">
          <input type="checkbox" v-model="autoCloseEnabled" />
          <span class="auto-close-label">Auto-fermer</span>
        </label>
      </div>

      <div class="results-area">
        <!-- Code : editeur en direct (prof) -->
        <LiveCodeEditor
          ref="codeEditorRef"
          v-if="liveStore.currentActivity.type === 'live_code' && promoId"
          :activity-id="liveStore.currentActivity.id"
          :promo-id="promoId"
          :initial-content="liveStore.currentActivity.content ?? ''"
          :initial-language="liveStore.currentActivity.language ?? 'javascript'"
        />
        <!-- Board : tableau collaboratif -->
        <LiveBoard
          v-else-if="liveStore.currentActivity.type === 'board'"
          :activity-id="liveStore.currentActivity.id"
          :is-teacher="true"
          :columns="parseJsonArray<string>(liveStore.currentActivity.options as string | string[] | null)"
          :max-votes="liveStore.currentActivity.max_rating ?? 3"
        />
        <!-- Message Wall : mur de messages -->
        <MessageWall
          v-else-if="liveStore.currentActivity.type === 'message_wall'"
          :activity-id="liveStore.currentActivity.id"
          :is-teacher="true"
        />
        <LiveActivityResults
          v-else
          :activity="liveStore.currentActivity"
          :results="liveStore.results"
          :pulse-sondage-counts="pulseSondageCounts"
          @toggle-pin="onTogglePin"
        >
          <template #empty>
            <div class="results-waiting">
              <Zap :size="32" class="results-waiting-icon" />
              <span>En attente des reponses...</span>
            </div>
          </template>
        </LiveActivityResults>
      </div>
    </div>

    <!-- Bouton flottant aide raccourcis -->
    <button
      class="help-fab"
      aria-label="Afficher les raccourcis clavier (touche ?)"
      title="Raccourcis clavier (?)"
      @click="shortcutsOpen = true"
    >?</button>

    <LiveShortcutsOverlay :open="shortcutsOpen" @close="shortcutsOpen = false" />

    <!-- Mode projection (teleporte via position:fixed dans le composant) -->
    <LivePresentationMode
      v-if="presentationOpen && liveStore.currentActivity"
      :activity="liveStore.currentActivity"
      :join-code="liveStore.currentSession?.join_code"
      :response-count="liveStore.results?.totalResponses ?? liveStore.results?.total ?? 0"
      :elapsed-seconds="elapsedSeconds"
      :median-response-seconds="responseTimer.medianSeconds.value"
      :position-index="currentActivityIndex"
      :total-count="totalActivities"
      :has-next="!!nextPendingActivity"
      :confusion-count="confusionCount"
      @close="closePresentation"
      @close-activity="closeCurrentActivity(); closePresentation()"
      @next="goNext"
    >
      <LiveActivityResults
        :activity="liveStore.currentActivity"
        :results="liveStore.results"
        :pulse-sondage-counts="pulseSondageCounts"
      >
        <template #empty>
          <div class="projection-waiting">
            <Zap :size="48" />
            <span>En attente des reponses...</span>
          </div>
        </template>
      </LiveActivityResults>
    </LivePresentationMode>
  </div>
</template>

<style scoped>
.teacher-live {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-main);
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* Fade+rise discret au changement de vue (home, session, activity live, leaderboard, podium). */
.live-home, .live-session, .live-activity-view, .live-leaderboard-view, .live-podium-view {
  animation: live-view-in .26s var(--ease-out) both;
}
@keyframes live-view-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .live-home, .live-session, .live-activity-view, .live-leaderboard-view, .live-podium-view {
    animation: none;
  }
}

/* ── Home / Landing ── */
.live-home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  max-width: 680px;
  width: 100%;
  margin-top: 48px;
}
.live-home-sub {
  width: 100%; max-width: 680px;
  display: flex; flex-direction: column; gap: 16px;
}
.live-home-back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: none; border: none; cursor: pointer; font-family: inherit;
  padding: 4px 0; transition: color .12s;
}
.live-home-back:hover { color: var(--accent); }

.live-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.hero-icon { color: var(--accent); opacity: .5; }
.hero-title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin: 0; }
.hero-desc { font-size: 13px; color: var(--text-muted); max-width: 400px; }

.live-home-name {
  width: 100%; max-width: 420px;
}
.live-home-input {
  width: 100%; padding: 10px 16px; border-radius: 8px;
  background: var(--bg-input, var(--border));
  border: 1px solid var(--border-input, var(--bg-hover));
  color: var(--text-primary); font-size: 14px; font-family: inherit;
  outline: none; transition: border-color .15s; text-align: center;
}
.live-home-input:focus { border-color: var(--accent); }
.live-home-input::placeholder { color: var(--text-muted); }

/* ── Category grid ── */
.live-cat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  width: 100%;
}
.live-cat-card {
  position: relative;
  display: flex; flex-direction: column; gap: 14px;
  padding: 22px 22px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  transition: transform .18s var(--ease-out), border-color .18s, box-shadow .18s, background .18s;
  overflow: hidden;
  font-family: inherit;
  isolation: isolate;
}
/* Halo diagonal derriere la carte */
.live-cat-card::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at top right,
              color-mix(in srgb, var(--cat-color) 12%, transparent) 0%,
              transparent 55%);
  opacity: 0; transition: opacity .22s;
  z-index: -1;
}
/* Barre colore en haut */
.live-cat-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--cat-color), color-mix(in srgb, var(--cat-color) 50%, transparent));
  opacity: 0; transition: opacity .2s;
}
.live-cat-card:hover {
  border-color: color-mix(in srgb, var(--cat-color) 55%, var(--border));
  box-shadow: 0 10px 30px color-mix(in srgb, var(--cat-color) 15%, rgba(0,0,0,.25));
  transform: translateY(-2px);
}
.live-cat-card:hover::before,
.live-cat-card:hover::after { opacity: 1; }
.live-cat-card:disabled { opacity: .5; cursor: wait; }

.live-cat-icon {
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--cat-color) 14%, transparent);
  color: var(--cat-color);
  transition: transform .2s var(--ease-spring), background .15s;
}
.live-cat-card:hover .live-cat-icon {
  transform: scale(1.08) rotate(-4deg);
  background: color-mix(in srgb, var(--cat-color) 22%, transparent);
}
.live-cat-info { display: flex; flex-direction: column; gap: 2px; }
.live-cat-label { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.live-cat-desc { font-size: 12px; color: var(--text-muted); }
.live-cat-types {
  display: flex; flex-wrap: wrap; gap: 4px;
}
.live-cat-type {
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 4px;
  background: var(--bg-hover); color: var(--text-secondary);
  text-transform: capitalize;
}
.live-cat-more { color: var(--text-muted); }
.live-cat-arrow {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); opacity: 0; transition: all .15s;
}
.live-cat-card:hover .live-cat-arrow { opacity: 1; color: var(--cat-color); }

.live-home-drafts-hint {
  text-align: center;
}
.live-home-drafts-text {
  font-size: 12px; color: var(--text-muted);
}

/* ── Category detail sub-page ── */
.live-cat-detail {
  width: 100%; max-width: 640px;
  display: flex; flex-direction: column; gap: 24px;
}
.lcd-header {
  display: flex; align-items: center; gap: 16px;
}
.lcd-icon {
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--cat-color) 12%, transparent);
  color: var(--cat-color);
  flex-shrink: 0;
}
.lcd-title {
  font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0;
}
.lcd-desc {
  font-size: 13px; color: var(--text-muted); margin: 2px 0 0;
}
.lcd-section {
  display: flex; flex-direction: column; gap: 10px;
}
.lcd-section-title {
  font-size: 12px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .04em; margin: 0;
}
.lcd-types-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.lcd-type-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px;
}
.lcd-type-icon { color: var(--cat-color); flex-shrink: 0; }
.lcd-type-info { display: flex; flex-direction: column; gap: 1px; }
.lcd-type-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.lcd-type-id { font-size: 10px; color: var(--text-muted); font-family: monospace; }

.lcd-features {
  display: flex; flex-direction: column; gap: 6px;
}
.lcd-feat {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-secondary);
  padding: 6px 10px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 6px;
}
.lcd-feat::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--cat-color);
  flex-shrink: 0;
}

.lcd-create {
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 12px;
}
.lcd-create-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: 8px;
  font-size: 15px; font-weight: 700;
  background: var(--cat-color); color: #fff;
  border: none; cursor: pointer;
  transition: all .15s; font-family: inherit;
}
.lcd-create-btn:hover { filter: brightness(1.1); }
.lcd-create-btn:disabled { opacity: .4; cursor: not-allowed; }

/* Legacy create-input (still used in session view) */
.create-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--bg-input, var(--border));
  border: 1px solid var(--border-input, var(--bg-hover));
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color .15s;
}
.create-input:focus {
  border-color: var(--accent);
}
.create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
}
.create-btn:hover { filter: brightness(1.1); }
.create-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ── Session waiting ── */
.live-session {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 720px;
  width: 100%;
}
.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.session-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.session-meta-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.session-cat-pill {
  font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 10px;
}
.session-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
}
.session-status {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 6px;
  letter-spacing: .5px;
}
.status-waiting { background: rgba(251,191,36,.15); color: #fbbf24; }
.status-active  { background: rgba(34,197,94,.15); color: #22c55e; }
.status-ended   { background: rgba(107,114,128,.15); color: #9ca3af; }
.session-actions {
  display: flex;
  gap: 8px;
}
.btn-start {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: #22c55e; color: #fff; border: none; cursor: pointer;
  transition: all .15s;
}
.btn-start:hover { filter: brightness(1.1); }
.btn-end {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(239,68,68,.12); color: #f87171; border: 1px solid rgba(239,68,68,.2);
  cursor: pointer; transition: all .15s;
}
.btn-end:hover { background: rgba(239,68,68,.2); }
.btn-export {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(74,144,217,.08); color: var(--accent);
  border: 1px solid rgba(74,144,217,.2); cursor: pointer;
  transition: all .15s;
}
.btn-export:hover { background: rgba(74,144,217,.15); }
.btn-export:disabled { opacity: .4; cursor: not-allowed; }
.btn-preview {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(168,85,247,.08); color: #a855f7;
  border: 1px solid rgba(168,85,247,.2); cursor: pointer;
  transition: all .15s;
}
.btn-preview:hover { background: rgba(168,85,247,.18); }
.btn-preview.active { background: #a855f7; color: #fff; border-color: #a855f7; }
.btn-template {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: var(--bg-elevated); color: var(--text-secondary);
  border: 1px solid var(--border); cursor: pointer;
  transition: all .15s;
}
.btn-template:hover { color: var(--text-primary); border-color: var(--border-input); }

/* Templates list (home) */
.live-templates {
  width: 100%;
  display: flex; flex-direction: column; gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
  margin-top: 8px;
}
.live-templates-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px;
  margin: 8px 0 2px;
}
.live-templates-list {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.live-template-card {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all .15s;
}
.live-template-card:hover { border-color: var(--border-input); }
.ltc-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ltc-name {
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ltc-meta { font-size: 10px; color: var(--text-muted); }
.ltc-actions { display: flex; gap: 4px; flex-shrink: 0; }
.ltc-load {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
  background: var(--accent-subtle); color: var(--accent);
  border: 1px solid rgba(74,144,217,.25); cursor: pointer;
  font-family: inherit;
  transition: all .15s;
}
.ltc-load:hover { background: rgba(74,144,217,.22); }
.ltc-del {
  width: 26px; height: 26px; border-radius: 6px;
  background: rgba(239,68,68,.08); color: #f87171;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.ltc-del:hover { background: rgba(239,68,68,.2); }

/* ── Floating help button ── */
.help-fab {
  position: fixed;
  bottom: 20px; right: 20px;
  width: 38px; height: 38px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 16px; font-weight: 800;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--elevation-1);
  transition: all .18s var(--ease-out);
  z-index: 15;
  font-family: inherit;
}
.help-fab:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--elevation-2);
}
.teacher-live.preview-open .help-fab { right: 440px; }

/* ── Preview pane (mode apercu) ── */
.teacher-live.preview-open {
  padding-right: 420px;
  transition: padding .2s;
}
.preview-pane {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 400px;
  background: var(--bg-main);
  border-left: 1px solid var(--border);
  padding: 24px 16px;
  overflow-y: auto;
  z-index: 20;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,.15);
  animation: slidePreview .22s ease-out;
}
@keyframes slidePreview {
  from { transform: translateX(20px); opacity: 0 }
  to   { transform: translateX(0);    opacity: 1 }
}
@media (max-width: 900px) {
  .teacher-live.preview-open { padding-right: 32px; }
  .preview-pane { display: none; }
}
.session-meta-bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.participant-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-radius: 8px;
  background: var(--bg-elevated); color: var(--text-muted);
  font-size: 14px; font-weight: 600;
}
.confusion-counter {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 8px;
  background: #fef3c7; color: #d97706;
  font-size: 12px; font-weight: 700;
  animation: pulse-warn .8s ease-in-out infinite alternate;
}
.self-paced-panel {
  padding: 12px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sp-teacher-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.btn-launch-all {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #10b981);
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s;
}
.btn-launch-all:hover { filter: brightness(1.08); }
.sp-all-launched {
  font-size: 12px;
  color: #10b981;
  font-weight: 600;
}
.sp-progress-dashboard {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sp-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sp-progress-title {
  flex: 0 0 140px;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sp-progress-bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sp-progress-bar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  overflow: hidden;
}
.sp-progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width .3s ease;
}
.sp-progress-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: right;
}
@keyframes pulse-warn {
  from { opacity: .7 }
  to   { opacity: 1 }
}
.progress-bar {
  flex: 1; min-width: 140px; height: 28px; position: relative;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: rgba(34,197,94,.25);
  border-radius: 8px; transition: width .4s cubic-bezier(.25,.8,.25,1);
}
.progress-text {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: var(--text-secondary, #aaa);
}

/* ── Spark mode panel (Kahoot-like auto-chain) ── */
.spark-mode-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px;
  background:
    linear-gradient(135deg, var(--live-spark-soft), transparent 80%),
    var(--bg-elevated);
  border: 1px solid var(--live-spark-border);
  border-radius: 14px;
  position: relative;
}
.spm-toggle-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.spm-toggle {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}
.spm-toggle input[type="checkbox"] {
  position: absolute; opacity: 0; pointer-events: none;
}
.spm-toggle-track {
  position: relative;
  width: 40px; height: 22px;
  background: rgba(245,158,11,.15);
  border: 1px solid var(--live-spark-border);
  border-radius: 999px;
  transition: all .18s;
  flex-shrink: 0;
}
.spm-toggle-dot {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: var(--live-spark);
  border-radius: 50%;
  transition: transform .18s var(--ease-out);
}
.spm-toggle input:checked + .spm-toggle-track {
  background: var(--live-spark);
  border-color: var(--live-spark);
}
.spm-toggle input:checked + .spm-toggle-track .spm-toggle-dot {
  background: #fff;
  transform: translateX(18px);
}
.spm-toggle-meta { display: flex; flex-direction: column; gap: 2px; }
.spm-toggle-label {
  font-size: 14px; font-weight: 700;
  color: var(--text-primary);
}
.spm-toggle-desc {
  font-size: 11px; color: var(--text-muted);
}
.spm-delay {
  display: flex; align-items: center; gap: 8px;
}
.spm-delay-label {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .4px;
}
.spm-delay-btns { display: flex; gap: 4px; }
.spm-delay-btn {
  min-width: 36px;
  padding: 4px 10px;
  border-radius: 6px;
  font-family: inherit; font-size: 12px; font-weight: 700;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  transition: all .12s;
}
.spm-delay-btn:hover { color: var(--text-primary); }
.spm-delay-btn.active {
  background: var(--live-spark);
  border-color: var(--live-spark);
  color: #fff;
}

/* Big Start Spark button */
.btn-start-spark {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px 28px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--live-spark), #fbbf24);
  color: #1a1300;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--live-spark) 40%, transparent);
  transition: all .18s var(--ease-out), transform .1s;
  position: relative;
  overflow: hidden;
}
.btn-start-spark::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent);
  transform: translateX(-100%);
  animation: bss-shine 3s ease-in-out infinite;
}
@keyframes bss-shine { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .btn-start-spark::after { animation: none; } }
.btn-start-spark:hover { transform: translateY(-2px); filter: brightness(1.05); }
.btn-start-spark:active { transform: translateY(0); }
.bss-label {
  font-size: 18px; font-weight: 800;
  letter-spacing: -.01em;
}
.bss-sub {
  font-size: 11px; font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,.15);
  color: rgba(26,19,0,.7);
}

/* Countdown auto-chain en mode leaderboard */
.auto-chain-countdown {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--live-spark-border);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  animation: acc-in .3s var(--ease-out);
}
@keyframes acc-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.acc-ring {
  position: relative;
  width: 44px; height: 44px;
  border-radius: 50%;
  background:
    conic-gradient(var(--live-spark) var(--progress, 0%), rgba(255,255,255,.08) var(--progress, 0%));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.acc-ring::before {
  content: '';
  position: absolute; inset: 3px;
  border-radius: 50%;
  background: var(--bg-elevated);
}
.acc-number {
  position: relative;
  font-family: 'JetBrains Mono', monospace;
  font-size: 17px;
  font-weight: 800;
  color: var(--live-spark);
  font-variant-numeric: tabular-nums;
}
.acc-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1;
  min-width: 0;
}
.acc-label {
  font-size: 11px; font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.acc-next {
  font-size: 13px; font-weight: 700;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acc-cancel {
  padding: 6px 12px;
  border-radius: 6px;
  font-family: inherit; font-size: 11px; font-weight: 600;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all .15s;
}
.acc-cancel:hover { color: var(--text-primary); border-color: var(--border-input); }

/* ── Activities ── */
.activities-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.activities-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.activities-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.activities-header-actions {
  display: flex; align-items: center; gap: 6px;
}
.btn-add-activity {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: var(--accent-subtle, rgba(74,144,217,.12));
  color: var(--accent); border: 1px solid rgba(74,144,217,.2);
  cursor: pointer; transition: all .15s;
}
.btn-add-activity:hover { background: rgba(74,144,217,.2); }
.btn-import-csv {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
  background: var(--bg-elevated); color: var(--text-secondary);
  border: 1px solid var(--border); cursor: pointer;
  transition: all .15s;
  font-family: inherit;
}
.btn-import-csv:hover:not(:disabled) {
  color: var(--text-primary); border-color: var(--border-input);
  background: var(--bg-hover);
}
.btn-import-csv:disabled { opacity: .5; cursor: wait; }

.csv-group { position: relative; display: inline-flex; gap: 4px; }
.btn-csv-help {
  width: 28px; height: 28px; border-radius: 7px;
  background: transparent; color: var(--text-muted);
  border: 1px solid var(--border); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
  align-self: center;
}
.btn-csv-help:hover,
.btn-csv-help.active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: var(--accent-subtle);
}

.csv-help {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 340px;
  padding: 14px 16px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--elevation-2);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: csv-help-in .16s var(--ease-out);
}
@keyframes csv-help-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.csv-help-close {
  position: absolute; top: 6px; right: 6px;
  width: 22px; height: 22px;
  border-radius: 5px;
  background: none; border: none;
  color: var(--text-muted); cursor: pointer;
  font-size: 18px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.csv-help-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.csv-help-title {
  margin: 0; font-size: 12px; font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase; letter-spacing: .5px;
}
.csv-help-section {
  display: flex; flex-direction: column; gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.csv-help-section:first-of-type { border-top: none; padding-top: 0; }
.csv-help-section-title {
  font-size: 11px; font-weight: 700; color: var(--accent);
  text-transform: uppercase; letter-spacing: .4px;
}
.csv-help-code {
  display: block;
  padding: 6px 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 10px;
  color: var(--text-primary);
  overflow-x: auto;
  white-space: nowrap;
}
.csv-help-text {
  font-size: 11px; line-height: 1.5; margin: 0;
  color: var(--text-secondary);
}
.csv-help-text code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 1px 4px;
  background: var(--bg-input);
  border-radius: 3px;
  color: var(--text-primary);
}
.csv-help-download {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  font-family: inherit; font-size: 12px; font-weight: 600;
  background: var(--accent-subtle); color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 6px; cursor: pointer;
  align-self: flex-start;
  transition: background .15s;
}
.csv-help-download:hover { background: rgba(74,144,217,.2); }
.activity-form-wrapper {
  padding: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius, 12px);
}
.no-activities {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 40px 32px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px dashed var(--border);
  border-radius: 12px;
}
.no-activities-icon {
  opacity: .3;
  color: var(--accent);
}
.no-activities-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-secondary, #aaa);
}
.no-activities-desc {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 360px;
}
.no-activities-tip {
  font-size: 11px;
  color: var(--text-muted);
  opacity: .6;
  margin-top: 4px;
}
.no-activities-filtered {
  padding: 32px 24px;
}

/* ── Category filter bar ── */
.cat-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0 4px;
}
.cat-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all .15s;
}
.cat-filter-pill:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
}
.cat-filter-pill .cfp-count {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-muted);
  min-width: 18px;
  text-align: center;
}
.cat-filter-pill.active {
  color: var(--cat-color, var(--accent));
  border-color: var(--cat-color, var(--accent));
  background: color-mix(in srgb, var(--cat-color, var(--accent)) 10%, transparent);
}
.cat-filter-pill.active .cfp-count {
  background: var(--cat-color, var(--accent));
  color: #fff;
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.activity-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all .15s;
  overflow: hidden;
}
.activity-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--text-muted);
  opacity: 0;
  transition: opacity .15s;
}
.activity-card:hover {
  border-color: var(--border-input);
  transform: translateX(1px);
}
.activity-card:hover::before { opacity: 1; }
/* Barre laterale colore selon la categorie */
.activity-card:has(.cat--spark)::before { background: var(--live-spark); }
.activity-card:has(.cat--pulse)::before { background: var(--live-pulse); }
.activity-card:has(.cat--code)::before  { background: var(--live-code); }
.activity-card:has(.cat--board)::before { background: var(--live-board); }
.activity-card.closed {
  opacity: .55;
}
.activity-card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: rgba(74,144,217,.12); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background .15s, color .15s;
}
/* Teinte de l'icone selon la categorie */
.activity-card:has(.cat--spark) .activity-card-icon { background: var(--live-spark-soft); color: var(--live-spark); }
.activity-card:has(.cat--pulse) .activity-card-icon { background: var(--live-pulse-soft); color: var(--live-pulse); }
.activity-card:has(.cat--code)  .activity-card-icon { background: var(--live-code-soft);  color: var(--live-code); }
.activity-card:has(.cat--board) .activity-card-icon { background: var(--live-board-soft); color: var(--live-board); }
.activity-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.activity-card-meta {
  display: flex; align-items: center; gap: 6px;
}
.activity-card-type {
  font-size: 11px; font-weight: 600;
  color: var(--text-muted);
}
.activity-card-cat {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; padding: 1px 6px; border-radius: 8px;
}
.activity-elapsed {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 700; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.activity-topbar-cat {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; padding: 2px 8px; border-radius: 10px;
}
.cat--spark  { background: var(--live-spark-soft); color: var(--live-spark); }
.cat--pulse  { background: var(--live-pulse-soft); color: var(--live-pulse); }
.cat--code   { background: var(--live-code-soft);  color: var(--live-code); }
.cat--board  { background: var(--live-board-soft); color: var(--live-board); }
.activity-card-title {
  font-size: 14px; font-weight: 600;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.activity-card-done {
  font-size: 11px; font-weight: 600;
  color: #22c55e; background: rgba(34,197,94,.12);
  padding: 2px 8px; border-radius: 4px;
}
.activity-card-actions {
  display: flex; gap: 6px; flex-shrink: 0;
}
.btn-launch {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  background: #22c55e; color: #fff; border: none;
  cursor: pointer; transition: all .15s;
}
.btn-launch:hover { filter: brightness(1.1); }
.btn-edit-activity {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(74,144,217,.08); color: var(--accent);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.btn-edit-activity:hover { background: rgba(74,144,217,.18); }
.btn-delete-activity {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(239,68,68,.08); color: #f87171;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.btn-delete-activity:hover { background: rgba(239,68,68,.18); }
.drag-handle {
  color: var(--text-muted);
  cursor: grab;
  display: flex; align-items: center;
  flex-shrink: 0;
}
.drag-handle:active { cursor: grabbing; }
.activity-card.dragging { opacity: .4; border-style: dashed; }

/* ── Activity live (presentation) ── */
.live-activity-view {
  width: 100%;
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.activity-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
}
.activity-topbar-info {
  display: flex; align-items: center; gap: 8px;
  color: var(--accent);
}
.activity-topbar-type {
  font-size: 13px; font-weight: 700;
}
.activity-topbar-pos {
  font-size: 12px; font-weight: 700;
  padding: 3px 9px; border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
  margin-left: 4px;
}
.activity-topbar-pos .pos-sep {
  color: var(--text-muted);
  opacity: .5;
  margin: 0 2px;
}
.activity-topbar-title {
  flex: 1;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
}
.activity-topbar-actions {
  display: flex; gap: 8px; flex-shrink: 0;
}
.btn-project {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000));
  color: #fff; border: none; cursor: pointer;
  transition: all .15s, transform .1s;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 25%, transparent);
}
.btn-project:hover { filter: brightness(1.1); transform: translateY(-1px); }
.btn-project:active { transform: translateY(0); }
.btn-close-activity {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(239,68,68,.12); color: #f87171;
  border: 1px solid rgba(239,68,68,.2); cursor: pointer;
  transition: all .15s;
}
.btn-close-activity:hover { background: rgba(239,68,68,.2); }
.btn-next {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: var(--accent); color: #fff; border: none;
  cursor: pointer; transition: all .15s;
}
.btn-next:hover { filter: brightness(1.1); }
.results-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}
.results-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 18px;
  font-weight: 600;
}
.projection-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  color: rgba(255,255,255,.45);
  font-size: 22px;
  font-weight: 500;
  animation: proj-pulse 2.2s ease-in-out infinite;
}
@keyframes proj-pulse {
  0%, 100% { opacity: .5 }
  50% { opacity: 1 }
}
@media (prefers-reduced-motion: reduce) {
  .projection-waiting { animation: none; }
}
.results-waiting-icon {
  opacity: .4;
  animation: pulse-dot 2s infinite;
}

/* ── Activity live bar (timer + response count) ── */
.activity-live-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 12px 0;
}
.response-count {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary, #aaa);
}
.response-progress {
  width: 80px;
  height: 6px;
  background: rgba(255,255,255,.06);
  border-radius: 3px;
  overflow: hidden;
}
.response-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff));
  border-radius: 3px;
  transition: width .5s cubic-bezier(.25,.8,.25,1);
}
.response-median {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}
.auto-close-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-muted);
  user-select: none;
}
.auto-close-toggle input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}
.auto-close-label {
  font-weight: 600;
}

/* ── Leaderboard view ── */
.live-leaderboard-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  max-width: 560px;
  width: 100%;
  margin-top: 40px;
}
.lb-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.btn-launch-next {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: #22c55e;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-launch-next:hover { filter: brightness(1.1); }
.btn-dismiss-lb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
}
.btn-dismiss-lb:hover { filter: brightness(1.1); }

/* ── Podium view ── */
.live-podium-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  width: 100%;
  max-width: 560px;
  margin-top: 20px;
}
.btn-dismiss-podium {
  padding: 10px 32px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  transition: all .15s;
  z-index: 1;
}
.btn-dismiss-podium:hover { background: var(--bg-hover); }
</style>
