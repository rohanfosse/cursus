/**
 * Bots scriptes du mode demo (jalon V5 — bots intelligents).
 *
 * Worker leger qui scanne periodiquement les sessions demo actives et,
 * pour chaque session, declenche plusieurs actions probabilistes pour
 * creer l'illusion d'une "promo vivante" et reactive au visiteur.
 *
 * V5 ameliorations :
 *   - Tier 1 : reactivite au visiteur (replies @mention, reactions
 *     ciblees sur ses posts dans les 60s)
 *   - Tier 2 : personnalites stables par bot (pragmatique / curieuse /
 *     serviable / organisee / senior / discret)
 *   - Tier 3 : variance de longueur (court / moyen / long), awareness
 *     time-of-day (matin / journee / soir)
 *   - Tier 4 : edits realistes (vrais corrections, pas juste un suffixe),
 *     reactions threadees avec quote, bursts (rafale de messages)
 *
 * En NODE_ENV=test, le worker n'est PAS demarre automatiquement (laisse
 * les tests piloter manuellement via runOnce()).
 */
const { getDemoDb } = require('../db/demo-connection')

const TICK_INTERVAL_MS = 60_000

// Probabilites de chaque action par tick (independantes). Calibrees pour
// ressentir comme une promo active sans spammer.
const PROB = {
  replyToVisitor:  0.70, // SI le visiteur a poste recemment, 70% de reponse
  reactToVisitor:  0.55, // SI le visiteur a poste recemment, 55% de reaction
  post:            0.30, // post spontane (pas en reponse)
  reactToRecent:   0.20, // reaction sur message recent (pas du visiteur)
  editOwn:         0.08, // edit d'un message recent du bot
  burst:           0.10, // x3 actions ce tick (rafale)
}

// Pool d'emojis. 10 emojis neutres et universellement compris.
const REACT_EMOJIS = ['👍', '❤️', '🎉', '😂', '🤔', '🔥', '💡', '🙏', '✅', '👀']

