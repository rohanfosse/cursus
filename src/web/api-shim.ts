// ─── Shim window.api pour le build web (sans Electron) ───────────────────────
// Implémente exactement la même interface que src/preload/index.ts,
// en remplaçant les appels IPC par fetch + socket.io + APIs browser natives.

import { io, Socket } from 'socket.io-client'

// ─── Config ──────────────────────────────────────────────────────────────────
const SERVER_URL: string = import.meta.env.DEV
  ? 'http://localhost:3001'
  : 'https://cursus.devrohan.cloud'

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

// Cache pour les fichiers ouverts via <input type="file">
// Clé : pseudo-path "__web__<timestamp>", valeur : données du fichier
const fileCache = new Map<string, { mime: string; b64: string; ext: string; name: string }>()

// ─── Socket.io ───────────────────────────────────────────────────────────────
function connectSocket(token: string): void {
  socket?.disconnect()
  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  })
  socket.on('msg:new', (data: MsgNewPayload) => msgCallbacks.forEach(cb => cb(data)))
  socket.on('typing', (data: { channelId: number; userName: string }) => typingCallbacks.forEach(cb => cb(data)))
  socket.on('presence:update', (data: PresenceEntry[]) => presenceCallbacks.forEach(cb => cb(data)))
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
      if (res.status === 401) {
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
        return { ok: false, error: isAbort ? 'Délai d\'attente dépassé' : 'Erreur réseau — vérifiez votre connexion' }
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return { ok: false, error: 'Erreur réseau' }
}

const get  = (p: string)              => apiFetch(p)
const post = (p: string, b: unknown)  => apiFetch(p, { method: 'POST',   body: JSON.stringify(b) })
const patch = (p: string, b: unknown) => apiFetch(p, { method: 'PATCH',  body: JSON.stringify(b) })
const del  = (p: string)              => apiFetch(p, { method: 'DELETE' })

// ─── Utilitaires browser ─────────────────────────────────────────────────────

