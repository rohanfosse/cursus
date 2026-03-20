import { contextBridge, ipcRenderer } from 'electron'
import { io, Socket } from 'socket.io-client'

// ─── Configuration serveur ────────────────────────────────────────────────────
const SERVER_URL: string = import.meta.env.DEV
  ? 'http://localhost:3001'
  : 'https://cursus.devrohan.cloud'

/** Décodage base64 protégé contre les données corrompues */
function safeAtob(b64: string): string {
  try { return atob(b64) }
  catch { console.warn('[Preload] Décodage base64 échoué'); return '' }
}

// ─── État module-level ────────────────────────────────────────────────────────
let jwtToken: string | null = null
let socket:   Socket | null  = null

// ─── Callbacks "msg:new" enregistrés avant la connexion socket ────────────────
type MsgNewPayload = {
  channelId:       number | null
  dmStudentId:     number | null
  authorName:      string | null
  channelName:     string | null
  promoId:         number | null
  preview:         string | null
  mentionEveryone: boolean
  mentionNames:    string[]
}
const msgCallbacks: Array<(data: MsgNewPayload) => void> = []
const socketStateCallbacks: Array<(connected: boolean) => void> = []
type PresenceEntry = { id: number; name: string; role: string }
const presenceCallbacks: Array<(data: PresenceEntry[]) => void> = []

// ─── Socket.io ────────────────────────────────────────────────────────────────
function connectSocket(token: string): void {
  socket?.disconnect()
  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  })
  socket.on('msg:new', (data: MsgNewPayload) => {
    msgCallbacks.forEach((cb) => cb(data))
  })
  socket.on('presence:update', (data: PresenceEntry[]) => {
    presenceCallbacks.forEach((cb) => cb(data))
  })
  socket.on('connect', () => {
    socketStateCallbacks.forEach((cb) => cb(true))
  })
  socket.on('disconnect', () => {
    socketStateCallbacks.forEach((cb) => cb(false))
  })
  socket.on('connect_error', (err) => {
    console.warn('[Socket.io] Erreur connexion:', err.message)
    socketStateCallbacks.forEach((cb) => cb(false))
  })
}

// ─── Fetch vers le serveur (avec timeout, retry, 401 handling) ───────────────
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
        // Notifier le renderer que la session a expiré
        try { ipcRenderer.send('auth:expired') } catch {}
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
      // Backoff avant retry (1s, 3s)
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return { ok: false, error: 'Erreur réseau' }
}

function get(path: string)                      { return apiFetch(path) }
function post(path: string, body: unknown)      { return apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }) }
function patch(path: string, body: unknown)     { return apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body) }) }
function del(path: string)                      { return apiFetch(path, { method: 'DELETE' }) }

// ─── IPC local (fenêtre, dialogs, shell, fs) ─────────────────────────────────
function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args)
}