// Reaction a un trigger contextuel (ex: si message contient "merci" -> ❤️).
// Utilise pour reagir intelligemment plutot qu'aleatoirement aux messages
// du visiteur.
function pickEmojiForContent(content) {
  const c = (content || '').toLowerCase()
  if (/merci|thanks|cimer/.test(c))               return '🙏'
  if (/bug|broken|cassed?|plante|crash/.test(c))  return '🔥' // ironique
  if (/```|<code>|=>|function|=== /.test(c))      return '🔥'
  if (/genial|top|super|cool|nickel/.test(c))     return '🎉'
  if (/mdr|lol|haha|ptdr/.test(c))                return '😂'
  if (/^https?:\/\//m.test(c))                    return '💡'
  if (/^\?/.test(c) || /\?$/.test(c.trim()))      return '🤔'
  // Default : 50/50 entre 👍 et ❤️
  return Math.random() < 0.5 ? '👍' : '❤️'
}

// ────────────────────────────────────────────────────────────────────
//  Personnalites des bots
//
//  Chaque bot a un caractere stable et un pool de phrases qui colle
//  a ce caractere. Le visiteur voit toujours Lucas comme le pragmatique,
//  Sara comme la curieuse, etc. Ca rend la conversation lisible —
//  on reconnait qui parle.
// ────────────────────────────────────────────────────────────────────
const PERSONAS = {
  'Lucas Bernard': {
    style: 'pragmatique',
    favChannels: ['developpement-web', 'projets'],
    short: ['ok', 'noted', 'top', 'ca marche', 'go', 'merci'],
    medium: [
      'J\'ai update la branche main, pensez a faire un pull.',
      'Tests CI passent, je deploy la preview.',
      'Le bug du form valide au 1er render est fixe.',
      'PR pretes pour review, ca presse pas.',
      'Push fait, attendez 30s pour le deploy.',
    ],
    long: [
      'J\'ai refactore le module auth ce matin :\n```js\nconst session = await verify(token)\nreturn session?.user ?? null\n```\nC\'est plus lisible et evite la double-promise. Review bienvenue.',
    ],
    questions: [
      'Quelqu\'un d\'autre a le bug du loader infini sur Safari ?',
      'On part sur fetch ou axios pour ce projet ?',
    ],
  },
  'Sara Bouhassoun': {
    style: 'curieuse',
    favChannels: ['algorithmique', 'developpement-web'],
    short: ['ah ok', 'genial', 'jamais entendu', 'wow', 'curieuse'],
    medium: [
      'Je viens de tester, ca marche super bien.',
      'Je vais relire la doc, je suis pas sure d\'avoir compris.',
      'Du coup la rotation double c\'est juste 2 simples a la suite ?',
    ],
    long: [],
    questions: [
      'Quelqu\'un a compris la rotation double ? Je bloque sur le cas gauche-droite.',
      'Pourquoi argon2 plutot que bcrypt ? Les deux sont pas surs ?',
      'C\'est quoi la difference entre BFS et DFS deja ?',
      'Vous prenez quoi comme editeur ? VS Code suffit ou y a mieux ?',
    ],
  },
  'Mehdi Chaouki': {
    style: 'serviable',
    favChannels: ['projets', 'algorithmique'],
    short: ['je share', 'voila', 'check ca', 'utile ?'],
    medium: [
      'Mon schema rotations AVL : github.com/mehdi-c/avl-cheatsheet — fork si besoin.',
      'J\'ai trouve un visualiseur sympa pour les arbres : usfca.edu/galles.',
      'Pour les tests, regarde Vitest, c\'est plus rapide que Jest.',
    ],
    long: [
      'Petit tip pour ceux qui galerent avec npm install :\n```bash\nrm -rf node_modules package-lock.json\nnpm install\n```\nResolu 80% des cas chez moi.',
    ],
    questions: [],
  },
  'Alice Martin': {
    style: 'organisee',
    favChannels: ['general', 'projets'],
    short: ['ok pour moi', 'note', 'ajoute au kanban'],
    medium: [
      'On se voit dans la salle B204 a 14h pour la review.',
      'Reunion d\'equipe demain 10h, validez le creneau svp.',
      'Le Kanban est a jour, j\'ai bouge les cartes en "En cours".',
      'La maquette Figma est prete, je share ce soir.',
    ],
    long: [],
    questions: [
      'On garde Trello ou on switch sur le Kanban Cursus ?',
    ],
  },
  'Jean Durand': {
    style: 'senior',
    favChannels: ['algorithmique', 'developpement-web'],
    short: ['exactement', 'bon point', 'piege classique'],
    medium: [
      'L\'invariant AVL garantit une profondeur en O(log n) — voila pourquoi l\'insertion reste log.',
      'Pense a ajouter `npm audit` au workflow, ca break si une dep critique est detectee.',
      'CORS, c\'est l\'origine exacte qui doit matcher cote serveur. Pas `*` avec credentials.',
    ],
    long: [
      'Pour le `balanceFactor` :\n```python\ndef balance(node):\n    return height(node.left) - height(node.right)\n```\nSi > 1 et fils gauche < 0, rotation gauche-droite. Sinon, simple droite.',
    ],
    questions: [],
  },
  'Hugo Petit': {
    style: 'discret',
    favChannels: ['general', 'algorithmique'],
    short: ['ok', 'merci', 'noté', 'compris', 'oki', '+1'],
    medium: [
      'Je vais y reflechir.',
      'Je note pour vendredi.',
      'Je teste ce soir.',
    ],
    long: [],
    questions: [],
  },
  'Lea Rousseau': {
    style: 'organisee',
    favChannels: ['general', 'projets'],
    short: ['ok', 'reçu', 'à demain'],
    medium: [
      'Petit rappel : le formulaire d\'evaluation est ouvert jusqu\'a vendredi.',
      'Je reste 5 min apres le cours pour les questions.',
    ],
    long: [],
    questions: [],
  },
}

// Replies au visiteur : matcher (regex) -> reply template. Utilise quand
// le visiteur a poste un message recemment (les bots "lui repondent").
// Le {NAME} est interpole avec le prenom du visiteur, {Q} avec sa question.
const VISITOR_REPLIES = [
  // Salutations
  { match: /^(salut|hello|coucou|hi|yo|bonjour)/i,
    replies: ['Salut {NAME} !', 'Hello {NAME}, ca va ?', '@{NAME} bonjour'] },
  // Remerciements
  { match: /\b(merci|thanks|cimer)\b/i,
    replies: ['De rien {NAME} !', '@{NAME} avec plaisir', 'Pas de souci'] },
  // Questions sur le code
  { match: /(comment|pourquoi|c'est quoi|quoi)\s+.*(\?|$)/i,
    replies: [
      '@{NAME} bonne question, j\'allais demander la meme chose',
      'Je crois qu\'il y a la doc dans Lumen, regarde le chap 2',
      'Hmm pas sur, mais regarde dans Documents > Cours',
      '@{NAME} je crois c\'est explique dans le cours d\'hier',
    ] },
  // Help / blocked
  { match: /\b(aide|help|bloque|galere|comprend pas|comprends pas)\b/i,
    replies: [
      '@{NAME} je peux t\'aider, raconte ?',
      'Tu peux poster un screen ?',
      'On en parle apres le cours si tu veux',
    ] },
  // Code / techie
  { match: /```|`[^`]+`|=>|=== |function|const \w+ =/i,
    replies: [
      '@{NAME} ah c\'est propre ca',
      'Tu peux pousser sur le repo qu\'on regarde ?',
      'Marche chez moi, weird',
    ] },
  // Question generale (finit par ?)
  { match: /\?\s*$/,
    replies: [
      '@{NAME} laisse-moi 5 min je regarde',
      'Bonne question, qui sait ?',
      'Hmm je crois que oui mais a verifier',
      '@{NAME} je dirais oui, mais Jean confirmera',
    ] },
  // Default / catch-all
  { match: /.*/,
    replies: [
      '@{NAME} ok',
      '@{NAME} +1',
      '@{NAME} carrement',
      '@{NAME} bien vu',
      'Vu',
      '+1',
    ] },
]

// Variations d'edition : vraies corrections sur le texte plutot qu'un
// suffixe colle. Pioche un pattern qui matche le contenu original.
const EDIT_PATTERNS = [
  // Typos courantes
  { from: /\bvraimt\b/gi,    to: 'vraiment' },
  { from: /\btres\b(?! [a-z])/gi, to: 'tres' },
  { from: /\bdu cou\b/gi,    to: 'du coup' },
  { from: /\bptetre\b/gi,    to: 'peut-etre' },
  // Espace insecable FR avant ponctuation forte
  { from: / ?\?$/,           to: ' ?' },
  { from: / ?!$/,            to: ' !' },
  { from: / ?:(\s|$)/,       to: ' :$1' },
  // Extension : remplace point final par ", ..."
  { from: /\.$/,             to: ', du coup je teste.' },
  { from: /\.$/,             to: ' (a confirmer).' },
  // Ajout d'un emoji discret
  { from: /(\bok\b)$/i,      to: 'ok 👍' },
]

let tickIv = null

// ────────────────────────────────────────────────────────────────────
//  Helpers communs
// ────────────────────────────────────────────────────────────────────

function pickRandom(arr) {
  if (!arr || !arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

function getStudentByName(db, tenantId, name) {
  return db.prepare(
    `SELECT id, name, avatar_initials FROM demo_students
     WHERE tenant_id = ? AND name = ?`
  ).get(tenantId, name)
}

function getChannels(db, tenantId) {
  return db.prepare(
    `SELECT id, name FROM demo_channels WHERE tenant_id = ?`
  ).all(tenantId)
}

/** Renvoie l'heure du serveur en 'morning' | 'day' | 'evening' | 'night'. */
function timeOfDay() {
  const h = new Date().getHours()
  if (h >= 6  && h < 11) return 'morning'
  if (h >= 11 && h < 18) return 'day'
  if (h >= 18 && h < 23) return 'evening'
  return 'night'
}

/**
 * Pioche un message dans les pools d'une persona, avec variance de longueur :
 * 50% court, 35% medium, 15% long. Retourne null si le pool retenu est vide
 * (la persona peut ne pas avoir de "long" par exemple).
 */
function pickPersonaMessage(persona, prefer = 'mixed') {
  const r = Math.random()
  let pool = null
  if (prefer === 'short')   pool = persona.short
  else if (prefer === 'medium') pool = persona.medium
  else if (prefer === 'long')   pool = persona.long
  else if (prefer === 'question') pool = persona.questions
  else {
    // Mixed : 50% short, 35% medium, 15% long. Si pool vide, fallback medium.
    if (r < 0.50)      pool = persona.short
    else if (r < 0.85) pool = persona.medium
    else               pool = persona.long
  }
  return pickRandom(pool) || pickRandom(persona.medium) || pickRandom(persona.short)
}

/** Pioche une persona qui a ce canal dans ses favoris. */
function pickPersonaForChannel(channelName) {
  const candidates = Object.entries(PERSONAS).filter(([_, p]) => p.favChannels.includes(channelName))
  const [name, persona] = pickRandom(candidates) || pickRandom(Object.entries(PERSONAS))
  return { name, persona }
}

/**
 * Insert un message d'un bot. Resout l'auteur dans demo_students du tenant.
 * Skip silencieusement si le message est identique au dernier du canal
 * (avoid spam) ou si l'auteur n'existe pas (seed corrompu, peu probable).
 */
function insertBotMessage(db, tenantId, channelId, authorName, content) {
  const author = getStudentByName(db, tenantId, authorName)
  if (!author) return null

  const lastMsg = db.prepare(
    `SELECT content FROM demo_messages WHERE tenant_id = ? AND channel_id = ?
     ORDER BY id DESC LIMIT 1`
  ).get(tenantId, channelId)
  if (lastMsg && lastMsg.content === content) return null

  const result = db.prepare(
    `INSERT INTO demo_messages
       (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content)
     VALUES (?, ?, ?, ?, 'student', ?, ?)`
  ).run(tenantId, channelId, author.id, author.name, author.avatar_initials, content)

  return { id: result.lastInsertRowid, channelId, content, authorName }
}

// ────────────────────────────────────────────────────────────────────
//  Action 1 : POST spontane (sans visiteur recent)
// ────────────────────────────────────────────────────────────────────
function postSpontaneous(db, session) {
  const channels = getChannels(db, session.tenant_id)
  if (!channels.length) return null

  // Pioche un canal random, puis une persona qui aime ce canal
  const channel = pickRandom(channels)
  const { name: authorName, persona } = pickPersonaForChannel(channel.name)

  // Time-of-day : la nuit on poste rarement et plus court ; soir = + posts
  const tod = timeOfDay()
  if (tod === 'night' && Math.random() < 0.7) return null

  const prefer = tod === 'morning' ? 'short' : (tod === 'evening' ? 'mixed' : 'mixed')
  const content = pickPersonaMessage(persona, prefer)
  if (!content) return null

  const inserted = insertBotMessage(db, session.tenant_id, channel.id, authorName, content)
  return inserted ? { type: 'post', ...inserted } : null
}

// ────────────────────────────────────────────────────────────────────
//  Action 2 : REPLY au visiteur
//
//  Le visiteur a poste un message dans les 90 dernieres secondes ?
//  Un bot lui repond avec @mention et un template adapte au contenu
//  (regex matching). Au plus 1 reply par message visiteur (`replied_at`
//  pseudo-flag : on regarde si un message bot vient APRES le sien et
//  contient son @mention dans le meme canal).
// ────────────────────────────────────────────────────────────────────
function replyToVisitor(db, session, visitorName) {
  // Pioche le dernier message du visiteur, recent et non-encore-replied
  const lastVisitorMsg = db.prepare(
    `SELECT m.id, m.channel_id, m.content, m.author_name FROM demo_messages m
     WHERE m.tenant_id = ?
       AND m.author_type IN ('student', 'teacher')
       AND m.author_name = ?
       AND datetime(m.created_at) >= datetime('now', '-90 seconds')
     ORDER BY m.id DESC LIMIT 1`
  ).get(session.tenant_id, visitorName)
  if (!lastVisitorMsg) return null

  // Deja replied ? On cherche un message bot apres celui-ci dans le meme
  // canal qui contient @<prenom du visiteur>.
  const firstName = visitorName.split(' ')[0]
  const alreadyReplied = db.prepare(
    `SELECT 1 FROM demo_messages
     WHERE tenant_id = ? AND channel_id = ? AND id > ?
       AND content LIKE ?
     LIMIT 1`
  ).get(session.tenant_id, lastVisitorMsg.channel_id, lastVisitorMsg.id, `%@${firstName}%`)
  if (alreadyReplied) return null

  // Trouve un template qui matche
  const template = VISITOR_REPLIES.find(t => t.match.test(lastVisitorMsg.content)) || VISITOR_REPLIES[VISITOR_REPLIES.length - 1]
  const reply = pickRandom(template.replies).replace(/\{NAME\}/g, firstName)

  // Pioche une persona compatible avec le canal
  const channelInfo = db.prepare(
    `SELECT name FROM demo_channels WHERE id = ? AND tenant_id = ?`
  ).get(lastVisitorMsg.channel_id, session.tenant_id)
  if (!channelInfo) return null
  const { name: authorName } = pickPersonaForChannel(channelInfo.name)

  const inserted = insertBotMessage(db, session.tenant_id, lastVisitorMsg.channel_id, authorName, reply)
  return inserted ? { type: 'reply', visitorMsgId: lastVisitorMsg.id, ...inserted } : null
}

// ────────────────────────────────────────────────────────────────────
//  Action 3 : REACT au visiteur (recente)
// ────────────────────────────────────────────────────────────────────
function reactToVisitor(db, session, visitorName) {
  const lastVisitorMsg = db.prepare(
    `SELECT id, content, reactions FROM demo_messages
     WHERE tenant_id = ?
       AND author_name = ?
       AND datetime(created_at) >= datetime('now', '-60 seconds')
     ORDER BY id DESC LIMIT 1`
  ).get(session.tenant_id, visitorName)
  if (!lastVisitorMsg) return null

  const emoji = pickEmojiForContent(lastVisitorMsg.content)
  const reactor = db.prepare(
    `SELECT id FROM demo_students WHERE tenant_id = ? ORDER BY RANDOM() LIMIT 1`
  ).get(session.tenant_id)
  if (!reactor) return null

  let reactions = {}
  if (lastVisitorMsg.reactions) {
    try { reactions = JSON.parse(lastVisitorMsg.reactions) } catch { /* corrupt : reset */ }
  }
  const ids = Array.isArray(reactions[emoji]) ? reactions[emoji] : []
  if (ids.includes(reactor.id)) return null
  reactions[emoji] = [...ids, reactor.id]

  db.prepare(
    `UPDATE demo_messages SET reactions = ? WHERE id = ? AND tenant_id = ?`
  ).run(JSON.stringify(reactions), lastVisitorMsg.id, session.tenant_id)

  return { type: 'react-visitor', messageId: lastVisitorMsg.id, emoji, reactorId: reactor.id }
}

// ────────────────────────────────────────────────────────────────────
//  Action 4 : REACT a un message recent (pas du visiteur)
// ────────────────────────────────────────────────────────────────────
function reactToRecent(db, session, visitorName) {
  // Cible : messages des 30 dernieres minutes, NON-postes par le visiteur
  // (sinon double avec reactToVisitor).
  const recentMessages = db.prepare(
    `SELECT id, content, reactions FROM demo_messages
     WHERE tenant_id = ?
       AND author_name != ?
       AND datetime(created_at) >= datetime('now', '-30 minutes')
     ORDER BY id DESC LIMIT 20`
  ).all(session.tenant_id, visitorName)
  if (!recentMessages.length) return null

  const target = pickRandom(recentMessages)
  // Reaction contextuelle plutot qu'aleatoire
  const emoji = pickEmojiForContent(target.content)
  const reactor = db.prepare(
    `SELECT id FROM demo_students WHERE tenant_id = ? ORDER BY RANDOM() LIMIT 1`
  ).get(session.tenant_id)
  if (!reactor) return null

  let reactions = {}
  if (target.reactions) {
    try { reactions = JSON.parse(target.reactions) } catch { /* corrupt : reset */ }
  }
  const ids = Array.isArray(reactions[emoji]) ? reactions[emoji] : []
  if (ids.includes(reactor.id)) return null
  reactions[emoji] = [...ids, reactor.id]

  db.prepare(
    `UPDATE demo_messages SET reactions = ? WHERE id = ? AND tenant_id = ?`
  ).run(JSON.stringify(reactions), target.id, session.tenant_id)

  return { type: 'react', messageId: target.id, emoji, reactorId: reactor.id }
}

// ────────────────────────────────────────────────────────────────────
//  Action 5 : EDIT realiste — vraies corrections, pas un suffixe colle
// ────────────────────────────────────────────────────────────────────
function botEditOwn(db, session) {
  const candidate = db.prepare(
    `SELECT m.id, m.content, m.author_id FROM demo_messages m
     WHERE m.tenant_id = ?
       AND m.author_type = 'student'
       AND m.edited = 0
       AND datetime(m.created_at) >= datetime('now', '-5 minutes')
       AND m.author_id IN (SELECT id FROM demo_students WHERE tenant_id = ?)
     ORDER BY RANDOM() LIMIT 5`
  ).all(session.tenant_id, session.tenant_id)
  if (!candidate.length) return null

  // Cherche un candidat dont le contenu matche au moins un EDIT_PATTERN.
  // Sinon (aucun match), append un suffixe simple comme fallback.
  let edited = null
  for (const c of candidate) {
    for (const p of EDIT_PATTERNS) {
      if (p.from.test(c.content)) {
        edited = { id: c.id, content: c.content.replace(p.from, p.to) }
        break
      }
    }
    if (edited) break
  }
  if (!edited) {
    const c = candidate[0]
    edited = { id: c.id, content: c.content + ' (edit)' }
  }

  db.prepare(
    `UPDATE demo_messages SET content = ?, edited = 1 WHERE id = ? AND tenant_id = ?`
  ).run(edited.content, edited.id, session.tenant_id)

  return { type: 'edit', messageId: edited.id }
}

// ────────────────────────────────────────────────────────────────────
//  Tick principal
//
//  Pour chaque session active :
//    1. Identifie le visiteur (via demo_sessions.user_name)
//    2. Si visiteur a poste recemment : tente reply + react cibles
//    3. Sinon : tente post spontane
//    4. Toujours : tente reactToRecent + editOwn
//    5. Burst : 10% de chance de re-tirer 2 actions de plus
//
//  Renvoie des compteurs par type pour observabilite.
// ────────────────────────────────────────────────────────────────────
function runOnceForSession(db, session) {
  const stats = { posted: 0, replied: 0, reactedVisitor: 0, reacted: 0, edited: 0 }

  // Identifie le visiteur (le user_name dans demo_sessions est le pseudo
  // du currentUser : "Emma Lefevre" pour student, "Prof. Lemaire" pour teacher)
  const visitorName = session.user_name || ''

  // Detection "visiteur a poste recemment" — feature Tier 1.1/1.2
  const visitorPostedRecently = db.prepare(
    `SELECT 1 FROM demo_messages
     WHERE tenant_id = ? AND author_name = ?
       AND datetime(created_at) >= datetime('now', '-90 seconds')
     LIMIT 1`
  ).get(session.tenant_id, visitorName)

  // 1. Si le visiteur a parle, on repond/reagit prioritairement
  if (visitorPostedRecently) {
    if (Math.random() < PROB.replyToVisitor) {
      if (replyToVisitor(db, session, visitorName)) stats.replied++
    }
    if (Math.random() < PROB.reactToVisitor) {
      if (reactToVisitor(db, session, visitorName)) stats.reactedVisitor++
    }
  } else {
    // 2. Sinon, post spontane
    if (Math.random() < PROB.post) {
      if (postSpontaneous(db, session)) stats.posted++
    }
  }

  // 3. Reaction sur un message recent quelconque (toujours, en plus)
  if (Math.random() < PROB.reactToRecent) {
    if (reactToRecent(db, session, visitorName)) stats.reacted++
  }

  // 4. Edit d'un message recent du bot (toujours, faible probabilite)
  if (Math.random() < PROB.editOwn) {
    if (botEditOwn(db, session)) stats.edited++
  }

  // 5. Burst : rejoue 2 actions de plus (post + react) — donne l'effet
  // "rafale de discussion" comme dans une vraie conversation qui decolle.
  if (Math.random() < PROB.burst) {
    if (postSpontaneous(db, session)) stats.posted++
    if (reactToRecent(db, session, visitorName)) stats.reacted++
  }

  return stats
}

function runOnce() {
  try {
    const db = getDemoDb()
    const sessions = db.prepare(
      `SELECT id, tenant_id, user_name FROM demo_sessions
       WHERE expires_at > datetime('now')`
    ).all()
    const total = { sessions: sessions.length, posted: 0, replied: 0, reactedVisitor: 0, reacted: 0, edited: 0 }
    for (const s of sessions) {
      const got = runOnceForSession(db, s)
      total.posted          += got.posted
      total.replied         += got.replied
      total.reactedVisitor  += got.reactedVisitor
      total.reacted         += got.reacted
      total.edited          += got.edited
    }
    return total
  } catch (err) {
    return { sessions: 0, posted: 0, replied: 0, reactedVisitor: 0, reacted: 0, edited: 0, error: err.message }
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
  // Exports pour les tests qui veulent forcer une action specifique
  postSpontaneous,
  replyToVisitor,
  reactToVisitor,
  reactToRecent,
  botEditOwn,
  pickEmojiForContent,
  PERSONAS,
  REACT_EMOJIS,
  VISITOR_REPLIES,
  EDIT_PATTERNS,
}
