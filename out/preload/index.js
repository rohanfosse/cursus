"use strict";
const electron = require("electron");
function invoke(channel, ...args) {
  return electron.ipcRenderer.invoke(channel, ...args);
}
electron.contextBridge.exposeInMainWorld("api", {
  // ── Structure ──────────────────────────────────────────────────────────────
  getPromotions: () => invoke("db:getPromotions"),
  getChannels: (promoId) => invoke("db:getChannels", promoId),
  getStudents: (promoId) => invoke("db:getStudents", promoId),
  getAllStudents: () => invoke("db:getAllStudents"),
  // ── Messages ───────────────────────────────────────────────────────────────
  getChannelMessages: (channelId) => invoke("db:getChannelMessages", channelId),
  getDmMessages: (studentId) => invoke("db:getDmMessages", studentId),
  // Pagination par curseur — beforeId = undefined pour la page initiale
  getChannelMessagesPage: (channelId, beforeId) => invoke("db:getChannelMessagesPage", channelId, beforeId ?? null),
  getDmMessagesPage: (studentId, beforeId) => invoke("db:getDmMessagesPage", studentId, beforeId ?? null),
  searchMessages: (channelId, q) => invoke("db:searchMessages", channelId, q),
  searchAllMessages: (args) => invoke("db:searchAllMessages", args),
  sendMessage: (payload) => invoke("db:sendMessage", payload),
  // ── Travaux ────────────────────────────────────────────────────────────────
  getTravaux: (channelId) => invoke("db:getTravaux", channelId),
  getTravailById: (travailId) => invoke("db:getTravailById", travailId),
  createTravail: (payload) => invoke("db:createTravail", payload),
  getTravauxSuivi: (travailId) => invoke("db:getTravauxSuivi", travailId),
  // ── Dépôts ─────────────────────────────────────────────────────────────────
  getDepots: (travailId) => invoke("db:getDepots", travailId),
  addDepot: (payload) => invoke("db:addDepot", payload),
  setNote: (payload) => invoke("db:setNote", payload),
  setFeedback: (payload) => invoke("db:setFeedback", payload),
  // ── Groupes ────────────────────────────────────────────────────────────────
  getGroups: (promoId) => invoke("db:getGroups", promoId),
  createGroup: (payload) => invoke("db:createGroup", payload),
  deleteGroup: (groupId) => invoke("db:deleteGroup", groupId),
  getGroupMembers: (groupId) => invoke("db:getGroupMembers", groupId),
  setGroupMembers: (payload) => invoke("db:setGroupMembers", payload),
  // ── Profil & travaux étudiant ──────────────────────────────────────────────
  getStudentProfile: (studentId) => invoke("db:getStudentProfile", studentId),
  getStudentTravaux: (studentId) => invoke("db:getStudentTravaux", studentId),
  // ── Ressources ─────────────────────────────────────────────────────────────
  getRessources: (travailId) => invoke("db:getRessources", travailId),
  addRessource: (payload) => invoke("db:addRessource", payload),
  deleteRessource: (id) => invoke("db:deleteRessource", id),
  // ── Groupes par projet ─────────────────────────────────────────────────────
  getTravailGroupMembers: (travailId) => invoke("db:getTravailGroupMembers", travailId),
  setTravailGroupMember: (payload) => invoke("db:setTravailGroupMember", payload),
  // ── Brouillon ──────────────────────────────────────────────────────────────
  updateTravailPublished: (payload) => invoke("db:updateTravailPublished", payload),
  // ── Promotions & canaux ────────────────────────────────────────────────────
  createPromotion: (payload) => invoke("db:createPromotion", payload),
  deletePromotion: (promoId) => invoke("db:deletePromotion", promoId),
  createChannel: (payload) => invoke("db:createChannel", payload),
  renameChannel: (id, name) => invoke("db:renameChannel", id, name),
  deleteChannel: (id) => invoke("db:deleteChannel", id),
  renameCategory: (promoId, old, next) => invoke("db:renameCategory", promoId, old, next),
  deleteCategory: (promoId, category) => invoke("db:deleteCategory", promoId, category),
  updateChannelMembers: (payload) => invoke("db:updateChannelMembers", payload),
  // ── Inscription ────────────────────────────────────────────────────────────
  getStudentByEmail: (email) => invoke("db:getStudentByEmail", email),
  registerStudent: (payload) => invoke("db:registerStudent", payload),
  // ── Identité / login ───────────────────────────────────────────────────────
  getIdentities: () => invoke("db:getIdentities"),
  loginWithCredentials: (email, pwd) => invoke("db:loginWithCredentials", email, pwd),
  // ── Shell ──────────────────────────────────────────────────────────────────
  openPath: (filePath) => invoke("shell:openPath", filePath),
  openExternal: (url) => invoke("shell:openExternal", url),
  // ── Fichiers & export ──────────────────────────────────────────────────────
  openImageDialog: () => invoke("dialog:openImage"),
  openFileDialog: () => invoke("dialog:openFile"),
  exportCsv: (travailId) => invoke("export:csv", travailId),
  // ── Échéancier prof ────────────────────────────────────────────────────────
  getTeacherSchedule: () => invoke("db:getTeacherSchedule"),
  // ── Gantt + rendus ─────────────────────────────────────────────────────────
  getGanttData: (promoId) => invoke("db:getGanttData", promoId),
  getAllRendus: (promoId) => invoke("db:getAllRendus", promoId),
  getTravailCategories: (promoId) => invoke("db:getTravailCategories", promoId),
  // ── Données de démonstration ───────────────────────────────────────────────
  resetAndSeed: () => invoke("db:resetAndSeed"),
  // ── PDF viewer ─────────────────────────────────────────────────────────────
  openPdf: (filePath) => invoke("window:openPdf", filePath),
  // ── Documents ──────────────────────────────────────────────────────────────
  getChannelDocuments: (channelId) => invoke("db:getChannelDocuments", channelId),
  getPromoDocuments: (promoId) => invoke("db:getPromoDocuments", promoId),
  addChannelDocument: (payload) => invoke("db:addChannelDocument", payload),
  deleteChannelDocument: (id) => invoke("db:deleteChannelDocument", id),
  getChannelDocumentCategories: (channelId) => invoke("db:getChannelDocumentCategories", channelId),
  // ── Documents de projet (nouveau) ──────────────────────────────────────────
  getProjectDocuments: (promoId, project) => invoke("db:getProjectDocuments", promoId, project ?? null),
  addProjectDocument: (payload) => invoke("db:addProjectDocument", payload),
  getProjectDocumentCategories: (promoId, project) => invoke("db:getProjectDocumentCategories", promoId, project ?? null),
  // ── Messages épinglés ──────────────────────────────────────────────────────
  getPinnedMessages: (channelId) => invoke("db:getPinnedMessages", channelId),
  togglePinMessage: (payload) => invoke("db:togglePinMessage", payload),
  updateReactions: (msgId, reactionsJson) => invoke("db:updateReactions", msgId, reactionsJson),
  deleteMessage: (id) => invoke("db:deleteMessage", id),
  editMessage: (id, content) => invoke("db:editMessage", id, content),
  // ── Actions de masse ───────────────────────────────────────────────────────
  markNonSubmittedAsD: (travailId) => invoke("db:markNonSubmittedAsD", travailId),
  // ── Fichiers ───────────────────────────────────────────────────────────────
  readFileBase64: (filePath) => invoke("fs:readFileBase64", filePath),
  downloadFile: (filePath) => invoke("fs:downloadFile", filePath),
  // ── Intervenants ──────────────────────────────────────────────────────────
  getClasseStats: (promoId) => invoke("db:getClasseStats", promoId),
  updateStudentPhoto: (payload) => invoke("db:updateStudentPhoto", payload),
  getIntervenants: () => invoke("db:getIntervenants"),
  createIntervenant: (payload) => invoke("db:createIntervenant", payload),
  deleteIntervenant: (id) => invoke("db:deleteIntervenant", id),
  getTeacherChannels: (id) => invoke("db:getTeacherChannels", id),
  setTeacherChannels: (payload) => invoke("db:setTeacherChannels", payload),
  // ── Contrôles de fenêtre ──────────────────────────────────────────────────
  windowMinimize: () => invoke("window:minimize"),
  windowMaximize: () => invoke("window:maximize"),
  windowClose: () => invoke("window:close"),
  windowIsMaximized: () => invoke("window:isMaximized"),
  // Écoute les changements d'état maximize (push depuis Main)
  onMaximizeChange: (cb) => {
    const listener = (_event, maximized) => cb(maximized);
    electron.ipcRenderer.on("window:maximizeState", listener);
    return () => electron.ipcRenderer.removeListener("window:maximizeState", listener);
  },
  // Plateforme (pour afficher/cacher les boutons selon l'OS)
  platform: process.platform,
  // ── Temps réel ─────────────────────────────────────────────────────────────
  // Retourne une fonction de désabonnement pour le cleanup Vue.
  onNewMessage: (cb) => {
    const listener = (_event, data) => cb(data);
    electron.ipcRenderer.on("msg:new", listener);
    return () => electron.ipcRenderer.removeListener("msg:new", listener);
  }
});
