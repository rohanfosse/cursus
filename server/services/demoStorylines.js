/**
 * Trames narratives jouees pendant une session demo. Au lieu de laisser
 * les bots poster aleatoirement (tick demoBots), une storyline orchestre
 * une suite d'evenements coherents (annonce prof -> question -> reponse
 * + reaction -> rebondissement) sur ~5 min. Le visiteur a l'impression
 * de suivre une vraie tranche de vie de la promo.
 *
 * 3 storylines tournent au hasard pour eviter la monotonie sur visites
 * repetees. Chaque storyline est une liste d'evenements avec un timing
 * relatif au /start. Au /demo/start, on schedule un setTimeout par
 * evenement qui declenche l'action correspondante.
 *
 * Coexiste avec demoBots tick : les bots aleatoires ajoutent du grain
 * autour des moments scriptes, et reagissent au visiteur quand il poste.
 *
 * Skippe en NODE_ENV=test pour preserver les tests deterministes.
 */

const { getDemoDb } = require('../db/demo-connection')

// ────────────────────────────────────────────────────────────────────
//  Storylines : chacune = liste d'evenements scriptes sur ~5 min
// ────────────────────────────────────────────────────────────────────

/**
 * Storyline "Auth & deadline projet web" — 12 evenements sur 5 min.
 * Centre sur le canal developpement-web + general. Bons rebondissements :
 * prof annonce -> question Sara -> reponse Jean -> reaction Sara -> Lucas
 * push -> Alice valide -> rappel Lea -> recap final.
 */
const STORY_AUTH = [
  { at:  30, channel: 'general',           author: 'Prof. Lemaire',    type: 'post',     content: 'Petit rappel : le rendu du Projet Web E4 c\'est vendredi 17h. Pensez aux tests + au deploy.' },
  { at:  75, channel: 'developpement-web', author: 'Sara Bouhassoun',  type: 'post',     content: 'Question (peut-etre stupide) : argon2id vs bcrypt, c\'est quoi la difference pratique ?' },
  { at: 105, channel: 'developpement-web', author: 'Jean Durand',      type: 'typing-then-post', content: 'argon2 = memoire-dur, bloque les GPU farms. bcrypt c\'etait le standard mais argon2id est recommande OWASP 2024.' },
  { at: 130, target: { channel: 'developpement-web', author: 'Jean Durand', contains: 'argon2 = memoire-dur' }, type: 'react', emoji: '🙏', reactor: 'Sara Bouhassoun' },
  { at: 165, channel: 'developpement-web', author: 'Lucas Bernard',    type: 'typing-then-post', content: 'Quelqu\'un peut review feat/auth-module ce soir ? J\'ai push le JWT + refresh token.' },
  { at: 190, target: { channel: 'developpement-web', author: 'Lucas Bernard', contains: 'feat/auth-module' }, type: 'react', emoji: '👀', reactor: 'Alice Martin' },
  { at: 220, channel: 'developpement-web', author: 'Alice Martin',     type: 'typing-then-post', content: '@Lucas je passe vers 21h. Tu veux qu\'on mob ou async PR ?' },
  { at: 250, channel: 'projets',           author: 'Mehdi Chaouki',    type: 'post',     content: 'J\'ai trouve un visualiseur AVL super : usfca.edu/galles/visualization/AVLtree.html. Cliquez "Insert" pour voir les rotations en live.' },
  { at: 280, target: { channel: 'projets', author: 'Mehdi Chaouki', contains: 'visualiseur AVL' }, type: 'react', emoji: '💡', reactor: 'Emma Lefevre' },
  { at: 285, target: { channel: 'projets', author: 'Mehdi Chaouki', contains: 'visualiseur AVL' }, type: 'react', emoji: '💡', reactor: 'Jean Durand' },
  { at: 290, target: { channel: 'projets', author: 'Mehdi Chaouki', contains: 'visualiseur AVL' }, type: 'react', emoji: '💡', reactor: 'Sara Bouhassoun' },
  { at: 320, channel: 'general',           author: 'Lea Rousseau',     type: 'post',     content: 'Petit rappel : le formulaire d\'eval semestre est ouvert jusqu\'a vendredi. 5 min, ca aide vraiment l\'equipe pour le S2.' },
]

