// ─── Composable pour normaliser les appels API avec retry & gestion d'erreurs ─
import { useToast } from './useToast'

// ─── Types publics ──────────────────────────────────────────────────────────

export interface ApiResult<T = unknown> {
  ok: boolean
  data?: T | null
  error?: string
}

export type ErrorContextKey =
  | 'send' | 'edit' | 'delete' | 'pin' | 'search' | 'reaction'
  | 'upload' | 'download' | 'doc'
  | 'submit' | 'grade' | 'feedback' | 'devoir'
  | 'signature' | 'sign'
  | 'channel' | 'promo' | 'group'
  | 'login' | 'register' | 'password'
  | 'forbidden'
  | 'network' | 'timeout' | 'offline' | 'aborted'

export interface ApiOptions {
  /** Contexte d'erreur (clé dans ERROR_CONTEXT) */
  context?: ErrorContextKey | string
  /** Nombre de tentatives supplémentaires sur erreur réseau (défaut 0 = pas de retry) */
  retries?: number
  /** Masquer le toast d'erreur (défaut false) */
  silent?: boolean
  /** Timeout en ms (défaut 20000 ; 0 = désactivé) */
  timeoutMs?: number
  /** AbortSignal externe pour annuler l'appel */
  signal?: AbortSignal
  /** Clé de déduplication : un appel en vol réutilisé */
  dedupKey?: string
  /** Callback invoqué avant chaque retry (0-indexed sur la tentative échouée) */
  onRetry?: (attempt: number, error: unknown) => void
}

/**
 * Messages d'erreur contextualisés par domaine.
 */
const ERROR_CONTEXT = Object.freeze<Record<string, Readonly<{ msg: string; detail?: string }>>>({
  // Messages
  send:     { msg: 'Impossible d\'envoyer le message.',            detail: 'Vérifiez votre connexion et réessayez.' },
  edit:     { msg: 'Impossible de modifier le message.',           detail: 'Le message a peut-être été supprimé entre-temps.' },
  delete:   { msg: 'Impossible de supprimer le message.',          detail: 'Vous ne pouvez supprimer que vos propres messages.' },
  pin:      { msg: 'Impossible d\'épingler le message.',           detail: 'Limite de 5 messages épinglés par canal atteinte.' },
  search:   { msg: 'La recherche a échoué.',                       detail: 'Essayez avec des termes plus courts ou différents.' },
  reaction: { msg: 'Impossible d\'ajouter la réaction.',           detail: 'Le message a peut-être été supprimé.' },
  // Documents
  upload:   { msg: 'Échec de l\'envoi du fichier.',                detail: 'Vérifiez la taille (max 50 Mo) et le format du fichier.' },
  download: { msg: 'Impossible de télécharger le fichier.',        detail: 'Le fichier a peut-être été déplacé ou supprimé.' },
  doc:      { msg: 'Erreur lors de l\'opération sur le document.', detail: 'Vérifiez vos permissions et réessayez.' },
  // Devoirs
  submit:   { msg: 'Impossible de soumettre le rendu.',            detail: 'Vérifiez que la deadline n\'est pas dépassée et que le fichier est valide.' },
  grade:    { msg: 'Impossible d\'enregistrer la note.',           detail: 'Vérifiez que le format de note est correct (A-F ou numérique).' },
  feedback: { msg: 'Impossible d\'enregistrer le feedback.',       detail: 'Le texte est peut-être trop long (max 5 000 caractères).' },
  devoir:   { msg: 'Erreur lors de l\'opération sur le devoir.',   detail: 'Vérifiez les champs requis et réessayez.' },
  // Signatures
  signature: { msg: 'Erreur lors de l\'opération de signature.',   detail: 'Vérifiez que le document est toujours accessible.' },
  sign:      { msg: 'Impossible de signer le document.',           detail: 'Le fichier a peut-être été modifié depuis la demande.' },
  // Structure
  channel:  { msg: 'Erreur lors de l\'opération sur le canal.',    detail: 'Le canal a peut-être été supprimé.' },
  promo:    { msg: 'Erreur lors de l\'opération sur la promotion.', detail: 'Vérifiez que la promotion existe toujours.' },
  group:    { msg: 'Erreur lors de l\'opération sur le groupe.',   detail: 'Le groupe a peut-être été modifié.' },
  // Auth
  login:    { msg: 'Échec de la connexion.',                       detail: 'Vérifiez votre email et votre mot de passe.' },
  register: { msg: 'Échec de la création du compte.',              detail: 'Vérifiez les informations saisies.' },
  password: { msg: 'Impossible de changer le mot de passe.',       detail: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.' },
  // Permissions
  forbidden: { msg: 'Action non autorisée.',                       detail: 'Vous n\'avez pas les permissions nécessaires pour cette action.' },
  // Network
  network:  { msg: 'Impossible de contacter le serveur.',          detail: 'Vérifiez votre connexion internet et réessayez.' },
  timeout:  { msg: 'Le serveur met trop de temps à répondre.',     detail: 'Réessayez dans quelques instants.' },
  offline:  { msg: 'Vous êtes hors ligne.',                        detail: 'L\'action sera réessayée automatiquement à la reconnexion.' },
  aborted:  { msg: 'Action annulée.',                              detail: undefined },
})

// ─── Détection d'erreurs ────────────────────────────────────────────────────

const NETWORK_HINTS = ['fetch', 'network', 'failed to fetch', 'econnrefused', 'err_connection', 'load failed', 'err_network']
const TIMEOUT_HINTS = ['timeout', 'timed out']
const ABORT_HINTS = ['abort', 'aborterror']

function normalizeMessage(err: unknown): string {
  if (!err) return ''
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return ''
}

function isNetworkError(err: unknown): boolean {
  const msg = normalizeMessage(err).toLowerCase()
  if (!msg) return false
  // TypeError from fetch is network-level
  if (err instanceof TypeError && /fetch/.test(msg)) return true
  return NETWORK_HINTS.some((k) => msg.includes(k))
}

function isTimeoutError(err: unknown): boolean {
  const msg = normalizeMessage(err).toLowerCase()
  return TIMEOUT_HINTS.some((k) => msg.includes(k))
}

function isAbortError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') return true
  const msg = normalizeMessage(err).toLowerCase()
  return ABORT_HINTS.some((k) => msg.includes(k))
}

