---
name: lumen-code-examples
status: backlog
created: 2026-04-08T19:19:56Z
progress: 0%
prd: .claude/prds/lumen-code-examples.md
github: https://github.com/rohanfosse/cursus/issues/122
---

# Epic: lumen-code-examples

## Overview

Ajouter aux cours Lumen la possibilite d'attacher un projet de code multi-fichiers sous forme de snapshot immuable d'un repo GitHub public. Les enseignants collent une URL, Cursus fetch l'arborescence + le contenu a la publication, puis les etudiants parcourent l'arbo dans le reader et telechargent le zip genere a la volee cote serveur.

Approche pragmatique visant le pilote CESI septembre 2026 : zero stockage de fichiers prof cote Cursus (le repo git fait foi), snapshot fige pour la reproductibilite, resync manuel via bouton. Reutilise au maximum les patterns existants (meta row editor v2.22.0, grille reader v2.23.0, highlight.js de markdown.ts).

## Architecture Decisions

### AD-1 : Snapshot JSON stocke en colonne de la table lumen_courses (pas de table dediee)

Le snapshot est un document autonome et atomique avec le cours. Plutot que creer une table `lumen_course_snapshots` avec une ligne par fichier, on stocke le JSON complet dans une colonne `repo_snapshot TEXT` de `lumen_courses`.

**Raisons :**
- Atomicite : pas de join pour recuperer le snapshot
- Simplicite : un seul insert/update a la publication
- Taille contenue par les limites dures (5 Mo max, donc < 10 Mo apres base64)
- Pas besoin d'indexer le contenu des fichiers individuellement

**Trade-off accepte :** on ne peut pas chercher dans le contenu des fichiers de tous les cours. Pas un besoin actuel.

### AD-2 : Fetch GitHub API en natif, sans SDK

Utiliser `fetch` natif + GitHub REST API v3 (endpoints publics, pas de token). Zero dependance nouvelle cote Node.

**Raisons :**
- 2 endpoints suffisent : `GET /repos/:owner/:repo` (metadata + default_branch) + `GET /repos/:owner/:repo/git/trees/:sha?recursive=1` (arbo) + `GET /repos/:owner/:repo/contents/:path` (contenu)
- `@octokit/rest` = 400+ Ko pour 3 endpoints : disproportionne
- Plus facile a tester (mock fetch)

### AD-3 : Snapshot immuable avec resync explicite

Le snapshot ne se met JAMAIS a jour tout seul. Le prof doit cliquer "Resynchroniser" pour refetch. Couvert par la deep-interview (Round 5).

**Raisons :**
- Reproductibilite : l'etudiant voit exactement ce que le prof a publie
- Pas de rate limit GitHub (60 req/h) puisque pas de fetch a la volee
- Pas de cache invalidation complexe
- Le prof controle explicitement quand les etudiants voient les maj

### AD-4 : Zip genere a la volee depuis le snapshot stocke, pas proxy vers GitHub

Cote backend, construire le zip depuis le JSON stocke avec `archiver` (streaming). Ne pas rediriger vers `github.com/.../archive/main.zip`.

**Raisons :**
- Robustesse : marche meme si le repo GitHub a ete supprime entre temps
- Coherence : l'etudiant recoit exactement les fichiers du snapshot, pas la derniere version du repo
- Nom du zip controle (`{cours-slug}-exemple.zip` au lieu de `repo-main.zip`)
- Pas de CORS / redirections

### AD-5 : LumenProjectPanel dans LumenReader, pas une page separee

Integrer l'arbre + viewer dans un panneau au sein de [LumenReader.vue](src/renderer/src/components/lumen/LumenReader.vue). Pas de route separee, pas de modal.

**Raisons :**
- Le projet est contextuel au cours, l'etudiant ne doit pas perdre le contexte du contenu
- Permet de garder les ameliorations UX du reader (progress bar, TOC, prev/next)
- Pas de nouvelle route a gerer
- Sur desktop >1280px : tiroir lateral droit (a cote du TOC)
- Sur desktop 1024-1280px : sous l'article
- Sur mobile : sous l'article, collapsible

## Technical Approach

### Frontend Components