/**
 * Storyline "Algo & TP4 AVL" — focus sur le canal algorithmique.
 */
const STORY_AVL = [
  { at:  30, channel: 'algorithmique',     author: 'Prof. Lemaire',    type: 'post',     content: 'Le TP4 sur les arbres AVL est en ligne. Implementez les 4 rotations + un benchmark vs BST. Rendu mardi 18h.' },
  { at:  80, channel: 'algorithmique',     author: 'Hugo Petit',       type: 'typing-then-post', content: 'Je bloque sur la rotation gauche-droite, c\'est pas la meme chose que rotation gauche puis droite ?' },
  { at: 115, channel: 'algorithmique',     author: 'Sara Bouhassoun',  type: 'typing-then-post', content: '@Hugo en fait si, c\'est exactement ca : tu fais d\'abord rotate_left sur le fils gauche puis rotate_right sur le noeud. C\'est juste le nom du cas (LR) qui prete a confusion.' },
  { at: 150, target: { channel: 'algorithmique', author: 'Sara Bouhassoun', contains: 'rotate_left sur le fils gauche' }, type: 'react', emoji: '🙏', reactor: 'Hugo Petit' },
  { at: 180, channel: 'algorithmique',     author: 'Jean Durand',      type: 'typing-then-post', content: 'Pour debugger le balanceFactor, ajoutez un log de la hauteur a chaque insert. Vous verrez tres vite ou ca part en sucette.' },
  { at: 215, channel: 'algorithmique',     author: 'Mehdi Chaouki',    type: 'post',     content: 'Mon schema des 4 cas (LL, RR, LR, RL) est sur mon github : github.com/mehdi-c/avl-cheatsheet. Fork-le si ca aide.' },
  { at: 245, target: { channel: 'algorithmique', author: 'Mehdi Chaouki', contains: 'avl-cheatsheet' }, type: 'react', emoji: '🔥', reactor: 'Emma Lefevre' },
  { at: 250, target: { channel: 'algorithmique', author: 'Mehdi Chaouki', contains: 'avl-cheatsheet' }, type: 'react', emoji: '🔥', reactor: 'Lucas Bernard' },
  { at: 280, channel: 'general',           author: 'Prof. Lemaire',    type: 'post',     content: 'Le Live AVL demarre dans 30 min, code AVL-2026 dispo sur l\'onglet Live.' },
  { at: 320, channel: 'algorithmique',     author: 'Alice Martin',     type: 'typing-then-post', content: 'On se voit en B204 a 10h pour la review collective avant le live ?' },
]

/**
 * Storyline "Soutenance & equipes" — focus sur la coordination projet.
 */
const STORY_SOUTENANCE = [
  { at:  30, channel: 'general',           author: 'Prof. Lemaire',    type: 'post',     content: 'Les creneaux de soutenance Projet Web E4 sont ouverts. Reservez votre slot sur l\'onglet Rendez-vous, 15 min par equipe.' },
  { at:  85, channel: 'projets',           author: 'Emma Lefevre',     type: 'typing-then-post', content: 'Notre equipe (Lucas, Sara, Jean) prend le creneau lundi 14h ?' },
  { at: 110, target: { channel: 'projets', author: 'Emma Lefevre', contains: 'lundi 14h' }, type: 'react', emoji: '✅', reactor: 'Lucas Bernard' },
  { at: 115, target: { channel: 'projets', author: 'Emma Lefevre', contains: 'lundi 14h' }, type: 'react', emoji: '✅', reactor: 'Sara Bouhassoun' },
  { at: 120, target: { channel: 'projets', author: 'Emma Lefevre', contains: 'lundi 14h' }, type: 'react', emoji: '✅', reactor: 'Jean Durand' },
  { at: 160, channel: 'developpement-web', author: 'Sara Bouhassoun',  type: 'typing-then-post', content: 'Les diapos finales sont dans le drive equipe-2 (8 slides max comme demande). Relisez ce soir si possible.' },
  { at: 200, channel: 'developpement-web', author: 'Lucas Bernard',    type: 'typing-then-post', content: 'Vu, j\'ajoute la demo gif pour la slide 5. La page de login en 4 secondes ca fait son effet.' },
  { at: 230, target: { channel: 'developpement-web', author: 'Lucas Bernard', contains: 'demo gif' }, type: 'react', emoji: '🎉', reactor: 'Sara Bouhassoun' },
  { at: 260, channel: 'projets',           author: 'Alice Martin',     type: 'typing-then-post', content: 'Petit conseil pour les soutenances : timer dans la diapo, ca evite de deborder. On a vu deux equipes l\'an dernier finir avant la conclusion.' },
  { at: 295, target: { channel: 'projets', author: 'Alice Martin', contains: 'timer dans la diapo' }, type: 'react', emoji: '💡', reactor: 'Mehdi Chaouki' },
  { at: 330, channel: 'general',           author: 'Lea Rousseau',     type: 'post',     content: 'N\'oubliez pas : badge etudiant a l\'entree, et arrivee 10 min en avance pour le brief jury.' },
]

