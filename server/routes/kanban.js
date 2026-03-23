/** Routes API Kanban — cartes de suivi par travail/groupe. */
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')

// GET /travaux/:travailId/groups/:groupId - cartes d'un groupe pour un travail
router.get('/travaux/:travailId/groups/:groupId', wrap((req) => {
  return queries.getKanbanCards(Number(req.params.travailId), Number(req.params.groupId))
}))

// POST /travaux/:travailId/groups/:groupId - créer une carte
router.post('/travaux/:travailId/groups/:groupId', wrap((req) => {
  const { title, description } = req.body
  if (!title) throw new Error('title requis')
  const createdBy = req.user?.name ?? ''
  return queries.createKanbanCard({
    travailId:   Number(req.params.travailId),
    groupId:     Number(req.params.groupId),
    title,
    description,
    createdBy,
  })
}))

// PATCH /cards/:id - modifier titre/description/position
router.patch('/cards/:id', wrap((req) => {
  const { title, description, position, status } = req.body
  if (status !== undefined) {
    return queries.moveKanbanCard(Number(req.params.id), status, position ?? 0)
  }
  return queries.updateKanbanCard(Number(req.params.id), { title, description, position })
}))

// DELETE /cards/:id
router.delete('/cards/:id', wrap((req) => {
  queries.deleteKanbanCard(Number(req.params.id))
  return null
}))

module.exports = router
