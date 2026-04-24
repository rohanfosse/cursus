/**
 * useOfflineCache - Composable pour le cache offline.
 * Lit et ecrit des donnees dans le stockage local Electron via IPC.
 *
 * - `cacheData` / `loadCached` : persistence brute (contrat historique).
 * - `cacheDataWithTtl` / `loadCachedFresh` : persistence enveloppée avec horodatage,
 *   permettant une invalidation basée sur une durée de vie maximale côté lecteur.
 */

interface OfflineReadResult<T> {
  ok: boolean
  data?: T | null
  error?: string
}

interface TtlEnvelope<T> {
  __ttl: true
  ts: number
  data: T
}

function isTtlEnvelope<T>(x: unknown): x is TtlEnvelope<T> {
  return !!x && typeof x === 'object'
    && (x as TtlEnvelope<T>).__ttl === true
    && typeof (x as TtlEnvelope<T>).ts === 'number'
}

function warn(scope: string, err: unknown): void {
  // console.warn est volontaire pour surfacer les pannes de cache en dev ;
  // en production l'IPC ne doit jamais jeter, mais on reste défensif.
   
  console.warn(`[OfflineCache] ${scope}`, err)
}

/** Ecrire des donnees dans le cache offline (brut, sans enveloppe). */
export async function cacheData<T>(key: string, data: T): Promise<void> {
  try {
    await window.api.offlineWrite(key, data)
  } catch (err) {
    warn(`Erreur ecriture "${key}"`, err)
  }
}

/** Lire des donnees depuis le cache offline (brut, sans enveloppe). */
export async function loadCached<T>(key: string): Promise<T | null> {
  try {
    const res = (await window.api.offlineRead(key)) as OfflineReadResult<T> | undefined
    if (res?.ok && res.data != null) return res.data as T
    return null
  } catch (err) {
    warn(`Erreur lecture "${key}"`, err)
    return null
  }
}

/** Vider tout le cache offline */
export async function clearOfflineCache(): Promise<void> {
  try {
    await window.api.offlineClear()
  } catch (err) {
    warn('Erreur nettoyage', err)
  }
}

/**
 * Variante TTL : enveloppe la donnée avec un horodatage pour permettre
 * une invalidation côté lecteur via `loadCachedFresh(key, maxAgeMs)`.
 *
 * Compatible avec `loadCached` (qui retournera l'enveloppe brute) : n'utiliser
 * que si tous les consommateurs de la clé passent par les helpers TTL.
 */
export async function cacheDataWithTtl<T>(key: string, data: T): Promise<void> {
  const envelope: TtlEnvelope<T> = { __ttl: true, ts: Date.now(), data }
  try {
    await window.api.offlineWrite(key, envelope)
  } catch (err) {
    warn(`Erreur ecriture TTL "${key}"`, err)
  }
}

/**
 * Lit une donnée TTL. Retourne `null` si :
 *  - la clé est absente,
 *  - l'enveloppe est corrompue / absente (donnée legacy sans __ttl),
 *  - la donnée est plus ancienne que `maxAgeMs` (expirée).
 */
export async function loadCachedFresh<T>(key: string, maxAgeMs: number): Promise<T | null> {
  try {
    const res = (await window.api.offlineRead(key)) as OfflineReadResult<unknown> | undefined
    if (!res?.ok || res.data == null) return null
    if (!isTtlEnvelope<T>(res.data)) return null
    const age = Date.now() - res.data.ts
    if (age > Math.max(0, maxAgeMs)) return null
    return res.data.data
  } catch (err) {
    warn(`Erreur lecture TTL "${key}"`, err)
    return null
  }
}
