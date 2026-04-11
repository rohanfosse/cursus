// ─── Shim window.api pour le build web (sans Electron) ───────────────────────
// Implémente exactement la même interface que src/preload/index.ts,
// en remplaçant les appels IPC par fetch + socket.io + APIs browser natives.

import { io, Socket } from 'socket.io-client'

// ─── Config ──────────────────────────────────────────────────────────────────
const SERVER_URL: string = import.meta.env.VITE_SERVER_URL
  || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://app.cursus.school')

// ─── État ────────────────────────────────────────────────────────────────────
let jwtToken: string | null = null
let socket:   Socket | null = null

type MsgNewPayload = {
  channelId: number | null; dmStudentId: number | null; authorName: string | null
  channelName: string | null; promoId: number | null; preview: string | null
  mentionEveryone: boolean; mentionNames: string[]
}
const msgCallbacks: Array<(data: MsgNewPayload) => void> = []
const socketStateCallbacks: Array<(connected: boolean) => void> = []
const typingCallbacks: Array<(data: { channelId: number; userName: string }) => void> = []
type PresenceEntry = { id: number; name: string; role: string }
const presenceCallbacks: Array<(data: PresenceEntry[]) => void> = []

// Live quiz callbacks
type LiveActivityPushedPayload = { activity: unknown }
type LiveActivityClosedPayload = { activityId: number }
type LiveResultsUpdatePayload  = { activityId: number; data: unknown }
type LiveSessionStartedPayload = { sessionId: number }
type LiveSessionEndedPayload   = { sessionId: number }
type LiveInvitePayload         = { sessionId: number; title: string; joinCode: string; teacherName: string }
type LiveScoresUpdatePayload   = { sessionId: number; activityId: number; leaderboard: unknown[] }
const liveActivityPushedCallbacks: Array<(data: LiveActivityPushedPayload) => void> = []
const liveActivityClosedCallbacks: Array<(data: LiveActivityClosedPayload) => void> = []
const liveResultsUpdateCallbacks:  Array<(data: LiveResultsUpdatePayload) => void> = []
const liveSessionStartedCallbacks: Array<(data: LiveSessionStartedPayload) => void> = []
const liveSessionEndedCallbacks:   Array<(data: LiveSessionEndedPayload) => void> = []
const liveInviteCallbacks:         Array<(data: LiveInvitePayload) => void> = []
const liveScoresUpdateCallbacks:   Array<(data: LiveScoresUpdatePayload) => void> = []

// REX callbacks
type RexActivityPushedPayload = { activity: unknown }
type RexActivityClosedPayload = { activityId: number }
type RexResultsUpdatePayload  = { activityId: number; data: unknown }
type RexSessionStartedPayload = { sessionId: number }
type RexSessionEndedPayload   = { sessionId: number }
type RexInvitePayload         = { sessionId: number; title: string; joinCode: string; teacherName: string }
const rexActivityPushedCallbacks: Array<(data: RexActivityPushedPayload) => void> = []
const rexActivityClosedCallbacks: Array<(data: RexActivityClosedPayload) => void> = []
const rexResultsUpdateCallbacks:  Array<(data: RexResultsUpdatePayload) => void> = []
const rexSessionStartedCallbacks: Array<(data: RexSessionStartedPayload) => void> = []
const rexSessionEndedCallbacks:   Array<(data: RexSessionEndedPayload) => void> = []
const rexInviteCallbacks:         Array<(data: RexInvitePayload) => void> = []

// Grade notification callbacks
type GradeNewPayload = { devoirTitle: string; note: string | null; feedback: string | null; devoirId: number; category: string | null }
const gradeNewCallbacks: Array<(data: GradeNewPayload) => void> = []

// Cache pour les fichiers ouverts via <input type="file">
// Clé : pseudo-path "__web__<timestamp>", valeur : données du fichier
const fileCache = new Map<string, { mime: string; b64: string; ext: string; name: string }>()

