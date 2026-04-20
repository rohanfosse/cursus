import { contextBridge, ipcRenderer } from 'electron'
import { io, Socket } from 'socket.io-client'
import {
  SERVER_URL, safeAtob, setJwtToken, getJwtToken, setUnauthorizedHandler,
  get, post, put, patch, del,
} from './httpClient'
import type {
  MsgNewPayload, PresenceEntry, TypingPayload,
  LiveActivityPushedPayload, LiveActivityClosedPayload, LiveResultsUpdatePayload,
  LiveSessionStartedPayload, LiveSessionEndedPayload, LiveInvitePayload, LiveScoresUpdatePayload,
  LiveCodeUpdatePayload, LiveBoardUpdatePayload, LiveConfusionUpdatePayload, LiveSelfPacedPayload,
  BookingNewPayload, BookingCancelledPayload,
  GradeNewPayload, SignatureUpdatePayload, DocumentNewPayload, AssignmentNewPayload,
} from './socketTypes'
import * as sockEv from './socketEvents'

let socket: Socket | null = null

// Nettoyer le socket sur 401 (session expiree)
setUnauthorizedHandler(() => { socket?.disconnect() })

function connectSocket(token: string): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
  }
  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  })
  sockEv.bindSocketEvents(socket)
}

// ─── IPC local (fenêtre, dialogs, shell, fs) ─────────────────────────────────
function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args)
}

// ─── Badge barre des taches ──────────────────────────────────────────────────
function setBadge()   { ipcRenderer.send('badge:set') }
function clearBadge() { ipcRenderer.send('badge:clear') }

