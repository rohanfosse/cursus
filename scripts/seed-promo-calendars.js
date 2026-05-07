/**
 * Seed des abonnements ICS publics pour les 2 promos pilote (CPIA2 / FISAA4).
 * Idempotent : ne re-cree pas si un abonnement existe deja avec la meme URL.
 *
 * Usage : `node scripts/seed-promo-calendars.js`
 *
 * Le serveur doit pouvoir lire les variables d'env classiques (JWT_SECRET pour
 * la cle de chiffrement). Lance le depuis la racine du repo avec le .env charge.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') })

// Pour le seed pilote on accepte un fallback dev si JWT_SECRET n'est pas
// set par ailleurs : la clef de chiffrement doit faire >= 32 chars.
// IMPORTANT : la valeur doit etre IDENTIQUE entre le seed et le serveur,
// sinon les URLs ICS chiffrees seront illisibles a la lecture. Si le user
// run le serveur avec un autre JWT_SECRET, il faut re-run le seed avec le
// meme secret en var d'env.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'cursus-pilote-dev-jwt-secret-change-in-production-please'
  console.warn('[seed-promo-calendars] WARNING : JWT_SECRET fallback dev utilise.')
  console.warn('[seed-promo-calendars] Si le serveur tourne avec un autre secret,')
  console.warn('[seed-promo-calendars] les URLs chiffrees seront illisibles. Re-run avec :')
  console.warn('[seed-promo-calendars]   set JWT_SECRET=<votre_secret> && node scripts/seed-promo-calendars.js')
}

const queries = require('../server/db/index')
const subs = queries.promoCalendarSubscriptions
const { fetchAndParseIcs } = require('../server/services/icsParser')
const { getDb } = require('../server/db/connection')

queries.init()

const TEACHER_NAME = 'Rohan Fosse'

// Hard-coded URLs ICS publiees fournies par le prof (calendar.ics Outlook).
const SEEDS = [
  {
    promoName: 'CPI A2 Informatique',
    label: 'CPIA2 Info 25/26',
    color: '#ef4444',
    icsUrl: 'https://outlook.office365.com/owa/calendar/dc74f48978a24f8bb07f09219ef0a997@cesi.fr/b9af67c11b7f432ebcb1597718375d5345691433302372155103/calendar.ics',
  },
  {
    promoName: 'FISA Informatique A4',
    label: 'FISAA4 Info 24/27',
    color: '#22c55e',
    icsUrl: 'https://outlook.office365.com/owa/calendar/dc74f48978a24f8bb07f09219ef0a997@cesi.fr/ec8b19bf160f4769a03139807fa36fc111425151990963844375/calendar.ics',
  },
]

async function main() {
  const db = getDb()
  const teacher = db.prepare('SELECT id FROM teachers WHERE name = ? LIMIT 1').get(TEACHER_NAME)
  if (!teacher) {
    console.error(`[seed-promo-calendars] Enseignant introuvable : ${TEACHER_NAME}`)
    process.exit(1)
  }
  console.log(`[seed-promo-calendars] Enseignant : ${TEACHER_NAME} (id=${teacher.id})`)

  for (const s of SEEDS) {
    const promo = db.prepare('SELECT id, name FROM promotions WHERE name = ? LIMIT 1').get(s.promoName)
    if (!promo) {
      console.warn(`[seed-promo-calendars] Promo introuvable : ${s.promoName} (skip)`)
      continue
    }

    // Idempotence : si un abonnement existe deja sur cette promo avec ce label, on skip
    const existing = subs.listForPromo(promo.id).find(x => x.label === s.label)
    if (existing) {
      console.log(`[seed-promo-calendars] Existe deja : ${s.label} (id=${existing.id}) → refresh`)
      const result = await fetchAndParseIcs(s.icsUrl)
      if (result.ok) {
        subs.replaceEvents(existing.id, result.events)
        subs.markFetched(existing.id, { eventCount: result.events.length, error: null })
        console.log(`  → refresh ok (${result.events.length} events)`)
      } else {
        subs.markFetched(existing.id, { eventCount: 0, error: result.error })
        console.warn(`  → refresh echec : ${result.error}`)
      }
      continue
    }

    const created = subs.createSubscription({
      promoId: promo.id,
      teacherId: teacher.id,
      label: s.label,
      icsUrl: s.icsUrl,
      color: s.color,
    })
    console.log(`[seed-promo-calendars] Cree : ${s.label} (id=${created.id}, promo=${promo.name})`)
    const result = await fetchAndParseIcs(s.icsUrl)
    if (result.ok) {
      subs.replaceEvents(created.id, result.events)
      subs.markFetched(created.id, { eventCount: result.events.length, error: null })
      console.log(`  → import ok (${result.events.length} events)`)
    } else {
      subs.markFetched(created.id, { eventCount: 0, error: result.error })
      console.warn(`  → import echec : ${result.error}`)
    }
  }

  console.log('[seed-promo-calendars] Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-promo-calendars] Crash :', err)
  process.exit(1)
})
