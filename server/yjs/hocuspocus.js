/**
 * Hocuspocus WebSocket server pour la collaboration Yjs sur les cahiers.
 *
 * Attache au serveur HTTP existant sur /collaboration.
 * - Auth : JWT dans le query param ?token=<jwt> (l'API browser WebSocket ne
 *          permet pas de headers custom lors de l'upgrade).
 * - Ownership : delegue a services/cahierAccess.js (source unique partagee
 *               avec le middleware HTTP).
 * - Persistence : onLoadDocument lit le BLOB yjs_state, onStoreDocument le
 *                 reecrit (debounce 2s geree par Hocuspocus).
 *
 * Convention doc name : "cahier-<id>".
 */
const { Server } = require('@hocuspocus/server')
const { WebSocketServer } = require('ws')
const jwt = require('jsonwebtoken')
const Y = require('yjs')
const queries = require('../db/index')
const log = require('../utils/logger')
const { canAccessCahier } = require('../services/cahierAccess')

const COLLAB_PATH = '/collaboration'

/** Parse cahier id from documentName "cahier-<id>". */
function parseCahierId(documentName) {
  const m = /^cahier-(\d+)$/.exec(documentName)
  return m ? Number(m[1]) : null
}

/**
 * Adapter de la verification d'acces commune pour la forme attendue ici.
 * Retourne { ok, reason } (sans 'status' HTTP).
 */
function checkCahierAccess(user, cahierId) {
  const r = canAccessCahier(user, cahierId)
  return r.ok ? { ok: true } : { ok: false, reason: r.reason }
}

function buildHocuspocusServer(opts = {}) {
  const jwtSecret = opts.jwtSecret
    || process.env.JWT_SECRET
    || (process.env.NODE_ENV === 'production' ? null : 'changeme-dev-secret')

  if (!jwtSecret) {
    // Symetrique au check de server/index.js : en prod sans secret, refus.
    throw new Error('[Hocuspocus] JWT_SECRET obligatoire en production')
  }

  return new Server({
    debounce: 2000,          // coalesce onStoreDocument 2s
    maxDebounce: 10_000,     // force save au moins toutes les 10s en edition soutenue

    async onAuthenticate({ token, documentName }) {
      if (!token) throw new Error('Token manquant')
      let decoded
      try {
        decoded = jwt.verify(token, jwtSecret)
      } catch {
        throw new Error('Token invalide ou expire')
      }
      const cahierId = parseCahierId(documentName)
      if (!cahierId) throw new Error('Document name invalide')
      const access = checkCahierAccess(decoded, cahierId)
      if (!access.ok) {
        log.warn('cahier_ws_denied', { userId: decoded?.id, cahierId, reason: access.reason })
        throw new Error('Acces refuse')
      }
      log.info('cahier_ws_connect', { userId: decoded.id, cahierId, userType: decoded.type })
      return { user: decoded, cahierId }
    },

    async onLoadDocument({ documentName, document }) {
      const cahierId = parseCahierId(documentName)
      if (!cahierId) return document
      const state = queries.getCahierYjsState(cahierId)
      if (state && state.length > 0) {
        try {
          Y.applyUpdate(document, state)
        } catch (err) {
          // BLOB corrompu : on rejette plutot que d'ecraser silencieusement.
          // Un admin peut ensuite inspecter la colonne yjs_state.
          log.error('cahier_ws_load_failed', { cahierId, error: err.message })
          throw new Error('Etat du cahier corrompu, contactez l\'administrateur')
        }
      }
      return document
    },

    async onStoreDocument({ documentName, document }) {
      const cahierId = parseCahierId(documentName)
      if (!cahierId) return
      try {
        const state = Buffer.from(Y.encodeStateAsUpdate(document))
        queries.saveCahierYjsState(cahierId, state)
      } catch (err) {
        log.warn('cahier_ws_store_failed', { cahierId, error: err.message })
      }
    },

    onDisconnect({ context, documentName }) {
      log.info('cahier_ws_disconnect', {
        userId: context?.user?.id,
        cahierId: parseCahierId(documentName),
      })
    },
  })
}

/**
 * Attache Hocuspocus au http.Server existant sur COLLAB_PATH.
 * Retourne l'instance Hocuspocus (pour test / shutdown).
 */
function attachHocuspocus(httpServer, opts = {}) {
  const hocuspocus = buildHocuspocusServer(opts)
  const wss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', (request, socket, head) => {
    // On ne touche QUE notre path. socket.io gere ses propres upgrades
    // via engine.attach (listener separe). Pour les paths inconnus, on laisse
    // tomber : Node fermera le socket par timeout.
    if (!request.url || !request.url.startsWith(COLLAB_PATH)) return
    wss.handleUpgrade(request, socket, head, (ws) => {
      hocuspocus.handleConnection(ws, request)
    })
  })

  log.info('hocuspocus_attached', { path: COLLAB_PATH })
  return hocuspocus
}

module.exports = {
  attachHocuspocus,
  buildHocuspocusServer,
  parseCahierId,
  checkCahierAccess,
  COLLAB_PATH,
}