| Composant | Action | Lignes estimees |
|-----------|--------|-----------------|
| `LumenView.vue` (meta row editeur) | Ajouter input URL repo + badge snapshot + bouton resync | +50 |
| `LumenReader.vue` | Integrer le panneau projet + passer les donnees | +30 |
| `LumenProjectPanel.vue` (nouveau) | Container : tree + viewer + download, responsive | ~200 |
| `LumenProjectTree.vue` (nouveau) | Arborescence expandable avec icones, navigation clavier | ~180 |
| `LumenProjectFileViewer.vue` (nouveau) | Viewer single-file avec hljs lazy | ~120 |
| `stores/lumen.ts` | Actions `setCourseRepo`, `refreshSnapshot`, `fetchFileContent` | +60 |
| `preload/index.ts` + IPC | Exposer `updateLumenRepo`, `refreshLumenSnapshot`, `getLumenFile`, `downloadLumenZip` | +40 |

### Backend Services

| Fichier | Action | Lignes estimees |
|---------|--------|-----------------|
| `server/db/schema.js` | Migration : 5 colonnes sur `lumen_courses` (repo_url, repo_snapshot, repo_commit_sha, repo_default_branch, repo_snapshot_at) | +20 |
| `server/db/models/lumen.js` | CRUD snapshot : read/write colonnes | +30 |
| `server/services/lumenSnapshot.js` (nouveau) | Parse URL, fetch GitHub API, walker, validation limites, serialization | ~250 |
| `server/services/lumenZip.js` (nouveau) | Construit un zip streaming depuis le JSON snapshot via `archiver` | ~80 |
| `server/routes/lumen.js` | 4 nouvelles routes : POST snapshot, POST refresh, GET download, GET file/:path | +120 |

### Infrastructure

**Nouvelle dependance :**
- `archiver` (~200 Ko) pour le zip streaming cote Node

**Pas de migration lourde :** les 5 colonnes ajoutees sont nullable et retrocompatibles. Les cours existants restent intacts, juste sans projet attache.

**Pas de CI/infra nouvelle :** pas de service externe, pas de queue, pas de worker separe.

## Implementation Strategy

### Phase 1 — Fondations backend (parallelisable une fois le schema pose)

1. Migration DB + model (bloquant pour tout le reste)
2. Service snapshot (fetch GitHub API + validation)
3. Service zip (archiver)

### Phase 2 — Routes API + integration publication

4. Routes snapshot + refresh + download + file
5. Integration dans le flow `POST /publish` existant

### Phase 3 — UI enseignant

6. Meta row editor : input URL + badge + bouton resync

### Phase 4 — UI etudiant

7. Composants `LumenProjectTree` + `LumenProjectFileViewer`
8. Integration `LumenProjectPanel` dans `LumenReader`

### Phase 5 — Tests + finalisation

9. Tests backend (service snapshot, service zip, routes)
10. Tests frontend (composants tree/viewer, integration reader)

Les phases 3 et 4 peuvent demarrer en parallele apres la phase 2. La phase 5 est sequentielle (tests du code ecrit dans les phases precedentes).

## Task Breakdown Preview

| # | Tache | Phase | Parallele ? | Effort |
|---|-------|-------|-------------|--------|
| 1 | Migration DB + model `lumen_courses` (5 colonnes snapshot) | 1 | oui | S |
| 2 | Service `lumenSnapshot.js` : parse URL + fetch GitHub + validation | 1 | non (depend 1) | L |
| 3 | Service `lumenZip.js` : construction zip streaming depuis JSON | 1 | oui | S |
| 4 | Routes REST snapshot + refresh + download + file + integration publish | 2 | non (depend 2, 3) | M |
| 5 | IPC preload + actions store `lumen.ts` | 2 | non (depend 4) | S |
| 6 | UI editor : input URL + badge snapshot + bouton resync dans meta row | 3 | oui (depend 5) | M |
| 7 | Composant `LumenProjectTree` + `LumenProjectFileViewer` | 4 | oui (depend 5) | L |
| 8 | Integration `LumenProjectPanel` dans `LumenReader` responsive | 4 | non (depend 7) | M |
| 9 | Tests backend : service snapshot, zip, routes (vitest + mock fetch) | 5 | non (depend 4) | M |
| 10 | Tests frontend : tree, viewer, integration reader (vitest + testing-library) | 5 | non (depend 8) | M |