// ─── Exposition à la page renderer ───────────────────────────────────────────
contextBridge.exposeInMainWorld('api', {
  setBadge,
  clearBadge,

  // ── Auth / session ──────────────────────────────────────────────────────────
  setToken: (token: string) => {
    setJwtToken(token)
    connectSocket(token)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      ipcRenderer.send('auth:setUser', { id: payload.id, name: payload.name, type: payload.type, promo_id: payload.promo_id })
    } catch { /* token invalide — ignore */ }
  },

  async refreshToken(): Promise<{ token: string } | null> {
    const current = getJwtToken()
    if (!current) return null
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${current}` },
        body: '{}',
      })
      const data = await res.json()
      if (data?.ok && data.data?.token) {
        const newToken = data.data.token as string
        setJwtToken(newToken)
        connectSocket(newToken)
        try {
          const payload = JSON.parse(atob(newToken.split('.')[1]))
          ipcRenderer.send('auth:setUser', { id: payload.id, name: payload.name, type: payload.type, promo_id: payload.promo_id })
        } catch { /* ignore */ }
        return { token: newToken }
      }
      return null
    } catch { return null }
  },

  getIdentities: () => get('/api/auth/identities'),
  findUserByName: (name: string) => get(`/api/auth/find-user?name=${encodeURIComponent(name)}`),
  getTeachers: () => get('/api/auth/teachers'),

  loginWithCredentials: async (email: string, pwd: string) => {
    const res = await post('/api/auth/login', { email, password: pwd }) as { ok: boolean; data?: { token?: string; [k: string]: unknown }; error?: string }
    if (res?.ok && res.data?.token) {
      const token = res.data.token as string
      setJwtToken(token)
      connectSocket(token)
      const { token: _t, ...user } = res.data
      return { ok: true, data: { ...user, token } }
    }
    return res
  },

  changePassword: (userId: number, isTeacher: boolean, currentPwd: string, newPwd: string) =>
    post('/api/auth/change-password', { userId, isTeacher, currentPwd, newPwd }),

  exportPersonalData: (studentId: number) => get(`/api/auth/export/${studentId}`),

  getStudentByEmail: (email: string) => get(`/api/auth/student-by-email?email=${encodeURIComponent(email)}`),
  registerStudent:   (payload: unknown) => post('/api/auth/register', payload),

  importStudents: async (promoId: number, path?: string) => {
    // Si un path est fourni (drag-drop), on skippe le dialog natif.
    let filePath: string | null = path ?? null
    if (!filePath) {
      const fileRes = await invoke('dialog:openFile') as { ok: boolean; data?: string | null }
      if (!fileRes?.ok || !fileRes.data) return { ok: false, error: 'Annulé' }
      filePath = fileRes.data
    }
    const b64Res = await invoke('fs:readFileBase64', filePath) as { ok: boolean; data?: { b64: string } }
    if (!b64Res?.ok || !b64Res.data?.b64) return { ok: false, error: 'Lecture échouée' }
    const text = safeAtob(b64Res.data.b64)
    if (!text) return { ok: false, error: 'Fichier CSV invalide (décodage échoué)' }
    const lines = text.split('\n').filter((l: string) => l.trim())
    if (lines.length < 2) return { ok: false, error: 'Fichier vide' }
    const students = lines.slice(1).map((line: string) => {
      const cols = line.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''))
      return { nom: cols[0], prenom: cols[1], email: cols[2] }
    }).filter((s: { email?: string }) => s.email)
    return post('/api/students/bulk-import', { promoId, students })
  },

  bulkImportStudents: (promoId: number, rows: Record<string, string>[]) =>
    post('/api/students/bulk-import', { promoId, rows }),

  // ── Promotions & canaux ─────────────────────────────────────────────────────
  getPromotions:  ()              => get('/api/promotions'),
  createPromotion:(payload: unknown) => post('/api/promotions', payload),
  deletePromotion:(promoId: number)  => del(`/api/promotions/${promoId}`),
  renamePromotion:(promoId: number, name: string, color?: string) => patch(`/api/promotions/${promoId}`, { name, color }),

  getChannels:    (promoId: number) => get(`/api/promotions/${promoId}/channels`),
  createChannel:  (payload: unknown) => post('/api/promotions/channels', payload),
  renameChannel:  (id: number, name: string) => patch(`/api/promotions/channels/${id}/name`, { name }),
  deleteChannel:  (id: number)       => del(`/api/promotions/channels/${id}`),
  archiveChannel: (id: number)       => post(`/api/promotions/channels/${id}/archive`, {}),
  restoreChannel: (id: number)       => post(`/api/promotions/channels/${id}/restore`, {}),
  getArchivedChannels: (promoId: number) => get(`/api/promotions/${promoId}/channels/archived`),
  renameCategory: (promoId: number, old: string, next: string) =>
    post('/api/promotions/categories/rename', { promoId, old, next }),
  deleteCategory: (promoId: number, category: string) =>
    post('/api/promotions/categories/delete', { promoId, category }),
  updateChannelMembers:  (payload: unknown) => post('/api/promotions/channels/members', payload),
  updateChannelCategory: (channelId: number, category: string | null) =>
    patch(`/api/promotions/channels/${channelId}/category`, { category }),
  updateChannelPrivacy: (channelId: number, isPrivate: boolean, members?: number[]) =>
    patch(`/api/promotions/channels/${channelId}/privacy`, { isPrivate, members }),

  // ── Étudiants ───────────────────────────────────────────────────────────────
  getStudents:      (promoId: number) => get(`/api/promotions/${promoId}/students`),
  getAllStudents:    ()                => get('/api/students'),
  getStudentProfile:(studentId: number) => get(`/api/students/${studentId}/profile`),
  getStudentTravaux:(studentId: number) => get(`/api/students/${studentId}/assignments`),
  updateStudentPhoto:(payload: { studentId: number; photoData: string | null }) =>
    post('/api/students/photo', payload),
  updateTeacherPhoto:(payload: { teacherId: number; photoData: string | null }) =>
    post('/api/teachers/photo', payload),
  getClasseStats:   (promoId: number) => get(`/api/students/stats?promoId=${promoId}`),

  // ── Messages ────────────────────────────────────────────────────────────────
  getChannelMessagesPage: (channelId: number, beforeId?: number) => {
    const qs = beforeId != null ? `?before=${beforeId}` : ''
    return get(`/api/messages/channel/${channelId}/page${qs}`)
  },
  getDmMessagesPage: (studentId: number, beforeId?: number, peer?: number) => {
    const params = new URLSearchParams()
    if (beforeId != null) params.set('before', String(beforeId))
    if (peer != null) params.set('peer', String(peer))
    const qs = params.toString() ? `?${params}` : ''
    return get(`/api/messages/dm/${studentId}/page${qs}`)
  },
  getRecentDmContacts: (studentId: number, limit?: number) =>
    get(`/api/messages/dm-contacts/${studentId}?limit=${limit ?? 15}`),
  searchMessages:    (channelId: number, q: string) =>
    get(`/api/messages/search?channelId=${channelId}&q=${encodeURIComponent(q)}`),
  searchDmMessages:  (studentId: number, q: string, peer?: number) => {
    const params = new URLSearchParams({ q })
    if (peer != null) params.set('peer', String(peer))
    return get(`/api/messages/dm/${studentId}/search?${params}`)
  },
  searchAllMessages: (args: { promoId: number | null; query: string; limit?: number; userId?: number | null }) =>
    post('/api/messages/search-all', args),
  sendMessage:       (payload: unknown) => post('/api/messages', payload),
  getPinnedMessages: (channelId: number) => get(`/api/messages/pinned/${channelId}`),
  togglePinMessage:  (payload: unknown) => post('/api/messages/pin', payload),
  updateReactions:   (msgId: number, reactionsJson: string) =>
    post('/api/messages/reactions', { msgId, reactionsJson }),
  deleteMessage:  (id: number)                  => del(`/api/messages/${id}`),
  editMessage:    (id: number, content: string) => patch(`/api/messages/${id}`, { content }),
  reportMessage:  (messageId: number, reason: string) => post(`/api/messages/${messageId}/report`, { reason }),

  // Feedback
  // Rappels prof
  getTeacherReminders: () => get('/api/admin/rappels'),
  toggleReminderDone: (id: number, done: boolean) => post(`/api/admin/rappels/${id}/done`, { done }),

  submitFeedback: (type: string, title: string, description: string) =>
    post('/api/admin/feedback', { type, title, description }),
  getMyFeedback: () => get('/api/admin/feedback/mine'),

  // ── Travaux ─────────────────────────────────────────────────────────────────
  getTravaux:             (channelId: number)  => get(`/api/assignments?channelId=${channelId}`),
  getTravailById:         (travailId: number)  => get(`/api/assignments/${travailId}`),
  createTravail:          (payload: unknown)   => post('/api/assignments', payload),
  updateTravail:          (id: number, payload: unknown) => patch(`/api/assignments/${id}`, payload),
  deleteTravail:          (id: number)         => del(`/api/assignments/${id}`),
  getTravauxSuivi:        (travailId: number)  => get(`/api/assignments/${travailId}/suivi`),
  updateTravailPublished: (payload: unknown)   => post('/api/assignments/publish', payload),
  updateTravailScheduled: (payload: { travailId: number; scheduledAt: string | null }) => post('/api/assignments/schedule', payload),
  getTravailCategories:   (promoId: number)    => get(`/api/assignments/categories?promoId=${promoId}`),
  getGanttData:           (promoId: number, channelId?: number) => get(`/api/assignments/gantt?promoId=${promoId}${channelId ? `&channelId=${channelId}` : ''}`),
  getAllRendus:            (promoId: number)    => get(`/api/assignments/rendus?promoId=${promoId}`),
  getTeacherSchedule:     ()                   => get('/api/assignments/teacher-schedule'),
  markNonSubmittedAsD:    (travailId: number)  => post(`/api/assignments/${travailId}/mark-missing`, {}),
  getTravailGroupMembers: (travailId: number)  => get(`/api/assignments/${travailId}/group-members`),

  // ── Rappels enseignant ───────────────────────────────────────────────────────
  getReminders:    (promoTag?: string)          => get(`/api/assignments/reminders${promoTag ? `?promoTag=${promoTag}` : ''}`),
  createReminder:  (payload: unknown)           => post('/api/assignments/reminders', payload),
  updateReminder:  (id: number, payload: unknown) => patch(`/api/assignments/reminders/${id}`, payload),
  deleteReminder:  (id: number)                 => del(`/api/assignments/reminders/${id}`),

  // ── Calendrier (iCal sync) ─────────────────────────────────────────────────
  getCalendarFeedUrl: ()                         => `${SERVER_URL}/api/calendar/feed.ics`,
  getOutlookEvents: (from: string, to: string) => get(`/api/calendar/outlook/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  createOutlookEvent: (payload: { subject: string; startDateTime: string; endDateTime: string; body?: string; attendees?: Array<{ email: string; name?: string }>; createTeams?: boolean }) => post('/api/calendar/outlook/events', payload),
  deleteOutlookEvent: (id: string) => del(`/api/calendar/outlook/events/${encodeURIComponent(id)}`),

  // ── Dépôts ──────────────────────────────────────────────────────────────────
  getDepots:   (travailId: number) => get(`/api/depots?travailId=${travailId}`),
  addDepot:    (payload: unknown)  => post('/api/depots', payload),
  setNote:     (payload: unknown)  => post('/api/depots/note', payload),
  setFeedback: (payload: unknown)  => post('/api/depots/feedback', payload),

  // ── Groupes ─────────────────────────────────────────────────────────────────
  getGroups:       (promoId: number)  => get(`/api/groups?promoId=${promoId}`),
  createGroup:     (payload: unknown) => post('/api/groups', payload),
  getGroupMembers: (groupId: number)  => get(`/api/groups/${groupId}/members`),
  setGroupMembers: (payload: { groupId: number; studentIds: number[] }) => post(`/api/groups/${payload.groupId}/members`, payload),

  // ── Ressources ──────────────────────────────────────────────────────────────
  getRessources:  (travailId: number) => get(`/api/resources?travailId=${travailId}`),
  addRessource:   (payload: unknown)  => post('/api/resources', payload),
  deleteRessource:(id: number)        => del(`/api/resources/${id}`),

  // ── Documents ───────────────────────────────────────────────────────────────
  getChannelDocuments:          (channelId: number) => get(`/api/documents/channel/${channelId}`),
  addChannelDocument:           (payload: unknown)  => post('/api/documents/channel', payload),
  deleteChannelDocument:        (id: number)        => del(`/api/documents/channel/${id}`),
  getProjectDocuments:          (promoId: number, project?: string | null) => {
    const qs = project ? `&project=${encodeURIComponent(project)}` : ''
    return get(`/api/documents/project?promoId=${promoId}${qs}`)
  },
  addProjectDocument:           (payload: unknown)  => post('/api/documents/project', payload),
  updateProjectDocument:        (id: number, payload: unknown) => patch(`/api/documents/project/${id}`, payload),
  searchDocuments:              (promoId: number, q: string) => get(`/api/documents/search?promoId=${promoId}&q=${encodeURIComponent(q)}`),
  linkDocumentToTravail:        (docId: number, travailId: number | null) => patch(`/api/documents/link/${docId}`, { travailId }),

  // ── Cahiers (notebooks collaboratifs) ────────────────────────────────────
  getCahiers:          (promoId: number, project?: string | null) => {
    const qs = project ? `&project=${encodeURIComponent(project)}` : ''
    return get(`/api/cahiers?promoId=${promoId}${qs}`)
  },
  getCahierById:       (id: number) => get(`/api/cahiers/${id}`),
  getCahierYjsState:   (id: number) => get(`/api/cahiers/${id}/state`),
  saveCahierYjsState:  (id: number, base64State: string) => patch(`/api/cahiers/${id}/state`, { state: base64State }),
  createCahier:        (payload: unknown) => post('/api/cahiers', payload),
  renameCahier:        (id: number, title: string) => patch(`/api/cahiers/${id}`, { title }),
  deleteCahier:        (id: number) => del(`/api/cahiers/${id}`),

  // ── Intervenants ────────────────────────────────────────────────────────────
  getIntervenants:    ()                 => get('/api/teachers'),
  createIntervenant:  (payload: unknown) => post('/api/teachers', payload),
  deleteIntervenant:  (id: number)       => del(`/api/teachers/${id}`),
  getTeacherChannels: (id: number)       => get(`/api/teachers/${id}/channels`),
  setTeacherChannels: (payload: { teacherId: number; channelIds: number[] }) => post(`/api/teachers/${payload.teacherId}/channels`, payload),

  // ── Projets (entite backend) ──────────────────────────────────────────────
  getProjectsByPromo:      (promoId: number)                          => get(`/api/projects/promo/${promoId}`),
  getProjectById:          (id: number)                               => get(`/api/projects/${id}`),
  createProject:           (payload: unknown)                         => post('/api/projects', payload),
  updateProject:           (id: number, payload: unknown)             => patch(`/api/projects/${id}`, payload),
  deleteProject:           (id: number)                               => del(`/api/projects/${id}`),
  addTravailToProject:     (projectId: number, travailId: number)     => post(`/api/projects/${projectId}/travaux`, { travailId }),
  removeTravailFromProject:(projectId: number, travailId: number)     => del(`/api/projects/${projectId}/travaux/${travailId}`),
  getProjectTravaux:       (projectId: number)                        => get(`/api/projects/${projectId}/travaux`),
  getProjectDocs:          (projectId: number)                        => get(`/api/projects/${projectId}/documents`),
  assignTaToProject:       (teacherId: number, projectId: number)     => post(`/api/projects/${projectId}/tas`, { teacherId }),
  unassignTaFromProject:   (teacherId: number, projectId: number)     => del(`/api/projects/${projectId}/tas/${teacherId}`),
  getProjectTas:           (projectId: number)                        => get(`/api/projects/${projectId}/tas`),
  getTaProjects:           (teacherId: number)                        => get(`/api/projects/ta/${teacherId}`),

  // ── Rubriques ───────────────────────────────────────────────────────────────
  getRubric:      (travailId: number) => get(`/api/rubrics/${travailId}`),
  upsertRubric:   (payload: unknown)  => post('/api/rubrics', payload),
  deleteRubric:   (travailId: number) => del(`/api/rubrics/${travailId}`),
  getDepotScores: (depotId: number)   => get(`/api/rubrics/scores/${depotId}`),
  setDepotScores: (payload: unknown)  => post('/api/rubrics/scores', payload),

  // ── Live Quiz ──────────────────────────────────────────────────────────────
  createLiveSession:       (payload: unknown)  => post('/api/live/sessions', payload),
  getLiveSession:          (id: number)         => get(`/api/live/sessions/${id}`),
  getLiveSessionByCode:    (code: string)       => get(`/api/live/sessions/code/${code}`),
  getActiveLiveSession:    (promoId: number)    => get(`/api/live/sessions/promo/${promoId}/active`),
  getLiveSessionsForPromo: (promoId: number)    => get(`/api/live/sessions/promo/${promoId}`),
  cloneLiveSession:        (id: number, payload: unknown) => post(`/api/live/sessions/${id}/clone`, payload),
  reorderLiveActivities:   (sessionId: number, order: number[]) => patch(`/api/live/sessions/${sessionId}/activities/reorder`, { order }),
  updateLiveSessionStatus: (id: number, status: string) => patch(`/api/live/sessions/${id}/status`, { status }),
  deleteLiveSession:       (id: number)         => del(`/api/live/sessions/${id}`),
  addLiveActivity:         (sessionId: number, payload: unknown) => post(`/api/live/sessions/${sessionId}/activities`, payload),
  updateLiveActivity:      (id: number, payload: unknown) => patch(`/api/live/activities/${id}`, payload),
  deleteLiveActivity:      (id: number)         => del(`/api/live/activities/${id}`),
  setLiveActivityStatus:   (id: number, status: string) => patch(`/api/live/activities/${id}/status`, { status }),
  submitLiveResponse:      (activityId: number, payload: unknown) => post(`/api/live/activities/${activityId}/respond`, payload),
  getLiveActivityResults:   (activityId: number) => get(`/api/live/activities/${activityId}/results`),
  getLiveLeaderboard:       (sessionId: number)  => get(`/api/live/sessions/${sessionId}/leaderboard`),
  exportLiveSessionCsv:     (sessionId: number)  => get(`/api/live/sessions/${sessionId}/export-csv`),
  getLiveHistoryForPromo:   (promoId: number, params?: { search?: string; dateFrom?: string; dateTo?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search)   qs.set('search', params.search)
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom)
    if (params?.dateTo)   qs.set('dateTo', params.dateTo)
    const q = qs.toString()
    return get(`/api/live/sessions/promo/${promoId}/history${q ? '?' + q : ''}`)
  },
  getLiveStatsForPromo:     (promoId: number) => get(`/api/live/sessions/promo/${promoId}/stats`),

  emitLiveJoin:  (promoId: number) => { socket?.emit('live:join', { promoId }) },
  emitLiveLeave: (promoId: number) => { socket?.emit('live:leave', { promoId }) },

  onLiveActivityPushed: (cb: (data: LiveActivityPushedPayload) => void) => sockEv.liveActivityPushed.add(cb),
  onLiveActivityClosed: (cb: (data: LiveActivityClosedPayload) => void) => sockEv.liveActivityClosed.add(cb),
  onLiveResultsUpdate:  (cb: (data: LiveResultsUpdatePayload) => void) => sockEv.liveResultsUpdate.add(cb),
  onLiveSessionStarted: (cb: (data: LiveSessionStartedPayload) => void) => sockEv.liveSessionStarted.add(cb),
  onLiveSessionEnded:   (cb: (data: LiveSessionEndedPayload) => void) => sockEv.liveSessionEnded.add(cb),
  onLiveInvite:         (cb: (data: LiveInvitePayload) => void) => sockEv.liveInvite.add(cb),
  onLiveScoresUpdate:   (cb: (data: LiveScoresUpdatePayload) => void) => sockEv.liveScoresUpdate.add(cb),

  // ── Live v2 unifie (Spark + Pulse + Code + Board) ─────────────────────────
  createLiveV2Session:       (payload: unknown) => post('/api/live-v2/sessions', payload),
  getLiveV2Session:          (id: number) => get(`/api/live-v2/sessions/${id}`),
  getLiveV2SessionByCode:    (code: string) => get(`/api/live-v2/sessions/code/${code}`),
  getActiveLiveV2Session:    (promoId: number) => get(`/api/live-v2/sessions/promo/${promoId}/active`),
  getLiveV2SessionsForPromo: (promoId: number) => get(`/api/live-v2/sessions/promo/${promoId}`),
  cloneLiveV2Session:        (id: number, payload: unknown) => post(`/api/live-v2/sessions/${id}/clone`, payload),
  reorderLiveV2Activities:   (sessionId: number, order: number[]) => patch(`/api/live-v2/sessions/${sessionId}/activities/reorder`, { order }),
  updateLiveV2SessionStatus: (id: number, status: string) => patch(`/api/live-v2/sessions/${id}/status`, { status }),
  deleteLiveV2Session:       (id: number) => del(`/api/live-v2/sessions/${id}`),
  addLiveV2Activity:         (sessionId: number, payload: unknown) => post(`/api/live-v2/sessions/${sessionId}/activities`, payload),
  updateLiveV2Activity:      (id: number, payload: unknown) => patch(`/api/live-v2/activities/${id}`, payload),
  deleteLiveV2Activity:      (id: number) => del(`/api/live-v2/activities/${id}`),
  setLiveV2ActivityStatus:   (id: number, status: string, extra?: unknown) => patch(`/api/live-v2/activities/${id}/status`, { status, ...(extra as object || {}) }),
  submitLiveV2Response:      (activityId: number, payload: unknown) => post(`/api/live-v2/activities/${activityId}/respond`, payload),
  getLiveV2ActivityResults:  (activityId: number) => get(`/api/live-v2/activities/${activityId}/results`),
  getLiveV2Leaderboard:      (sessionId: number) => get(`/api/live-v2/sessions/${sessionId}/leaderboard`),
  toggleLiveV2Pin:           (responseId: number, pinned: boolean) => post(`/api/live-v2/responses/${responseId}/pin`, { pinned }),
  saveLiveV2CodeSnapshot:    (activityId: number, content: string) => patch(`/api/live-v2/activities/${activityId}/code-snapshot`, { content }),
  exportLiveV2SessionCsv:    (sessionId: number) => get(`/api/live-v2/sessions/${sessionId}/export-csv`),
  getLiveV2HistoryForPromo:  (promoId: number, params?: { search?: string; dateFrom?: string; dateTo?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search)   qs.set('search', params.search)
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom)
    if (params?.dateTo)   qs.set('dateTo', params.dateTo)
    const q = qs.toString()
    return get(`/api/live-v2/sessions/promo/${promoId}/history${q ? '?' + q : ''}`)
  },
  getLiveV2StatsForPromo:    (promoId: number) => get(`/api/live-v2/sessions/promo/${promoId}/stats`),
  // Board
  getLiveV2BoardCards:  (activityId: number) => get(`/api/live-v2/activities/${activityId}/cards`),
  addLiveV2BoardCard:   (activityId: number, payload: unknown) => post(`/api/live-v2/activities/${activityId}/cards`, payload),
  updateLiveV2BoardCard: (cardId: number, payload: unknown) => patch(`/api/live-v2/cards/${cardId}`, payload),
  deleteLiveV2BoardCard:(cardId: number) => del(`/api/live-v2/cards/${cardId}`),
  voteLiveV2BoardCard:  (cardId: number, vote: boolean) => post(`/api/live-v2/cards/${cardId}/vote`, { vote }),
  hideLiveV2BoardCard:  (cardId: number, hidden: boolean) => patch(`/api/live-v2/cards/${cardId}/hide`, { hidden }),
  // Self-paced
  toggleLiveV2SelfPaced: (sessionId: number, selfPaced: boolean) => patch(`/api/live-v2/sessions/${sessionId}/self-paced`, { selfPaced }),
  launchAllLiveV2:       (sessionId: number) => post(`/api/live-v2/sessions/${sessionId}/launch-all`, {}),
  getLiveV2Progress:     (sessionId: number) => get(`/api/live-v2/sessions/${sessionId}/progress`),
  getLiveV2MyResponses:  (sessionId: number) => get(`/api/live-v2/sessions/${sessionId}/my-responses`),
  // Confusion signal
  sendConfusionSignal:   (sessionId: number, active: boolean) => post(`/api/live-v2/sessions/${sessionId}/confused`, { active }),
  getConfusionCount:     (sessionId: number) => get(`/api/live-v2/sessions/${sessionId}/confused`),

  // ── Booking (mini-Calendly) ─────────────────────────────────────────────
  getBookingEventTypes:      ()                          => get('/api/bookings/event-types'),
  createBookingEventType:    (payload: unknown)          => post('/api/bookings/event-types', payload),
  updateBookingEventType:    (id: number, payload: unknown) => patch(`/api/bookings/event-types/${id}`, payload),
  deleteBookingEventType:    (id: number)                => del(`/api/bookings/event-types/${id}`),
  getBookingAvailability:    ()                          => get('/api/bookings/availability'),
  setBookingAvailability:    (rules: unknown)            => put('/api/bookings/availability', { rules }),
  createBookingToken:        (eventTypeId: number, studentId: number) => post('/api/bookings/tokens', { eventTypeId, studentId }),
  createBulkBookingTokens:   (eventTypeId: number, promoId: number) => post('/api/bookings/tokens/bulk', { eventTypeId, promoId }),
  getMyBookings:             (from?: string, to?: string) => {
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    const q = qs.toString()
    return get(`/api/bookings/my-bookings${q ? '?' + q : ''}`)
  },
  startBookingOAuth:         ()                          => get('/api/bookings/oauth/start'),
  getBookingOAuthStatus:     ()                          => get('/api/bookings/oauth/status'),
  disconnectBookingOAuth:    ()                          => del('/api/bookings/oauth/disconnect'),

  // ── Calendar iCal feed (abonnement externe Google/Outlook/Apple) ──────────
  getCalendarFeedToken:      ()                          => get('/api/calendar/feed-token'),
  rotateCalendarFeedToken:   ()                          => post('/api/calendar/feed-token', {}),
  revokeCalendarFeedToken:   ()                          => del('/api/calendar/feed-token'),

  // ── TypeRace (mini-jeu typing speed + leaderboard) ────────────────────────
  typeRaceRandomPhrase:   (excludeIds: number[] = []) => {
    const q = excludeIds.length ? `?exclude=${excludeIds.join(',')}` : ''
    return get(`/api/typerace/phrases/random${q}`)
  },
  typeRaceSubmitScore:    (payload: { phraseId: number; wpm: number; accuracy: number; durationMs: number }) =>
    post('/api/typerace/scores', payload),
  typeRaceLeaderboard:    (scope: 'day' | 'week' | 'all' = 'day', promoId?: number | null) => {
    const params = new URLSearchParams({ scope })
    if (promoId != null) params.set('promoId', String(promoId))
    return get(`/api/typerace/leaderboard?${params.toString()}`)
  },
  typeRaceMyStats:        ()                             => get('/api/typerace/me'),

  // ── Arcade games generiques (Snake, Space Invaders, Pacman, ...) ──────────
  gameSubmitScore: (gameId: string, payload: { score: number; durationMs: number; meta?: Record<string, unknown> }) =>
    post(`/api/games/${gameId}/scores`, payload),
  gameLeaderboard: (gameId: string, scope: 'day' | 'week' | 'all' = 'day', promoId?: number | null) => {
    const params = new URLSearchParams({ scope })
    if (promoId != null) params.set('promoId', String(promoId))
    return get(`/api/games/${gameId}/leaderboard?${params.toString()}`)
  },
  gameMyStats:     (gameId: string)                      => get(`/api/games/${gameId}/me`),

  emitLiveCodeUpdate: (activityId: number, promoId: number, content: string, language: string | null) => {
    socket?.emit('live:code-update', { activityId, promoId, content, language })
  },
  onLiveCodeUpdate:      (cb: (data: LiveCodeUpdatePayload) => void) => sockEv.liveCodeUpdate.add(cb),
  onLiveBoardUpdate:     (cb: (data: LiveBoardUpdatePayload) => void) => sockEv.liveBoardUpdate.add(cb),
  onLiveConfusionUpdate: (cb: (data: LiveConfusionUpdatePayload) => void) => sockEv.liveConfusion.add(cb),
  onLiveSelfPacedUpdate: (cb: (data: LiveSelfPacedPayload) => void) => sockEv.liveSelfPaced.add(cb),

  // ── Booking real-time ────────────────────────────────────────────────────────
  onBookingNew:       (cb: (data: BookingNewPayload) => void) => sockEv.bookingNew.add(cb),
  onBookingCancelled: (cb: (data: BookingCancelledPayload) => void) => sockEv.bookingCancelled.add(cb),

  // ── Lumen (liseuse cours GitHub) ───────────────────────────────────────────
  // GitHub auth
  getLumenGithubStatus:     ()                      => get('/api/lumen/github/me'),
  connectLumenGithub:       (token: string)         => post('/api/lumen/github/connect', { token }),
  disconnectLumenGithub:    ()                      => del('/api/lumen/github/disconnect'),

  // Promo <-> org mapping
  getLumenPromoOrg:         (promoId: number)       => get(`/api/lumen/promos/${promoId}/github-org`),
  setLumenPromoOrg:         (promoId: number, org: string | null) =>
    put(`/api/lumen/promos/${promoId}/github-org`, { org }),

  // Repos
  getLumenReposForPromo:    (promoId: number)       => get(`/api/lumen/repos/promo/${promoId}`),
  syncLumenReposForPromo:   (promoId: number)       => post(`/api/lumen/repos/sync/promo/${promoId}`, {}),
  getLumenRepo:             (id: number)            => get(`/api/lumen/repos/${id}`),
  createLumenRepoFromScaffold: (promoId: number, slug: string, blocTitle: string) =>
    post(`/api/lumen/promos/${promoId}/repos`, { slug, blocTitle }),
  searchLumenChapters: (promoId: number, q: string, limit?: number) => {
    const params = new URLSearchParams({ q })
    if (limit) params.set('limit', String(limit))
    return get(`/api/lumen/promos/${promoId}/search?${params.toString()}`)
  },

  // Integration projets Cursus
  getLumenReposByProjectName: (promoId: number, name: string) =>
    get(`/api/lumen/repos/by-project-name?promoId=${promoId}&name=${encodeURIComponent(name)}`),
  getLumenUnlinkedReposForPromo: (promoId: number) =>
    get(`/api/lumen/repos/promo/${promoId}/unlinked`),
  setLumenRepoProject:      (repoId: number, projectId: number | null) =>
    put(`/api/lumen/repos/${repoId}/project`, { projectId }),
  setLumenRepoVisibility:   (repoId: number, visible: boolean) =>
    put(`/api/lumen/repos/${repoId}/visibility`, { visible }),

  // Integration devoirs <-> chapitres
  getLumenTravauxForChapter: (repoId: number, path: string) =>
    get(`/api/lumen/repos/${repoId}/chapters/travaux?path=${encodeURIComponent(path)}`),
  getLumenChaptersForTravail: (travailId: number) =>
    get(`/api/lumen/travaux/${travailId}/chapters`),
  linkLumenChapterToTravail: (travailId: number, repoId: number, chapterPath: string) =>
    post('/api/lumen/chapters/travaux', { travailId, repoId, chapterPath }),
  unlinkLumenChapterFromTravail: (travailId: number, repoId: number, chapterPath: string) =>
    del('/api/lumen/chapters/travaux', { travailId, repoId, chapterPath }),

  // Chapitres
  getLumenChapterContent:   (repoId: number, path: string) =>
    get(`/api/lumen/repos/${repoId}/content?path=${encodeURIComponent(path)}`),

  // Edition de chapitre (v2.67) — teacher / admin only.
  // updateLumenChapterFile : modifie un fichier existant. SHA requis.
  // createLumenChapterFile : cree un nouveau fichier. Pas de SHA.
  updateLumenChapterFile: (
    repoId: number,
    body: { path: string; content: string; sha: string; message?: string },
  ) => put(`/api/lumen/repos/${repoId}/file`, body),
  createLumenChapterFile: (
    repoId: number,
    body: { path: string; content: string; message?: string },
  ) => post(`/api/lumen/repos/${repoId}/file`, body),

  // Tracking lecture
  markLumenChapterRead:     (repoId: number, path: string) =>
    post(`/api/lumen/repos/${repoId}/read`, { path }),
  getLumenMyReads:          ()                      => get('/api/lumen/my-reads'),
  getLumenReadCountsForRepo:(repoId: number)        => get(`/api/lumen/repos/${repoId}/read-counts`),
  getLumenReadCountsForPromo:(promoId: number)      => get(`/api/lumen/read-counts/promo/${promoId}`),

  // Notes privees etudiant
  getLumenChapterNote:      (repoId: number, path: string) =>
    get(`/api/lumen/repos/${repoId}/note?path=${encodeURIComponent(path)}`),
  saveLumenChapterNote:     (repoId: number, path: string, content: string) =>
    put(`/api/lumen/repos/${repoId}/note`, { path, content }),
  deleteLumenChapterNote:   (repoId: number, path: string) =>
    del(`/api/lumen/repos/${repoId}/note`, { path }),
  getLumenMyNotes:          ()                      => get('/api/lumen/my-notes'),
  getLumenMyNotedChapters:  ()                      => get('/api/lumen/my-noted-chapters'),

  // Stats (prof)
  getLumenStatsForPromo:    (promoId: number)       => get(`/api/lumen/stats/promo/${promoId}`),

  // Export notes en markdown local via save dialog Electron
  downloadLumenNotesExport: async () => {
    try {
      const resp = await get('/api/lumen/my-notes') as { ok: boolean; data?: { notes: Array<{ owner: string; repo: string; path: string; content: string; manifest_json: string | null }> } }
      if (!resp?.ok) return { ok: false, error: 'Impossible de recuperer les notes' }
      const notes = resp.data?.notes ?? []
      if (!notes.length) return { ok: false, error: 'Aucune note a exporter' }
      const md = notes.map((n) => {
        let title = n.path
        try {
          const m = JSON.parse(n.manifest_json ?? 'null')
          const ch = m?.chapters?.find((c: { path: string; title: string }) => c.path === n.path)
          if (ch?.title) title = ch.title
        } catch { /* fallback sur path */ }
        return `## ${n.owner}/${n.repo} — ${title}\n\n${n.content}\n`
      }).join('\n---\n\n')
      return await ipcRenderer.invoke('lumen:saveNotesMarkdown', {
        content: `# Mes notes Lumen\n\n${md}`,
        suggestedName: 'mes-notes-lumen.md',
      }) as { ok: boolean; data?: { filename: string; path: string } | null; error?: string }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erreur export notes' }
    }
  },

  // ── Kanban ─────────────────────────────────────────────────────────────────
  getKanbanCards:   (travailId: number, groupId: number)                       => get(`/api/kanban/travaux/${travailId}/groups/${groupId}`),
  createKanbanCard: (travailId: number, groupId: number, payload: unknown)     => post(`/api/kanban/travaux/${travailId}/groups/${groupId}`, payload),
  updateKanbanCard: (cardId: number, payload: unknown)                         => patch(`/api/kanban/cards/${cardId}`, payload),
  deleteKanbanCard: (cardId: number)                                           => del(`/api/kanban/cards/${cardId}`),

  // ── Carnet de suivi ──────────────────────────────────────────────────────
  getDmFiles: () => get('/api/messages/dm-files'),

  getTeacherNotes:        (studentId: number) => get(`/api/teacher-notes/student/${studentId}`),
  getTeacherNotesByPromo: (promoId: number)   => get(`/api/teacher-notes/promo/${promoId}`),
  getTeacherNotesSummary: (promoId: number)   => get(`/api/teacher-notes/promo/${promoId}/summary`),
  createTeacherNote:      (payload: unknown)  => post('/api/teacher-notes', payload),
  updateTeacherNote:      (id: number, payload: unknown) => patch(`/api/teacher-notes/${id}`, payload),
  deleteTeacherNote:      (id: number)        => del(`/api/teacher-notes/${id}`),

  // ── Engagement analytics ─────────────────────────────────────────────────
  getEngagementScores: (promoId: number) => get(`/api/engagement/${promoId}`),

  // ── Modules enrichissement (enable/disable) ─────────────────────────────
  getModules: () => get('/api/admin/modules'),
  setModuleEnabled: (module: string, enabled: boolean) => post('/api/admin/modules', { module, enabled }),

  // ── Signatures ──────────────────────────────────────────────────────────
  createSignatureRequest: (data: { message_id: number; dm_student_id: number; file_url: string; file_name: string }) =>
    post('/api/signatures', data),
  getSignatureRequests: (status?: string) =>
    get(status ? `/api/signatures?status=${status}` : '/api/signatures'),
  getPendingSignatureCount: () => get('/api/signatures/pending-count'),
  getSignatureByMessage: (messageId: number) => get(`/api/signatures/by-message/${messageId}`),
  signDocument: (id: number, signatureImage: string) =>
    post(`/api/signatures/${id}/sign`, { signature_image: signatureImage }),
  rejectSignature: (id: number, reason: string) =>
    post(`/api/signatures/${id}/reject`, { reason }),

  // ── Grade notifications ─────────────────────────────────────────────────────
  onGradeNew: (cb: (data: GradeNewPayload) => void) => sockEv.gradeNew.add(cb),

  // ── Signature notifications ──────────────────────────────────────────────────
  onSignatureUpdate: (cb: (data: SignatureUpdatePayload) => void) => sockEv.signatureUpdate.add(cb),

  // ── Document & assignment notifications ────────────────────────────────────
  onDocumentNew:   (cb: (data: DocumentNewPayload) => void) => sockEv.documentNew.add(cb),
  onAssignmentNew: (cb: (data: AssignmentNewPayload) => void) => sockEv.assignmentNew.add(cb),

  // ── Admin ────────────────────────────────────────────────────────────────────
  resetAndSeed: () => post('/api/admin/reset-seed', {}),

  // ── Shell ───────────────────────────────────────────────────────────────────
  openPath: async (filePath: string) => {
    if (filePath.startsWith('http://') || filePath.startsWith('https://'))
      return invoke('shell:openExternal', filePath)
    return invoke('shell:openPath', filePath)
  },
  openExternal: (url: string) => invoke('shell:openExternal', url),

  // ── Fichiers & export (dialogue OS) ──────────────────────────────────────────
  openImageDialog: () => invoke('dialog:openImage'),
  openFileDialog:  () => invoke('dialog:openFile'),
  exportCsv:       (travailId: number) => invoke('export:csv', travailId),

  // Upload d'un fichier local vers le serveur → retourne l'URL publique + taille
  uploadFile: async (localPath: string) => {
    const b64Res = await invoke('fs:readFileBase64', localPath) as { ok: boolean; data?: { b64: string; mime: string; ext: string } }
    if (!b64Res?.ok || !b64Res.data) return b64Res
    const { b64, mime, ext } = b64Res.data
    const fileName = localPath.split(/[/\\]/).pop() ?? `file.${ext}`
    const byteChars = safeAtob(b64)
    if (!byteChars) return { ok: false, error: 'Fichier corrompu (décodage échoué)' }
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    const formData = new FormData()
    formData.append('file', blob, fileName)
    try {
      const token = getJwtToken()
      const res = await fetch(`${SERVER_URL}/api/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const json = await res.json() as { ok: boolean; data?: string; file_size?: number; error?: string }
      if (json.ok && json.data) {
        return { ok: true, data: { url: `${SERVER_URL}${json.data}`, file_size: json.file_size } }
      }
      return { ok: false, error: json.error ?? 'Upload échoué' }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },

  // Lecture base64 : supporte les URLs serveur en plus des chemins locaux
  readFileBase64: async (filePath: string) => {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      try {
        const token = getJwtToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res  = await fetch(filePath, { headers })
        if (!res.ok) {
          return { ok: false, error: `HTTP ${res.status} ${res.statusText} — ${filePath}` }
        }
        const blob = await res.blob()
        // MIME prioritaire : Content-Type du serveur. Sinon devine par extension.
        const ext  = filePath.split('/').pop()?.split('.').pop()?.toLowerCase() ?? 'bin'
        const extMime: Record<string, string> = {
          pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
          mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          txt: 'text/plain', csv: 'text/csv', md: 'text/markdown',
        }
        const guessedMime = extMime[ext] ?? blob.type ?? 'application/octet-stream'
        const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : guessedMime
        return new Promise<unknown>((resolve) => {
          const reader = new FileReader()
          reader.onload  = () => {
            const b64 = (reader.result as string).split(',')[1] ?? ''
            if (!b64) {
              resolve({ ok: false, error: 'Fichier vide ou base64 invalide.' })
              return
            }
            resolve({ ok: true, data: { b64, mime, ext } })
          }
          reader.onerror = () => resolve({ ok: false, error: 'Lecture distante échouée (FileReader).' })
          reader.readAsDataURL(blob)
        })
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    }
    return invoke('fs:readFileBase64', filePath)
  },

  // Téléchargement : ouvre l'URL dans le navigateur si c'est une URL serveur
  downloadFile: async (filePath: string) => {
    if (filePath.startsWith('http://') || filePath.startsWith('https://'))
      return invoke('shell:openExternal', filePath)
    return invoke('fs:downloadFile', filePath)
  },

  // ── Contrôles de fenêtre ─────────────────────────────────────────────────────
  windowMinimize:    () => invoke('window:minimize'),
  windowMaximize:    () => invoke('window:maximize'),
  windowClose:       () => invoke('window:close'),
  windowIsMaximized: () => invoke('window:isMaximized'),

  onMaximizeChange: (cb: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized)
    ipcRenderer.on('window:maximizeState', listener)
    return () => ipcRenderer.removeListener('window:maximizeState', listener)
  },

  platform: process.platform,

  // ── Auto-update ──────────────────────────────────────────────────────────────
  onUpdaterAvailable: (cb: (version: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, version: string) => cb(version)
    ipcRenderer.on('updater:available', listener)
    return () => ipcRenderer.removeListener('updater:available', listener)
  },
  onUpdaterDownloaded: (cb: (version: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, version: string) => cb(version)
    ipcRenderer.on('updater:downloaded', listener)
    return () => ipcRenderer.removeListener('updater:downloaded', listener)
  },
  onUpdaterProgress: (cb: (percent: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, percent: number) => cb(percent)
    ipcRenderer.on('updater:progress', listener)
    return () => ipcRenderer.removeListener('updater:progress', listener)
  },
  onUpdaterError: (cb: (error: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error: string) => cb(error)
    ipcRenderer.on('updater:error', listener)
    return () => ipcRenderer.removeListener('updater:error', listener)
  },
  updaterQuitAndInstall: () => ipcRenderer.send('updater:quitAndInstall'),
  checkForUpdates: () => ipcRenderer.invoke('updater:checkNow'),

  // ── Onboarding wizard ───────────────────────────────────────────────────────
  getOnboardingStatus: (studentId: number) => ipcRenderer.invoke('get-onboarding-status', { studentId }),
  completeOnboarding: (studentId: number) => ipcRenderer.invoke('complete-onboarding', { studentId }),

  // ── Cache offline ───────────────────────────────────────────────────────────
  offlineWrite: (key: string, data: unknown) => ipcRenderer.invoke('offline:write', key, data),
  offlineRead:  (key: string) => ipcRenderer.invoke('offline:read', key),
  offlineClear: () => ipcRenderer.invoke('offline:clear'),

  // ── Temps reel (Socket.io) ───────────────────────────────────────────────────
  onNewMessage:        (cb: (data: MsgNewPayload) => void) => sockEv.msgNew.add(cb),
  onSocketStateChange: (cb: (connected: boolean) => void) => sockEv.socketState.add(cb),
  onPresenceUpdate:    (cb: (data: PresenceEntry[]) => void) => sockEv.presenceUpdate.add(cb),

  // Typing indicator
  emitTyping:   (channelId: number) => { socket?.emit('typing', { channelId }) },
  emitDmTyping: (dmStudentId: number, dmPeerId?: number) => { socket?.emit('typing', { dmStudentId, dmPeerId }) },
  onTyping:     (cb: (data: TypingPayload) => void) => sockEv.typing.add(cb),
})
