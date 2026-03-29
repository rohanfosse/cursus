// ─── Wrapper de résultat API typé ─────────────────────────────────────────────
// Remplace les retours `null` par un résultat discriminé qui préserve le
// contexte d'erreur (message + code de cause).

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  code: 'network' | 'auth' | 'validation' | 'server' | 'timeout'
}

export type ApiResult<T> = ApiSuccess<T> | ApiError

/**
 * Crée un résultat réussi.
 *
 * @param data Données retournées par l'appel API.
 */
export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

/**
 * Crée un résultat en échec avec contexte.
 *
 * @param error Message d'erreur lisible (en français côté UI).
 * @param code  Code de cause machine — permet un traitement conditionnel.
 */
export function failure(error: string, code: ApiError['code']): ApiError {
  return { ok: false, error, code }
}

/**
 * Type guard — retourne true si `result` est un `ApiSuccess<T>`.
 *
 * Permet d'accéder à `result.data` sans cast après la vérification.
 */
export function isOk<T>(result: ApiResult<T>): result is ApiSuccess<T> {
  return result.ok === true
}
