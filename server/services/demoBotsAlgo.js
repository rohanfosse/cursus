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

module.exports = {
  // Graphe social
  SOCIAL_GRAPH, BASE_AFFINITY,
  getAffinity, pickAffineBot,
  // Hawkes
  getIntensity, recordEvent, intensityMultiplier,
  LAMBDA_BASE, LAMBDA_ALPHA, LAMBDA_BETA,
  // Topic
  TOPIC_KEYWORDS, tokenize, tagsForText, topicVector, scoreTemplate, pickByTopic,
}