// ─── Exposition à la page renderer ───────────────────────────────────────────
contextBridge.exposeInMainWorld('api', {

  // ── Auth / session ──────────────────────────────────────────────────────────
  setToken: (token: string) => {
    jwtToken = token
    connectSocket(token)
  },

  getIdentities: () => get('/api/auth/identities'),
  findUserByName: (name: string) => get(`/api/auth/find-user?name=${encodeURIComponent(name)}`),
  getTeachers: () => get('/api/auth/teachers'),

  loginWithCredentials: async (email: string, pwd: string) => {
    const res = await post('/api/auth/login', { email, password: pwd }) as { ok: boolean; data?: { token?: string; [k: string]: unknown }; error?: string }
    if (res?.ok && res.data?.token) {
      jwtToken = res.data.token as string
      connectSocket(jwtToken)
      // Retourner sans exposer le token dans l'objet user
      const { token: _t, ...user } = res.data
      return { ok: true, data: { ...user, token: res.data.token } }
    }
    return res
  },

  changePassword: (userId: number, isTeacher: boolean, currentPwd: string, newPwd: string) =>
    post('/api/auth/change-password', { userId, isTeacher, currentPwd, newPwd }),

  exportPersonalData: (studentId: number) => get(`/api/auth/export/${studentId}`),

  getStudentByEmail: (email: string) => get(`/api/auth/student-by-email?email=${encodeURIComponent(email)}`),
  registerStudent:   (payload: unknown) => post('/api/auth/register', payload),

  importStudents: async (promoId: number) => {
    const fileRes = await invoke('dialog:openFile') as { ok: boolean; data?: string | null }
    if (!fileRes?.ok || !fileRes.data) return { ok: false, error: 'Annulé' }
    const b64Res = await invoke('fs:readFileBase64', fileRes.data) as { ok: boolean; data?: { b64: string } }
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

  // ── Promotions & canaux ─────────────────────────────────────────────────────
  getPromotions:  ()              => get('/api/promotions'),
  createPromotion:(payload: unknown) => post('/api/promotions', payload),
  deletePromotion:(promoId: number)  => del(`/api/promotions/${promoId}`),

  getChannels:    (promoId: number) => get(`/api/promotions/${promoId}/channels`),
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
  getRecentDmContacts: (studentId: number, limit?: number) =>
    get(`/api/messages/dm-contacts/${studentId}?limit=${limit ?? 15}`),
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
  submitFeedback: (type: string, title: string, description: string) =>
    post('/api/admin/feedback', { type, title, description }),
  getMyFeedback: () => get('/api/admin/feedback/mine'),

  // ── Travaux ─────────────────────────────────────────────────────────────────
  getTravaux:             (channelId: number)  => get(`/api/assignments?channelId=${channelId}`),
  getTravailById:         (travailId: number)  => get(`/api/assignments/${travailId}`),
  createTravail:          (payload: unknown)   => post('/api/assignments', payload),
  getTravauxSuivi:        (travailId: number)  => get(`/api/assignments/${travailId}/suivi`),
  updateTravailPublished: (payload: unknown)   => post('/api/assignments/publish', payload),
  getTravailCategories:   (promoId: number)    => get(`/api/assignments/categories?promoId=${promoId}`),
  getGanttData:           (promoId: number)    => get(`/api/assignments/gantt?promoId=${promoId}`),
  getAllRendus:            (promoId: number)    => get(`/api/assignments/rendus?promoId=${promoId}`),
  getTeacherSchedule:     ()                   => get('/api/assignments/teacher-schedule'),
  markNonSubmittedAsD:    (travailId: number)  => post(`/api/assignments/${travailId}/mark-missing`, {}),
  getTravailGroupMembers: (travailId: number)  => get(`/api/assignments/${travailId}/group-members`),
  setTravailGroupMember:  (payload: unknown)   => post('/api/assignments/group-member', payload),

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

  // Upload d'un fichier local vers le serveur → retourne l'URL publique
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
      const res = await fetch(`${SERVER_URL}/api/files/upload`, {
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

  // Lecture base64 : supporte les URLs serveur en plus des chemins locaux
  readFileBase64: async (filePath: string) => {
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
    return invoke('fs:readFileBase64', filePath)
  },

  // Téléchargement : ouvre l'URL dans le navigateur si c'est une URL serveur
  downloadFile: async (filePath: string) => {
    if (filePath.startsWith('http://') || filePath.startsWith('https://'))
      return invoke('shell:openExternal', filePath)
    return invoke('fs:downloadFile', filePath)
  },

  // ── PDF viewer (fenêtre native) ──────────────────────────────────────────────
  openPdf: (filePath: string) => invoke('window:openPdf', filePath),

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

  // ── Temps réel (Socket.io) ───────────────────────────────────────────────────
  onNewMessage: (cb: (data: MsgNewPayload) => void) => {
    msgCallbacks.push(cb)
    return () => {
      const idx = msgCallbacks.indexOf(cb)
      if (idx !== -1) msgCallbacks.splice(idx, 1)
    }
  },

  onSocketStateChange: (cb: (connected: boolean) => void) => {
    socketStateCallbacks.push(cb)
    return () => {
      const idx = socketStateCallbacks.indexOf(cb)
      if (idx !== -1) socketStateCallbacks.splice(idx, 1)
    }
  },

  // Présence en ligne
  onPresenceUpdate: (cb: (data: PresenceEntry[]) => void) => {
    presenceCallbacks.push(cb)
    return () => {
      const idx = presenceCallbacks.indexOf(cb)
      if (idx !== -1) presenceCallbacks.splice(idx, 1)
    }
  },

  // Typing indicator (stub — Electron desktop doesn't use Socket.io directly)
  emitTyping: (_channelId: number) => {},
  emitDmTyping: (_dmStudentId: number) => {},
  onTyping: (_cb: (data: { channelId?: number; dmStudentId?: number; userName: string }) => void) => () => {},
})
