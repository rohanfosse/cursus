/**
 * demoBotsAlgo - 3 sous-systemes algorithmiques pour rendre les bots demo
 * plus credibles. Importe par demoBots.js.
 *
 *   1. Graphe social pondere : matrice d'affinite bot<->bot. Drive QUI
 *      repond/reagit/DM a QUI au lieu d'un tirage uniforme. Visible :
 *      "Emma et Lucas finissent toujours par se chercher".
 *   2. Processus de Hawkes : auto-excitation -> chaque event augmente
 *      temporairement l'intensite des PROB.*, puis decay exponentiel.
 *      Reproduit les rafales naturelles "burst de 4 messages puis calme".
 *   3. Topic tagging + score : chaque template a un set de tags. On
 *      compute la frequence des tags dans les N derniers messages du
 *      canal, on score les templates par overlap. Quand le visiteur
 *      tape "AVL", les bots gravitent vers les templates algo.
 *
 * Aucun de ces algos ne necessite d'embedding ni de stockage persistent.
 * Tout se passe en memoire (Map<tenantId, ...>) avec des cutoffs de
 * fenetre temporelle pour borner la consommation.
 */

// ────────────────────────────────────────────────────────────────────
//  1. Graphe social (matrice d'affinite ponderee, symetrique)
// ────────────────────────────────────────────────────────────────────
//
// Edges = "qui s'entend avec qui" sur la base des binomes natifs du seed
// (Emma+Lucas sur le projet web, Sara+Jean sur l'algo, Alice+Mehdi sur
// l'organisation, Hugo+Lea discrets). Poids 0..1, plus fort = plus
// frequent. La symetrie permet d'utiliser le meme score dans les deux
// sens (qui repond a qui, qui reagit apres qui).
//
// Si un bot n'apparait pas dans la map, getAffinity renvoie BASE_AFFINITY
// pour eviter de l'isoler completement (sans ca il ne parlerait jamais).
const BASE_AFFINITY = 0.15
const RAW_GRAPH = {
  'Emma Lefevre':     { 'Lucas Bernard': 0.9, 'Sara Bouhassoun': 0.7, 'Alice Martin': 0.6, 'Mehdi Chaouki': 0.4 },
  'Lucas Bernard':    { 'Jean Durand': 0.7, 'Sara Bouhassoun': 0.5, 'Hugo Petit': 0.4 },
  'Sara Bouhassoun':  { 'Jean Durand': 0.85, 'Mehdi Chaouki': 0.6, 'Hugo Petit': 0.4 },
  'Jean Durand':      { 'Mehdi Chaouki': 0.55 },
  'Alice Martin':     { 'Mehdi Chaouki': 0.7, 'Lea Rousseau': 0.6, 'Hugo Petit': 0.4 },
  'Mehdi Chaouki':    { },
  'Hugo Petit':       { 'Lea Rousseau': 0.5 },
  'Lea Rousseau':     { },
}
// Symetrise une fois au load : si A connait B avec poids w, alors B connait A.
const SOCIAL_GRAPH = (() => {
  const g = {}
  for (const [a, neighbors] of Object.entries(RAW_GRAPH)) {
    g[a] = g[a] || {}
    for (const [b, w] of Object.entries(neighbors)) {
      g[a][b] = w
      g[b] = g[b] || {}
      // Si l'autre direction a deja un poids different, on garde le max
      // (le ressenti suit le plus fort des deux).
      g[b][a] = Math.max(g[b][a] || 0, w)
    }
  }
  return g
})()

function getAffinity(a, b) {
  if (!a || !b || a === b) return 0
  return SOCIAL_GRAPH[a]?.[b] ?? BASE_AFFINITY
}

/**
 * Pioche un bot dans `candidates` avec une probabilite proportionnelle
 * a son affinite avec `target`. Si target est null ou aucun candidat
 * n'a d'affinite > 0, fallback sur tirage uniforme. `exclude` est une
 * liste de noms a ne pas piocher (auto-exclusion typique).
 */