Effort : S = 1-2h, M = 2-4h, L = 4-8h. Total estime : **22-34h** (2-3 semaines a 10-20h/sem).

Parallelisation effective :
- Phase 1 : taches 1, 3 peuvent commencer apres que le schema est pose (tache 1 bloque toutes les autres)
- Apres phase 2 (tache 5) : taches 6 et 7 peuvent demarrer en parallele
- Tests (9, 10) en fin de chaque cote backend/frontend

## Dependencies

### Code existant a reutiliser

- [markdown.ts](src/renderer/src/utils/markdown.ts) — config `highlight.js` deja en place, importable directement dans `LumenProjectFileViewer`
- [LumenView.vue](src/renderer/src/views/LumenView.vue:795-930) — pattern meta row (cf. input Promo + select Projet associe ajoutes en v2.22.0)
- [LumenReader.vue](src/renderer/src/components/lumen/LumenReader.vue) — grille `reader-grid` qui peut accueillir un 3e panneau via breakpoint responsive
- [lumen.ts store](src/renderer/src/stores/lumen.ts) — actions existantes `createCourse`, `updateCourse`, `publishCourse` a etendre
- `server/routes/lumen.js` — handlers REST existants, pattern a suivre
- `server/db/models/lumen.js` — CRUD existant a etendre

### Nouvelles dependances externes

- `archiver` (npm, ~200 Ko) — zip streaming cote Node

### APIs tierces

- GitHub REST API v3, endpoints publics (pas de token requis, rate limit 60 req/h par IP)

## Success Criteria (Technical)

1. Un cours avec `repo_url` defini peut etre publie avec succes → snapshot cree en DB avec le SHA du commit
2. Le download zip d'un cours snapshote contient l'arborescence exacte du repo a l'instant T du snapshot, meme si le repo a change depuis
3. Les limites dures (200 fichiers, 5 Mo, 512 Ko/fichier) sont verifiees avant stockage et refusent proprement avec message explicite
4. Les cas d'erreur GitHub (404, 403 rate limit, 504 timeout, URL malformee) donnent des messages actionables cote UI
5. Zero regression sur les 2651 tests existants
6. Couverture >= 60% sur les nouveaux services et composants
7. Build TypeScript clean (zero error vue-tsc)
8. Le reader reste fluide (rendu du panneau < 100ms pour un projet de 200 fichiers)

## Estimated Effort

- **Phase 1 (Fondations backend)** : 6-10h
- **Phase 2 (Routes API + IPC)** : 4-6h
- **Phase 3 (UI enseignant)** : 3-4h
- **Phase 4 (UI etudiant)** : 6-10h
- **Phase 5 (Tests)** : 4-6h
- **Total** : **23-36h** sur 2-3 semaines

## Tasks Created

- [ ] 001.md - Migration DB + model lumen_courses (5 colonnes snapshot) (parallel: true)
- [ ] 002.md - Service lumenSnapshot.js : parse + fetch GitHub + validation (parallel: false, depends: 1)
- [ ] 003.md - Service lumenZip.js : construction zip streaming (parallel: true, depends: 1)
- [ ] 004.md - Routes REST snapshot + integration publish (parallel: false, depends: 2, 3)
- [ ] 005.md - IPC preload + actions store lumen.ts (parallel: false, depends: 4)
- [ ] 006.md - UI editor : meta row URL + badge + resync (parallel: true, depends: 5)
- [ ] 007.md - Composants LumenProjectTree + LumenProjectFileViewer (parallel: true, depends: 5)
- [ ] 008.md - Integration LumenProjectPanel dans LumenReader responsive (parallel: false, depends: 7)
- [ ] 009.md - Tests backend (service snapshot, zip, routes) (parallel: false, depends: 4)
- [ ] 010.md - Tests frontend (tree, viewer, integration reader) (parallel: false, depends: 8)

Total tasks: 10
Parallel tasks: 4 (001, 003 debut ; 006, 007 mid ; 009, 010 fin)
Sequential tasks: 6
Estimated total effort: 23-36 hours
