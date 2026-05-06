/**
 * ipcSafe — utilitaires pour sanitiser les payloads avant qu'ils ne
 * traversent le pont `contextBridge` du preload Electron.
 *
 * Probleme : quand on appelle `window.api.X(payload)` depuis le renderer,
 * Electron clone les arguments via `structuredClone` pour les passer en
 * toute securite a la sandbox preload. `structuredClone` echoue avec
 * "An object could not be cloned." sur les Proxies Vue (ref / reactive)
 * — typiquement quand on construit un payload directement a partir de
 * `form.value.X` sans deep-copier.
 *
 * Symptome : la requete est bloquee AVANT meme l'appel HTTP, l'erreur
 * remonte en exception dans le `try` de la composable, le toast generique
 * est affiche, et l'API serveur ne voit jamais la requete.
 *
 * Solution : `toRawPayload` deep-clone via JSON cycle, ce qui strip
 * toute la reactivite Vue et garantit que le payload est un objet POJO
 * structuredClone-friendly. Adapte aux shapes de donnees metier
 * (primitives, strings, arrays, objets imbriques) — pas aux Date / Map
 * / Set / Blob qui necessiteraient un clone plus riche.
 */

/**
 * Deep-clone un payload pour le rendre safe a passer via contextBridge.
 * Strip toute reactivite Vue (ref / reactive / shallowRef).
 *
 * Note : preserve la signature TS d'entree pour ne pas degrader le typage
 * a chaque appel.
 *
 * @example
 *   const payload = { title: form.value.title, items: form.value.items }
 *   await window.api.createX(toRawPayload(payload))
 */
export function toRawPayload<T>(payload: T): T {
  if (payload == null || typeof payload !== 'object') return payload
  return JSON.parse(JSON.stringify(payload)) as T
}