/** Ouvre un sélecteur de fichier et résout avec le File sélectionné (ou null). */
function pickFile(accept = '*'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = accept
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => { document.body.removeChild(input); resolve(input.files?.[0] ?? null) }
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

  // ── Auth / session ──────────────────────────────────────────────────────────
  setToken(token: string) { jwtToken = token; connectSocket(token) },

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
  renameCategory: (promoId: number, old: string, next: string) =>
    post('/api/promotions/categories/rename', { promoId, old, next }),
  deleteCategory: (promoId: number, category: string) =>
    post('/api/promotions/categories/delete', { promoId, category }),
  updateChannelMembers:  (payload: unknown) => post('/api/promotions/channels/members', payload),
  updateChannelCategory: (channelId: number, category: string | null) =>
    patch(`/api/promotions/channels/${channelId}/category`, { category }),

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
  getChannelMessages:     (channelId: number) => get(`/api/messages/channel/${channelId}`),
  getDmMessages:          (studentId: number) => get(`/api/messages/dm/${studentId}`),
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
  searchAllMessages: (args: { promoId: number | null; query: string; limit?: number }) =>
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
  updateTravailFields:    (id: number, fields: unknown) => patch(`/api/assignments/${id}`, fields),
  getTravauxSuivi:        (travailId: number) => get(`/api/assignments/${travailId}/suivi`),
  updateTravailPublished: (payload: unknown)  => post('/api/assignments/publish', payload),
  getTravailCategories:   (promoId: number)   => get(`/api/assignments/categories?promoId=${promoId}`),
  getGanttData:           (promoId: number)   => get(`/api/assignments/gantt?promoId=${promoId}`),
  getAllRendus:            (promoId: number)   => get(`/api/assignments/rendus?promoId=${promoId}`),
  getTeacherSchedule:     ()                  => get('/api/assignments/teacher-schedule'),
  markNonSubmittedAsD:    (travailId: number) => post(`/api/assignments/${travailId}/mark-missing`, {}),
  getTravailGroupMembers: (travailId: number) => get(`/api/assignments/${travailId}/group-members`),
  setTravailGroupMember:  (payload: unknown)  => post('/api/assignments/group-member', payload),

  // ── Dépôts ──────────────────────────────────────────────────────────────────
  getDepots:   (travailId: number) => get(`/api/depots?travailId=${travailId}`),
  addDepot:    (payload: unknown)  => post('/api/depots', payload),
  setNote:     (payload: unknown)  => post('/api/depots/note', payload),
  setFeedback: (payload: unknown)  => post('/api/depots/feedback', payload),

  // ── Groupes ─────────────────────────────────────────────────────────────────
  getGroups:       (promoId: number)  => get(`/api/groups?promoId=${promoId}`),
  createGroup:     (payload: unknown) => post('/api/groups', payload),
  deleteGroup:     (groupId: number)  => del(`/api/groups/${groupId}`),
  getGroupMembers: (groupId: number)  => get(`/api/groups/${groupId}/members`),
  setGroupMembers: (payload: unknown) => post(`/api/groups/${(payload as { groupId: number }).groupId}/members`, payload),

  // ── Ressources ──────────────────────────────────────────────────────────────
  getRessources:  (travailId: number) => get(`/api/resources?travailId=${travailId}`),
  addRessource:   (payload: unknown)  => post('/api/resources', payload),
  deleteRessource:(id: number)        => del(`/api/resources/${id}`),

  // ── Documents ───────────────────────────────────────────────────────────────
  getChannelDocuments:          (channelId: number) => get(`/api/documents/channel/${channelId}`),
  getChannelDocumentCategories: (channelId: number) => get(`/api/documents/channel/${channelId}/categories`),
  getPromoDocuments:            (promoId: number)   => get(`/api/documents/promo/${promoId}`),
  addChannelDocument:           (payload: unknown)  => post('/api/documents/channel', payload),
  deleteChannelDocument:        (id: number)        => del(`/api/documents/channel/${id}`),
  getProjectDocuments:          (promoId: number, project?: string | null) => {
    const qs = project ? `&project=${encodeURIComponent(project)}` : ''
    return get(`/api/documents/project?promoId=${promoId}${qs}`)
  },
  addProjectDocument:           (payload: unknown)  => post('/api/documents/project', payload),
  getProjectDocumentCategories: (promoId: number, project?: string | null) => {
    const qs = project ? `&project=${encodeURIComponent(project)}` : ''
    return get(`/api/documents/project/categories?promoId=${promoId}${qs}`)
  },

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

  // ── Admin ────────────────────────────────────────────────────────────────────
  resetAndSeed: () => post('/api/admin/reset-seed', {}),

  // ── Upload fichier vers le serveur ────────────────────────────────────────────
  async uploadFile(pseudoPath: string) {
    const cached = fileCache.get(pseudoPath)
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
      const json = await res.json() as { ok: boolean; data?: string; error?: string }
      if (json.ok && json.data) json.data = `${SERVER_URL}${json.data}`
      return json
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },

  // ── Fichiers — implémentation browser ────────────────────────────────────────
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
    const file = await pickFile()
    if (!file) return { ok: true, data: null }
    const data = await fileToBase64(file)
    const id = `__web__${Date.now()}_${Math.random().toString(36).slice(2)}`
    fileCache.set(id, { ...data, name: file.name })
    return { ok: true, data: id }  // pseudo-path
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
        const res  = await fetch(filePath)
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
  openPdf     (path: string) {
    if (path.startsWith('__web__')) {
      const cached = fileCache.get(path)
      if (cached) {
        const bytes = Uint8Array.from(atob(cached.b64), c => c.charCodeAt(0))
        const blob  = new Blob([bytes], { type: 'application/pdf' })
        window.open(URL.createObjectURL(blob), '_blank')
        return Promise.resolve({ ok: true, data: null })
      }
    }
    window.open(path, '_blank')
    return Promise.resolve({ ok: true, data: null })
  },

  // ── Contrôles fenêtre — no-ops ────────────────────────────────────────────
  windowMinimize:    () => Promise.resolve({ ok: true, data: null }),
  windowMaximize:    () => Promise.resolve({ ok: true, data: null }),
  windowClose:       () => Promise.resolve({ ok: true, data: null }),
  windowIsMaximized: () => Promise.resolve({ ok: true, data: false }),
  onMaximizeChange:  (_cb: unknown) => () => {},

  platform: 'web',

  // ── Typing indicator ───────────────────────────────────────────────────────
  emitTyping(channelId: number) {
    socket?.emit('typing', { channelId })
  },
  emitDmTyping(dmStudentId: number) {
    socket?.emit('typing', { dmStudentId })
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