// ─── Socket.io ───────────────────────────────────────────────────────────────
function connectSocket(token: string): void {
  socket?.disconnect()
  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  })
  socket.on('msg:new', (data: MsgNewPayload) => msgCallbacks.forEach(cb => cb(data)))
  socket.on('typing', (data: { channelId: number; userName: string }) => typingCallbacks.forEach(cb => cb(data)))
  socket.on('presence:update', (data: PresenceEntry[]) => presenceCallbacks.forEach(cb => cb(data)))
  socket.on('live:activity-pushed', (data: LiveActivityPushedPayload) => liveActivityPushedCallbacks.forEach(cb => cb(data)))
  socket.on('live:activity-closed', (data: LiveActivityClosedPayload) => liveActivityClosedCallbacks.forEach(cb => cb(data)))
  socket.on('live:results-update',  (data: LiveResultsUpdatePayload) => liveResultsUpdateCallbacks.forEach(cb => cb(data)))
  socket.on('live:session-started', (data: LiveSessionStartedPayload) => liveSessionStartedCallbacks.forEach(cb => cb(data)))
  socket.on('live:session-ended',   (data: LiveSessionEndedPayload) => liveSessionEndedCallbacks.forEach(cb => cb(data)))
  socket.on('live:invite',          (data: LiveInvitePayload) => liveInviteCallbacks.forEach(cb => cb(data)))
  socket.on('live:scores-update',  (data: LiveScoresUpdatePayload) => liveScoresUpdateCallbacks.forEach(cb => cb(data)))
  socket.on('rex:activity-pushed', (data: RexActivityPushedPayload) => rexActivityPushedCallbacks.forEach(cb => cb(data)))
  socket.on('rex:activity-closed', (data: RexActivityClosedPayload) => rexActivityClosedCallbacks.forEach(cb => cb(data)))
  socket.on('rex:results-update',  (data: RexResultsUpdatePayload) => rexResultsUpdateCallbacks.forEach(cb => cb(data)))
  socket.on('rex:session-started', (data: RexSessionStartedPayload) => rexSessionStartedCallbacks.forEach(cb => cb(data)))
  socket.on('rex:session-ended',   (data: RexSessionEndedPayload) => rexSessionEndedCallbacks.forEach(cb => cb(data)))
  socket.on('rex:invite',          (data: RexInvitePayload) => rexInviteCallbacks.forEach(cb => cb(data)))
  socket.on('grade:new',           (data: GradeNewPayload) => gradeNewCallbacks.forEach(cb => cb(data)))
  socket.on('connect', () => socketStateCallbacks.forEach(cb => cb(true)))
  socket.on('disconnect', () => socketStateCallbacks.forEach(cb => cb(false)))
  socket.on('connect_error', (err) => {
    console.warn('[Socket.io]', err.message)
    socketStateCallbacks.forEach(cb => cb(false))
  })
}

// ─── fetch helpers (avec timeout, retry, 401 handling) ───────────────────────
const FETCH_TIMEOUT = 15_000
const MAX_RETRIES   = 2

async function apiFetch(path: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
      const res = await fetch(`${SERVER_URL}${path}`, { ...options, headers, signal: ctrl.signal })
      clearTimeout(timer)
      if (res.status === 401 && !path.startsWith('/api/auth/login')) {
        jwtToken = null
        socket?.disconnect()
        window.dispatchEvent(new CustomEvent('cursus:auth-expired'))
        return { ok: false, error: 'Session expirée. Veuillez vous reconnecter.' }
      }
      try {
        return await res.json()
      } catch {
        return { ok: false, error: 'Réponse serveur invalide (JSON attendu)' }
      }
    } catch (e: unknown) {
      const isAbort = e instanceof Error && e.name === 'AbortError'
      if (attempt === retries) {
        console.warn(`[API] ${path} échoué après ${retries + 1} tentative(s):`, isAbort ? 'timeout' : (e as Error).message)
        return { ok: false, error: isAbort ? 'Délai d\'attente dépassé' : 'Erreur réseau - vérifiez votre connexion' }
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return { ok: false, error: 'Erreur réseau' }
}

const get  = (p: string)              => apiFetch(p)
const post = (p: string, b: unknown)  => apiFetch(p, { method: 'POST',   body: JSON.stringify(b) })
const put  = (p: string, b: unknown)  => apiFetch(p, { method: 'PUT',    body: JSON.stringify(b) })
const patch = (p: string, b: unknown) => apiFetch(p, { method: 'PATCH',  body: JSON.stringify(b) })
const del  = (p: string, b?: unknown) => apiFetch(p, b !== undefined
  ? { method: 'DELETE', body: JSON.stringify(b) }
  : { method: 'DELETE' })

// ─── Utilitaires browser ─────────────────────────────────────────────────────

/** Ouvre un sélecteur de fichier et résout avec le(s) File sélectionné(s) (ou null). */
function pickFile(accept = '*', multiple = false): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = accept
    if (multiple) input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => { document.body.removeChild(input); resolve(input.files?.[0] ?? null) }
    input.oncancel = () => { document.body.removeChild(input); resolve(null) }
    input.click()
  })
}

/** Ouvre un sélecteur multi-fichiers et résout avec les Files sélectionnés (ou null). */
function pickFiles(accept = '*'): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type     = 'file'
    input.accept   = accept
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => { document.body.removeChild(input); resolve(input.files?.length ? Array.from(input.files) : null) }
    input.oncancel = () => { document.body.removeChild(input); resolve(null) }
    input.click()
  })
}

