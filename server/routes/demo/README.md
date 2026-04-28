# Routes demo

Trois fichiers, une responsabilite par fichier :

| Fichier | Role | Touche au tenant ? |
|---------|------|--------------------|
| `index.js` | Router racine, POST /start, POST /end, mount middleware + sous-routers | Crud session |
| `real.js` | Endpoints qui lisent / ecrivent les tables `demo_*` (messages, channels, presence, etc.) | Oui |
| `mocks.js` | Fallbacks hardcoded pour les features prod non couvertes par le seed | Non (sauf lookup statique) |

## Ordre de dispatch

```
POST /start              -> index.js (avant demoMode)
[demoMode middleware]    -> index.js
POST /end                -> index.js
GET  /messages/...       -> real.js  (real router monte avant mocks)
GET  /booking/...        -> mocks.js
GET  /<inconnu>          -> mocks.js wildcard ({ ok: true, data: [] })
POST /<inconnu>          -> mocks.js wildcard (403 + message)
```

L'ordre `real -> mocks` garantit qu'un endpoint vrai (ex: `/messages/channel/:id/page`) prevaut toujours sur un fallback du meme path.

## Ajouter un mock

1. Identifier l'URL prod (ex: `/api/booking/event-types`)
2. Identifier le shape attendu cote frontend (Devtools + types)
3. Ajouter `router.get('/booking/event-types', (_, res) => res.json({...}))` dans la section thematique de `mocks.js`
4. Si le shape doit ressembler a la realite, regarder `server/db/models/<feature>.js` pour les colonnes effectives

Pour qu'un endpoint **modifie** le tenant (ex: nouveau message), passer par `real.js` avec une requete SQL parametree par `req.tenantId`.

## DEMO_STRICT

`DEMO_STRICT=1` fait que le wildcard renvoie 501 au lieu de `[]`. Utile en CI pour reperer les nouvelles routes prod qui meritent un mock. Toutes les wildcards hits sont aussi log via `console.warn` pour analyse a posteriori.

## Tests

Voir `tests/backend/demo/`.
