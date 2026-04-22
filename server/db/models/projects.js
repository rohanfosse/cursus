// ─── Modele Projet : CRUD + liaison travaux/documents + assignation TA ────────
const { getDb } = require('../connection')

// ── CRUD Projets ──────────────────────────────────────────────────────────────

function getProjectsByPromo(promoId) {
  return getDb().prepare('SELECT * FROM projects WHERE promo_id = ? ORDER BY created_at DESC').all(promoId)
}

function getProjectById(id) {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id)
}

function createProject({ promoId, name, description, channelId, deadline, createdBy }) {
  const res = getDb().prepare(
    'INSERT INTO projects (promo_id, name, description, channel_id, deadline, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(promoId, name, description ?? null, channelId ?? null, deadline ?? null, createdBy)
  return res.lastInsertRowid
}

function updateProject(id, { name, description, deadline }) {
  const db = getDb()
  const fields = []
  const values = []
  if (name !== undefined)        { fields.push('name = ?');        values.push(name) }
  if (description !== undefined) { fields.push('description = ?'); values.push(description) }
  if (deadline !== undefined)    { fields.push('deadline = ?');    values.push(deadline) }
  if (fields.length === 0) return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) ?? null
  values.push(id)
  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) ?? null
}

function deleteProject(id) {
  return getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

/**
 * Normalise un nom de projet pour le matching Lumen <-> projects :
 * trim + lowercase + decomposition Unicode NFD (retire les accents).
 * Exposee pour qu'elle puisse etre utilisee cote SQL et cote JS avec
 * la meme semantique.
 */
function normalizeProjectName(name) {
  if (typeof name !== 'string') return ''
  return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Cherche un projet dans une promo par son nom normalise.
 * Retourne :
 *  - { ok: true, project: {...} } si exactement un match
 *  - { ok: false, code: 'not_found' } si aucun match
 *  - { ok: false, code: 'ambiguous', matches: [...] } si plusieurs
 *    projets ont le meme nom normalise (projects.name n'est pas unique
 *    dans le schema — on refuse explicitement le match ambigu pour eviter
 *    de choisir silencieusement un projet au hasard).
 */
function findProjectByNormalizedName(promoId, name) {
  const normalized = normalizeProjectName(name)
  if (!normalized) return { ok: false, code: 'not_found' }
  const all = getDb().prepare('SELECT * FROM projects WHERE promo_id = ?').all(promoId)
  const matches = all.filter((p) => normalizeProjectName(p.name) === normalized)
  if (matches.length === 0) return { ok: false, code: 'not_found' }
  if (matches.length > 1) return { ok: false, code: 'ambiguous', matches }
  return { ok: true, project: matches[0] }
}

// ── Liaison travaux ───────────────────────────────────────────────────────────

function addTravailToProject(projectId, travailId) {
  return getDb().prepare(
    'INSERT OR IGNORE INTO project_travaux (project_id, travail_id) VALUES (?, ?)'
  ).run(projectId, travailId)
}

function removeTravailFromProject(projectId, travailId) {
  return getDb().prepare(
    'DELETE FROM project_travaux WHERE project_id = ? AND travail_id = ?'
  ).run(projectId, travailId)
}

function getProjectTravaux(projectId) {
  return getDb().prepare(`
    SELECT t.* FROM travaux t
    JOIN project_travaux pt ON pt.travail_id = t.id
    WHERE pt.project_id = ?
    ORDER BY t.deadline ASC
  `).all(projectId)
}

// ── Liaison documents ─────────────────────────────────────────────────────────

function addDocumentToProject(projectId, documentId) {
  return getDb().prepare(
    'INSERT OR IGNORE INTO project_documents (project_id, document_id) VALUES (?, ?)'
  ).run(projectId, documentId)
}

function getProjectLinkedDocuments(projectId) {
  return getDb().prepare(`
    SELECT d.* FROM channel_documents d
    JOIN project_documents pd ON pd.document_id = d.id
    WHERE pd.project_id = ?
    ORDER BY d.id DESC
  `).all(projectId)
}

// ── Assignation TA ────────────────────────────────────────────────────────────

function assignTaToProject(teacherId, projectId) {
  return getDb().prepare(
    'INSERT OR IGNORE INTO teacher_projects (teacher_id, project_id) VALUES (?, ?)'
  ).run(teacherId, projectId)
}

function unassignTaFromProject(teacherId, projectId) {
  return getDb().prepare(
    'DELETE FROM teacher_projects WHERE teacher_id = ? AND project_id = ?'
  ).run(teacherId, projectId)
}

function getProjectTas(projectId) {
  return getDb().prepare(`
    SELECT t.* FROM teachers t
    JOIN teacher_projects tp ON tp.teacher_id = t.id
    WHERE tp.project_id = ?
    ORDER BY t.name ASC
  `).all(projectId)
}

function getTaProjects(teacherId) {
  return getDb().prepare(`
    SELECT p.* FROM projects p
    JOIN teacher_projects tp ON tp.project_id = p.id
    WHERE tp.teacher_id = ?
    ORDER BY p.created_at DESC
  `).all(teacherId)
}

// ── Liaison enseignant-promo ──────────────────────────────────────────────────

function getTeacherPromos(teacherId) {
  return getDb().prepare(`
    SELECT pr.* FROM promotions pr
    JOIN teacher_promos tp ON tp.promo_id = pr.id
    WHERE tp.teacher_id = ?
    ORDER BY pr.name ASC
  `).all(teacherId)
}

function assignTeacherToPromo(teacherId, promoId) {
  return getDb().prepare(
    'INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (?, ?)'
  ).run(teacherId, promoId)
}

function unassignTeacherFromPromo(teacherId, promoId) {
  return getDb().prepare(
    'DELETE FROM teacher_promos WHERE teacher_id = ? AND promo_id = ?'
  ).run(teacherId, promoId)
}

module.exports = {
  getProjectsByPromo,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  normalizeProjectName,
  findProjectByNormalizedName,
  addTravailToProject,
  removeTravailFromProject,
  getProjectTravaux,
  addDocumentToProject,
  getProjectLinkedDocuments,
  assignTaToProject,
  unassignTaFromProject,
  getProjectTas,
  getTaProjects,
  getTeacherPromos,
  assignTeacherToPromo,
  unassignTeacherFromPromo,
}
