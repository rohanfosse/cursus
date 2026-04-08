---
subject: Fichiers de code d'exemple dans les cours Lumen
type: brownfield
rounds: 5
ambiguity: 16.75%
created: 2026-04-08
---

# Specification : Fichiers de code d'exemple dans Lumen

## Scores de clarte

| Dimension | Score | Poids | Contribution |
|-----------|-------|-------|--------------|
| Objectif | 0.95 | 35% | 0.333 |
| Contraintes | 0.85 | 25% | 0.213 |
| Criteres de succes | 0.85 | 25% | 0.213 |
| Contexte (brownfield) | 0.50 | 15% | 0.075 |
| **Total clarte** | | | **0.833** |
| **Ambiguite finale** | | | **16.75%** |

## Objectif

Permettre a un enseignant d'attacher **un** projet de code multi-fichiers a un cours Lumen, en liant un **repo git public** au cours. Les etudiants peuvent parcourir l'arborescence directement dans le reader, lire le contenu des fichiers avec coloration syntaxique, et telecharger le projet entier en .zip.

Formulation en une phrase : *un cours = un repo git d'exemple, snapshote a la publication, parcouru dans le reader et telechargeable en zip.*

## Contraintes

- **Cardinalite** : au plus un projet par cours (1-1 avec `lumen_courses`). Pas de multi-projets.
- **Source unique** : URL d'un repo git public. GitHub en priorite pour le pilote CESI, GitLab optionnel apres.
- **Pas de stockage de fichiers prof** : le prof ne televerse rien via Cursus, il colle une URL.
- **Snapshot immuable** : Cursus fetch l'arborescence + contenu une seule fois (a la publication du cours) et le stocke. Pas de refetch automatique.
- **Mise a jour manuelle uniquement** : si le prof push du nouveau code, il doit explicitement re-synchroniser depuis un bouton dans l'editeur (voir TODO).
- **Aucune execution cote client** : pas de sandbox, pas de Pyodide. Lecture + download uniquement.
- **Pas d'authentification GitHub** : repos publics uniquement. Les repos prives sont hors scope.
- **Timeline** : livrable avant le pilote CESI de septembre 2026.

## Non-objectifs (hors scope)

