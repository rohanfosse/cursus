/**
 * useDemoNotifications - simule un flux de notifications "vivantes" pendant
 * la demo pour que l'app n'ait pas l'air figee.
 *
 * V2 : notifications scenarisees plutot qu'aleatoires. On joue de petites
 * sequences (mini-narratifs de 1 a 3 messages) au lieu de tirer au hasard
 * dans un pool plat. Resultat : le visiteur a l'impression d'observer une
 * conversation qui evolue (question -> reponse, reaction -> remerciement),
 * pas un fil de notifications deconnectees.
 *
 * Demarre uniquement quand currentUser.demo === true. Cadence :
 *  - 1re notif apres ~20s (laisser le temps de scanner le dashboard)
 *  - puis ~30-90s d'intervalle entre groupes (jitter important pour ne pas
 *    paraitre mecanique)
 *  - dans un groupe, les messages s'enchainent en 8-25s
 */
import { onUnmounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'

interface DemoNotif {
  title: string
  body: string
}

interface DemoScenario {
  /** Probabilite relative de tirer ce scenario (poids). */
  weight: number
  /** Description courte (debug). */
  label: string
  /** Suite d'evenements joues les uns apres les autres. */
  steps: Array<{
    notif: DemoNotif
    /** Delai avant ce step depuis le step precedent (ms). */
    delayMs: number
  }>
}

// ────────────────────────────────────────────────────────────────────────
//  Catalogue de scenarios. Chacun ressemble a une vraie tranche de vie
//  d'une promo (echange technique, annonce prof, reaction sociale...).
//  Les noms / canaux / devoirs reprennent ceux du seed (cf. demo-seed.js)
//  pour rester coherents avec ce que le visiteur voit deja a l'ecran.
// ────────────────────────────────────────────────────────────────────────
const SCENARIOS: DemoScenario[] = [
  // --- Echange technique entre etudiants ---
  {
    weight: 3,
    label: 'CORS Q&A',
    steps: [
      { notif: { title: 'Emma Lefevre',  body: 'a pose une question dans #developpement-web : "On bloque sur le CORS en local..."' }, delayMs: 0 },
      { notif: { title: 'Alice Martin',  body: 'a repondu : "Tu as `credentials: include` cote front + `Access-Control-Allow-Credentials: true` cote serveur ?"' }, delayMs: 12_000 },
      { notif: { title: 'Emma Lefevre',  body: 'a reagi 💡 a ta reponse — "Ah oui c\'etait ca, merci !"' }, delayMs: 18_000 },
    ],
  },

  // --- Annonce prof avec contexte ---
  {
    weight: 2,
    label: 'Prof rappel deadline',
    steps: [
      { notif: { title: 'Prof. Lemaire', body: 'Rappel : la **soutenance projet S1** est notee. Pensez aux diapos avant lundi 8h.' }, delayMs: 0 },
    ],
  },
  {
    weight: 2,
    label: 'Prof reunion',
    steps: [
      { notif: { title: 'Prof. Lemaire', body: 'Reunion mi-semestre confirmee mardi 14h en B204. Ordre du jour pousse dans Documents.' }, delayMs: 0 },
      { notif: { title: 'Hugo Petit',    body: 'a marque le message comme important ✅' }, delayMs: 22_000 },
    ],
  },

  // --- Quiz Spark live ---
  {
    weight: 2,
    label: 'Quiz Spark imminent',
    steps: [
      { notif: { title: 'Quiz Spark 2',   body: 'demarre dans 30 minutes. Pense aux rotations AVL (LL, RR, LR, RL).' }, delayMs: 0 },
      { notif: { title: 'Sara Bouhassoun', body: 'a partage un schema des rotations dans #algorithmique' }, delayMs: 14_000 },
    ],
  },

  // --- Reaction simple sur un message recent ---
  {
    weight: 4,
    label: 'Reaction simple',
    steps: [
      { notif: { title: 'Lucas Bernard',  body: 'a reagi 🔥 a ton message dans #developpement-web' }, delayMs: 0 },
    ],
  },
  {
    weight: 4,
    label: 'Reaction prof',
    steps: [
      { notif: { title: 'Prof. Lemaire',  body: 'a reagi 👏 a ton intervention dans #algorithmique' }, delayMs: 0 },
    ],
  },

  // --- Mention dans un canal ---
  {
    weight: 3,
    label: 'Mention coordination',
    steps: [
      { notif: { title: 'Lucas Bernard',  body: 't\'a mentionne(e) dans #developpement-web : "@emma tu es dispo pour la review ce soir ?"' }, delayMs: 0 },
    ],
  },

  // --- Devoir / livrable ---
  {
    weight: 3,
    label: 'Devoir nouveau',
    steps: [
      { notif: { title: 'Nouveau devoir', body: 'Prof. Lemaire a publie **TP4 Arbres AVL** (rendu dans 3 jours).' }, delayMs: 0 },
    ],
  },
  {
    weight: 2,
    label: 'Note recue',
    steps: [
      { notif: { title: 'Note recue',     body: 'Tu as obtenu un **B** sur _TP3 Tri rapide_. Feedback du prof disponible.' }, delayMs: 0 },
    ],
  },

  // --- Activite de canal ---
  {
    weight: 2,
    label: 'Document partage',
    steps: [
      { notif: { title: 'Mehdi Chaouki',  body: 'a partage **avl-cheatsheet.pdf** dans #algorithmique' }, delayMs: 0 },
      { notif: { title: 'Ines Moreau',    body: 'a reagi 📎 — "Top, merci !"' }, delayMs: 9_000 },
    ],
  },

  // --- Discussion projet ---
  {
    weight: 2,
    label: 'Equipe projet web',
    steps: [
      { notif: { title: 'Jean Durand',    body: 'a partage un workflow GitHub Actions dans #projets : "Fork-le si vous voulez, ca lint + teste."' }, delayMs: 0 },
      { notif: { title: 'Lucas Bernard',  body: 'a reagi 🔥 — "Ouais on prend, merci Jean !"' }, delayMs: 11_000 },
    ],
  },

  // --- Echange entraide algo ---
  {
    weight: 2,
    label: 'Entraide rotations',
    steps: [
      { notif: { title: 'Sara Bouhassoun', body: 'a pose une question dans #algorithmique : "Quelqu\'un a compris la rotation gauche-droite ?"' }, delayMs: 0 },
      { notif: { title: 'Jean Durand',     body: 'a repondu avec un bloc de code Python : "Tu fais 2 rotations simples plutot que 4 cas..."' }, delayMs: 16_000 },
      { notif: { title: 'Sara Bouhassoun', body: 'a reagi 🙏 — "@jean genie, ca s\'eclaire merci !"' }, delayMs: 22_000 },
    ],
  },

  // --- Notification systeme ---
  {
    weight: 1,
    label: 'Connexion en ligne',
    steps: [
      { notif: { title: 'Alice Martin',   body: 'est en ligne 🟢' }, delayMs: 0 },
    ],
  },
  {
    weight: 1,
    label: 'Inscription soutenance',
    steps: [
      { notif: { title: 'Soutenances',    body: 'Inscription ouverte pour les creneaux de **Soutenance Projet Web E4**. 8 places restantes.' }, delayMs: 0 },
    ],
  },

  // --- Live session ---
  {
    weight: 2,
    label: 'Live demarre',
    steps: [
      { notif: { title: 'Prof. Lemaire',  body: 'a demarre une session **Live Spark** : "Quiz Algo - Arbres AVL". Code AVL-2026.' }, delayMs: 0 },
    ],
  },

  // --- RDV rappel ---
  {
    weight: 1,
    label: 'RDV demain',
    steps: [
      { notif: { title: 'Rappel RDV',     body: 'Tu as un suivi individuel demain 10h avec Prof. Lemaire (Teams).' }, delayMs: 0 },
    ],
  },
]

const FIRST_DELAY_MS    = 20_000   // 20s avant le 1er scenario
const MIN_GROUP_INTERVAL = 30_000  // 30s mini entre 2 scenarios
const MAX_GROUP_INTERVAL = 90_000  // 90s maxi

export function useDemoNotifications(): void {
  const appStore = useAppStore()
  let outerTimer: ReturnType<typeof setTimeout> | null = null
  // Tous les timers d'un scenario en cours : un scenario peut spawner 1-3
  // setTimeouts, on doit pouvoir tous les annuler proprement au stop().
  const stepTimers: Set<ReturnType<typeof setTimeout>> = new Set()
  const recentScenarios: number[] = []
  const RECENT_MEMORY = 4

  function pickScenario(): DemoScenario {
    // Tirage pondere mais en excluant les recemment joues.
    const eligible = SCENARIOS
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => !recentScenarios.includes(i))
    const pool = eligible.length ? eligible : SCENARIOS.map((s, i) => ({ s, i }))
    const totalWeight = pool.reduce((sum, x) => sum + x.s.weight, 0)
    let r = Math.random() * totalWeight
    for (const { s, i } of pool) {
      r -= s.weight
      if (r <= 0) {
        recentScenarios.push(i)
        if (recentScenarios.length > RECENT_MEMORY) recentScenarios.shift()
        return s
      }
    }
    const last = pool[pool.length - 1]
    return last.s
  }

  function fireNotif(notif: DemoNotif): void {
    if (!appStore.currentUser?.demo) return
    try {
      window.dispatchEvent(new CustomEvent('cursus:notif-toast', {
        detail: { title: notif.title, body: notif.body },
      }))
    } catch { /* CustomEvent indisponible : on tombe silencieusement */ }
  }

  function playScenario(scenario: DemoScenario): void {
    let cumulative = 0
    for (const step of scenario.steps) {
      cumulative += step.delayMs
      const captured = step.notif
      const t = setTimeout(() => {
        stepTimers.delete(t)
        fireNotif(captured)
      }, cumulative)
      stepTimers.add(t)
    }
  }

  function scheduleNext(): void {
    const delay = MIN_GROUP_INTERVAL + Math.random() * (MAX_GROUP_INTERVAL - MIN_GROUP_INTERVAL)
    outerTimer = setTimeout(() => {
      if (!appStore.currentUser?.demo) { outerTimer = null; return }
      playScenario(pickScenario())
      scheduleNext()
    }, delay)
  }

  function start(): void {
    if (outerTimer) return
    outerTimer = setTimeout(() => {
      if (!appStore.currentUser?.demo) { outerTimer = null; return }
      playScenario(pickScenario())
      scheduleNext()
    }, FIRST_DELAY_MS)
  }

  function stop(): void {
    if (outerTimer) { clearTimeout(outerTimer); outerTimer = null }
    for (const t of stepTimers) clearTimeout(t)
    stepTimers.clear()
  }

  watch(
    () => appStore.currentUser?.demo === true,
    (isDemo) => { if (isDemo) start(); else stop() },
    { immediate: true },
  )

  onUnmounted(stop)
}
