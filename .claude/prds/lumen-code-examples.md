---
name: lumen-code-examples
description: Projets de code d'exemple attaches aux cours Lumen via snapshot de repo git public, parcourus et telecharges par les etudiants dans le reader
status: backlog
created: 2026-04-08T19:19:56Z
---

# PRD: lumen-code-examples

## Executive Summary

Permettre aux enseignants CESI d'attacher un projet de code multi-fichiers a un cours Lumen en liant simplement un repo git public. Cursus snapshote l'arborescence et le contenu a la publication, puis les etudiants parcourent les fichiers et telechargent le projet entier en zip directement dans le reader — sans jamais quitter l'application.

Feature livrable avant le pilote CESI de septembre 2026. Spec issue de la deep-interview du 2026-04-08 (5 rounds, 16.75% d'ambiguite finale).

## Problem Statement

### Le probleme

Les cours Lumen actuels supportent les fenced code blocks markdown (` ```python ... ``` `) avec coloration syntaxique via highlight.js. C'est suffisant pour des snippets isoles, mais **insuffisant quand l'exemple pedagogique est un vrai projet multi-fichiers** : un `main.py` + `utils.py` + `config.json`, ou un TP web avec `index.html` + `style.css` + `app.js`.

Aujourd'hui, les enseignants doivent :
- Coller chaque fichier dans un bloc markdown separe (perd la structure, pas de download)
- Ou heberger ailleurs (Google Drive, GitHub) et mettre un lien externe (sort du cours)
- Ou distribuer en zip via les "Ressources" des devoirs (mais les cours Lumen n'y ont pas acces)

### Pourquoi maintenant

Le pilote CESI de septembre 2026 va inclure des cours pratiques (TP Python, TP web). Sans projets d'exemple attaches, l'experience etudiante sera cassee des la premiere session. Les enseignants CESI utilisent deja git pour gerer leur code pedagogique — brancher Cursus dessus est naturel.

## User Stories

### US-1 : Enseignant qui attache un projet a son cours

**En tant qu'** enseignant CESI preparant un cours Lumen avec exemple de code,
**je veux** coller une URL de repo GitHub public dans la meta row de l'editeur,
**pour** que mes etudiants puissent voir et telecharger mon projet exemple directement dans le cours.

**Criteres d'acceptation :**
- Champ "Projet d'exemple (URL git)" visible dans la meta row de l'editeur Lumen
- Validation de l'URL au collage (format `https://github.com/owner/repo`)
- Au clic sur "Publier", Cursus fetch l'arborescence du repo et cree un snapshot
- Si le fetch reussit : toast "Projet snapshote (X fichiers, Y Ko)"
- Si le fetch echoue : erreur claire ("Repo introuvable" / "Rate limit — reessaie dans X min" / "Taille depassee")
- La publication ne passe PAS si le snapshot echoue

### US-2 : Enseignant qui met a jour le projet apres un push

**En tant qu'** enseignant qui a pousse du nouveau code dans son repo exemple,
**je veux** un bouton "Resynchroniser depuis le repo" dans l'editeur,
**pour** que mes etudiants voient la derniere version sans que j'aie a depublier/republier.

**Criteres d'acceptation :**
- Bouton visible dans le panneau d'edition d'un cours publie qui a un repo attache
- Affichage de la date du dernier snapshot + SHA du commit fige
- Au clic : refetch du repo, comparaison du SHA, confirmation si changement detecte
- Nouveau snapshot remplace l'ancien, timestamp mis a jour

### US-3 : Etudiant qui lit un cours avec projet

**En tant qu'** etudiant lisant un cours Lumen qui a un projet d'exemple,
**je veux** voir l'arborescence du projet dans le reader,
**pour** explorer les fichiers et telecharger le tout pour le lancer chez moi.

**Criteres d'acceptation :**
- Panneau "Projet d'exemple" visible dans le reader sous le contenu du cours (ou tiroir a droite sur desktop)
- Arborescence expandable (dossiers cliquables)
- Clic sur un fichier : affichage dans un viewer avec coloration syntaxique
- Bouton "Telecharger le projet (.zip)" bien visible
- Fichiers binaires (images, pdf) : message "Fichier binaire — telecharge le zip" au lieu d'un viewer
- Responsive : sur mobile, le panneau passe en dessous du contenu

### US-4 : Etudiant qui telecharge et utilise le projet

**En tant qu'** etudiant qui a clique sur "Telecharger",
**je veux** recevoir un .zip avec la structure du projet preservee,
**pour** l'extraire et l'ouvrir dans mon IDE sans reorganiser les fichiers.

**Criteres d'acceptation :**
- Le zip contient tous les fichiers du snapshot avec leurs chemins relatifs intacts
- Le nom du zip est `{slug-du-cours}-exemple.zip`
- Le download fonctionne meme si le repo GitHub original a ete supprime entre temps
- Les fichiers binaires sont inclus correctement (base64 decode)

## Functional Requirements

### FR-1 : Schema de donnees

Ajouter a la table `lumen_courses` :
- `repo_url TEXT` — URL git publique fournie par le prof
- `repo_snapshot TEXT` — JSON du snapshot (arborescence + contenu en base64)
- `repo_commit_sha TEXT` — SHA du commit snapshote
- `repo_default_branch TEXT` — branche par defaut du repo
- `repo_snapshot_at TEXT` — ISO datetime du fetch

### FR-2 : Service snapshot backend

Creer `server/services/lumenSnapshot.js` qui :
- Parse l'URL git (extract owner/repo)
- Fetch l'arborescence via GitHub API (`GET /repos/:owner/:repo/git/trees/:sha?recursive=1`)
- Fetch le contenu de chaque fichier (`GET /repos/:owner/:repo/contents/:path`)
- Valide les limites dures : 200 fichiers, 5 Mo total, 512 Ko par fichier
- Serialise en JSON avec chemins relatifs, contenu base64, metadata
- Gere les cas d'erreur (404, rate limit, timeout 30s)

### FR-3 : Routes API

- `POST /api/lumen/:id/snapshot` — declenche le snapshot (utilise a la publication)
- `POST /api/lumen/:id/snapshot/refresh` — resync manuel (bouton prof)
- `GET /api/lumen/:id/snapshot/download` — streaming d'un zip construit a la volee depuis le snapshot stocke
- `GET /api/lumen/:id/snapshot/file?path=...` — retourne le contenu d'un fichier individuel pour le viewer

### FR-4 : Integration dans le flow de publication

Etendre `POST /api/lumen/:id/publish` :
- Si `repo_url` est defini et le snapshot n'existe pas, declencher le snapshot
- Si le snapshot echoue, renvoyer une erreur sans publier le cours
- Si l'URL a change depuis le dernier snapshot, refresh automatiquement

### FR-5 : UI enseignant

Dans [LumenView.vue](src/renderer/src/views/LumenView.vue) meta row de l'editeur :
- Input `url` pour `repo_url` avec placeholder `https://github.com/owner/repo`
- Affichage conditionnel apres snapshot : badge "Snapshot : X fichiers · Y Ko · il y a Z jours"
- Bouton "Resynchroniser" (icone RefreshCw) a cote de l'input, uniquement si un snapshot existe

### FR-6 : UI etudiant

Creer deux composants :
- `LumenProjectTree.vue` — arborescence expandable avec icones par type de fichier
- `LumenProjectFileViewer.vue` — affichage single-file avec hljs (reutilise la config existante de markdown.ts)

Integrer dans [LumenReader.vue](src/renderer/src/components/lumen/LumenReader.vue) :
- Section "Projet d'exemple" sous l'article (ou en tiroir a droite sur desktop >1280px)
- Condition d'affichage : `course.repo_snapshot != null`

### FR-7 : Download zip

Cote backend : construction du zip a la volee depuis le JSON stocke (utiliser `archiver` ou `jszip`). Streaming pour eviter de materialiser en memoire.
Cote frontend : simple `window.open()` ou `<a href>` vers l'endpoint.

## Non-Functional Requirements

### Performance

- Snapshot fetch : < 30s pour un repo de taille moyenne (< 50 fichiers)
- Download zip : streaming sans materialisation complete en memoire
- Rendering de l'arborescence : < 100ms pour 200 fichiers
- Syntax highlighting a la volee : lazy (au clic sur le fichier, pas en eager)

### Securite

- Validation stricte de l'URL pour eviter SSRF (whitelist : github.com en v1)
- Sanitization du contenu des fichiers avant rendu (deja fait par hljs qui escape)
- Pas de stockage de credentials GitHub (repos publics uniquement)
- Limites dures pour eviter l'abus : 200 fichiers, 5 Mo total, 512 Ko par fichier

### Fiabilite

- Snapshot immuable : les etudiants voient la meme version meme si le repo change/disparait
- Idempotence : republier sans changer l'URL ne re-fetch pas
- Gestion explicite des rate limits GitHub (60 req/h non authentifie) avec messages clairs

### Accessibilite

- Arborescence navigable au clavier (fleches haut/bas, Enter pour expand/select)
- Viewer de fichier avec `aria-label` explicite
- Bouton download avec texte clair, pas uniquement une icone

## Success Criteria

### Mesurables

- [ ] **100 %** des cours Lumen publies durant le pilote CESI qui ont un repo git attache reussissent leur snapshot
- [ ] **< 3 secondes** de temps de chargement perceptible du panneau projet cote etudiant (depuis snapshot stocke local)
- [ ] **Zero regression** sur les 2651 tests existants
- [ ] **Au moins 1 cours** du pilote utilise la feature pour le premier mois

### Qualitatifs

- Un enseignant CESI colle une URL GitHub et voit son projet dans le reader en moins de 2 minutes sans documentation
- Un etudiant telecharge le zip, l'extrait, et lance le code sans reorganiser manuellement la structure
- La feature ne complique pas l'ecriture d'un cours sans projet (le champ est optionnel et discret)

## Constraints & Assumptions

### Techniques

- Utiliser `better-sqlite3` existant (colonne JSON dans `lumen_courses`)
- Reutiliser `highlight.js` deja configure dans [markdown.ts](src/renderer/src/utils/markdown.ts)
- Reutiliser le pattern meta row de l'editeur deja en place (cf. Promo + Projet associe ajoutes en v2.22.0)
- Pas de nouvelle dependance lourde cote frontend (pas de `@octokit/rest`, simple `fetch` suffit pour la GitHub API)
- Cote backend : utiliser `archiver` (deja present dans deps Node) ou l'ajouter si absent

### Temporelles

- Livrable avant le pilote CESI de septembre 2026
- Priorite P1 (bloquant pour les cours pratiques du pilote)

### Ressources

- Developpement solo par Rohan (10-20h/semaine)
- Pas de beta-testeurs externes avant le pilote

### Hypotheses

- Les enseignants CESI ont deja l'habitude de git pour leur code pedagogique
- Les repos exemples restent petits (< 200 fichiers, < 5 Mo) — TP typique = 5-20 fichiers
- Pas de besoin de versioning etudiant (pas de fork, pas de PR) pour le pilote
- GitHub API publique (60 req/h) est suffisante pour le volume initial (< 10 publications/jour)

## Out of Scope

Explicitement **exclus de la v1** (reevaluation possible apres pilote) :

- **Repos prives** (necessite OAuth GitHub par utilisateur)
- **Plusieurs projets par cours** (1 seul pour le pilote)
- **Edition en ligne** (mini-IDE integre au reader)
- **Execution / sandbox** (Pyodide, iframe JS, etc.)
- **Diff inter-versions** (comparer snapshot A vs snapshot B)
- **Student forks** (permettre a un etudiant de "remix" le projet)
- **Comments inline sur le code** (annotations etudiants sur les fichiers)
- **Auto-refresh** (le snapshot reste fige, pas de poll automatique)
- **Support GitLab / Bitbucket / self-hosted** (GitHub uniquement en v1)
- **Preview en image** pour les fichiers binaires (pdf, png affiches inline) — juste "binaire, telecharge le zip"

## Dependencies

### Internes (code existant)

- [markdown.ts](src/renderer/src/utils/markdown.ts) — hljs pour coloration
- [LumenView.vue](src/renderer/src/views/LumenView.vue) — pattern meta row v2.22.0
- [LumenReader.vue](src/renderer/src/components/lumen/LumenReader.vue) — grille reader-grid v2.23.0
- [lumen.ts store](src/renderer/src/stores/lumen.ts) — actions create/update/publish a etendre
- `server/routes/lumen.js` — routes REST Lumen existantes
- `server/db/schema.js` — migration DB

### Externes

- **GitHub API v3** (REST) — pas de cle API requise pour les repos publics
- **archiver** (npm) — pour generer le zip streaming (a ajouter si absent)

### Pas de dependance sur

- OAuth GitHub (repos publics uniquement)
- Octokit (fetch natif suffit)
- CDN externe
- Services tiers