/** Lit un File comme base64 + mime. */
function fileToBase64(file: File): Promise<{ mime: string; b64: string; ext: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => {
      const dataUrl = reader.result as string
      const b64  = dataUrl.split(',')[1] ?? ''
      const mime = file.type || 'application/octet-stream'
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? ''
      resolve({ mime, b64, ext })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Déclenche un téléchargement browser depuis un Blob. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Génère et télécharge le CSV des notes d'un travail (côté client). */
async function exportCsvBrowser(travailId: number): Promise<unknown> {
  const [travailRes, depotsRes] = await Promise.all([
    get(`/api/assignments/${travailId}`),
    get(`/api/depots?travailId=${travailId}`),
  ]) as [{ ok: boolean; data: { title: string } }, { ok: boolean; data: unknown[] }]

  if (!travailRes.ok) return { ok: false, error: 'Travail introuvable.' }

  const depots = depotsRes.data as Array<{
    student_name: string; note: number | null; feedback: string | null
    submitted_at: string | null; type: string | null; link_url: string | null; file_name: string | null
  }>

  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const headers = ['Étudiant', 'Note', 'Feedback', 'Soumis le', 'Type', 'Fichier / Lien']
  const rows = depots.map(d => [
    esc(d.student_name), esc(d.note ?? ''), esc(d.feedback ?? ''),
    esc(d.submitted_at ?? ''), esc(d.type ?? ''),
    esc(d.type === 'link' ? (d.link_url ?? '') : (d.file_name ?? '')),
  ])
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n')
  const safeName = travailRes.data.title.replace(/[\\/:*?"<>|]/g, '_')

  triggerDownload(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
    `notes_${safeName}.csv`,
  )
  return { ok: true, data: `notes_${safeName}.csv` }
}

/** Parse et importe un CSV étudiant (remplace le handler IPC). */
async function importStudentsBrowser(promoId: number): Promise<unknown> {
  const file = await pickFile('.csv,.txt')
  if (!file) return { ok: true, data: null }
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: 'Fichier trop volumineux (max 10 Mo).' }

  const raw  = (await file.text()).replace(/^\uFEFF/, '')
  const sep  = raw.includes(';') ? ';' : ','
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return { ok: false, error: 'Fichier CSV vide ou sans données.' }

  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = cols[j] ?? '' })
    rows.push(row)
  }
  return post('/api/students/bulk-import', { promoId, rows })
}

