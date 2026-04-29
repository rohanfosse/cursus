# Routes demo

Quatre fichiers, une responsabilite par fichier :

| Fichier | Role | Touche au tenant ? |
|---------|------|--------------------|
| `index.js` | Router racine, POST /start, POST /end, mount middleware + sous-routers | CRUD session |
| `real.js` | Endpoints qui lisent les tables `demo_*` et le feed temps-reel (messages, presence, notif feed, typing, recent DMs) | Lecture + ecritures POST/messages |
| `interactive.js` | Endpoints d'actions etudiantes qui DOIVENT persister pendant la session (bookmarks, pin, reactions, edit/delete message, lumen reads/notes) | Oui (DB + Map en memoire) |
| `mocks.js` | Fallbacks hardcoded pour les features prod non couvertes par le seed (booking, documents, lumen catalogue, kanban, signatures...) | Non (sauf lookups statiques) |

## Ordre de dispatch

```
POST /start              -> index.js (avant demoMode)
[demoMode middleware]    -> index.js
POST /end                -> index.js
GET  /messages/...       -> real.js  (read + recent DMs + notif feed)
POST /bookmarks          -> interactive.js (etat per-tenant)
POST /messages/reactions -> interactive.js (DB write)
GET  /booking/...        -> mocks.js
GET  /<inconnu>          -> mocks.js wildcard ({ ok: true, data: [] })
POST /<inconnu>          -> mocks.js wildcard (403 + message)
```

L'ordre `real -> interactive -> mocks` garantit qu'un endpoint vrai prevaut toujours sur un fallback du meme path.

## Etat en memoire (interactive.js)

Pour les actions qui n'ont pas de table demo_* dediee, on maintient un Map per-tenant :

```js
// server/routes/demo/interactive.js
const _state = new Map()  // tenantId -> {
//   bookmarks: Map<msgId, { note, addedAt }>,
//   bookmarkRemovals: Set<msgId>,           // baseline mask
//   lumenReads: Map<`${repoId}|${path}`, { readAt }>,
//   lumenNotes: Map<`${repoId}|${path}`, { content, updatedAt }>,
// }
```

Le state est purge dans `index.js > POST /end`, en plus des Hawkes/typing/sims du demoBots. Sans cette purge, un visiteur qui demarre N sessions accumule N* l'etat en memoire.

## Ajouter un mock

1. Identifier l'URL prod (ex: `/api/booking/event-types`)
2. Identifier le shape attendu cote frontend (Devtools + types)
3. Ajouter `router.get('/booking/event-types', (_, res) => res.json({...}))` dans la section thematique de `mocks.js`
4. Si le shape doit ressembler a la realite, regarder `server/db/models/<feature>.js` pour les colonnes effectives

Pour qu'un endpoint **modifie** le tenant (ex: nouveau message), passer par `real.js` avec une requete SQL parametree par `req.tenantId`.

Pour qu'un endpoint **ecrive un etat ephemere** sans table dediee (ex: signet pose par le visiteur), passer par `interactive.js` qui utilise les Maps en memoire.

## V2 aliases (api-shim.ts)

Le `liveStore` cote front utilise systematiquement les variantes `/api/live-v2/...` qui n'existent pas en demo (le seed ne contient pas les tables `live_*_v2`). On les redirige sur les routes V1 dans `src/web/api-shim.ts` :

```ts
getLiveV2Session:        (id) => get(`/api/live/sessions/${id}`),
submitLiveV2Response:    (aid, p) => post(`/api/live/activities/${aid}/respond`, p),
getActiveLiveV2Session:  (pid) => get(`/api/live/sessions/promo/${pid}/active`),
// ... etc.
```

Sans ces aliases, chaque appel V2 tombe dans `makeWebFallback` qui retourne `[]` et l'onglet Live reste fige sur "Rejoindre une session".

## Algos demo (demoBotsAlgo.js)

3 sous-systemes algorithmiques pour rendre les bots "vivants" :

1. **Graphe social pondere** (`SOCIAL_GRAPH`) : matrice d'affinite bot<->bot qui drive QUI repond/reagit/DM a QUI (cf. `pickAffineBot`).
2. **Processus de Hawkes** (`getIntensity`, `recordEvent`) : auto-excitation -> les PROB.* du tick sont multipliees par lambda. Reproduit les rafales naturelles.
3. **Topic scoring** (`topicVector`, `pickByTopic`) : TF-IDF light sur 6 topics + tags par template. Le visiteur tape "AVL" -> les bots gravitent vers les phrases tagees `algo`.

Plus 2 simulateurs cote prof :

- `simulateLiveResults` : sigmoid + multinomial pour le compteur de reponses qui monte sur l'ecran "Resultats"
- `getSimulatedSubmissions` : courbe de remises selon distance a deadline + diligence des etudiants

## DEMO_STRICT

`DEMO_STRICT=1` fait que le wildcard renvoie 501 au lieu de `[]`. Utile en CI pour reperer les nouvelles routes prod qui meritent un mock. Toutes les wildcards hits sont aussi log via `console.warn` pour analyse a posteriori.

## Tests

Voir `tests/backend/demo/` :

- `routes.test.js` — cycle session (start/end), routes core (promotions/channels/messages), wildcard fallback
- `seed.test.js` — seedTenant : volumes, isolation par tenant, reactions au format enrichi
- `bots.test.js` — actions individuelles des bots (post/reply/react/edit) avec mockRandom
- `interactive.test.js` — bookmarks, pin/reactions/edit/delete (ownership), Lumen reads/notes, welcome DM, recent-dm-contacts
- `live-student.test.js` — active session shape (qcm+JSON options), join code, respond (live + replay), past sessions, notif/typing feed
- `student-journey.test.js` — smoke test end-to-end happy path : 1 test qui parcourt tout le journey sans 4xx/5xx

99 tests verts au moment de l'ecriture (cf. `demo-hardening-4` tag).
