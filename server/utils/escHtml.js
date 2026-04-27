/**
 * Escape HTML entities to prevent XSS in templates and emails.
 * @param {string} s
 * @returns {string}
 */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Caracteres invisibles utilises pour spoofer un nom (zero-width + bidi + BOM).
// On garde la liste explicite par codepoint pour qu'elle soit auditee facilement.
const INVISIBLE_RE = /[​-‏‪-‮⁦-⁩﻿]/g

/**
 * Sanitize une chaine destinee a un contexte non-HTML (subject d'email,
 * header SMTP, body texte d'invitation Outlook). Strippe les CR/LF qui
 * permettent l'injection de header, ainsi que les caracteres invisibles
 * (zero-width, bidirectional override) utilises pour spoofer un nom.
 * Coupe a `maxLen` caracteres.
 *
 * @param {string} s
 * @param {number} [maxLen=200]
 * @returns {string}
 */
function sanitizePlainText(s, maxLen = 200) {
  return String(s)
    // CR/LF/TAB : neutralise l'injection d'en-tetes SMTP / RFC5322
    .replace(/[\r\n\t]/g, ' ')
    // Controle ASCII (0x00-0x1F sauf espace) et DEL (0x7F)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(INVISIBLE_RE, '')
    .trim()
    .slice(0, maxLen)
}

/**
 * Whitelist scheme + parse pour empecher les URLs malicieuses dans les
 * attributs HTML (`<a href="...">`). Protege contre `javascript:fetch(...)`,
 * `data:text/html,<script>`, etc. — z.string().url() de zod accepte tous
 * les schemes valides syntaxiquement, donc cette validation est obligatoire
 * avant injection dans un template.
 *
 * Renvoie l'URL normalisee si http(s), null sinon.
 *
 * @param {string|null|undefined} u
 * @returns {string|null}
 */
function safeHttpUrl(u) {
  if (!u || typeof u !== 'string') return null
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.href
  } catch {
    return null
  }
}

module.exports = { escHtml, sanitizePlainText, safeHttpUrl }
