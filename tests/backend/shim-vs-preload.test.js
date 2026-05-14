// ─── Test anti-regression : parite shim web vs preload Electron ──────────────
//
// Pourquoi : `src/preload/index.ts` expose ~329 methodes sur `window.api` en
// mode Electron, et `src/web/api-shim.ts` doit en exposer un equivalent en
// mode web (PWA mobile, app.cursus.school). Quand on ajoute une route au
// preload sans toucher au shim, le mecanisme Proxy/fallback du shim retourne
// silencieusement `{ ok: false }` -> la feature est invisible en mode web sans
// crash, donc le bug passe inapercu jusqu'au pilote.
//
// Ce test parse les deux fichiers, extrait les cles, et fail si des methodes
// presentes dans preload sont absentes du shim ET ne sont pas dans la
// whitelist `ALLOWED_MISSING_IN_SHIM` (typiquement APIs natives Electron qui
// n'ont pas d'equivalent web : badge OS, file dialogs natifs, auto-updater,
// IPC renderer-process, runtime errors uncaught...).
//
// Historique :
//   - v2.332 : agenda promo invisible en mobile (getPromoCalendarEvents
//     manquant) — incident pilote
//   - v2.333 : audit revele 83 trous, 74 routes HTTP + 10 natives no-op
//     ajoutees, 9 restants whitelistes (live realtime non bloquant)
//
// Si ce test fail :
//   1. Soit ajouter la route manquante au shim (preferable)
//   2. Soit ajouter le nom a ALLOWED_MISSING_IN_SHIM si vraiment Electron-only

// describe/it/expect sont globaux (vitest config : `globals: true` sur backend).
const fs = require('fs')
const path = require('path')

const PRELOAD_PATH = path.join(__dirname, '../../src/preload/index.ts')
const SHIM_PATH    = path.join(__dirname, '../../src/web/api-shim.ts')

/**
 * APIs natives Electron-only qui n'ont pas vocation a exister en web.
 * Cette liste DOIT rester courte et justifiee — l'ajout d'une entree
 * documente que la feature ne peut pas marcher en mode web.
 *
 * Live realtime (onLiveXxx, emitLiveCodeUpdate, onPollUpdate, onStatusChange) :
 * dans une release dediee on cablera ces events sur socket.io cote shim. Pour
 * le pilote CESI les sessions Live se font en presentiel desktop.
 */
const ALLOWED_MISSING_IN_SHIM = new Set([
  // Realtime live/status : a cabler dans une release dediee
  'emitLiveCodeUpdate',
  'onLiveBoardUpdate',
  'onLiveCodeUpdate',
  'onLiveConfusionUpdate',
  'onLiveSelfPacedUpdate',
  'onPollUpdate',
  'onStatusChange',
  // Electron-only : pas d'equivalent web pertinent
  'onRuntimeError',  // uncaught exceptions du renderer-process
  'offlineWrite',    // cache offline Electron (le web utilise SW + localStorage)
  // Mode examen surveille = desktop only par design (cf. phase 4 de
  // l'interview produit). Le verrouillage kiosk (fullscreen, paste lock,
  // blocage devtools) repose sur les APIs Electron BrowserWindow ; le web
  // ne peut pas garantir ce niveau de confinement (l'utilisateur garde
  // toujours acces a son OS via la barre du navigateur).
  'exam',
])

/**
 * Extrait les cles d'objet methode depuis un fichier TypeScript.
 * Matche les patterns au niveau d'indentation 2 espaces :
 *   - `keyName: ...`        (assignation)
 *   - `keyName(args) {...}` (method shorthand)
 *   - `async keyName(...)`  (async method shorthand)
 *
 * Tres permissif intentionnellement : on prefere capter trop puis filtrer
 * via `expectedKeys` que rater une cle qui devrait etre alignee.
 */
function extractKeys(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split('\n')
  const keys = new Set()
  const KEY_RE = /^ {2}(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*[:(]/
  for (const line of lines) {
    const m = line.match(KEY_RE)
    if (m) keys.add(m[1])
  }
  return keys
}

describe('Shim vs preload parity', () => {
  it('aucune API preload n\'est manquante dans le shim web (hors whitelist)', () => {
    const preloadKeys = extractKeys(PRELOAD_PATH)
    const shimKeys    = extractKeys(SHIM_PATH)

    // Sanity check : si l'extraction n'a rien retourne, le test ne sert a rien.
    expect(preloadKeys.size).toBeGreaterThan(200)
    expect(shimKeys.size).toBeGreaterThan(200)

    const missing = []
    for (const key of preloadKeys) {
      if (!shimKeys.has(key) && !ALLOWED_MISSING_IN_SHIM.has(key)) {
        missing.push(key)
      }
    }

    if (missing.length > 0) {
      const msg = [
        `${missing.length} methodes preload manquent dans le shim web :`,
        ...missing.sort().map(k => `  - ${k}`),
        '',
        'Solutions :',
        ' 1. Ajouter la route au shim dans src/web/api-shim.ts (preferable)',
        ' 2. Si vraiment Electron-only : ajouter a ALLOWED_MISSING_IN_SHIM',
        '    dans tests/backend/shim-vs-preload.test.js avec un commentaire',
        '    justifiant pourquoi la feature ne peut pas marcher en web.',
      ].join('\n')
      throw new Error(msg)
    }
  })

  it('la whitelist ALLOWED_MISSING_IN_SHIM ne contient pas d\'entrees obsoletes', () => {
    // Si une entree de la whitelist a ete ajoutee au shim, on doit la retirer
    // de la liste pour eviter qu'elle ne masque un futur trou avec ce nom.
    const shimKeys = extractKeys(SHIM_PATH)
    const obsolete = [...ALLOWED_MISSING_IN_SHIM].filter(k => shimKeys.has(k))
    if (obsolete.length > 0) {
      throw new Error([
        `${obsolete.length} entrees de ALLOWED_MISSING_IN_SHIM sont maintenant dans le shim :`,
        ...obsolete.map(k => `  - ${k}`),
        '',
        'Retirez-les de la whitelist dans tests/backend/shim-vs-preload.test.js.',
      ].join('\n'))
    }
  })

  it('la whitelist ne contient pas d\'entrees absentes du preload', () => {
    // Si une cle de la whitelist a ete renommee/supprimee dans le preload,
    // la garder dans la whitelist devient du bruit.
    const preloadKeys = extractKeys(PRELOAD_PATH)
    const stale = [...ALLOWED_MISSING_IN_SHIM].filter(k => !preloadKeys.has(k))
    if (stale.length > 0) {
      throw new Error([
        `${stale.length} entrees de ALLOWED_MISSING_IN_SHIM ne sont plus dans le preload :`,
        ...stale.map(k => `  - ${k}`),
        '',
        'Retirez-les de la whitelist — la cle preload n\'existe plus.',
      ].join('\n'))
    }
  })
})
