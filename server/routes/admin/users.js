/**
 * Routes admin — Gestion des utilisateurs (CRUD, reset mot de passe)
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

    const tempPwd = 'Cursus2026!'
    const hashed  = bcrypt.hashSync(tempPwd, 10)
    const table   = isTeacher ? 'teachers' : 'students'

    db.prepare(`UPDATE ${table} SET password = ?, must_change_password = 1 WHERE id = ?`)
      .run(hashed, realId)

    res.json({ ok: true, data: { tempPassword: tempPwd } })
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