function pickAffineBot(target, candidates, exclude = []) {
  const eligible = candidates.filter(c => !exclude.includes(c) && c !== target)
  if (!eligible.length) return null

  const weighted = eligible.map(c => ({ name: c, w: getAffinity(target, c) }))
  const total = weighted.reduce((s, x) => s + x.w, 0)
  if (total <= 0) return eligible[Math.floor(Math.random() * eligible.length)]

  let r = Math.random() * total
  for (const x of weighted) {
    r -= x.w
    if (r <= 0) return x.name
  }
  return weighted[weighted.length - 1].name
}

// ────────────────────────────────────────────────────────────────────
//  2. Processus de Hawkes (auto-excitation)
// ────────────────────────────────────────────────────────────────────
//
// lambda(t) = lambda_base + sum_i alpha * exp(-beta * (t - t_i))
// Chaque event passe i contribue une "secousse" alpha qui decroit avec
// le temps. Plus la promo a parle recemment, plus lambda est haut, plus
// les PROB.* sont multipliees -> les bots parlent plus pendant les
// rafales et moins pendant les creux. Reproduit la respiration humaine.
//
// Parametres calibres pour une session demo (5-15 min) :
//  - alpha = 0.4 : chaque message ajoute ~40% de chance de plus
//  - beta  = 1/120 : demi-vie ~83s (les bursts durent ~2-3 min)
//  - cutoff = 600s : on prune les events plus vieux pour borner la memoire
const LAMBDA_BASE = 1.0
const LAMBDA_ALPHA = 0.4
const LAMBDA_BETA = 1 / 120
const LAMBDA_CUTOFF_MS = 600_000

const _hawkes = new Map() // tenantId -> { events: [{ t: ms }] }

function getIntensity(tenantId, now = Date.now()) {
  const state = _hawkes.get(tenantId)
  if (!state || !state.events.length) return LAMBDA_BASE
  let lambda = LAMBDA_BASE
  for (const e of state.events) {
    const dt = (now - e.t) / 1000
    if (dt < 0) continue
    lambda += LAMBDA_ALPHA * Math.exp(-LAMBDA_BETA * dt)
  }
  return lambda
}

function recordEvent(tenantId, now = Date.now()) {
  if (!tenantId) return
  let state = _hawkes.get(tenantId)
  if (!state) { state = { events: [] }; _hawkes.set(tenantId, state) }
  state.events.push({ t: now })
  // Prune events older than cutoff (borne la memoire et le cout par tick).
  const cutoff = now - LAMBDA_CUTOFF_MS
  if (state.events.length > 50 || state.events[0].t < cutoff) {
    state.events = state.events.filter(e => e.t > cutoff)
  }
}

/**
 * Multiplicateur a appliquer aux PROB.* pour ce tick. Borne entre 0.5
 * (creux profond) et 3.0 (rafale intense) pour eviter que les bots ne
 * disparaissent ou ne saturent.
 */
function intensityMultiplier(tenantId, now = Date.now()) {
  const lambda = getIntensity(tenantId, now)
  return Math.max(0.5, Math.min(3.0, lambda / LAMBDA_BASE))
}

// ────────────────────────────────────────────────────────────────────
//  3. Topic tagging + scoring contextuel
// ────────────────────────────────────────────────────────────────────
//
// Chaque template (reply au visiteur, post grammar) peut etre tag avec
// 1+ topics. On compute la frequence des topics dans les N derniers
// messages du canal courant, et on score les templates par overlap.
// Effet visible : visiteur tape "AVL" -> les bots reprennent des
// templates `algo` plutot que des templates aleatoires.
//
// Tokenisation : minuscule + split sur non-alphanumerique. Stop-words
// FR courants droppes. Pas de stemming (cout/benefice mauvais ici).
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'a', 'et', 'ou', 'mais', 'donc', 'car', 'ni', 'or',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'lui', 'leur', 'mon', 'ton', 'son', 'ma', 'ta', 'sa',
  'mes', 'tes', 'ses', 'ce', 'cet', 'cette', 'ces', 'qui', 'que', 'quoi',
  'dont', 'ou', 'est', 'sont', 'ete', 'avoir', 'etre', 'fait', 'faire',
  'pas', 'plus', 'moins', 'tres', 'si', 'oui', 'non',
  'pour', 'avec', 'sans', 'dans', 'sur', 'sous', 'par', 'vers',
])

