// ─── IPC : Travaux, dépôts, groupes, rubrics ─────────────────────────────────
const { handle } = require('./helpers')
const queries = require('../../db/index')

function register() {
  // ── Travaux ─────────────────────────────────────────────────────────────
  handle('db:getTravaux',       (channelId) => queries.getTravaux(channelId))
  handle('db:getTravailById',   (travailId) => queries.getTravailById(travailId))
  handle('db:createTravail',    (payload)   => queries.createTravail(payload))
  handle('db:getTravauxSuivi',  (travailId) => queries.getTravauxSuivi(travailId))

  // ── Dépôts ──────────────────────────────────────────────────────────────
  handle('db:getDepots',   (travailId) => queries.getDepots(travailId))
  handle('db:addDepot',    (payload)   => queries.addDepot(payload))
  handle('db:setNote',     (payload)   => queries.setNote(payload))
  handle('db:setFeedback', (payload)   => queries.setFeedback(payload))

  // ── Groupes ─────────────────────────────────────────────────────────────
  handle('db:getGroups',       (promoId)  => queries.getGroups(promoId))
  handle('db:createGroup',     (payload)  => queries.createGroup(payload))
  handle('db:deleteGroup',     (groupId)  => queries.deleteGroup(groupId))
  handle('db:getGroupMembers', (groupId)  => queries.getGroupMembers(groupId))
  handle('db:setGroupMembers', (payload)  => queries.setGroupMembers(payload))

  // ── Groupes par projet ──────────────────────────────────────────────────
  handle('db:getTravailGroupMembers', (travailId) => queries.getTravailGroupMembers(travailId))
  handle('db:setTravailGroupMember',  (payload)   => queries.setTravailGroupMember(payload))

  // ── Brouillon / publication ─────────────────────────────────────────────
  handle('db:updateTravailPublished', (payload) => queries.updateTravailPublished(payload))

  // ── Ressources ──────────────────────────────────────────────────────────
  handle('db:getRessources',  (travailId) => queries.getRessources(travailId))
  handle('db:addRessource',   (payload)   => queries.addRessource(payload))
  handle('db:deleteRessource',(id)        => queries.deleteRessource(id))

  // ── Échéancier prof ─────────────────────────────────────────────────────
  handle('db:getTeacherSchedule',     ()         => queries.getTeacherSchedule())
  handle('db:getTravailCategories',   (promoId)  => queries.getTravailCategories(promoId))

  // ── Gantt + rendus ──────────────────────────────────────────────────────
  handle('db:getGanttData',  (promoId) => queries.getGanttData(promoId ?? null))
  handle('db:getAllRendus',   (promoId) => queries.getAllRendus(promoId ?? null))

  // ── Action de masse ─────────────────────────────────────────────────────
  handle('db:markNonSubmittedAsD', (travailId) => queries.markNonSubmittedAsD(travailId))

  // ── Rubrics ─────────────────────────────────────────────────────────────
  handle('db:getRubric',      (travailId) => queries.getRubric(travailId))
  handle('db:upsertRubric',   (payload)   => queries.upsertRubric(payload))
  handle('db:deleteRubric',   (travailId) => queries.deleteRubric(travailId))
  handle('db:getDepotScores', (depotId)   => queries.getDepotScores(depotId))
  handle('db:setDepotScores', (payload)   => queries.setDepotScores(payload))
}

module.exports = { register }