const ALL_STORIES = [STORY_AUTH, STORY_AVL, STORY_SOUTENANCE]

// ────────────────────────────────────────────────────────────────────
//  Helpers DB (resolution channel + bot par nom)
// ────────────────────────────────────────────────────────────────────

function getChannelByName(db, tenantId, name) {
  return db.prepare(
    `SELECT id FROM demo_channels WHERE tenant_id = ? AND name = ?`
  ).get(tenantId, name)
}

function getStudentByName(db, tenantId, name) {
  return db.prepare(
    `SELECT id, name, avatar_initials FROM demo_students WHERE tenant_id = ? AND name = ?`
  ).get(tenantId, name)
}

function getTeacherByName(db, tenantId, name) {
  return db.prepare(
    `SELECT id, name FROM demo_teachers WHERE tenant_id = ? AND name = ?`
  ).get(tenantId, name)
}

function findRecentMessage(db, tenantId, target) {
  const channel = getChannelByName(db, tenantId, target.channel)
  if (!channel) return null
  return db.prepare(
    `SELECT id, content, reactions FROM demo_messages
     WHERE tenant_id = ? AND channel_id = ? AND author_name = ?
       AND content LIKE ?
       AND datetime(created_at) >= datetime('now', '-5 minutes')
     ORDER BY id DESC LIMIT 1`
  ).get(tenantId, channel.id, target.author, `%${target.contains}%`)
}

// ────────────────────────────────────────────────────────────────────
//  Insertion d'evenements
// ────────────────────────────────────────────────────────────────────