const TOPIC_KEYWORDS = {
  auth:    ['auth', 'jwt', 'token', 'password', 'hash', 'argon', 'bcrypt', 'cors', 'oauth', 'login', 'session', 'cookie'],
  algo:    ['tri', 'quicksort', 'avl', 'arbre', 'rotation', 'complexite', 'recursion', 'fibonacci', 'graphe', 'bfs', 'dfs', 'invariant', 'pivot'],
  web:     ['html', 'css', 'vue', 'react', 'frontend', 'dom', 'layout', 'flexbox', 'grid', 'responsive', 'mobile'],
  devops:  ['ci', 'cd', 'deploy', 'deployment', 'docker', 'github', 'pipeline', 'render', 'vercel', 'workflow', 'actions'],
  project: ['equipe', 'projet', 'livrable', 'soutenance', 'kanban', 'sprint', 'rendu', 'deadline'],
  test:    ['test', 'tests', 'vitest', 'jest', 'coverage', 'assertion', 'mock', 'fixture'],
}

function tokenize(text) {
  if (!text) return []
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire diacritiques
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t))
}

function tagsForText(text) {
  const tokens = new Set(tokenize(text))
  const tags = new Set()
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(k => tokens.has(k))) tags.add(topic)
  }
  return tags
}

/**
 * Calcule un vecteur topic-frequency a partir d'une liste de contenus.
 * Retourne un Record<topic, count>.
 */
function topicVector(messages) {
  const v = {}
  for (const m of messages) {
    const tags = tagsForText(typeof m === 'string' ? m : m.content)
    for (const tag of tags) v[tag] = (v[tag] || 0) + 1
  }
  return v
}

/**
 * Score un template par rapport a un vecteur topic du canal. Score plus
 * eleve = template plus pertinent. Si le template n'a aucun tag, score
 * = 0.5 (neutre — on ne punit pas les phrases generiques type "ok").
 */
function scoreTemplate(templateText, channelTopics) {
  const tags = tagsForText(templateText)
  if (!tags.size) return 0.5
  let score = 0
  for (const tag of tags) score += channelTopics[tag] || 0
  return score
}

/**
 * Pioche un template dans `templates` avec proba proportionnelle a son
 * score sur le contexte canal. Tirage softmax-like : score 0 reste
 * possible (poids 1 par defaut) pour eviter de tuer les phrases neutres.
 */
function pickByTopic(templates, channelTopics) {
  if (!templates || !templates.length) return null
  if (!channelTopics || !Object.keys(channelTopics).length) {
    return templates[Math.floor(Math.random() * templates.length)]
  }
  const weighted = templates.map(t => {
    const text = typeof t === 'string' ? t : (t.text || t.content || '')
    return { t, w: 1 + scoreTemplate(text, channelTopics) }
  })
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const x of weighted) {
    r -= x.w
    if (r <= 0) return x.t
  }
  return weighted[weighted.length - 1].t
}

// ────────────────────────────────────────────────────────────────────
//  4. Live activity simulator (cote prof)
// ────────────────────────────────────────────────────────────────────
//
//  Quand un prof projette une activite Spark/Pulse en cours de demo,
//  on veut que le compteur de reponses tourne en temps reel et que la
//  distribution se forme. Sans ca, l'endpoint /live/activities/:id/results
//  renvoie 7 reponses figees et l'effet "live" s'evapore.
//
//  Modele : courbe logistique pour le total cumule (la majorite repond
//  vite, la queue traine), tirage multinomial sur la distribution cible
//  pour repartir chaque reponse arrivee. Resultat visible : 7 -> 12 -> 16
//  reponses sur 60s, distribution qui tend vers la verite-terrain.
//
//  Etat en memoire keyed par `${tenantId}|${activityId}`. Lazy : la sim
//  ne demarre qu'au 1er query, donc l'activite "bouge" des que le prof
//  ouvre le panneau Resultats.
const _liveSim = new Map()

