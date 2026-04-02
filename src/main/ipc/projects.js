// ─── IPC : Projets — CRUD + travaux/documents + assignation TA ───────────────
const { handle, handleRole } = require('./helpers')
const queries = require('../../../server/db/index')

function register() {
  // ── CRUD Projets ──────────────────────────────────────────────────────
  handle('projects:getByPromo',  (promoId) => queries.getProjectsByPromo(promoId))
  handle('projects:getById',     (id)      => queries.getProjectById(id))
  handleRole('teacher','projects:create',  (data) => queries.createProject(data))
  handleRole('teacher','projects:update',  (id, data) => queries.updateProject(id, data))
  handleRole('teacher','projects:delete',  (id)   => queries.deleteProject(id))

  // ── Liaison travaux ───────────────────────────────────────────────────
  handleRole('teacher','projects:addTravail',    (projectId, travailId) => queries.addTravailToProject(projectId, travailId))
  handleRole('teacher','projects:removeTravail', (projectId, travailId) => queries.removeTravailFromProject(projectId, travailId))
  handle('projects:getTravaux',   (projectId) => queries.getProjectTravaux(projectId))

  // ── Liaison documents ─────────────────────────────────────────────────
  handleRole('teacher','projects:addDocument', (projectId, documentId) => queries.addDocumentToProject(projectId, documentId))
  handle('projects:getDocuments', (projectId) => queries.getProjectLinkedDocuments(projectId))

  // ── Assignation TA ────────────────────────────────────────────────────
  handleRole('teacher','projects:assignTa',   (teacherId, projectId) => queries.assignTaToProject(teacherId, projectId))
  handleRole('teacher','projects:unassignTa', (teacherId, projectId) => queries.unassignTaFromProject(teacherId, projectId))
  handle('projects:getTas',       (projectId) => queries.getProjectTas(projectId))
  handle('projects:getTaProjects', (teacherId) => queries.getTaProjects(teacherId))

  // ── Liaison enseignant-promo ──────────────────────────────────────────
  handle('projects:getTeacherPromos',      (teacherId) => queries.getTeacherPromos(teacherId))
  handleRole('teacher','projects:assignTeacherToPromo', (teacherId, promoId) => queries.assignTeacherToPromo(teacherId, promoId))
}

module.exports = { register }