// ─── Exposition de window.api ─────────────────────────────────────────────────
;(window as unknown as { api: unknown }).api = {

  // ── Badge (no-op en web) ────────────────────────────────────────────────────
  setBadge() {},
  clearBadge() {},

  // ── Auth / session ──────────────────────────────────────────────────────────
  setToken(token: string) { jwtToken = token; connectSocket(token) },

  async refreshToken() {
    const res = await post('/api/auth/refresh', {}) as { ok: boolean; data?: { token?: string } }
    if (res?.ok && res.data?.token) {
      jwtToken = res.data.token
      return { token: res.data.token }
    }
    return null
  },

  getIdentities: () => get('/api/auth/identities'),
  findUserByName: (name: string) => get(`/api/auth/find-user?name=${encodeURIComponent(name)}`),
  getTeachers: () => get('/api/auth/teachers'),

  async loginWithCredentials(email: string, pwd: string) {
    const res = await post('/api/auth/login', { email, password: pwd }) as { ok: boolean; data?: { token?: string; [k: string]: unknown }; error?: string }
    if (res?.ok && res.data?.token) {
      jwtToken = res.data.token as string
      connectSocket(jwtToken)
    }
    return res
  },

  changePassword:    (userId: number, isTeacher: boolean, currentPwd: string, newPwd: string) =>
    post('/api/auth/change-password', { userId, isTeacher, currentPwd, newPwd }),
  exportPersonalData:(studentId: number) => get(`/api/auth/export/${studentId}`),
  getStudentByEmail: (email: string)     => get(`/api/auth/student-by-email?email=${encodeURIComponent(email)}`),
  registerStudent:   (payload: unknown)  => post('/api/auth/register', payload),

  // ── Promotions & canaux ─────────────────────────────────────────────────────
  getPromotions:  () => get('/api/promotions'),
  createPromotion:(payload: unknown) => post('/api/promotions', payload),
  deletePromotion:(promoId: number)  => del(`/api/promotions/${promoId}`),
  renamePromotion:(promoId: number, name: string, color?: string) => patch(`/api/promotions/${promoId}`, { name, color }),
  getChannels:    (promoId: number)  => get(`/api/promotions/${promoId}/channels`),
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
  getStudents:      (promoId: number)   => get(`/api/promotions/${promoId}/students`),
  getAllStudents:    ()                  => get('/api/students'),
  getStudentProfile:(studentId: number) => get(`/api/students/${studentId}/profile`),
  getStudentTravaux:(studentId: number) => get(`/api/students/${studentId}/assignments`),
  updateStudentPhoto:(payload: { studentId: number; photoData: string | null }) =>
    post('/api/students/photo', payload),
  updateTeacherPhoto:(payload: { teacherId: number; photoData: string | null }) =>
    post('/api/teachers/photo', payload),
  getClasseStats:   (promoId: number)   => get(`/api/students/stats?promoId=${promoId}`),

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
  getTravaux:             (channelId: number) => get(`/api/assignments?channelId=${channelId}`),
  getTravailById:         (travailId: number) => get(`/api/assignments/${travailId}`),
  createTravail:          (payload: unknown)  => post('/api/assignments', payload),
  deleteTravail:          (id: number)        => del(`/api/assignments/${id}`),
  getTravauxSuivi:        (travailId: number) => get(`/api/assignments/${travailId}/suivi`),
  updateTravailPublished: (payload: unknown)  => post('/api/assignments/publish', payload),
  getTravailCategories:   (promoId: number)   => get(`/api/assignments/categories?promoId=${promoId}`),
  getGanttData:           (promoId: number, channelId?: number) => get(`/api/assignments/gantt?promoId=${promoId}${channelId ? `&channelId=${channelId}` : ''}`),
  getAllRendus:            (promoId: number)   => get(`/api/assignments/rendus?promoId=${promoId}`),
  getTeacherSchedule:     ()                  => get('/api/assignments/teacher-schedule'),
  markNonSubmittedAsD:    (travailId: number) => post(`/api/assignments/${travailId}/mark-missing`, {}),
  getTravailGroupMembers: (travailId: number) => get(`/api/assignments/${travailId}/group-members`),

  // ── Dépôts ──────────────────────────────────────────────────────────────────
  getDepots:   (travailId: number) => get(`/api/depots?travailId=${travailId}`),
  addDepot:    (payload: unknown)  => post('/api/depots', payload),
  setNote:     (payload: unknown)  => post('/api/depots/note', payload),
  setFeedback: (payload: unknown)  => post('/api/depots/feedback', payload),

  // ── Groupes ─────────────────────────────────────────────────────────────────
  getGroups:       (promoId: number)  => get(`/api/groups?promoId=${promoId}`),
  createGroup:     (payload: unknown) => post('/api/groups', payload),
  getGroupMembers: (groupId: number)  => get(`/api/groups/${groupId}/members`),
  setGroupMembers: (payload: unknown) => post(`/api/groups/${(payload as { groupId: number }).groupId}/members`, payload),

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

  // ── Intervenants ────────────────────────────────────────────────────────────
  getIntervenants:    ()                 => get('/api/teachers'),
  createIntervenant:  (payload: unknown) => post('/api/teachers', payload),
  deleteIntervenant:  (id: number)       => del(`/api/teachers/${id}`),
  getTeacherChannels: (id: number)       => get(`/api/teachers/${id}/channels`),
  setTeacherChannels: (payload: unknown) => post(`/api/teachers/${(payload as { teacherId: number }).teacherId}/channels`, payload),

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
  updateLiveSessionStatus: (id: number, status: string) => patch(`/api/live/sessions/${id}/status`, { status }),
  addLiveActivity:         (sessionId: number, payload: unknown) => post(`/api/live/sessions/${sessionId}/activities`, payload),
  deleteLiveActivity:      (id: number)         => del(`/api/live/activities/${id}`),
  setLiveActivityStatus:   (id: number, status: string) => patch(`/api/live/activities/${id}/status`, { status }),
  submitLiveResponse:      (activityId: number, payload: unknown) => post(`/api/live/activities/${activityId}/respond`, payload),
  getLiveActivityResults:   (activityId: number) => get(`/api/live/activities/${activityId}/results`),
  getLiveLeaderboard:       (sessionId: number)  => get(`/api/live/sessions/${sessionId}/leaderboard`),
  getLiveHistoryForPromo:   (promoId: number, params?: { search?: string; dateFrom?: string; dateTo?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search)   qs.set('search', params.search)
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom)
    if (params?.dateTo)   qs.set('dateTo', params.dateTo)
    const q = qs.toString()
    return get(`/api/live/sessions/promo/${promoId}/history${q ? '?' + q : ''}`)
  },
  getLiveStatsForPromo:     (promoId: number) => get(`/api/live/sessions/promo/${promoId}/stats`),

  emitLiveJoin(promoId: number)  { socket?.emit('live:join', { promoId }) },
  emitLiveLeave(promoId: number) { socket?.emit('live:leave', { promoId }) },

  onLiveActivityPushed(cb: (data: LiveActivityPushedPayload) => void) {
    liveActivityPushedCallbacks.push(cb)
    return () => { const i = liveActivityPushedCallbacks.indexOf(cb); if (i !== -1) liveActivityPushedCallbacks.splice(i, 1) }
  },
  onLiveActivityClosed(cb: (data: LiveActivityClosedPayload) => void) {
    liveActivityClosedCallbacks.push(cb)
    return () => { const i = liveActivityClosedCallbacks.indexOf(cb); if (i !== -1) liveActivityClosedCallbacks.splice(i, 1) }
  },
  onLiveResultsUpdate(cb: (data: LiveResultsUpdatePayload) => void) {
    liveResultsUpdateCallbacks.push(cb)
    return () => { const i = liveResultsUpdateCallbacks.indexOf(cb); if (i !== -1) liveResultsUpdateCallbacks.splice(i, 1) }
  },
  onLiveSessionStarted(cb: (data: LiveSessionStartedPayload) => void) {
    liveSessionStartedCallbacks.push(cb)
    return () => { const i = liveSessionStartedCallbacks.indexOf(cb); if (i !== -1) liveSessionStartedCallbacks.splice(i, 1) }
  },
  onLiveSessionEnded(cb: (data: LiveSessionEndedPayload) => void) {
    liveSessionEndedCallbacks.push(cb)
    return () => { const i = liveSessionEndedCallbacks.indexOf(cb); if (i !== -1) liveSessionEndedCallbacks.splice(i, 1) }
  },
  onLiveInvite(cb: (data: LiveInvitePayload) => void) {
    liveInviteCallbacks.push(cb)
    return () => { const i = liveInviteCallbacks.indexOf(cb); if (i !== -1) liveInviteCallbacks.splice(i, 1) }
  },
  onLiveScoresUpdate(cb: (data: LiveScoresUpdatePayload) => void) {
    liveScoresUpdateCallbacks.push(cb)
    return () => { const i = liveScoresUpdateCallbacks.indexOf(cb); if (i !== -1) liveScoresUpdateCallbacks.splice(i, 1) }
  },

  // ── REX (Retour d'Experience) ──────────────────────────────────────────────
  createRexSession:       (payload: unknown)  => post('/api/rex/sessions', payload),
  getRexSession:          (id: number)         => get(`/api/rex/sessions/${id}`),
  getRexSessionByCode:    (code: string)       => get(`/api/rex/sessions/code/${code}`),
  getActiveRexSession:    (promoId: number)    => get(`/api/rex/sessions/promo/${promoId}/active`),
  updateRexSessionStatus: (id: number, status: string) => patch(`/api/rex/sessions/${id}/status`, { status }),
  addRexActivity:         (sessionId: number, payload: unknown) => post(`/api/rex/sessions/${sessionId}/activities`, payload),
  deleteRexActivity:      (id: number)         => del(`/api/rex/activities/${id}`),
  setRexActivityStatus:   (id: number, status: string) => patch(`/api/rex/activities/${id}/status`, { status }),
  submitRexResponse:      (activityId: number, payload: unknown) => post(`/api/rex/activities/${activityId}/respond`, payload),
  getRexActivityResults:  (activityId: number) => get(`/api/rex/activities/${activityId}/results`),
  toggleRexPin:           (responseId: number, pinned: boolean) => post(`/api/rex/responses/${responseId}/pin`, { pinned }),
  exportRexSession:       (sessionId: number, format: string) => get(`/api/rex/sessions/${sessionId}/export?format=${format}`),
  getRexHistoryForPromo:  (promoId: number, params?: { search?: string; dateFrom?: string; dateTo?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search)   qs.set('search', params.search)
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom)
    if (params?.dateTo)   qs.set('dateTo', params.dateTo)
    const q = qs.toString()
    return get(`/api/rex/sessions/promo/${promoId}/history${q ? '?' + q : ''}`)
  },
  getRexStatsForPromo:    (promoId: number) => get(`/api/rex/sessions/promo/${promoId}/stats`),

  // Lumen (liseuse GitHub)
  getLumenGithubStatus:       ()                      => get('/api/lumen/github/me'),
  connectLumenGithub:         (token: string)         => post('/api/lumen/github/connect', { token }),
  disconnectLumenGithub:      ()                      => del('/api/lumen/github/disconnect'),
  getLumenPromoOrg:           (promoId: number)       => get(`/api/lumen/promos/${promoId}/github-org`),
  setLumenPromoOrg:           (promoId: number, org: string | null) => put(`/api/lumen/promos/${promoId}/github-org`, { org }),
  getLumenReposForPromo:      (promoId: number)       => get(`/api/lumen/repos/promo/${promoId}`),
  syncLumenReposForPromo:     (promoId: number)       => post(`/api/lumen/repos/sync/promo/${promoId}`, {}),
  getLumenRepo:               (id: number)            => get(`/api/lumen/repos/${id}`),
  getLumenReposByProjectName: (promoId: number, name: string) =>
    get(`/api/lumen/repos/by-project-name?promoId=${promoId}&name=${encodeURIComponent(name)}`),
  getLumenUnlinkedReposForPromo: (promoId: number) =>
    get(`/api/lumen/repos/promo/${promoId}/unlinked`),
  setLumenRepoProject:        (repoId: number, projectId: number | null) =>
    put(`/api/lumen/repos/${repoId}/project`, { projectId }),
  getLumenTravauxForChapter:  (repoId: number, path: string) =>
    get(`/api/lumen/repos/${repoId}/chapters/travaux?path=${encodeURIComponent(path)}`),
  getLumenChaptersForTravail: (travailId: number) =>
    get(`/api/lumen/travaux/${travailId}/chapters`),
  linkLumenChapterToTravail:  (travailId: number, repoId: number, chapterPath: string) =>
    post('/api/lumen/chapters/travaux', { travailId, repoId, chapterPath }),
  unlinkLumenChapterFromTravail: (travailId: number, repoId: number, chapterPath: string) =>
    del('/api/lumen/chapters/travaux', { travailId, repoId, chapterPath }),
  getLumenChapterContent:     (repoId: number, p: string) => get(`/api/lumen/repos/${repoId}/content?path=${encodeURIComponent(p)}`),
  markLumenChapterRead:       (repoId: number, p: string) => post(`/api/lumen/repos/${repoId}/read`, { path: p }),
  getLumenMyReads:            ()                      => get('/api/lumen/my-reads'),
  getLumenReadCountsForRepo:  (repoId: number)        => get(`/api/lumen/repos/${repoId}/read-counts`),
  getLumenReadCountsForPromo: (promoId: number)       => get(`/api/lumen/read-counts/promo/${promoId}`),
  getLumenChapterNote:        (repoId: number, p: string) => get(`/api/lumen/repos/${repoId}/note?path=${encodeURIComponent(p)}`),
  saveLumenChapterNote:       (repoId: number, p: string, content: string) => put(`/api/lumen/repos/${repoId}/note`, { path: p, content }),
  deleteLumenChapterNote:     (repoId: number, p: string) => del(`/api/lumen/repos/${repoId}/note`, { path: p }),
  getLumenMyNotes:            ()                      => get('/api/lumen/my-notes'),
  getLumenMyNotedChapters:    ()                      => get('/api/lumen/my-noted-chapters'),
  getLumenStatsForPromo:      (promoId: number)       => get(`/api/lumen/stats/promo/${promoId}`),

  // Kanban
  getKanbanCards:   (travailId: number, groupId: number)                   => get(`/api/kanban/travaux/${travailId}/groups/${groupId}`),
  createKanbanCard: (travailId: number, groupId: number, payload: unknown) => post(`/api/kanban/travaux/${travailId}/groups/${groupId}`, payload),
  updateKanbanCard: (cardId: number, payload: unknown)                     => patch(`/api/kanban/cards/${cardId}`, payload),
  deleteKanbanCard: (cardId: number)                                       => del(`/api/kanban/cards/${cardId}`),

  // Fichiers DM
  getDmFiles: () => get('/api/messages/dm-files'),

  // Carnet de suivi
  getTeacherNotes:        (studentId: number) => get(`/api/teacher-notes/student/${studentId}`),
  getTeacherNotesByPromo: (promoId: number)   => get(`/api/teacher-notes/promo/${promoId}`),
  getTeacherNotesSummary: (promoId: number)   => get(`/api/teacher-notes/promo/${promoId}/summary`),
  createTeacherNote:      (payload: unknown)  => post('/api/teacher-notes', payload),
  updateTeacherNote:      (id: number, payload: unknown) => patch(`/api/teacher-notes/${id}`, payload),
  deleteTeacherNote:      (id: number)        => del(`/api/teacher-notes/${id}`),

  // Signatures
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

  // Engagement
  getEngagementScores: (promoId: number) => get(`/api/engagement/${promoId}`),

  emitRexJoin(promoId: number)  { socket?.emit('rex:join', { promoId }) },
  emitRexLeave(promoId: number) { socket?.emit('rex:leave', { promoId }) },

  onRexActivityPushed(cb: (data: RexActivityPushedPayload) => void) {
    rexActivityPushedCallbacks.push(cb)
    return () => { const i = rexActivityPushedCallbacks.indexOf(cb); if (i !== -1) rexActivityPushedCallbacks.splice(i, 1) }
  },
  onRexActivityClosed(cb: (data: RexActivityClosedPayload) => void) {
    rexActivityClosedCallbacks.push(cb)
    return () => { const i = rexActivityClosedCallbacks.indexOf(cb); if (i !== -1) rexActivityClosedCallbacks.splice(i, 1) }
  },
  onRexResultsUpdate(cb: (data: RexResultsUpdatePayload) => void) {
    rexResultsUpdateCallbacks.push(cb)
    return () => { const i = rexResultsUpdateCallbacks.indexOf(cb); if (i !== -1) rexResultsUpdateCallbacks.splice(i, 1) }
  },
  onRexSessionStarted(cb: (data: RexSessionStartedPayload) => void) {
    rexSessionStartedCallbacks.push(cb)
    return () => { const i = rexSessionStartedCallbacks.indexOf(cb); if (i !== -1) rexSessionStartedCallbacks.splice(i, 1) }
  },
  onRexSessionEnded(cb: (data: RexSessionEndedPayload) => void) {
    rexSessionEndedCallbacks.push(cb)
    return () => { const i = rexSessionEndedCallbacks.indexOf(cb); if (i !== -1) rexSessionEndedCallbacks.splice(i, 1) }
  },
  onRexInvite(cb: (data: RexInvitePayload) => void) {
    rexInviteCallbacks.push(cb)
    return () => { const i = rexInviteCallbacks.indexOf(cb); if (i !== -1) rexInviteCallbacks.splice(i, 1) }
  },

  // ── Grade notifications ─────────────────────────────────────────────────────
  onGradeNew(cb: (data: GradeNewPayload) => void) {
    gradeNewCallbacks.push(cb)
    return () => { const i = gradeNewCallbacks.indexOf(cb); if (i !== -1) gradeNewCallbacks.splice(i, 1) }
  },

  // ── Admin ────────────────────────────────────────────────────────────────────
  resetAndSeed: () => post('/api/admin/reset-seed', {}),

  // ── Upload fichier vers le serveur ────────────────────────────────────────────
  async uploadFile(filePath: string) {
    // Si c'est déjà une URL serveur (uploadé via openFileDialog), retourner directement
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return { ok: true, data: { url: filePath } }
    }
    // Legacy : pseudo-path __web__ (ancien format, garde la compat)
    const cached = fileCache.get(filePath)
    if (!cached) return { ok: false, error: 'Fichier non trouvé (cache expiré).' }
    const bytes = Uint8Array.from(atob(cached.b64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: cached.mime })
    const formData = new FormData()
    formData.append('file', blob, cached.name)
    try {
      const res  = await fetch(`${SERVER_URL}/api/files/upload`, {
        method: 'POST',
        headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
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

  // ── Fichiers - implémentation browser ────────────────────────────────────────
  async openImageDialog() {
    const file = await pickFile('image/*')
    if (!file) return { ok: true, data: null }
    const reader = new FileReader()
    return new Promise((resolve) => {
      reader.onload  = () => resolve({ ok: true, data: reader.result as string })
      reader.onerror = () => resolve({ ok: false, error: 'Erreur lecture fichier' })
      reader.readAsDataURL(file)
    })
  },

  async openFileDialog() {
    const files = await pickFiles()
    if (!files || files.length === 0) return { ok: true, data: null }
    // Upload chaque fichier au serveur et retourne les URLs
    const urls: string[] = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file, file.name)
      try {
        const res  = await fetch(`${SERVER_URL}/api/files/upload`, {
          method: 'POST',
          headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
          body: formData,
        })
        const json = await res.json() as { ok: boolean; data?: string; error?: string }
        if (json.ok && json.data) {
          const serverUrl = `${SERVER_URL}${json.data}`
          const data = await fileToBase64(file)
          fileCache.set(serverUrl, { ...data, name: file.name })
          urls.push(serverUrl)
        }
      } catch {
        // Skip failed uploads, continue with the rest
      }
    }
    return { ok: true, data: urls.length ? urls : null }
  },

  async readFileBase64(filePath: string) {
    if (filePath.startsWith('__web__')) {
      const cached = fileCache.get(filePath)
      return cached
        ? { ok: true, data: { mime: cached.mime, b64: cached.b64, ext: cached.ext } }
        : { ok: false, error: 'Fichier introuvable (expiré)' }
    }
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      try {
        const headers: Record<string, string> = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}
        const res  = await fetch(filePath, { headers })
        const blob = await res.blob()
        const ext  = filePath.split('/').pop()?.split('.').pop()?.toLowerCase() ?? 'bin'
        return new Promise<unknown>((resolve) => {
          const reader = new FileReader()
          reader.onload  = () => {
            const b64 = (reader.result as string).split(',')[1] ?? ''
            resolve({ ok: true, data: { b64, mime: blob.type || 'application/octet-stream', ext } })
          }
          reader.onerror = () => resolve({ ok: false, error: 'Lecture distante échouée.' })
          reader.readAsDataURL(blob)
        })
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    }
    // Chemin relatif /uploads/... → préfixer avec SERVER_URL
    if (filePath.startsWith('/uploads/')) {
      try {
        const headers: Record<string, string> = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}
        const res  = await fetch(`${SERVER_URL}${filePath}`, { headers })
        const blob = await res.blob()
        const ext  = filePath.split('.').pop()?.toLowerCase() ?? 'bin'
        return new Promise<unknown>((resolve) => {
          const reader = new FileReader()
          reader.onload  = () => {
            const b64 = (reader.result as string).split(',')[1] ?? ''
            resolve({ ok: true, data: { b64, mime: blob.type || 'application/octet-stream', ext } })
          }
          reader.onerror = () => resolve({ ok: false, error: 'Lecture échouée.' })
          reader.readAsDataURL(blob)
        })
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    }
    return { ok: false, error: 'Chemin local non supporté sur le web.' }
  },

  async downloadFile(filePath: string) {
    if (filePath.startsWith('__web__')) {
      const cached = fileCache.get(filePath)
      if (cached) {
        const bytes = Uint8Array.from(atob(cached.b64), c => c.charCodeAt(0))
        triggerDownload(new Blob([bytes], { type: cached.mime }), cached.name)
        return { ok: true, data: null }
      }
      return { ok: false, error: 'Fichier non disponible.' }
    }
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      try {
        const res  = await fetch(filePath)
        const blob = await res.blob()
        const name = filePath.split('/').pop()?.replace(/^\d+_[a-f0-9]+_/, '') ?? 'fichier'
        triggerDownload(blob, name)
        return { ok: true, data: null }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    }
    return { ok: false, error: 'Fichier non disponible.' }
  },

  exportCsv: (travailId: number) => exportCsvBrowser(travailId),

  importStudents: (promoId: number) => importStudentsBrowser(promoId),

  bulkImportStudents: (promoId: number, rows: Record<string, string>[]) =>
    post('/api/students/bulk-import', { promoId, rows }),

  // ── Shell → browser ──────────────────────────────────────────────────────────
  // Open synchronously to avoid popup blocker (must be in user gesture call stack)
  openPath(url: string) {
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) return Promise.resolve({ ok: false, error: 'Popup bloqué par le navigateur. Autorisez les popups pour ce site.' })
    return Promise.resolve({ ok: true, data: null })
  },
  openExternal(url: string) {
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) return Promise.resolve({ ok: false, error: 'Popup bloqué par le navigateur. Autorisez les popups pour ce site.' })
    return Promise.resolve({ ok: true, data: null })
  },
  // ── Contrôles fenêtre - no-ops ────────────────────────────────────────────
  windowMinimize:    () => Promise.resolve({ ok: true, data: null }),
  windowMaximize:    () => Promise.resolve({ ok: true, data: null }),
  windowClose:       () => Promise.resolve({ ok: true, data: null }),
  windowIsMaximized: () => Promise.resolve({ ok: true, data: false }),
  onMaximizeChange:  (_cb: unknown) => () => {},

  // ── Signature notifications ──────────────────────────────────────────────
  onSignatureUpdate(cb: (data: { id: number; status: string; signed_file_url?: string }) => void) {
    socket?.on('signature:update', cb)
    return () => { socket?.off('signature:update', cb) }
  },
  onDocumentNew(cb: (data: { name: string; category?: string }) => void) {
    socket?.on('document:new', cb)
    return () => { socket?.off('document:new', cb) }
  },
  onAssignmentNew(cb: (data: { title: string; category?: string; deadline?: string }) => void) {
    socket?.on('assignment:new', cb)
    return () => { socket?.off('assignment:new', cb) }
  },

  // ── Updater - no-ops en web ──────────────────────────────────────────────
  onUpdaterAvailable:  (_cb: unknown) => () => {},
  onUpdaterDownloaded: (_cb: unknown) => () => {},
  checkForUpdates: async () => ({ ok: true, data: { available: false, version: '—' } }),

  platform: 'web',

  // ── Typing indicator ───────────────────────────────────────────────────────
  emitTyping(channelId: number) {
    socket?.emit('typing', { channelId })
  },
  emitDmTyping(dmStudentId: number, dmPeerId?: number) {
    socket?.emit('typing', { dmStudentId, dmPeerId })
  },

  // ── Temps réel (Socket.io) ───────────────────────────────────────────────────
  onNewMessage(cb: (data: MsgNewPayload) => void) {
    msgCallbacks.push(cb)
    return () => { const i = msgCallbacks.indexOf(cb); if (i !== -1) msgCallbacks.splice(i, 1) }
  },

  onSocketStateChange(cb: (connected: boolean) => void) {
    socketStateCallbacks.push(cb)
    return () => { const i = socketStateCallbacks.indexOf(cb); if (i !== -1) socketStateCallbacks.splice(i, 1) }
  },

  onPresenceUpdate(cb: (data: PresenceEntry[]) => void) {
    presenceCallbacks.push(cb)
    return () => { const i = presenceCallbacks.indexOf(cb); if (i !== -1) presenceCallbacks.splice(i, 1) }
  },

  onTyping(cb: (data: { channelId: number; userName: string }) => void) {
    typingCallbacks.push(cb)
    return () => { const i = typingCallbacks.indexOf(cb); if (i !== -1) typingCallbacks.splice(i, 1) }
  },
}
