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
  getChannelMessages:     (channelId: number)                    => invoke('db:getChannelMessages',     channelId),
  getDmMessages:          (studentId: number)                    => invoke('db:getDmMessages',          studentId),
  // Pagination par curseur — beforeId = undefined pour la page initiale
  getChannelMessagesPage: (channelId: number, beforeId?: number) => invoke('db:getChannelMessagesPage', channelId, beforeId ?? null),
  getDmMessagesPage:      (studentId: number, beforeId?: number) => invoke('db:getDmMessagesPage',      studentId, beforeId ?? null),
  searchMessages:         (channelId: number, q: string)         => invoke('db:searchMessages',         channelId, q),
  searchAllMessages:      (args: { promoId: number | null; query: string; limit?: number }) => invoke('db:searchAllMessages', args),
  sendMessage:            (payload: unknown)                     => invoke('db:sendMessage',             payload),

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
  createPromotion:  (payload: unknown)                           => invoke('db:createPromotion',  payload),
  deletePromotion:  (promoId: number)                            => invoke('db:deletePromotion',  promoId),
  createChannel:    (payload: unknown)                           => invoke('db:createChannel',    payload),
  renameChannel:    (id: number, name: string)                   => invoke('db:renameChannel',    id, name),
  deleteChannel:    (id: number)                                 => invoke('db:deleteChannel',    id),
  renameCategory:         (promoId: number, old: string, next: string)    => invoke('db:renameCategory',        promoId, old, next),
  deleteCategory:         (promoId: number, category: string)             => invoke('db:deleteCategory',        promoId, category),
  updateChannelMembers:   (payload: unknown)                              => invoke('db:updateChannelMembers',  payload),
  updateChannelCategory:  (channelId: number, category: string | null)    => invoke('db:updateChannelCategory', channelId, category),

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
  getGanttData:         (promoId: number) => invoke('db:getGanttData',         promoId),
  getAllRendus:          (promoId: number) => invoke('db:getAllRendus',          promoId),
  getTravailCategories: (promoId: number) => invoke('db:getTravailCategories',  promoId),

  // ── Données de démonstration ───────────────────────────────────────────────
  resetAndSeed: () => invoke('db:resetAndSeed'),

  // ── PDF viewer ─────────────────────────────────────────────────────────────
  openPdf: (filePath: string) => invoke('window:openPdf', filePath),

  // ── Documents ──────────────────────────────────────────────────────────────
  getChannelDocuments:          (channelId: number) => invoke('db:getChannelDocuments',          channelId),
  getPromoDocuments:            (promoId: number)   => invoke('db:getPromoDocuments',            promoId),
  addChannelDocument:           (payload: unknown)  => invoke('db:addChannelDocument',           payload),
  deleteChannelDocument:        (id: number)        => invoke('db:deleteChannelDocument',        id),
  getChannelDocumentCategories: (channelId: number) => invoke('db:getChannelDocumentCategories', channelId),

  // ── Documents de projet (nouveau) ──────────────────────────────────────────
  getProjectDocuments:          (promoId: number, project?: string | null) => invoke('db:getProjectDocuments', promoId, project ?? null),
  addProjectDocument:           (payload: unknown)                          => invoke('db:addProjectDocument', payload),
  getProjectDocumentCategories: (promoId: number, project?: string | null) => invoke('db:getProjectDocumentCategories', promoId, project ?? null),

  // ── Messages épinglés ──────────────────────────────────────────────────────
  getPinnedMessages: (channelId: number) => invoke('db:getPinnedMessages', channelId),
  togglePinMessage:  (payload: unknown)  => invoke('db:togglePinMessage',  payload),
  updateReactions:   (msgId: number, reactionsJson: string) => invoke('db:updateReactions', msgId, reactionsJson),
  deleteMessage:     (id: number)        => invoke('db:deleteMessage',     id),
  editMessage:       (id: number, content: string) => invoke('db:editMessage', id, content),

  // ── Actions de masse ───────────────────────────────────────────────────────
  markNonSubmittedAsD: (travailId: number) => invoke('db:markNonSubmittedAsD', travailId),

  // ── Fichiers ───────────────────────────────────────────────────────────────
  readFileBase64: (filePath: string) => invoke('fs:readFileBase64', filePath),
  downloadFile:   (filePath: string) => invoke('fs:downloadFile',   filePath),

  // ── Intervenants ──────────────────────────────────────────────────────────
  getClasseStats:     (promoId: number)  => invoke('db:getClasseStats', promoId),
  updateStudentPhoto: (payload: { studentId: number; photoData: string | null }) => invoke('db:updateStudentPhoto', payload),
  getIntervenants:    ()                 => invoke('db:getIntervenants'),
  createIntervenant:  (payload: unknown) => invoke('db:createIntervenant',  payload),
  deleteIntervenant:  (id: number)       => invoke('db:deleteIntervenant',  id),
  getTeacherChannels: (id: number)       => invoke('db:getTeacherChannels', id),
  setTeacherChannels: (payload: unknown) => invoke('db:setTeacherChannels', payload),

  // ── Contrôles de fenêtre ──────────────────────────────────────────────────
  windowMinimize:    () => invoke('window:minimize'),
  windowMaximize:    () => invoke('window:maximize'),
  windowClose:       () => invoke('window:close'),
  windowIsMaximized: () => invoke('window:isMaximized'),

  // Écoute les changements d'état maximize (push depuis Main)
  onMaximizeChange: (cb: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized)
    ipcRenderer.on('window:maximizeState', listener)
    return () => ipcRenderer.removeListener('window:maximizeState', listener)
  },

  // Plateforme (pour afficher/cacher les boutons selon l'OS)
  platform: process.platform,

  // ── Temps réel ─────────────────────────────────────────────────────────────
  // Retourne une fonction de désabonnement pour le cleanup Vue.
  onNewMessage: (cb: (data: {
    channelId:      number | null
    dmStudentId:    number | null
    authorName:     string | null
    channelName:    string | null
    promoId:        number | null
    preview:        string | null
    mentionEveryone: boolean
    mentionNames:   string[]
  }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: {
      channelId:      number | null
      dmStudentId:    number | null
      authorName:     string | null
      channelName:    string | null
      promoId:        number | null
      preview:        string | null
      mentionEveryone: boolean
      mentionNames:   string[]
    }) => cb(data)
    ipcRenderer.on('msg:new', listener)
    return () => ipcRenderer.removeListener('msg:new', listener)
  },
})
