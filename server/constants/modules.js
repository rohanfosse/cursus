/**
 * Modules enrichissement - source unique.
 *
 * Consomme par :
 *   - server/routes/admin/settings.js      (POST /api/admin/modules : allowlist)
 *   - server/routes/admin/settings-read.js (GET  /api/admin/modules : liste + etats)
 *   - server/public/admin/modules/modules-config.js via GET /api/admin/modules/meta
 *
 * Le renderer Electron (src/renderer/src/composables/useModules.ts) garde sa propre
 * liste statique pour rester operationnel offline - a synchroniser manuellement ici.
 */

const MODULE_KEYS = ['kanban', 'frise', 'live', 'signatures', 'lumen', 'games']

const MODULE_META = {
  kanban:     { label: 'Kanban projet',        desc: 'Tableau kanban pour la gestion de projet en groupe' },
  frise:      { label: 'Frise chronologique',  desc: 'Vue timeline des evenements et jalons' },
  live:       { label: 'Quiz interactif',      desc: 'Quiz en direct type Kahoot pour les cours' },
  signatures: { label: 'Signature PDF',        desc: 'Demandes de signature electronique de documents' },
  lumen:      { label: 'Lumen',                desc: 'Liseuse de cours adossee a GitHub' },
  games:      { label: 'Jeux',                 desc: 'Mini-jeux (TypeRace, etc.) avec leaderboard — opt-in' },
}

module.exports = { MODULE_KEYS, MODULE_META }
