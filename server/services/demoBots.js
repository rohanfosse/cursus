/**
 * Bots scriptes du mode demo (jalon V2 + V4 ameliorations).
 *
 * Worker leger qui scanne periodiquement les sessions demo actives et,
 * pour chaque session, declenche jusqu'a 3 actions probabilistes :
 *
 *   1. POST  : un bot poste un message dans un canal random  (30%)
 *   2. REACT : un bot ajoute une reaction emoji a un message (20%)
 *   3. EDIT  : un bot edite un de ses propres messages recents (8%)
 *
 * Les 3 actions sont independantes, sequentielles, et toutes les 60s.
 * Cree l'illusion d'une "promo vivante" sans necessiter de socket.io.
 *
 * En NODE_ENV=test, le worker n'est PAS demarre automatiquement (laisse
 * les tests piloter manuellement via runOnce()).
 *
 * Cf. v2.260 pour le seed enrichi (50+ messages, 8 reactions JSON, 5
 * pinned). Les bots font evoluer ce dataset au lieu de le laisser fige.
 */
const { getDemoDb } = require('../db/demo-connection')

const TICK_INTERVAL_MS = 60_000
const POST_PROBABILITY  = 0.30
const REACT_PROBABILITY = 0.20
const EDIT_PROBABILITY  = 0.08

// Pool d'emojis utilises pour les reactions des bots. Doit matcher ce que
// le frontend rend correctement (cf. MessageBubble.vue). Volontairement
// neutre, pas de drapeaux ou trucs polarisants.
const REACT_EMOJIS = ['👍', '❤️', '🎉', '😂', '🤔', '🔥', '💡', '🙏', '✅', '👀']

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
    { author: 'Hugo Petit',      content: 'Merci pour le partage, je regarde ce soir.' },
    { author: 'Lea Rousseau',    content: 'Je reste 5 min apres le cours pour les questions.' },
  ],
  'developpement-web': [
    { author: 'Lucas Bernard',   content: 'J\'ai update la branche main, pensez a faire un pull.' },
    { author: 'Alice Martin',    content: 'Le composant Vue ne se rafraichit pas, des idees ?' },
    { author: 'Sara Bouhassoun', content: 'C\'est bon pour moi, on peut merger la PR auth ?' },
    { author: 'Jean Durand',     content: 'Tests CI passent. Je deploy la preview.' },
    { author: 'Mehdi Chaouki',   content: 'Quelqu\'un sait pourquoi mon build Vite plante en `npm install` ?' },
    { author: 'Alice Martin',    content: 'Pense a ajouter `.env.example` dans le repo, sinon on devine.' },
    { author: 'Lucas Bernard',   content: 'Ok je merge l\'auth, deploy preview en cours.' },
  ],
  algorithmique: [
    { author: 'Sara Bouhassoun', content: 'Je crois que j\'ai compris la rotation double, merci Jean !' },
    { author: 'Mehdi Chaouki',   content: 'Le quiz Spark sur les arbres c\'est plus dur que celui d\'avant.' },
    { author: 'Alice Martin',    content: 'Vos solutions du TP3 sont sur le repo ?' },
    { author: 'Lucas Bernard',   content: 'Petite astuce : pour les BST, dessiner avant de coder change tout.' },
    { author: 'Hugo Petit',      content: 'Question bete : la profondeur d\'un AVL est bornee par 1.44 log n c\'est ca ?' },
    { author: 'Jean Durand',     content: 'Oui exactement, c\'est l\'invariant qui donne la complexite garantie.' },
  ],
  projets: [
    { author: 'Alice Martin',    content: 'On a fini la maquette Figma, je la share ce soir.' },
    { author: 'Jean Durand',     content: 'Reunion d\'equipe demain 10h, validez le creneau svp.' },
    { author: 'Mehdi Chaouki',   content: 'Le Kanban est a jour, j\'ai bouge les cartes en "En cours".' },
    { author: 'Sara Bouhassoun', content: 'Je m\'occupe de la doc technique, donnez-moi 1 jour.' },
    { author: 'Lea Rousseau',    content: 'Petit rappel : pensez a lier vos issues GitHub aux cartes Kanban.' },
  ],
}

// Variations d'edition appliquees par botEditOwn() : on ajoute un suffixe
// type "(edit: ...)" pour materialiser visuellement l'edition cote front
// (le badge `edited=1` est aussi positionne).
const EDIT_SUFFIXES = [
  ' (edit : typo)',
  ' (edit : merci)',
  ' (edit : precision)',
  ' (edit : oublie)',
]

let tickIv = null

// ────────────────────────────────────────────────────────────────────
//  Action 1 : POST — un bot publie un nouveau message
// ────────────────────────────────────────────────────────────────────
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

  return { type: 'post', id: result.lastInsertRowid, channelId: channel.id, content: tpl.content }
}

