import { contextBridge, ipcRenderer } from 'electron'

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('api', {
  // ── Structure ──────────────────────────────────────────────────────────────
  getPromotions:    ()              => invoke('db:getPromotions'),
  getChannels:      (promoId: number)    => invoke('db:getChannels',       promoId),
  getStudents:      (promoId: number)    => invoke('db:getStudents',       promoId),
  getAllStudents:    ()              => invoke('db:getAllStudents'),

  // ── Messages ───────────────────────────────────────────────────────────────
  getChannelMessages: (channelId: number)       => invoke('db:getChannelMessages', channelId),
  getDmMessages:      (studentId: number)       => invoke('db:getDmMessages',      studentId),
  searchMessages:     (channelId: number, q: string) => invoke('db:searchMessages', channelId, q),
  sendMessage:        (payload: unknown)        => invoke('db:sendMessage',         payload),

  // ── Travaux ────────────────────────────────────────────────────────────────
  getTravaux:        (channelId: number)  => invoke('db:getTravaux',       channelId),
  getTravailById:    (travailId: number)  => invoke('db:getTravailById',    travailId),
  createTravail:     (payload: unknown)   => invoke('db:createTravail',    payload),
  getTravauxSuivi:   (travailId: number)  => invoke('db:getTravauxSuivi',  travailId),

  // ── Dépôts ─────────────────────────────────────────────────────────────────
  getDepots:   (travailId: number)  => invoke('db:getDepots',   travailId),
  addDepot:    (payload: unknown)   => invoke('db:addDepot',    payload),
  setNote:     (payload: unknown)   => invoke('db:setNote',     payload),
  setFeedback: (payload: unknown)   => invoke('db:setFeedback', payload),

  // ── Groupes ────────────────────────────────────────────────────────────────
  getGroups:       (promoId: number)  => invoke('db:getGroups',       promoId),
  createGroup:     (payload: unknown) => invoke('db:createGroup',     payload),
  deleteGroup:     (groupId: number)  => invoke('db:deleteGroup',     groupId),
  getGroupMembers: (groupId: number)  => invoke('db:getGroupMembers', groupId),
  setGroupMembers: (payload: unknown) => invoke('db:setGroupMembers', payload),

  // ── Profil & travaux étudiant ──────────────────────────────────────────────
  getStudentProfile: (studentId: number) => invoke('db:getStudentProfile', studentId),
  getStudentTravaux: (studentId: number) => invoke('db:getStudentTravaux', studentId),

  // ── Ressources ─────────────────────────────────────────────────────────────
  getRessources:  (travailId: number) => invoke('db:getRessources',  travailId),
  addRessource:   (payload: unknown)  => invoke('db:addRessource',   payload),
  deleteRessource:(id: number)        => invoke('db:deleteRessource', id),

  // ── Groupes par projet ─────────────────────────────────────────────────────
  getTravailGroupMembers: (travailId: number) => invoke('db:getTravailGroupMembers', travailId),
  setTravailGroupMember:  (payload: unknown)  => invoke('db:setTravailGroupMember',  payload),

  // ── Brouillon ──────────────────────────────────────────────────────────────
  updateTravailPublished: (payload: unknown) => invoke('db:updateTravailPublished', payload),

  // ── Promotions & canaux ────────────────────────────────────────────────────
  createPromotion: (payload: unknown)  => invoke('db:createPromotion', payload),
  deletePromotion: (promoId: number)   => invoke('db:deletePromotion', promoId),
  createChannel:   (payload: unknown)  => invoke('db:createChannel',   payload),

  // ── Inscription ────────────────────────────────────────────────────────────
  getStudentByEmail: (email: string)   => invoke('db:getStudentByEmail', email),
  registerStudent:   (payload: unknown) => invoke('db:registerStudent',  payload),

  // ── Identité / login ───────────────────────────────────────────────────────
  getIdentities:        ()                          => invoke('db:getIdentities'),
  loginWithCredentials: (email: string, pwd: string) => invoke('db:loginWithCredentials', email, pwd),

  // ── Shell ──────────────────────────────────────────────────────────────────
  openPath:     (filePath: string) => invoke('shell:openPath',     filePath),
  openExternal: (url: string)      => invoke('shell:openExternal', url),

  // ── Fichiers & export ──────────────────────────────────────────────────────
  openImageDialog: () => invoke('dialog:openImage'),
  openFileDialog:  () => invoke('dialog:openFile'),
  exportCsv:       (travailId: number) => invoke('export:csv', travailId),

  // ── Échéancier prof ────────────────────────────────────────────────────────
  getTeacherSchedule: () => invoke('db:getTeacherSchedule'),

  // ── Gantt + rendus ─────────────────────────────────────────────────────────
  getGanttData: (promoId: number) => invoke('db:getGanttData', promoId),
  getAllRendus:  (promoId: number) => invoke('db:getAllRendus',  promoId),

  // ── PDF viewer ─────────────────────────────────────────────────────────────
  openPdf: (filePath: string) => invoke('window:openPdf', filePath),

  // ── Documents ──────────────────────────────────────────────────────────────
  getChannelDocuments:          (channelId: number) => invoke('db:getChannelDocuments',          channelId),
  getPromoDocuments:            (promoId: number)   => invoke('db:getPromoDocuments',            promoId),
  addChannelDocument:           (payload: unknown)  => invoke('db:addChannelDocument',           payload),
  deleteChannelDocument:        (id: number)        => invoke('db:deleteChannelDocument',        id),
  getChannelDocumentCategories: (channelId: number) => invoke('db:getChannelDocumentCategories', channelId),

  // ── Messages épinglés ──────────────────────────────────────────────────────
  getPinnedMessages: (channelId: number) => invoke('db:getPinnedMessages', channelId),
  togglePinMessage:  (payload: unknown)  => invoke('db:togglePinMessage',  payload),

  // ── Actions de masse ───────────────────────────────────────────────────────
  markNonSubmittedAsD: (travailId: number) => invoke('db:markNonSubmittedAsD', travailId),

  // ── Fichiers ───────────────────────────────────────────────────────────────
  readFileBase64: (filePath: string) => invoke('fs:readFileBase64', filePath),
  downloadFile:   (filePath: string) => invoke('fs:downloadFile',   filePath),

  // ── Temps réel ─────────────────────────────────────────────────────────────
  // Retourne une fonction de désabonnement pour le cleanup Vue.
  onNewMessage: (cb: (data: { channelId: number | null; dmStudentId: number | null }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { channelId: number | null; dmStudentId: number | null }) => cb(data)
    ipcRenderer.on('msg:new', listener)
    return () => ipcRenderer.removeListener('msg:new', listener)
  },
})
