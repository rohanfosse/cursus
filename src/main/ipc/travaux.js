// ─── IPC : Travaux, dépôts, groupes, rubrics ─────────────────────────────────
const { handle, handleRole, handlePromo } = require('./helpers')
const queries = require('../../../server/db/index')
const { validated, createTravailPayload, addDepotPayload, setNotePayload, setFeedbackPayload } = require('./validation')

function register() {
  // ── Travaux ─────────────────────────────────────────────────────────────
  handle('db:getTravaux',       (channelId) => queries.getTravaux(channelId))
  handle('db:getTravailById',   (travailId) => queries.getTravailById(travailId))
  handleRole('teacher','db:createTravail',    validated(createTravailPayload, (payload) => queries.createTravail(payload)))
  handle('db:getTravauxSuivi',  (travailId) => queries.getTravauxSuivi(travailId))

  // ── Dépôts ────────────────────────────────────────────────────────────
  handle('db:getDepots',   (travailId) => queries.getDepots(travailId))
  handle('db:addDepot',    validated(addDepotPayload, (payload) => queries.addDepot(payload)))
  handleRole('teacher','db:setNote',     validated(setNotePayload, (payload) => queries.setNote(payload)))
  handleRole('teacher','db:setFeedback', validated(setFeedbackPayload, (payload) => queries.setFeedback(payload)))

  // ── Groupes ───────────────────────────────────────────────────────────
  handlePromo('db:getGroups', (promoId) => promoId, (promoId) => queries.getGroups(promoId))
  handleRole('teacher','db:createGroup',     (payload)  => queries.createGroup(payload))
  handleRole('teacher','db:deleteGroup',     (groupId)  => queries.deleteGroup(groupId))
  handle('db:getGroupMembers', (groupId)  => queries.getGroupMembers(groupId))
  handleRole('teacher','db:setGroupMembers', (payload)  => queries.setGroupMembers(payload))

  // ── Groupes par projet ────────────────────────────────────────────────
  handle('db:getTravailGroupMembers', (travailId) => queries.getTravailGroupMembers(travailId))
  handleRole('teacher','db:setTravailGroupMember',  (payload)   => queries.setTravailGroupMember(payload))

  // ── Brouillon / publication (teacher-only) ────────────────────────────
  handleRole('teacher','db:updateTravailPublished', (payload) => queries.updateTravailPublished(payload))
  handleRole('teacher','db:updateTravailScheduled', (payload) => queries.updateTravail(payload.travailId, { scheduledPublishAt: payload.scheduledAt ?? null }))

  // ── Ressources ────────────────────────────────────────────────────────
  handle('db:getRessources',  (travailId) => queries.getRessources(travailId))
  handleRole('teacher','db:addRessource',   (payload)   => queries.addRessource(payload))
  handleRole('teacher','db:deleteRessource',(id)        => queries.deleteRessource(id))

  // ── Échéancier prof (teacher-only) ────────────────────────────────────
  handleRole('teacher','db:getTeacherSchedule',     ()         => queries.getTeacherSchedule())
  handlePromo('db:getTravailCategories', (promoId) => promoId, (promoId) => queries.getTravailCategories(promoId))

  // ── Gantt + rendus ────────────────────────────────────────────────────
  handlePromo('db:getGanttData', (promoId) => promoId, (promoId) => queries.getGanttData(promoId ?? null))
  handlePromo('db:getAllRendus',  (promoId) => promoId, (promoId) => queries.getAllRendus(promoId ?? null))

  // ── Action de masse (teacher-only) ────────────────────────────────────
  handleRole('teacher','db:markNonSubmittedAsD', (travailId) => queries.markNonSubmittedAsD(travailId))

  // ── Rubrics (teacher-only sauf lecture) ────────────────────────────────
  handle('db:getRubric',      (travailId) => queries.getRubric(travailId))
  handleRole('teacher','db:upsertRubric',   (payload)   => queries.upsertRubric(payload))
  handleRole('teacher','db:deleteRubric',   (travailId) => queries.deleteRubric(travailId))
  handle('db:getDepotScores', (depotId)   => queries.getDepotScores(depotId))
  handleRole('teacher','db:setDepotScores', (payload)   => queries.setDepotScores(payload))
}

module.exports = { register }
