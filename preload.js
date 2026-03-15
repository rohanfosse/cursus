const { contextBridge, ipcRenderer } = require('electron');

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('api', {
  // Structure
  getPromotions:      ()               => invoke('db:getPromotions'),
  getChannels:        (promoId)        => invoke('db:getChannels',       promoId),
  getStudents:        (promoId)        => invoke('db:getStudents',       promoId),
  getAllStudents:      ()               => invoke('db:getAllStudents'),

  // Messages
  getChannelMessages: (channelId)      => invoke('db:getChannelMessages', channelId),
  getDmMessages:      (studentId)      => invoke('db:getDmMessages',      studentId),
  searchMessages:     (channelId, q)   => invoke('db:searchMessages',     channelId, q),
  sendMessage:        (payload)        => invoke('db:sendMessage',        payload),

  // Travaux
  getTravaux:         (channelId)      => invoke('db:getTravaux',         channelId),
  getTravailById:     (travailId)      => invoke('db:getTravailById',      travailId),
  createTravail:      (payload)        => invoke('db:createTravail',      payload),
  getTravauxSuivi:    (travailId)      => invoke('db:getTravauxSuivi',    travailId),

  // Depots
  getDepots:          (travailId)      => invoke('db:getDepots',          travailId),
  addDepot:           (payload)        => invoke('db:addDepot',           payload),
  setNote:            (payload)        => invoke('db:setNote',            payload),
  setFeedback:        (payload)        => invoke('db:setFeedback',        payload),

  // Groupes
  getGroups:          (promoId)        => invoke('db:getGroups',          promoId),
  createGroup:        (payload)        => invoke('db:createGroup',        payload),
  deleteGroup:        (groupId)        => invoke('db:deleteGroup',        groupId),
  getGroupMembers:    (groupId)        => invoke('db:getGroupMembers',    groupId),
  setGroupMembers:    (payload)        => invoke('db:setGroupMembers',    payload),

  // Profil & travaux etudiant
  getStudentProfile:  (studentId)      => invoke('db:getStudentProfile',  studentId),
  getStudentTravaux:  (studentId)      => invoke('db:getStudentTravaux',  studentId),

  // Ressources
  getRessources:      (travailId)      => invoke('db:getRessources',      travailId),
  addRessource:       (payload)        => invoke('db:addRessource',       payload),
  deleteRessource:    (id)             => invoke('db:deleteRessource',    id),

  // Groupes par projet
  getTravailGroupMembers: (travailId)  => invoke('db:getTravailGroupMembers', travailId),
  setTravailGroupMember:  (payload)    => invoke('db:setTravailGroupMember',  payload),

  // Brouillon
  updateTravailPublished: (payload)    => invoke('db:updateTravailPublished', payload),

  // Promotions
  createPromotion:    (payload)        => invoke('db:createPromotion',        payload),
  deletePromotion:    (promoId)        => invoke('db:deletePromotion',        promoId),

  // Inscription
  getStudentByEmail:  (email)          => invoke('db:getStudentByEmail',      email),
  registerStudent:    (payload)        => invoke('db:registerStudent',        payload),

  // Identites (login)
  getIdentities:      ()               => invoke('db:getIdentities'),

  // Ouverture de fichiers / liens
  openPath:           (filePath)       => invoke('shell:openPath',        filePath),
  openExternal:       (url)            => invoke('shell:openExternal',    url),

  // Fichiers & export
  openImageDialog:    ()               => invoke('dialog:openImage'),
  openFileDialog:     ()               => invoke('dialog:openFile'),
  exportCsv:          (travailId)      => invoke('export:csv',            travailId),

  // Echéancier prof
  getTeacherSchedule: ()               => invoke('db:getTeacherSchedule'),

  // Gantt + rendus
  getGanttData:       (promoId)        => invoke('db:getGanttData',       promoId),
  getAllRendus:        (promoId)        => invoke('db:getAllRendus',        promoId),

  // PDF viewer
  openPdf:            (filePath)       => invoke('window:openPdf',        filePath),

  // Documents de canal
  getChannelDocuments:          (channelId)  => invoke('db:getChannelDocuments',          channelId),
  addChannelDocument:           (payload)    => invoke('db:addChannelDocument',           payload),
  deleteChannelDocument:        (id)         => invoke('db:deleteChannelDocument',        id),
  getChannelDocumentCategories: (channelId)  => invoke('db:getChannelDocumentCategories', channelId),

  // Messages épinglés
  getPinnedMessages:   (channelId) => invoke('db:getPinnedMessages', channelId),
  togglePinMessage:    (payload)   => invoke('db:togglePinMessage',  payload),

  // Action de masse
  markNonSubmittedAsD: (travailId) => invoke('db:markNonSubmittedAsD', travailId),

  // Fichiers
  readFileBase64: (filePath) => invoke('fs:readFileBase64', filePath),
  downloadFile:   (filePath) => invoke('fs:downloadFile',   filePath),
});
