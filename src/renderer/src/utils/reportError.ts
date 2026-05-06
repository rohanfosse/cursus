/**
 * reportError — helper unique pour les blocs catch des mutations cote
 * client. Centralise le triplet :
 *   1. console.error (visible en dev / DevTools)
 *   2. logToFile (persistant dans %APPDATA%/cursus/logs/main.log)
 *   3. retourne le message a afficher dans le toast
 *
 * Avant ce helper : le pattern courant etait
 *   } catch (err) {
 *     console.warn('[xxx]', err)
 *     showToast('Erreur', 'error')
 *   }
 * — la trace mourrait avec la session DevTools, et le toast generique
 * ne disait rien d'actionnable. Maintenant :
 *   } catch (err) {
 *     showToast(reportError(err, { tag: 'devoir', op: 'publish' }), 'error')
 *   }
 *
 * Le retour est `err.message` par defaut (utilisable directement comme
 * texte de toast) ou `userMessage` si fourni — utile quand le message
 * brut serait trop technique pour l'utilisateur final.
 */

export interface ReportErrorOptions {
  /** Domaine fonctionnel (devoir, admin, deposit, ...) — sert de prefix dans les logs. */
  tag: string
  /** Operation tentee (publish, duplicate, delete, save, ...) — concatenee a `_failed`. */
  op: string
  /** Contexte additionnel a logger (ids, payload allege, etc.). */
  meta?: Record<string, unknown>
  /** Message utilisateur si different de err.message — typiquement plus court / generique. */
  userMessage?: string
}

export function reportError(err: unknown, opts: ReportErrorOptions): string {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined

  // 1. Console pour DevTools (warn + non-error level pour ne pas casser
  //    les pages d'integration qui asserter "no error logged").
  // eslint-disable-next-line no-console
  console.error(`[${opts.tag}] ${opts.op}_failed:`, err)

  // 2. Log persistant. Le helper logToFile peut etre absent (mock test,
  //    web build sans Electron) — on ne casse jamais le flux metier
  //    pour un probleme de logger.
  try {
    window.api?.logToFile?.('error', opts.tag, `${opts.op}_failed`, {
      error: message,
      stack: stack ? stack.slice(0, 1000) : undefined,
      ...opts.meta,
    })
  } catch { /* never throw from a logger */ }

  return opts.userMessage ?? message
}
