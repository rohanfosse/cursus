// ─── IPC : Structure (promotions, canaux, étudiants) ─────────────────────────
const { handle, handleRole, handlePromo } = require('./helpers')
const queries = require('../../../server/db/index')
const { validated, createChannelPayload, createPromotionPayload, registerStudentPayload } = require('./validation')

function register() {
  handle('db:getPromotions',    ()           => queries.getPromotions())
  handlePromo('db:getChannels', (promoId) => promoId, (promoId) => queries.getChannels(promoId))
  handlePromo('db:getStudents', (promoId) => promoId, (promoId) => queries.getStudents(promoId))
  handleRole('teacher','db:getAllStudents',    ()           => queries.getAllStudents())

  // ── Promotions & canaux (teacher-only) ────────────────────────────────
  handleRole('teacher','db:createPromotion',          validated(createPromotionPayload, (payload) => queries.createPromotion(payload)))
  handleRole('teacher','db:deletePromotion',          (promoId)            => queries.deletePromotion(promoId))
  handleRole('teacher','db:createChannel',            validated(createChannelPayload, (payload) => queries.createChannel(payload)))
  handleRole('teacher','db:renameChannel',            (id, name)           => queries.renameChannel(id, name))
  handleRole('teacher','db:deleteChannel',            (id)                 => queries.deleteChannel(id))
  handleRole('teacher','db:renameCategory',           (promoId, old, next) => queries.renameCategory(promoId, old, next))
  handleRole('teacher','db:deleteCategory',           (promoId, category)  => queries.deleteCategory(promoId, category))
  handleRole('teacher','db:updateChannelMembers',     (payload)            => queries.updateChannelMembers(payload))
  handleRole('teacher','db:updateChannelCategory',    (channelId, category) => queries.updateChannelCategory(channelId, category))

  // ── Identité / login ───────────────────────────────────────────────────
  handle('db:getIdentities',        ()                 => queries.getIdentities())
  handle('db:loginWithCredentials', (email, password)  => queries.loginWithCredentials(email, password))
  handle('db:changePassword',       (userId, isTeacher, currentPwd, newPwd) => queries.changePassword(userId, isTeacher, currentPwd, newPwd))
  handle('db:exportPersonalData',   (studentId)        => queries.exportStudentData(studentId))

  // ── Inscription étudiant ──────────────────────────────────────────────
  handle('db:getStudentByEmail', (email)   => queries.getStudentByEmail(email))
  handle('db:registerStudent',   validated(registerStudentPayload, (payload) => queries.registerStudent(payload)))

  // ── Réinitialisation des données (teacher-only) ───────────────────────
  handleRole('teacher','db:resetAndSeed', () => { queries.resetAndSeed(); return null })

  // ── Profil étudiant ───────────────────────────────────────────────────
  handle('db:getStudentProfile', (studentId) => queries.getStudentProfile(studentId))
  handle('db:getStudentTravaux', (studentId) => queries.getStudentTravaux(studentId))

  // ── Vue Classe (teacher-only) ─────────────────────────────────────────
  handleRole('teacher','db:getClasseStats',     (promoId) => queries.getClasseStats(promoId))
  handleRole('teacher','db:updateStudentPhoto', (payload) => queries.updateStudentPhoto(payload.studentId, payload.photoData))

  // ── Intervenants (teacher-only) ───────────────────────────────────────
  handle('db:getIntervenants',    ()        => queries.getIntervenants())
  handleRole('teacher','db:createIntervenant',  (payload) => queries.createIntervenant(payload))
  handleRole('teacher','db:deleteIntervenant',  (id)      => queries.deleteIntervenant(id))
  handle('db:getTeacherChannels', (id)      => queries.getTeacherChannels(id))
  handleRole('teacher','db:setTeacherChannels', (payload) => queries.setTeacherChannels(payload))
}

module.exports = { register }