function insertPost(db, tenantId, channelName, authorName, content) {
  const channel = getChannelByName(db, tenantId, channelName)
  if (!channel) return null

  // Auteur peut etre prof (id negatif) ou student
  let authorId, authorType, authorInitials
  const teacher = getTeacherByName(db, tenantId, authorName)
  if (teacher) {
    authorId = -teacher.id
    authorType = 'teacher'
    authorInitials = teacher.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
  } else {
    const student = getStudentByName(db, tenantId, authorName)
    if (!student) return null
    authorId = student.id
    authorType = 'student'
    authorInitials = student.avatar_initials
  }

  // Skip si meme contenu en haut du canal (eviter les doublons si on rejoue)
  const last = db.prepare(
    `SELECT content FROM demo_messages WHERE tenant_id = ? AND channel_id = ?
     ORDER BY id DESC LIMIT 1`
  ).get(tenantId, channel.id)
  if (last && last.content === content) return null

  const result = db.prepare(
    `INSERT INTO demo_messages
       (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(tenantId, channel.id, authorId, authorName, authorType, authorInitials, content)

  return { id: result.lastInsertRowid, channelId: channel.id }
}

function addReaction(db, tenantId, msgId, emoji, reactorName) {
  const reactor = getStudentByName(db, tenantId, reactorName)
  if (!reactor) return null

  const msg = db.prepare(
    `SELECT reactions FROM demo_messages WHERE id = ? AND tenant_id = ?`
  ).get(msgId, tenantId)
  if (!msg) return null

  let reactions = {}
  if (msg.reactions) {
    try { reactions = JSON.parse(msg.reactions) } catch { /* corrupt : reset */ }
  }
  // Format enrichi { count, users[] } (cf. stores/messages.ts initReactions)
  let entry = reactions[emoji]
  if (!entry || typeof entry !== 'object' || !('count' in entry)) {
    entry = { count: 0, users: [] }
  }
  if (entry.users.includes(reactor.name)) return null
  entry.count = (entry.count || 0) + 1
  entry.users = [...(entry.users || []), reactor.name]
  reactions[emoji] = entry

  db.prepare(
    `UPDATE demo_messages SET reactions = ? WHERE id = ? AND tenant_id = ?`
  ).run(JSON.stringify(reactions), msgId, tenantId)
  return { msgId, emoji }
}

// ────────────────────────────────────────────────────────────────────
//  Scheduler : declenche chaque evenement a son timing
//
//  Approche : on stocke les timers par tenant pour pouvoir les cancel
//  au /demo/end (sinon les setTimeout continuent de firer apres la
//  purge du tenant et essaient d'inserer dans une session morte).
// ────────────────────────────────────────────────────────────────────
const _activeTimers = new Map() // tenantId -> Set<timer>

function _track(tenantId, timer) {
  let set = _activeTimers.get(tenantId)
  if (!set) { set = new Set(); _activeTimers.set(tenantId, set) }
  set.add(timer)
}

function cancelStoryline(tenantId) {
  const set = _activeTimers.get(tenantId)
  if (!set) return
  for (const t of set) clearTimeout(t)
  _activeTimers.delete(tenantId)
}

function pickStoryline() {
  return ALL_STORIES[Math.floor(Math.random() * ALL_STORIES.length)]
}

/**
 * Lance une storyline pour un tenant. Schedule un setTimeout par evenement
 * (offset depuis maintenant). Optionnellement appelle setTyping cote
 * demoBots pour les events 'typing-then-post' afin que l'indicateur
 * soit visible 2.5s avant le post.
 */
function startStoryline(tenantId, options = {}) {
  if (process.env.NODE_ENV === 'test') return null
  const story = options.story || pickStoryline()

  // Pour la coordination avec le typing indicator
  let demoBots = null
  try { demoBots = require('./demoBots') } catch { /* circular safety */ }

  for (const ev of story) {
    const timer = setTimeout(() => {
      try {
        const db = getDemoDb()
        if (ev.type === 'post') {
          insertPost(db, tenantId, ev.channel, ev.author, ev.content)
        } else if (ev.type === 'typing-then-post') {
          // Pose le flag typing 2.5s avant le post, pour cooperer avec
          // useDemoTyping cote front.
          const channel = getChannelByName(db, tenantId, ev.channel)
          if (channel && demoBots?.setTyping) {
            demoBots.setTyping(tenantId, channel.id, ev.author, 3000)
          }
          const insertTimer = setTimeout(() => {
            try {
              const db2 = getDemoDb()
              if (channel && demoBots?.clearTyping) demoBots.clearTyping(tenantId, channel.id)
              insertPost(db2, tenantId, ev.channel, ev.author, ev.content)
            } catch { /* tenant purged */ }
          }, 2500)
          _track(tenantId, insertTimer)
        } else if (ev.type === 'react') {
          const msg = findRecentMessage(db, tenantId, ev.target)
          if (msg) addReaction(db, tenantId, msg.id, ev.emoji, ev.reactor)
        }
      } catch { /* tenant purged or DB issue : ignore */ }
    }, ev.at * 1000)
    _track(tenantId, timer)
  }

  return { eventCount: story.length, totalDurationSec: story[story.length - 1].at }
}

module.exports = {
  startStoryline,
  cancelStoryline,
  pickStoryline,
  ALL_STORIES,
  // Exports pour les tests
  insertPost,
  addReaction,
}