function _logistic(t, half = 25, k = 8) {
  // Sigmoid centre sur `half` secondes, pente `k`. A t=0 -> ~0.05,
  // t=half -> 0.5, t=2*half -> ~0.95. Adapte a une session de demo
  // ou le prof regarde l'activite ~1 min.
  return 1 / (1 + Math.exp(-(t - half) / k))
}

function _sampleMultinomial(weights) {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return 0
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

/**
 * Avance la simulation d'une activite Spark/Pulse et renvoie l'etat
 * courant. `target` est la verite-terrain (distribution finale + total).
 *
 * @param {string} key       `${tenantId}|${activityId}`
 * @param {object} target    { distribution: number[], total: number, type: string, correct?: number }
 * @returns {object}         { type, total_responses, distribution, correct, last_response_at }
 */
function simulateLiveResults(key, target) {
  const now = Date.now()
  let state = _liveSim.get(key)
  if (!state) {
    state = {
      startedAt: now,
      lastUpdate: now,
      currentTotal: 0,
      currentDist: target.distribution.map(() => 0),
      lastResponseAt: null,
    }
    _liveSim.set(key, state)
  }

  // Combien on devrait avoir maintenant ?
  const elapsedSec = (now - state.startedAt) / 1000
  const targetNow = Math.round(target.total * _logistic(elapsedSec))
  const toAdd = Math.max(0, Math.min(target.total - state.currentTotal, targetNow - state.currentTotal))

  // Repartit chaque reponse selon la distribution cible (vue comme un
  // multinomial — on echantillonne avec remise, ce qui converge vers la
  // distribution cible quand le total grandit).
  for (let i = 0; i < toAdd; i++) {
    const idx = _sampleMultinomial(target.distribution)
    state.currentDist[idx] = (state.currentDist[idx] || 0) + 1
    state.currentTotal++
    state.lastResponseAt = new Date(now - i * 200).toISOString()
  }
  state.lastUpdate = now

  return {
    type: target.type,
    total_responses: state.currentTotal,
    distribution: state.currentDist.slice(),
    correct: target.correct ?? null,
    last_response_at: state.lastResponseAt,
  }
}

/** Reset (utile pour les tests). */
function resetLiveSim(key) {
  if (key) _liveSim.delete(key)
  else _liveSim.clear()
}

// ────────────────────────────────────────────────────────────────────
//  5. Assignment submission simulator
// ────────────────────────────────────────────────────────────────────
//
//  Le widget "Rendus recents" du dashboard prof doit ressembler a un
//  fil d'actu : nouveaux depots qui apparaissent au fil de la session.
//  Sans simulateur les rendus sont 100% statiques.
//
//  Modele : pour chaque assignment a venir (deadline future), on calcule
//  un taux de remise theorique base sur la distance a la deadline. Les
//  etudiants sont ranges par "diligence" (graphe d'affinite : les bots
//  serviables/organises rendent tot, les discrets en dernier). Au fil
//  de la session demo, on debloque progressivement les remises pour
//  donner l'impression d'une vague qui avance.
//
//  Etat keyed par `${tenantId}` -> { startedAt, perAssignment }.
const _submitSim = new Map()

// Diligence par persona (1 = rend tot, 0 = rend tard ou pas du tout).
// Mappe sur PERSONAS de demoBots.js — sans dependance circulaire,
// on liste juste les noms. Etudiants hors persona = diligence 0.5.
const DILIGENCE = {
  'Alice Martin':     0.95, // organisee
  'Lea Rousseau':     0.90, // organisee
  'Jean Durand':      0.85, // senior, rigoureux
  'Mehdi Chaouki':    0.80, // serviable
  'Emma Lefevre':     0.75, // active
  'Lucas Bernard':    0.65, // pragmatique
  'Sara Bouhassoun':  0.60, // curieuse, peut zigzaguer
  'Hugo Petit':       0.30, // discret, traine
}

/**
 * Renvoie l'ordre de remise pour une liste d'etudiants : plus diligent
 * en premier. Tirage stable : meme tenant -> meme ordre (pour ne pas
 * shuffler entre 2 polls front).
 */
function _orderByDiligence(students, assignmentId) {
  return students
    .map(s => ({
      s,
      d: (DILIGENCE[s.name] ?? 0.5) + ((s.id * 31 + assignmentId * 17) % 100) / 1000, // tie-break stable
    }))
    .sort((a, b) => b.d - a.d)
    .map(x => x.s)
}

/**
 * Cumul cible de remises pour un assignment, base sur :
 *  - distance a la deadline (proche = plus de remises)
 *  - temps ecoule depuis le start de session demo (pour creer la
 *    sensation de fil d'actu)
 *
 * Retourne un nombre entre 0 et N (total etudiants).
 */
function _targetSubmissionCount(assignment, totalStudents, sessionStartedAt) {
  const now = Date.now()
  const deadline = new Date(assignment.deadline).getTime()
  const daysToDeadline = (deadline - now) / 86_400_000

  // Baseline en fonction du delai a la deadline
  let baseline
  if (daysToDeadline < 0)       baseline = 0.92  // passe : presque tout le monde
  else if (daysToDeadline < 1)  baseline = 0.75  // jour-J : majorite
  else if (daysToDeadline < 3)  baseline = 0.45
  else if (daysToDeadline < 7)  baseline = 0.20
  else                          baseline = 0.05

  // Bonus session : a chaque 30s ecoulees on ajoute ~2% (max +15%) pour
  // que les rendus apparaissent visiblement pendant la demo.
  const sessionElapsedSec = (now - sessionStartedAt) / 1000
  const sessionBonus = Math.min(0.15, (sessionElapsedSec / 30) * 0.02)

  return Math.round(totalStudents * (baseline + sessionBonus))
}

/**
 * Renvoie la liste actuelle des soumissionnaires pour un assignment,
 * en avancant le simulateur si necessaire.
 *
 * @returns {{ student: object, submittedAt: string }[]}
 */
function getSimulatedSubmissions(tenantId, assignment, students) {
  let tenantState = _submitSim.get(tenantId)
  if (!tenantState) {
    tenantState = { startedAt: Date.now(), perAssignment: new Map() }
    _submitSim.set(tenantId, tenantState)
  }

  const target = _targetSubmissionCount(assignment, students.length, tenantState.startedAt)
  const ordered = _orderByDiligence(students, assignment.id)

  let assignState = tenantState.perAssignment.get(assignment.id)
  if (!assignState) {
    assignState = { submitted: [] } // [{ studentId, submittedAt }]
    tenantState.perAssignment.set(assignment.id, assignState)
  }

  // Avance jusqu'a `target` : ajoute les manquants dans l'ordre de diligence.
  while (assignState.submitted.length < target && assignState.submitted.length < ordered.length) {
    const next = ordered[assignState.submitted.length]
    // Timestamp : echelonne sur les heures precedentes pour eviter que
    // tout apparaisse "il y a 2s". Plus l'etudiant est diligent, plus il
    // a rendu tot (timestamp plus ancien).
    const hoursAgo = 0.5 + assignState.submitted.length * 0.7
    const submittedAt = new Date(Date.now() - hoursAgo * 3600_000).toISOString()
    assignState.submitted.push({ studentId: next.id, submittedAt })
  }

  return assignState.submitted.map(entry => ({
    student: ordered.find(s => s.id === entry.studentId) || students.find(s => s.id === entry.studentId),
    submittedAt: entry.submittedAt,
  })).filter(x => x.student)
}

function resetSubmissionSim(tenantId) {
  if (tenantId) _submitSim.delete(tenantId)
  else _submitSim.clear()
}

module.exports = {
  // Graphe social
  SOCIAL_GRAPH, BASE_AFFINITY,
  getAffinity, pickAffineBot,
  // Hawkes
  getIntensity, recordEvent, intensityMultiplier,
  LAMBDA_BASE, LAMBDA_ALPHA, LAMBDA_BETA,
  // Topic
  TOPIC_KEYWORDS, tokenize, tagsForText, topicVector, scoreTemplate, pickByTopic,
  // Live + assignments simulators (cote prof)
  simulateLiveResults, resetLiveSim,
  getSimulatedSubmissions, resetSubmissionSim,
  DILIGENCE,
}
