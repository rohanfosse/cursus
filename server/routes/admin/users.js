/**
 * Routes admin - Gestion des utilisateurs (CRUD, reset mot de passe)
 */
const router  = require('express').Router()
const queries = require('../../db/index')

router.get('/users', (req, res) => {
  try {
    const { search, promo_id, type, page, limit } = req.query
    const data = queries.getAdminUsers({
      search, promo_id: promo_id ? Number(promo_id) : null,
      type: type || null, page: Number(page) || 1, limit: Number(limit) || 50,
    })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/users/:id', (req, res) => {
  try {
    const data = queries.getAdminUserDetail(Number(req.params.id))
    if (!data) return res.status(404).json({ ok: false, error: 'Utilisateur introuvable.' })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.patch('/users/:id', (req, res) => {
  try {
    const { getDb } = require('../../db/connection')
    const db = getDb()
    const userId = Number(req.params.id)
    const isTeacher = userId < 0
    const realId = Math.abs(userId)
    const { name, email, promo_id } = req.body

    if (isTeacher) {
      const updates = []
      const params = []
      if (name)  { updates.push('name = ?');  params.push(name.trim()) }
      if (email) { updates.push('email = ?'); params.push(email.trim().toLowerCase()) }
      if (!updates.length) return res.json({ ok: true, data: null })
      params.push(realId)
      db.prepare(`UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    } else {
      const updates = []
      const params = []
      if (name)     { updates.push('name = ?');     params.push(name.trim()) }
      if (email)    { updates.push('email = ?');    params.push(email.trim().toLowerCase()) }
      if (promo_id) { updates.push('promo_id = ?'); params.push(Number(promo_id)) }
      if (name) {
        const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
        updates.push('avatar_initials = ?')
        params.push(initials)
      }
      if (!updates.length) return res.json({ ok: true, data: null })
      params.push(realId)
      db.prepare(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    }

    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/users/:id/reset-password', (req, res) => {
  try {
    const { getDb } = require('../../db/connection')
    const bcrypt = require('bcryptjs')
    const crypto = require('crypto')
    const db = getDb()
    const userId = Number(req.params.id)
    const isTeacher = userId < 0
    const realId = Math.abs(userId)

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    const tempPwd = Array.from(crypto.randomBytes(12), b => chars[b % chars.length]).join('')
    const hashed  = bcrypt.hashSync(tempPwd, 10)
    const table   = isTeacher ? 'teachers' : 'students'

    db.prepare(`UPDATE ${table} SET password = ?, must_change_password = 1 WHERE id = ?`)
      .run(hashed, realId)

    res.json({ ok: true, data: { tempPassword: tempPwd } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Gestion du role d'un enseignant (teacher / ta / admin) ──────────────────
// Les 3 routes role/promos exigent l'admin systeme : seul un admin peut
// manipuler l'appartenance d'un autre prof a une promo ou changer un role.
const ASSIGNABLE_ROLES = new Set(['teacher', 'ta', 'admin'])

function requireSystemAdmin(req, res, next) {
  const { isSystemAdmin } = require('../../permissions')
  if (!isSystemAdmin(req.user?.type)) {
    return res.status(403).json({ ok: false, error: 'Accès réservé à l\'administrateur systeme.' })
  }
  next()
}

router.patch('/users/:id/role', requireSystemAdmin, (req, res) => {
  try {
    const { getDb } = require('../../db/connection')
    const userId = Number(req.params.id)
    if (userId >= 0) {
      return res.status(400).json({ ok: false, error: 'Les étudiants n\'ont pas de rôle modifiable.' })
    }
    if (userId === req.user.id) {
      return res.status(409).json({ ok: false, error: 'Impossible de modifier son propre rôle.' })
    }
    const { role } = req.body ?? {}
    if (!ASSIGNABLE_ROLES.has(role)) {
      return res.status(400).json({ ok: false, error: 'Rôle invalide (teacher | ta | admin).' })
    }
    const db     = getDb()
    const realId = Math.abs(userId)
    const current = db.prepare('SELECT id, role FROM teachers WHERE id = ?').get(realId)
    if (!current) return res.status(404).json({ ok: false, error: 'Utilisateur introuvable.' })

    // Protection : ne jamais retirer le dernier admin
    if (current.role === 'admin' && role !== 'admin') {
      const remaining = db.prepare("SELECT COUNT(*) AS c FROM teachers WHERE role = 'admin' AND id != ?").get(realId).c
      if (remaining === 0) {
        return res.status(409).json({ ok: false, error: 'Impossible de rétrograder le dernier administrateur.' })
      }
    }

    db.prepare('UPDATE teachers SET role = ? WHERE id = ?').run(role, realId)
    res.json({ ok: true, data: { id: userId, role } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Promos assignees a un enseignant ─────────────────────────────────────────
router.get('/users/:id/promos', (req, res) => {
  try {
    const userId = Number(req.params.id)
    if (userId >= 0) return res.json({ ok: true, data: [] })
    const queries = require('../../db/index')
    const data = queries.getTeacherPromos(Math.abs(userId))
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/users/:id/promos', requireSystemAdmin, (req, res) => {
  try {
    const userId  = Number(req.params.id)
    const promoId = Number(req.body?.promoId)
    if (userId >= 0 || !Number.isFinite(promoId) || promoId <= 0) {
      return res.status(400).json({ ok: false, error: 'Paramètres invalides.' })
    }
    const queries = require('../../db/index')
    queries.assignTeacherToPromo(Math.abs(userId), promoId)
    res.json({ ok: true, data: { teacherId: userId, promoId } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.delete('/users/:id/promos/:promoId', requireSystemAdmin, (req, res) => {
  try {
    const userId  = Number(req.params.id)
    const promoId = Number(req.params.promoId)
    if (userId >= 0 || !Number.isFinite(promoId) || promoId <= 0) {
      return res.status(400).json({ ok: false, error: 'Paramètres invalides.' })
    }
    const queries = require('../../db/index')
    queries.unassignTeacherFromPromo(Math.abs(userId), promoId)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.delete('/users/:id', (req, res) => {
  try {
    const { getDb } = require('../../db/connection')
    const db = getDb()
    const userId = Number(req.params.id)
    const isTeacher = userId < 0
    const realId = Math.abs(userId)

    if (isTeacher) {
      const t = db.prepare('SELECT role FROM teachers WHERE id = ?').get(realId)
      if (!t) return res.status(404).json({ ok: false, error: 'Utilisateur introuvable.' })
      if (t.role === 'teacher') return res.status(403).json({ ok: false, error: 'Impossible de supprimer un Responsable Pédagogique.' })
      db.prepare('DELETE FROM teachers WHERE id = ?').run(realId)
    } else {
      db.prepare('DELETE FROM students WHERE id = ?').run(realId)
    }

    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
