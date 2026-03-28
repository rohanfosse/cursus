/**
 * useOfflineCache - Composable pour le cache offline.
 * Lit et ecrit des donnees dans le stockage local Electron via IPC.
 */

/** Ecrire des donnees dans le cache offline */
export async function cacheData<T>(key: string, data: T): Promise<void> {
  try {
    await window.api.offlineWrite(key, data)
  } catch (err) {
    console.warn(`[OfflineCache] Erreur ecriture "${key}"`, err)
  }
}

/** Lire des donnees depuis le cache offline */
export async function loadCached<T>(key: string): Promise<T | null> {
  try {
    const res = await window.api.offlineRead(key)
    if (res?.ok && res.data != null) return res.data as T
    return null
  } catch (err) {
    console.warn(`[OfflineCache] Erreur lecture "${key}"`, err)
    return null
  }
}

/** Vider tout le cache offline */
export async function clearOfflineCache(): Promise<void> {
  try {
    await window.api.offlineClear()
  } catch (err) {
    console.warn('[OfflineCache] Erreur nettoyage', err)
  }
}
