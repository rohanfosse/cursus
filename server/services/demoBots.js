/**
 * Bots scriptes du mode demo (jalon V2).
 *
 * Worker leger qui scanne periodiquement les sessions demo actives et,
 * pour chaque session, tire un nombre aleatoire pour decider si un bot
 * doit poster un message. Cree l'illusion d'une "promo vivante".
 *
 * Probabilite calibree pour ressentir comme une promo active sans spammer :
 *  - tick toutes les 60 secondes
 *  - 30% de chance qu'au moins un bot poste a chaque tick
 *  - 1 message par session par tick au maximum
 *
 * En NODE_ENV=test, le worker n'est PAS demarre automatiquement (laisse les
 * tests piloter manuellement via runOnce()).
 */
const { getDemoDb } = require('../db/demo-connection')

const TICK_INTERVAL_MS = 60_000
const POST_PROBABILITY = 0.30

// Pool de phrases plausibles, mappees a un canal cible (par nom). Les bots
// piochent dedans aleatoirement pour donner une diversite naturelle. Les
// noms d'auteur sont pris parmi les students du seed (cf. demo-seed.js).
const BOT_MESSAGES = {
  general: [
    { author: 'Lucas Bernard',   content: 'Vous avez les slides de ce matin ?' },
    { author: 'Alice Martin',    content: 'On se voit dans la salle B204 a 14h.' },
    { author: 'Mehdi Chaouki',   content: 'Quelqu\'un a un lien pour le replay du cours ?' },
    { author: 'Sara Bouhassoun', content: 'Petit rappel : le formulaire d\'evaluation est ouvert jusqu\'a vendredi.' },
    { author: 'Jean Durand',     content: 'Si jamais vous galerez sur l\'install Docker, je peux aider en perm ce midi.' },
  ],
  'developpement-web': [
    { author: 'Lucas Bernard',   content: 'J\'ai update la branche main, pensez a faire un pull.' },
    { author: 'Alice Martin',    content: 'Le composant Vue ne se rafraichit pas, des idees ?' },
    { author: 'Sara Bouhassoun', content: 'C\'est bon pour moi, on peut merger la PR auth ?' },
    { author: 'Jean Durand',     content: 'Tests CI passent. Je deploy la preview.' },
    { author: 'Mehdi Chaouki',   content: 'Quelqu\'un sait pourquoi mon build Vite plante en `npm install` ?' },
  ],
  algorithmique: [
    { author: 'Sara Bouhassoun', content: 'Je crois que j\'ai compris la rotation double, merci Jean !' },
    { author: 'Mehdi Chaouki',   content: 'Le quiz Spark sur les arbres c\'est plus dur que celui d\'avant.' },
    { author: 'Alice Martin',    content: 'Vos solutions du TP3 sont sur le repo ?' },
    { author: 'Lucas Bernard',   content: 'Petite astuce : pour les BST, dessiner avant de coder change tout.' },
  ],
  projets: [
    { author: 'Alice Martin',    content: 'On a fini la maquette Figma, je la share ce soir.' },
    { author: 'Jean Durand',     content: 'Reunion d\'equipe demain 10h, validez le creneau svp.' },
    { author: 'Mehdi Chaouki',   content: 'Le Kanban est a jour, j\'ai bouge les cartes en "En cours".' },
    { author: 'Sara Bouhassoun', content: 'Je m\'occupe de la doc technique, donnez-moi 1 jour.' },
  ],
}

let tickIv = null

/**
 * Pour une session donnee, decide si on poste et quel message.
 * Retourne le message insere (ou null).
 */
function postRandomBotMessage(db, session) {
  if (Math.random() > POST_PROBABILITY) return null

  // Pioche un canal de la session (random parmi les 4 canaux du seed).
  const channels = db.prepare(
    `SELECT id, name FROM demo_channels WHERE tenant_id = ?`
  ).all(session.tenant_id)
  if (!channels.length) return null

  const channel = channels[Math.floor(Math.random() * channels.length)]
  const pool = BOT_MESSAGES[channel.name] || BOT_MESSAGES.general
  const tpl  = pool[Math.floor(Math.random() * pool.length)]

  // Resoud l'auteur dans la table students du tenant (pour avoir le bon id
  // + initiales). Si l'auteur n'existe pas (peu probable, le seed est
  // identique), on skip silencieusement.
  const author = db.prepare(
    `SELECT id, name, avatar_initials FROM demo_students
     WHERE tenant_id = ? AND name = ?`
  ).get(session.tenant_id, tpl.author)
  if (!author) return null

  // Evite de poster un message identique au dernier message du canal (rend
  // la conversation moins repetitive si l'utilisateur reste longtemps).
  const lastMsg = db.prepare(
    `SELECT content FROM demo_messages WHERE tenant_id = ? AND channel_id = ?
     ORDER BY id DESC LIMIT 1`
  ).get(session.tenant_id, channel.id)
  if (lastMsg && lastMsg.content === tpl.content) return null

  const result = db.prepare(
    `INSERT INTO demo_messages
       (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content)
     VALUES (?, ?, ?, ?, 'student', ?, ?)`
  ).run(session.tenant_id, channel.id, author.id, author.name, author.avatar_initials, tpl.content)

  return { id: result.lastInsertRowid, channelId: channel.id, content: tpl.content }
}

/**
 * Une iteration : pour chaque session active, possible post.
 * Exporte aussi pour les tests qui veulent piloter manuellement.
 */
function runOnce() {
  try {
    const db = getDemoDb()
    const sessions = db.prepare(
      `SELECT id, tenant_id FROM demo_sessions
       WHERE expires_at > datetime('now')`
    ).all()
    let posted = 0
    for (const s of sessions) {
      if (postRandomBotMessage(db, s)) posted++
    }
    return { sessions: sessions.length, posted }
  } catch (err) {
    // Pas d'unhandled rejection si la DB est ferme entre 2 ticks.
    return { sessions: 0, posted: 0, error: err.message }
  }
}

function start() {
  if (tickIv) return
  if (process.env.NODE_ENV === 'test') return // pilote par les tests
  tickIv = setInterval(runOnce, TICK_INTERVAL_MS)
}

function stop() {
  if (tickIv) { clearInterval(tickIv); tickIv = null }
}

module.exports = { start, stop, runOnce, BOT_MESSAGES }