// ────────────────────────────────────────────────────────────────────
//  Action 2 : REACT — un bot ajoute une reaction emoji a un message
//
//  Pioche un message des 30 dernieres minutes (pour rester contextuel),
//  pioche un emoji du pool, append l'id d'un random student a la liste
//  reactions[emoji]. Le frontend re-rend automatiquement (polling ou
//  refetch). Idempotent : si le student a deja react, no-op.
// ────────────────────────────────────────────────────────────────────
function botReactToRecent(db, session) {
  if (Math.random() > REACT_PROBABILITY) return null

  // Cible : messages des 30 dernieres minutes, pas trop vieux. SQLite
  // datetime('now') retourne UTC ; les created_at sont aussi UTC ISO.
  const recentMessages = db.prepare(
    `SELECT id, reactions FROM demo_messages
     WHERE tenant_id = ?
       AND datetime(created_at) >= datetime('now', '-30 minutes')
     ORDER BY id DESC LIMIT 20`
  ).all(session.tenant_id)
  if (!recentMessages.length) return null

  const target = recentMessages[Math.floor(Math.random() * recentMessages.length)]
  const emoji  = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)]

  // Pioche un student aleatoire du tenant pour faire la reaction
  const reactor = db.prepare(
    `SELECT id FROM demo_students WHERE tenant_id = ? ORDER BY RANDOM() LIMIT 1`
  ).get(session.tenant_id)
  if (!reactor) return null

  // Parse les reactions existantes (peut etre null/vide). Format =
  // { emoji: [user_ids] }. Idempotent si reactor deja present.
  let reactions = {}
  if (target.reactions) {
    try { reactions = JSON.parse(target.reactions) } catch { /* corrupt : reset */ }
  }
  const ids = Array.isArray(reactions[emoji]) ? reactions[emoji] : []
  if (ids.includes(reactor.id)) return null // deja reagi
  reactions[emoji] = [...ids, reactor.id]

  db.prepare(
    `UPDATE demo_messages SET reactions = ? WHERE id = ? AND tenant_id = ?`
  ).run(JSON.stringify(reactions), target.id, session.tenant_id)

  return { type: 'react', messageId: target.id, emoji, reactorId: reactor.id }
}

// ────────────────────────────────────────────────────────────────────
//  Action 3 : EDIT — un bot edite un de SES messages recents
//
//  Pioche un message dont l'auteur est un student (pas le visiteur prof
//  ou etudiant), poste dans les 5 dernieres minutes (sinon ca paraitrait
//  bizarre d'editer un message vieux), pas deja edited. Append un suffixe
//  type "(edit : typo)" et set edited=1.
// ────────────────────────────────────────────────────────────────────
function botEditOwn(db, session) {
  if (Math.random() > EDIT_PROBABILITY) return null

  const candidate = db.prepare(
    `SELECT m.id, m.content, m.author_id FROM demo_messages m
     WHERE m.tenant_id = ?
       AND m.author_type = 'student'
       AND m.edited = 0
       AND datetime(m.created_at) >= datetime('now', '-5 minutes')
       AND m.author_id IN (SELECT id FROM demo_students WHERE tenant_id = ?)
     ORDER BY RANDOM() LIMIT 1`
  ).get(session.tenant_id, session.tenant_id)
  if (!candidate) return null

  const suffix = EDIT_SUFFIXES[Math.floor(Math.random() * EDIT_SUFFIXES.length)]
  const newContent = candidate.content + suffix

  db.prepare(
    `UPDATE demo_messages SET content = ?, edited = 1 WHERE id = ? AND tenant_id = ?`
  ).run(newContent, candidate.id, session.tenant_id)

  return { type: 'edit', messageId: candidate.id, suffix }
}

// ────────────────────────────────────────────────────────────────────
//  Tick principal : pour chaque session active, declenche les 3 actions.
//  Renvoie des compteurs pour les tests/observabilite.
// ────────────────────────────────────────────────────────────────────
function runOnce() {
  try {
    const db = getDemoDb()
    const sessions = db.prepare(
      `SELECT id, tenant_id FROM demo_sessions
       WHERE expires_at > datetime('now')`
    ).all()
    const stats = { sessions: sessions.length, posted: 0, reacted: 0, edited: 0 }
    for (const s of sessions) {
      if (postRandomBotMessage(db, s)) stats.posted++
      if (botReactToRecent(db, s))     stats.reacted++
      if (botEditOwn(db, s))           stats.edited++
    }
    return stats
  } catch (err) {
    // Pas d'unhandled rejection si la DB est ferme entre 2 ticks.
    return { sessions: 0, posted: 0, reacted: 0, edited: 0, error: err.message }
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

module.exports = {
  start,
  stop,
  runOnce,
  // Exporte les helpers individuels pour les tests qui veulent forcer
  // une action specifique (Math.random est non-deterministe sinon).
  postRandomBotMessage,
  botReactToRecent,
  botEditOwn,
  BOT_MESSAGES,
  REACT_EMOJIS,
}