- **Repos prives** (necessite OAuth GitHub par utilisateur).
- **Projets multi-par-cours** (un seul suffit pour le pilote).
- **Edition en ligne** (pas de mini-IDE, le prof edite dans son IDE habituel et push).
- **Execution / sandbox** (Pyodide, iframe JS runner, etc.).
- **Diff inter-versions** (pas de comparaison entre snapshots successifs).
- **Student forks** (pas de "remix" du projet pour les etudiants).
- **Comments inline sur le code** (hors scope de Lumen reader).
- **Auto-refresh** (le snapshot ne se met pas a jour tout seul — c'est un choix de fiabilite).
- **Support GitLab/Bitbucket/self-hosted** dans la v1 (GitHub uniquement).

## Criteres d'acceptation

### Cote enseignant

- [ ] Dans l'editeur Lumen (meta row), un champ "Projet d'exemple (URL git)" permet de coller une URL GitHub publique.
- [ ] Au clic sur "Publier" (ou "Publier et notifier"), Cursus fetch l'arborescence du repo et le contenu de chaque fichier, stocke le snapshot en base.
- [ ] Si le fetch echoue (repo introuvable, rate limit, timeout), la publication affiche une erreur claire ("Repo inaccessible : verifie l'URL ou reessaie dans 5 minutes") et **ne publie pas**.
- [ ] Si le repo depasse une taille limite (ex. 200 fichiers ou 5 Mo total), la publication est refusee avec un message explicite.
- [ ] Un bouton "Resynchroniser depuis le repo" dans le panneau d'edition permet de refetch manuellement apres un push.
- [ ] En re-editant un cours publie avec un repo, le prof voit l'URL actuelle + la date du dernier snapshot + le SHA du commit fige.

### Cote etudiant

- [ ] Dans le reader, un panneau "Projet d'exemple" apparait (sous le contenu du cours ou dans une colonne laterale) si le cours a un snapshot.
- [ ] L'etudiant peut parcourir l'arborescence du projet comme un explorateur de fichiers (dossiers expandables).
- [ ] Au clic sur un fichier, son contenu s'affiche dans un viewer avec coloration syntaxique (reutilise highlight.js deja utilise par Lumen).
- [ ] Un bouton "Telecharger le projet (.zip)" declenche le telechargement de l'archive complete.
- [ ] Pour les fichiers binaires (images, pdf), le viewer affiche un message "Fichier binaire — telecharge le zip pour le recuperer" sans tenter d'afficher le contenu.

### Fiabilite

- [ ] Le snapshot est idempotent : republier sans changer l'URL ne re-fetch pas le repo.
- [ ] Si GitHub supprime le repo apres le snapshot, les etudiants continuent de voir le contenu (le snapshot est autonome).
- [ ] Le zip telecharge par l'etudiant est construit depuis le snapshot local, pas via un proxy live vers GitHub (robustesse offline partielle).

## Hypotheses exposees et resolues

| Hypothese | Challenge | Resolution |
|-----------|-----------|-----------|
| "Code d'exemple = fenced block markdown ameliore" | Les fenced blocks existent deja et sont colores via hljs | Ecarte : l'utilisateur veut un **projet multi-fichiers**, pas un snippet |
| "Les profs vont televerser des fichiers depuis Cursus" | Oblige Cursus a gerer stockage, quotas, nettoyage | Ecarte via Contradicteur : solution git-url elimine le stockage prof cote Cursus |
| "Il faut une sandbox executable pour que ce soit utile" | Pyodide = 10 Mo bundle + securite + perf complexes | Ecarte via Simplificateur : pilote CESI vise "parcourir + telecharger" uniquement |
| "Il faut du live-sync entre le repo et le cours" | Rate limit GitHub, complexite d'invalidation cache | Ecarte : snapshot immuable a la publication + bouton de resync manuel |
| "Un cours peut avoir plusieurs exemples" | UI plus complexe, navigation entre plusieurs arbos | Ecarte : cardinalite 1-1 pour le pilote, re-evaluer apres feedback terrain |
| "Les repos prives sont necessaires" | Oblige a gerer OAuth GitHub par utilisateur | Hors scope v1 : les profs CESI mettent leurs exemples en public |

## Contexte technique

### Code existant reutilisable

- [markdown.ts](src/renderer/src/utils/markdown.ts) — `highlight.js` deja configure avec `highlightAuto`, reutilisable pour le viewer de fichiers
- [LumenReader.vue](src/renderer/src/components/lumen/LumenReader.vue) — la grille reader-grid peut accueillir un 3e panneau ou un tiroir sous l'article
- [LumenView.vue](src/renderer/src/views/LumenView.vue:795-930) — la meta row de l'editeur a deja un pattern pour ajouter un champ (cf. Promo + Projet associe)
- [lumen.ts store](src/renderer/src/stores/lumen.ts) — actions `createCourse`, `updateCourse`, `publishCourse` a etendre
- [server/routes/](server/routes/) — routes REST, pattern a suivre pour `POST /lumen/:id/snapshot`
- `better-sqlite3` — stockage snapshot : table dediee ou colonne JSON sur `lumen_courses`

### Fichiers a creer / modifier

**Backend :**
- `server/db/schema.js` — ajouter colonnes `repo_url TEXT`, `repo_snapshot TEXT` (JSON), `repo_commit_sha TEXT`, `repo_snapshot_at TEXT` sur la table `lumen_courses`
- `server/services/lumenSnapshot.js` (nouveau) — fetch GitHub API, walker recursif, construction du snapshot JSON, validation taille
- `server/routes/lumen.js` — etendre `POST /:id/publish` pour declencher le snapshot, ajouter `POST /:id/snapshot/refresh` (resync manuel)
- `server/routes/lumen.js` — ajouter `GET /:id/snapshot/download` (streaming d'un zip genere a la volee depuis le JSON stocke)

**Frontend :**
- `src/preload/index.ts` — exposer `updateLumenCourseRepo`, `refreshLumenSnapshot`, `downloadLumenSnapshot`
- `src/renderer/src/components/lumen/LumenReader.vue` — ajouter panneau "Projet d'exemple" avec file tree + viewer
- `src/renderer/src/components/lumen/LumenProjectTree.vue` (nouveau) — composant arborescence expandable
- `src/renderer/src/components/lumen/LumenProjectFileViewer.vue` (nouveau) — viewer single-file avec hljs
- `src/renderer/src/views/LumenView.vue` — ajouter input URL repo + bouton resync dans la meta row de l'editeur
- `src/renderer/src/stores/lumen.ts` — actions `setCourseRepo`, `refreshSnapshot`, `downloadSnapshot`

### Format du snapshot (proposition)

```json
{
  "repo_url": "https://github.com/rohanfosse/exemple-python-intro",
  "default_branch": "main",
  "commit_sha": "abc123def456",
  "fetched_at": "2026-04-08T14:30:00Z",
  "files": [
    { "path": "main.py", "type": "file", "size": 1234, "content_base64": "..." },
    { "path": "utils/helpers.py", "type": "file", "size": 567, "content_base64": "..." }
  ],
  "total_size": 1801,
  "file_count": 2
}
```

Stockage : JSON serialise dans une colonne TEXT de `lumen_courses`. Avantage : atomique avec le cours, pas de table supplementaire. Inconvenient : pas d'indexation fine du contenu. Acceptable pour < 5 Mo.

### Limites dures proposees

- Max **200 fichiers** par projet
- Max **5 Mo** de taille totale apres snapshot
- Max **512 Ko** par fichier individuel
- Fichiers binaires (non-UTF8) stockes en base64 mais le viewer affiche "binaire" au lieu du contenu

### Cas d'erreur a gerer

- URL mal formee → erreur 400 avec hint
- Repo introuvable (404 GitHub) → erreur 404 avec hint "verifie que le repo est public"
- Rate limit GitHub (403 avec `X-RateLimit-Remaining: 0`) → erreur 429 avec hint "reessaie dans X minutes"
- Timeout (> 30s de fetch) → erreur 504 avec hint "repo trop gros ou GitHub lent"
- Depassement des limites dures → erreur 413 avec compteurs precis

## Transcription

<details><summary>Voir les Q&R</summary>

**Round 1 — Objectif (35%)**
Q: Qu'est-ce qui compte le plus pour l'etudiant ? Les fenced blocks existent deja.
R: **Projet multi-fichiers.** Un exemple n'est pas toujours un seul fichier.
Ambiguite: 100% → 72.7%

**Round 2 — Contraintes (25%)**
Q: Comment le projet s'accroche-t-il au cours ?
R: **1 projet global par cours.**
Ambiguite: 72.7% → 61.3%

**Round 3 — Criteres (25%)**
Q: Qu'est-ce que l'etudiant fait avec ce projet ?
R: **Parcourir + telecharger.** (Pas d'execution, pas de copie file-by-file.)
Ambiguite: 61.3% → 38.5%

**Round 4 — Contraintes + Contradicteur**
Q: Comment le prof upload ? Et si on ne stockait rien dans Cursus ?
R: **Lien vers un repo git.** Zero stockage prof cote Cursus.
Ambiguite: 38.5% → 27.3%

**Round 5 — Contexte + Simplificateur**
Q: Quand fetch et comment gerer les echecs ? Version minimale pilote ?
R: **Snapshot a la publication.** Immuable, resync manuel via bouton.
Ambiguite: 27.3% → 16.75% ✅

</details>

## Prochaines etapes proposees

1. **Creer un PRD** via le skill `ccpm` pour transformer cette spec en epic GitHub avec taches decoupees
2. **Executer directement** si l'utilisateur veut commencer l'implementation backend d'abord (schema + service snapshot)
3. **Affiner** si on veut discuter les limites exactes (200/5 Mo/512 Ko) ou le format de snapshot
4. **Sauvegarder seulement** pour evaluer avec d'autres profs CESI avant de coder
