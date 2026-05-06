/**
 * emailMacros — helper de substitution de variables dans les templates
 * texte saisis par le prof (description campagne, ordre du jour).
 *
 * Decision pilote (deep interview Q10) : macros plutot que templates editables
 * pour rester simple. Le prof ecrit son message, on substitue les variables
 * connues a l'envoi.
 *
 * Variables exposees :
 *   {{nom_etudiant}}      -> "Jean Dupont"
 *   {{prenom_etudiant}}   -> "Jean" (premier mot du nom complet)
 *   {{nom_prof}}          -> "Rohan Fosse"
 *   {{titre_campagne}}    -> "Bilan mi-parcours A4"
 *   {{date_rdv}}          -> "lundi 12 mai" (vide si non encore reserve)
 *   {{heure_rdv}}         -> "14:30" (vide si non encore reserve)
 *   {{duree}}             -> "30 min"
 *
 * Comportement : variable inconnue -> laissee telle quelle (debug visible).
 *                vars null/undefined -> substitution par chaine vide.
 *
 * Securite : la fonction ne rend QUE du texte brut. C'est l'appelant qui
 * fait l'escapeHtml AVANT injection dans un mail HTML.
 */

const MACRO_RE = /\{\{\s*([a-z_][a-z_0-9]*)\s*\}\}/gi

/**
 * @param {string} template
 * @param {Record<string, string|number|null|undefined>} vars
 * @returns {string}
 */
function interpolateMacros(template, vars) {
  if (!template || typeof template !== 'string') return template || ''
  if (!vars || typeof vars !== 'object') return template
  const map = new Map()
  for (const [k, v] of Object.entries(vars)) {
    map.set(k.toLowerCase(), v == null ? '' : String(v))
  }
  return template.replace(MACRO_RE, (match, key) => {
    const norm = String(key).toLowerCase()
    return map.has(norm) ? map.get(norm) : match
  })
}

/**
 * Construit le bag de variables standard pour un mail campagne / tripartite.
 * @param {{
 *   studentName?: string|null,
 *   teacherName?: string|null,
 *   campaignTitle?: string|null,
 *   startDatetime?: string|null,
 *   durationMinutes?: number|null,
 * }} ctx
 */
function buildMacroVars(ctx) {
  const studentName = ctx.studentName || ''
  const firstName = studentName.split(/\s+/)[0] || ''
  let dateStr = ''
  let timeStr = ''
  if (ctx.startDatetime) {
    try {
      const d = new Date(ctx.startDatetime)
      dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    } catch { /* ignore parse error */ }
  }
  return {
    nom_etudiant:    studentName,
    prenom_etudiant: firstName,
    nom_prof:        ctx.teacherName || '',
    titre_campagne:  ctx.campaignTitle || '',
    titre_rdv:       ctx.campaignTitle || '',  // alias
    date_rdv:        dateStr,
    heure_rdv:       timeStr,
    duree:           ctx.durationMinutes ? `${ctx.durationMinutes} min` : '',
  }
}

/** Liste des macros disponibles, exposee a l'UI pour aider a la saisie. */
const AVAILABLE_MACROS = [
  '{{nom_etudiant}}',
  '{{prenom_etudiant}}',
  '{{nom_prof}}',
  '{{titre_campagne}}',
  '{{date_rdv}}',
  '{{heure_rdv}}',
  '{{duree}}',
]

module.exports = { interpolateMacros, buildMacroVars, AVAILABLE_MACROS }
