// ─── IPC : Structure (promotions, canaux, étudiants) ─────────────────────────
const { handle } = require('./helpers')
const queries = require('../../db/index')

function register() {
  handle('db:getPromotions',    ()           => queries.getPromotions())
  handle('db:getChannels',      (promoId)    => queries.getChannels(promoId))
  handle('db:getStudents',      (promoId)    => queries.getStudents(promoId))
  handle('db:getAllStudents',    ()           => queries.getAllStudents())

  // ── Promotions & canaux ─────────────────────────────────────────────────
  handle('db:createPromotion',          (payload)            => queries.createPromotion(payload))
  handle('db:deletePromotion',          (promoId)            => queries.deletePromotion(promoId))
  handle('db:createChannel',            (payload)            => queries.createChannel(payload))
  handle('db:renameChannel',            (id, name)           => queries.renameChannel(id, name))
  handle('db:deleteChannel',            (id)                 => queries.deleteChannel(id))
  handle('db:renameCategory',           (promoId, old, next) => queries.renameCategory(promoId, old, next))
  handle('db:deleteCategory',           (promoId, category)  => queries.deleteCategory(promoId, category))
  handle('db:updateChannelMembers',     (payload)            => queries.updateChannelMembers(payload))
  handle('db:updateChannelCategory',    (channelId, category) => queries.updateChannelCategory(channelId, category))

  // ── Identité / login ───────────────────────────────────────────────────
  handle('db:getIdentities',        ()                 => queries.getIdentities())
  handle('db:loginWithCredentials', (email, password)  => queries.loginWithCredentials(email, password))
  handle('db:changePassword',       (userId, isTeacher, currentPwd, newPwd) => queries.changePassword(userId, isTeacher, currentPwd, newPwd))
  handle('db:exportPersonalData',   (studentId)        => queries.exportStudentData(studentId))

  // ── Inscription étudiant ────────────────────────────────────────────────
  handle('db:getStudentByEmail', (email)   => queries.getStudentByEmail(email))
  handle('db:registerStudent',   (payload) => queries.registerStudent(payload))

  // ── Réinitialisation des données ────────────────────────────────────────
  handle('db:resetAndSeed', () => { queries.resetAndSeed(); return null })

  // ── Profil étudiant ─────────────────────────────────────────────────────
  handle('db:getStudentProfile', (studentId) => queries.getStudentProfile(studentId))
  handle('db:getStudentTravaux', (studentId) => queries.getStudentTravaux(studentId))

  // ── Vue Classe ──────────────────────────────────────────────────────────
  handle('db:getClasseStats',     (promoId) => queries.getClasseStats(promoId))
  handle('db:updateStudentPhoto', (payload) => queries.updateStudentPhoto(payload.studentId, payload.photoData))

  // ── Intervenants (TA) ───────────────────────────────────────────────────
  handle('db:getIntervenants',    ()        => queries.getIntervenants())
  handle('db:createIntervenant',  (payload) => queries.createIntervenant(payload))
  handle('db:deleteIntervenant',  (id)      => queries.deleteIntervenant(id))
  handle('db:getTeacherChannels', (id)      => queries.getTeacherChannels(id))
  handle('db:setTeacherChannels', (payload) => queries.setTeacherChannels(payload))
}

module.exports = { register }
