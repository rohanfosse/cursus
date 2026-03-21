// ─── Composable pour normaliser les appels API et la gestion d'erreurs ─────
import { useToast } from './useToast'

interface ApiResult<T = unknown> {
  ok: boolean
  data?: T | null
  error?: string
}

/**
 * Messages d'erreur contextualisés par domaine.
 * Utilisés à la place des messages génériques quand l'API ne retourne
 * pas de message suffisamment explicite.
 */
const ERROR_CONTEXT: Record<string, string> = {
  // Messages
  'send':     'Impossible d\'envoyer le message. Vérifiez votre connexion et réessayez.',
  'edit':     'Impossible de modifier le message. Il a peut-être été supprimé.',
  'delete':   'Impossible de supprimer le message.',
  'pin':      'Impossible d\'épingler le message. Limite de 5 messages épinglés par canal.',
  'search':   'La recherche a échoué. Essayez avec d\'autres termes.',
  // Documents
  'upload':   'Échec de l\'envoi du fichier. Vérifiez la taille (max 50 Mo) et réessayez.',
  'download': 'Impossible de télécharger le fichier.',
  // Devoirs
  'submit':   'Impossible de soumettre le rendu. Vérifiez que la deadline n\'est pas dépassée.',
  'grade':    'Impossible d\'enregistrer la note.',
  'feedback': 'Impossible d\'enregistrer le feedback.',
  // Structure
  'channel':  'Erreur lors de l\'opération sur le canal.',
  'promo':    'Erreur lors de l\'opération sur la promotion.',
  'group':    'Erreur lors de l\'opération sur le groupe.',
  // Auth
  'login':    'Échec de la connexion. Vérifiez vos identifiants.',
  'register': 'Échec de la création du compte.',
  'password': 'Impossible de changer le mot de passe.',
  // Network
  'network':  'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
}

/**
 * Helper pour les appels API avec gestion d'erreurs uniforme.
 *
 * Usage :
 *   const { api } = useApi()
 *   const data = await api(() => window.api.sendMessage(payload), 'send')
 */
export function useApi() {
  const { showToast } = useToast()

  async function api<T>(
    call: () => Promise<ApiResult<T>>,
    context?: string,
  ): Promise<T | null> {
    try {
      const res = await call()
      if (!res?.ok) {
        const msg = res?.error || (context ? ERROR_CONTEXT[context] : null) || 'Une erreur est survenue.'
        showToast(msg, 'error')
        return null
      }
      return (res.data ?? null) as T | null
    } catch (err: unknown) {
      const message = (err as Error)?.message ?? ''
      if (message.includes('fetch') || message.includes('network') || message.includes('Failed')) {
        showToast(ERROR_CONTEXT['network'], 'error')
      } else {
        showToast(context ? ERROR_CONTEXT[context] ?? message : message || 'Erreur inattendue.', 'error')
      }
      return null
    }
  }

  return { api, ERROR_CONTEXT }
}