function detectErrorContext(serverMsg: string): ErrorContextKey | null {
  const lower = serverMsg.toLowerCase()
  if (lower.includes('autoris') || lower.includes('permission') || lower.includes('interdit') || lower.includes('403')) return 'forbidden'
  if (lower.includes('session') || lower.includes('token') || lower.includes('authentif')) return 'login'
  if (lower.includes('promo')) return 'promo'
  if (lower.includes('canal') || lower.includes('channel')) return 'channel'
  if (lower.includes('signature') || lower.includes('signer')) return 'signature'
  return null
}

/** Attente avec backoff exponentiel + jitter (évite les tempêtes de retry synchronisées). */
function backoff(attempt: number): Promise<void> {
  const base = Math.min(200 * 2 ** attempt, 5000)
  const jitter = base * (0.1 + Math.random() * 0.2) // 10-30%
  return new Promise((r) => setTimeout(r, base + jitter))
}

/** Enveloppe une promesse d'un timeout + support d'abort externe. */
function withTimeout<T>(p: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if ((!timeoutMs || timeoutMs <= 0) && !signal) return p
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          if (settled) return
          settled = true
          reject(new Error('Request timeout'))
        }, timeoutMs)
      : null

    const onAbort = () => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      const err = new Error('Request aborted')
      ;(err as Error & { name: string }).name = 'AbortError'
      reject(err)
    }

    if (signal) {
      if (signal.aborted) return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
    }

    p.then(
      (v) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

// Module-level dedup store (shared across callers)
const inflight = new Map<string, Promise<unknown>>()

function showToastSafe(
  fn: (msg: string, type: 'error', detail?: string) => void,
  msg: string,
  detail?: string,
): void {
  try { fn(msg, 'error', detail) } catch { /* toast failures must not hide real errors */ }
}

/**
 * Helper pour les appels API avec retry automatique, timeout, abort & gestion d'erreurs uniforme.
 *
 * Usage :
 *   const { api } = useApi()
 *   const data = await api(() => window.api.sendMessage(payload), 'send')
 *   // Avec retry + timeout :
 *   const data = await api(() => window.api.loadData(), { context: 'search', retries: 2, timeoutMs: 10_000 })
 *   // Avec abort externe :
 *   const ctrl = new AbortController()
 *   api(() => window.api.heavyOp(), { signal: ctrl.signal })
 *   ctrl.abort()
 */
export function useApi() {
  const { showToast } = useToast()

  async function api<T>(
    call: () => Promise<ApiResult<T>>,
    optionsOrContext?: string | ApiOptions,
  ): Promise<T | null> {
    const opts: ApiOptions = typeof optionsOrContext === 'string'
      ? { context: optionsOrContext }
      : optionsOrContext ?? {}
    const {
      context,
      retries = 0,
      silent = false,
      timeoutMs = 20_000,
      signal,
      dedupKey,
      onRetry,
    } = opts

    // Early abort check
    if (signal?.aborted) {
      if (!silent) showToastSafe(showToast, ERROR_CONTEXT.aborted.msg)
      return null
    }

    // Offline guard (avant appel)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (!silent) showToastSafe(showToast, ERROR_CONTEXT.offline.msg, ERROR_CONTEXT.offline.detail)
      return null
    }

    // Dédup : réutiliser un appel identique déjà en vol
    if (dedupKey) {
      const existing = inflight.get(dedupKey) as Promise<T | null> | undefined
      if (existing) return existing
    }

    /**
     * Trace persistante de tout echec passant par useApi. Tag derive du
     * `context` (ex. 'devoir', 'submit', 'channel') pour pouvoir filtrer
     * dans main.log. Silent: true ne supprime PAS le log — un score
     * arcade qui plante doit toujours laisser une trace, sinon il
     * disparait totalement.
     */
    const logFailure = (kind: string, payload: Record<string, unknown>) => {
      try {
        window.api?.logToFile?.('error', `useApi:${context ?? 'generic'}`, kind, payload)
      } catch { /* never break a route on logger failure */ }
    }

    const exec = async (): Promise<T | null> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await withTimeout(call(), timeoutMs, signal)
          if (!res?.ok) {
            // Erreur métier — pas de retry
            const serverError = res?.error || ''
            logFailure('business_error', { serverError, attempt })
            if (!silent) {
              const ctx = context ? ERROR_CONTEXT[context] : null
              const autoKey = serverError ? detectErrorContext(serverError) : null
              const autoCtx = autoKey ? ERROR_CONTEXT[autoKey] : null
              const msg = serverError || ctx?.msg || 'Une erreur est survenue.'
              const detail = ctx?.detail || autoCtx?.detail
              showToastSafe(showToast, msg, detail)
            }
            return null
          }
          return (res.data ?? null) as T | null
        } catch (err: unknown) {
          // Abort : jamais retry, silencieux par défaut
          if (isAbortError(err) || signal?.aborted) {
            if (!silent) showToastSafe(showToast, ERROR_CONTEXT.aborted.msg)
            return null
          }

          const retryable = isNetworkError(err) || isTimeoutError(err)

          if (retryable && attempt < retries) {
            try { onRetry?.(attempt, err) } catch { /* user callback must not break retry */ }
            await backoff(attempt)
            continue
          }

          // Dernière tentative échouée — toujours log, peu importe silent.
          const message = normalizeMessage(err)
          const stack = err instanceof Error ? err.stack?.slice(0, 1000) : undefined
          if (isTimeoutError(err))      logFailure('timeout',  { message, attempt })
          else if (isNetworkError(err)) logFailure('network',  { message, attempt })
          else                          logFailure('thrown',   { message, stack, attempt })

          if (!silent) {
            if (isTimeoutError(err)) {
              showToastSafe(showToast, ERROR_CONTEXT.timeout.msg, ERROR_CONTEXT.timeout.detail)
            } else if (isNetworkError(err)) {
              const retryMsg = retries > 0 ? ` (${retries + 1} tentatives échouées)` : ''
              showToastSafe(showToast, ERROR_CONTEXT.network.msg + retryMsg, ERROR_CONTEXT.network.detail)
            } else {
              const ctx = context ? ERROR_CONTEXT[context] : null
              showToastSafe(
                showToast,
                ctx?.msg || message || 'Erreur inattendue.',
                ctx?.detail || (message ? `Détail : ${message}` : undefined),
              )
            }
          }
          return null
        }
      }
      return null
    }

    if (dedupKey) {
      const p = exec().finally(() => {
        // cleanup même si le même dedupKey a déjà été remplacé
        if (inflight.get(dedupKey) === p) inflight.delete(dedupKey)
      }) as Promise<T | null>
      inflight.set(dedupKey, p as Promise<unknown>)
      return p
    }

    return exec()
  }

  return { api, ERROR_CONTEXT }
}
