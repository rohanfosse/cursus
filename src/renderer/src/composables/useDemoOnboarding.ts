/**
 * useDemoOnboarding - controle l'affichage du mini-tour de bienvenue.
 *
 * Active uniquement en mode demo, des l'arrivee du visiteur. Pas de
 * persistence en localStorage : chaque session demo est un visiteur
 * different (interet pedagogique = leur montrer la feature au moins
 * une fois). Le visiteur peut "Passer" pour skip.
 *
 * Synchronise avec le DOM via data-tour="<step-id>" sur les elements
 * cibles (cf. NavRail). Si l'element n'existe pas (ex. un module
 * desactive), le step est skippe.
 */
import { ref, computed, watch } from 'vue'
import { useAppStore } from '@/stores/app'

export interface TourStep {
  /** Slug pour matcher data-tour="<id>" sur l'element cible. null = step sans cible (welcome/done). */
  target: string | null
  title: string
  body: string
  /** Position de la bulle relative a la cible. 'auto' = essaie right puis bottom puis top. */
  placement?: 'right' | 'bottom' | 'top' | 'left' | 'auto'
}

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Bienvenue dans Cursus',
    body: 'Une promo simulee et 30s de tour pour decouvrir l\'essentiel. Tu peux passer a tout moment.',
  },
  {
    target: 'live',
    title: 'Live en cours',
    body: 'Une session Spark sur les arbres AVL est en cours. Rejoins-la pour repondre au quiz en temps reel.',
    placement: 'right',
  },
  {
    target: 'messages',
    title: 'Messagerie de promo',
    body: 'Canaux thematiques + DMs. Les autres etudiants reagissent a tes messages dans la seconde.',
    placement: 'right',
  },
  {
    target: 'lumen',
    title: 'Cours interactifs',
    body: 'Tes cours sont ici, lus depuis github. Marque les chapitres lus, prends des notes.',
    placement: 'right',
  },
  {
    target: null,
    title: 'C\'est parti !',
    body: 'La session dure 24h, tu peux explorer librement. Bons clics.',
  },
]

const visible = ref(false)
const stepIndex = ref(0)

export function useDemoOnboarding() {
  const appStore = useAppStore()

  const currentStep = computed<TourStep | null>(() =>
    visible.value ? TOUR_STEPS[stepIndex.value] ?? null : null,
  )
  const isLastStep = computed(() => stepIndex.value >= TOUR_STEPS.length - 1)
  const isFirstStep = computed(() => stepIndex.value === 0)

  function start() {
    stepIndex.value = 0
    visible.value = true
  }

  function next() {
    if (stepIndex.value < TOUR_STEPS.length - 1) {
      stepIndex.value++
    } else {
      finish()
    }
  }

  function prev() {
    if (stepIndex.value > 0) stepIndex.value--
  }

  function finish() {
    visible.value = false
    stepIndex.value = 0
  }

  // Auto-start au passage en demo. Delai 1.5s pour laisser le dashboard
  // se rendre avant de couvrir l'ecran avec le tour.
  watch(
    () => appStore.currentUser?.demo === true,
    (isDemo) => {
      if (isDemo) {
        setTimeout(() => {
          if (appStore.currentUser?.demo) start()
        }, 1500)
      } else {
        finish()
      }
    },
    { immediate: true },
  )

  return {
    visible: computed(() => visible.value),
    currentStep,
    stepIndex: computed(() => stepIndex.value),
    totalSteps: TOUR_STEPS.length,
    isFirstStep,
    isLastStep,
    start, next, prev, finish,
  }
}
