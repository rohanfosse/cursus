const { contextBridge, ipcRenderer } = require('electron');

// Chaque appel renvoie { ok: bool, data?, error? }.
// Le renderer est responsable de verifier result.ok avant d'utiliser result.data.

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('api', {
  // Promotions & structure
  getPromotions:      ()          => invoke('db:getPromotions'),
  getChannels:        (promoId)   => invoke('db:getChannels',   promoId),
  getStudents:        (promoId)   => invoke('db:getStudents',   promoId),
  getAllStudents:      ()          => invoke('db:getAllStudents'),

  // Messages
  getChannelMessages: (channelId) => invoke('db:getChannelMessages', channelId),
  getDmMessages:      (studentId) => invoke('db:getDmMessages',      studentId),
  sendMessage:        (payload)   => invoke('db:sendMessage',        payload),

  // Travaux
  getTravaux:         (channelId) => invoke('db:getTravaux',    channelId),
  createTravail:      (payload)   => invoke('db:createTravail', payload),

  // Depots
  getDepots:          (travailId) => invoke('db:getDepots', travailId),
  addDepot:           (payload)   => invoke('db:addDepot',  payload),
  setNote:            (payload)   => invoke('db:setNote',   payload),

  // Dialogue fichier natif
  openFileDialog:     ()          => invoke('dialog:openFile'),
});
