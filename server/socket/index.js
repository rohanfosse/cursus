/**
 * Socket.io setup : authentification, presence, rooms, typing.
 * Extrait de server/index.js pour separation des responsabilites.
 */
const jwt = require('jsonwebtoken')
const log = require('../utils/logger')

module.exports = function setupSocket(io, queries, SECRET) {
  // ── Authentification ────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Non authentifié'))
    try {
      socket.user = jwt.verify(token, SECRET)
      next()
    } catch {
      next(new Error('Token invalide'))
    }
  })

  // ── Map userId → Set<socketId> pour envoi cible ───────────────────────────
  const userSockets = new Map()

  function userRoom(userId) { return `user:${userId}` }

  // ── Presence en ligne ─────────────────────────────────────────────────────
  const onlineUsers = new Map()

  function broadcastPresence() {
    const list = [...onlineUsers.entries()].map(([id, info]) => ({
      id, name: info.name, role: info.role,
    }))
    io.to('all').emit('presence:update', list)
  }

  io.on('connection', (socket) => {
    const name = socket.user?.name ?? socket.id
    const userId = socket.user?.id
    const role = socket.user?.role ?? 'student'
    log.info('ws_connect', { name, userId })

    // Rejoindre les salles promo
    if (socket.user?.promo_id) {
      socket.join(`promo:${socket.user.promo_id}`)
    } else if (socket.user?.type === 'teacher' || socket.user?.type === 'ta') {
      try {
        const promos = queries.getPromotions?.() ?? []
        for (const p of promos) socket.join(`promo:${p.id}`)
      } catch (err) { log.warn('ws_promo_join_error', { error: err.message }) }
    }
    socket.join('all')

    // Salle personnelle pour envoi cible (DMs, typing DM)
    if (userId != null) {
      socket.join(userRoom(userId))
      if (!userSockets.has(userId)) userSockets.set(userId, new Set())
      userSockets.get(userId).add(socket.id)

      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, { name, role, connectedAt: Date.now() })
      }
      broadcastPresence()
    }

    // Envoyer la liste actuelle au nouveau connecte
    socket.emit('presence:update', [...onlineUsers.entries()].map(([id, info]) => ({
      id, name: info.name, role: info.role,
    })))

    // ── Helper : re-valider le JWT sur les events critiques ──────────────
    function checkTokenValid() {
      try {
        jwt.verify(socket.handshake.auth?.token, SECRET)
        return true
      } catch {
        socket.emit('auth:expired')
        socket.disconnect(true)
        return false
      }
    }

    // Live quiz
    socket.on('live:join', ({ promoId }) => {
      if (promoId && checkTokenValid()) socket.join(`live:${promoId}`)
    })
    socket.on('live:leave', ({ promoId }) => {
      if (promoId) socket.leave(`live:${promoId}`)
    })

    // Live code broadcast (prof seulement)
    socket.on('live:code-update', ({ activityId, promoId, content, language }) => {
      if (!checkTokenValid()) return
      if (socket.user?.role !== 'teacher' && socket.user?.role !== 'admin') return
      if (!activityId || !promoId) return
      io.to(`live:${promoId}`).emit('live:code-update', { activityId, content, language })
    })

    // REX
    socket.on('rex:join', ({ promoId }) => {
      if (promoId && checkTokenValid()) socket.join(`rex:${promoId}`)
    })
    socket.on('rex:leave', ({ promoId }) => {
      if (promoId) socket.leave(`rex:${promoId}`)
    })

    // Indicateur de frappe
    socket.on('typing', ({ channelId, dmStudentId, dmPeerId }) => {
      if (!checkTokenValid()) return
      if (channelId) {
        socket.to('all').emit('typing', { channelId, userName: socket.user?.name })
      } else if (dmStudentId) {
        socket.to(userRoom(dmStudentId)).emit('typing', { dmStudentId, userName: socket.user?.name })
        const peer = dmPeerId ?? socket.user?.id
        if (peer && peer !== dmStudentId) {
          socket.to(userRoom(peer)).emit('typing', { dmStudentId, userName: socket.user?.name })
        }
      }
    })

    socket.on('disconnect', () => {
      log.info('ws_disconnect', { name, userId })
      if (userId != null && userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id)
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId)
          onlineUsers.delete(userId)
          broadcastPresence()
        }
      }
    })
  })
}
