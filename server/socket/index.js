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

  // Fan-out de 30+ clients simultanes (ex. reconnexion Wi-Fi promo)
  // declenche 30^2 events — debounce pour coalescer en une seule diffusion.
  let presenceTimer = null
  function broadcastPresence() {
    if (presenceTimer) return
    presenceTimer = setTimeout(() => {
      presenceTimer = null
      const list = [...onlineUsers.entries()].map(([id, info]) => ({
        id, name: info.name, role: info.role,
      }))
      io.to('all').emit('presence:update', list)
    }, 250)
  }

  // Limites de taille sur les payloads socket — evite qu un client malveillant
  // ou bugue bloque la room avec un blob enorme dans le buffer io.
  const MAX_LIVE_CODE_LEN    = 200_000
  const MAX_LIVE_LANG_LEN    = 32
  const MAX_TYPING_NAME_LEN  = 120

  function isValidLiveCode(content, language) {
    if (typeof content !== 'string' || content.length > MAX_LIVE_CODE_LEN) return false
    if (language != null && (typeof language !== 'string' || language.length > MAX_LIVE_LANG_LEN)) return false
    return true
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
    socket.on('live:code-update', (payload) => {
      if (!checkTokenValid()) return
      if (socket.user?.role !== 'teacher' && socket.user?.role !== 'admin') return
      if (!payload || typeof payload !== 'object') return
      const { activityId, promoId, content, language } = payload
      if (!Number.isInteger(activityId) || !Number.isInteger(promoId)) return
      if (!isValidLiveCode(content, language)) return
      io.to(`live:${promoId}`).emit('live:code-update', { activityId, content, language: language ?? null })
    })

    // Indicateur de frappe — diffuse UNIQUEMENT a la room concernee pour
    // eviter la fuite cross-promo. Pour un channel, on resout sa promo et
    // on emet vers `promo:${promoId}` au lieu de la room 'all' globale.
    socket.on('typing', (payload) => {
      if (!checkTokenValid()) return
      if (!payload || typeof payload !== 'object') return
      const { channelId, dmStudentId, dmPeerId } = payload
      const userName = (socket.user?.name ?? '').toString().slice(0, MAX_TYPING_NAME_LEN)
      if (Number.isInteger(channelId)) {
        try {
          const { getDb } = require('../db/connection')
          const ch = getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(channelId)
          if (ch?.promo_id) {
            socket.to(`promo:${ch.promo_id}`).emit('typing', { channelId, userName })
          }
        } catch { /* resolution failure : on ne diffuse pas plutot que de leaker */ }
      } else if (Number.isInteger(dmStudentId)) {
        socket.to(userRoom(dmStudentId)).emit('typing', { dmStudentId, userName })
        const peer = Number.isInteger(dmPeerId) ? dmPeerId : socket.user?.id
        if (peer && peer !== dmStudentId) {
          socket.to(userRoom(peer)).emit('typing', { dmStudentId, userName })
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
