---
subject: "Lumen — bouton Nouveau cours (scaffold GitHub)"
type: brownfield
rounds: 5
ambiguity_final: 16.55
created: 2026-04-11
---

# Spécification : Lumen — bouton "Nouveau cours" (scaffold GitHub)

## Scores de clarté finaux

| Dimension          | Score | Poids | Contribution |
|--------------------|------:|------:|-------------:|
| Objectif           |  0.97 |  35%  |        0.340 |
| Contraintes        |  0.80 |  25%  |        0.200 |
| Critères de succès |  0.70 |  25%  |        0.175 |
| Contexte           |  0.80 |  15%  |        0.120 |
| **Total clarté**   |       |       |    **0.835** |
| **Ambiguité**      |       |       |    **16.6%** |

## Objectif

Dans la vue Lumen (teacher/admin), un bouton **"Nouveau cours"** crée un repo
GitHub dans l'organisation de la promo courante et y pousse un squelette de
fichiers structurés reflétant le pattern utilisé par Rohan dans
`CESI-CPIA2-2526/4-Programmation-Web`, pour que le prochain bloc puisse être
démarré en un clic sans passer par clone/template/terminal.

Version courte : **"Je clique, j'ai un repo prêt à remplir en 5 secondes."**

## Contraintes

- **Pas de wizard multi-étapes** — un simple prompt (nom du repo, titre du bloc).
- **Pas de configuration pédagogique CESI** — pas de choix "PBL vs magistral",
  pas de sélection du référentiel. C'est du dogfood pour Rohan d'abord.
- **Ne génère PAS de `cursus.yaml`** — l'auto-manifest gère déjà, inutile de
  forcer le prof à éditer un YAML.
- **Un seul template figé en dur** dans le code (pas de système de templates
  pluggables, pas de téléchargement depuis un repo tiers).
- **Teacher/admin + responsable promo uniquement** (`requirePromoAdmin`).
- **Échoue si l'org GitHub n'est pas configurée** pour la promo.
- **Échoue si le repo existe déjà** (pas d'overwrite silencieux).
- **Pas d'UI de personnalisation du contenu** — si le prof veut autre chose,
  il édite le scaffold juste après.

## Non-objectifs (explicitement hors scope)

- Éditeur in-app pour écrire le markdown (reste du terrain IDE/GitHub).
- Preview live pendant l'écriture.
- Versioning / historique des cours année sur année.
- Collaboration multi-profs, pull requests, reviews.
- Linter pédagogique.
- Migration d'un cours existant vers le template.
- Tutorial / README d'onboarding pour d'autres profs CESI.
- Intégration GitHub Classroom.
- Scaffold "clonage intelligent" depuis un autre repo existant.

## Critères d'acceptation

- [ ] Un bouton **"Nouveau cours"** apparaît dans la topbar Lumen, visible pour
      teacher/admin uniquement, à côté du bouton Synchroniser.
- [ ] Click ouvre un prompt minimal : **slug du repo** (ex: `5-Base-de-Donnees`)
      + **titre du bloc** (ex: `Bloc 5 — Bases de données`).
- [ ] Validation : le slug doit matcher `^[a-zA-Z0-9][a-zA-Z0-9._-]*$`, le titre
      est non vide (max 200 chars).
- [ ] Le backend appelle l'API GitHub pour créer un repo privé dans l'org de la
      promo courante (endpoint `POST /orgs/{org}/repos`).
- [ ] Le backend pousse ensuite les fichiers du scaffold via l'API Contents
      (un seul commit initial nommé `chore: scaffold Cursus`).
- [ ] Le scaffold contient **exactement** :
  - `README.md` — titre + sections `## Introduction`, `## Déroulement`,
    `## Phases du projet`, `## Livrables` pré-remplies avec TODO.
  - `projet.md` — titre + sections `## Présentation`, `## Besoins`,
    `## Cahier des charges` pré-remplies avec TODO.
  - `process-daily.md` — copie du pattern daily de `4-Programmation-Web`.
  - `prosits/1-exemple.md` — un prosit modèle **rempli** avec un vrai contenu
    commenté (type prosit 1 d'Apache mais vide côté consignes) servant de
    référence de format.
  - `workshops/.gitkeep`
  - `guides/methodologie/.gitkeep`
  - `guides/.gitkeep`
  - `mini-projet/.gitkeep`
- [ ] Après succès, la modale se ferme, un toast "Cours créé" apparaît, et
      un **sync automatique** de la promo est déclenché pour ramener le nouveau
      repo dans la sidebar Lumen immédiatement.
- [ ] Le nouveau repo est créé avec `is_visible = 0` (masqué aux étudiants tant
      que le prof ne l'a pas publié — cohérent avec la default de v58).
- [ ] Erreurs gérées et affichées en toast : org non configurée, repo déjà
      existant, token GitHub sans scope `repo`, rate limit, réseau.

## Hypothèses exposées et résolues

| Hypothèse initiale | Challenge | Résolution |
|---|---|---|
| Le prochain besoin Lumen c'est la preuve d'apprentissage (quiz inline) | L'utilisateur a écarté cette piste | Pivot vers workflow auteur |
| "Workflow auteur" = éditeur in-app complet | Trop de scope, masqué par l'anxiété de polir | Réduit à **création** d'un cours, pas édition |
| Le scaffold doit être pédagogiquement opinionné CESI pour le pilote sept 2026 | Le user veut dogfood en premier | MVP minimal pour **Rohan**, généralisable plus tard |
| Un cursus.yaml doit être dans le scaffold | L'auto-manifest vient d'être livré | **Non** — scaffold sans cursus.yaml |
| Wizard avec choix (prosit/workshop/magistral) | Complexité sans ROI avant d'avoir un 2e user | MVP = template figé, prompt minimal (slug + titre) |

## Contexte technique

**Fichiers impactés** :

Backend :
- `server/routes/lumen.js` — nouvelle route `POST /api/lumen/promos/:id/repos`
  (teacher/admin + requirePromoAdmin + org configurée).
- `server/services/lumenRepoSync.js` — nouvelle fonction `createRepoWithScaffold`
  qui appelle `octokit.rest.repos.createInOrg` puis pousse les fichiers via
  `octokit.rest.repos.createOrUpdateFileContents` (ou batch via git Trees API
  pour un commit propre — à décider).
- `server/services/lumenScaffold.js` (**nouveau**) — contient le template
  figé : un `Map<path, content>` avec le contenu de chaque fichier du scaffold.
- `server/db/models/lumen.js` — `upsertLumenRepo` déjà ok, pas de changement DB.

Frontend :
- `src/preload/index.ts` + `src/web/api-shim.ts` + `src/renderer/src/env.d.ts` —
  nouvelle méthode `createLumenRepoFromScaffold(promoId, slug, title)`.
- `src/renderer/src/stores/lumen.ts` — nouvelle action
  `createRepoFromScaffold` qui appelle l'API puis relance `fetchReposForPromo`.
- `src/renderer/src/views/LumenView.vue` — bouton "Nouveau cours" à côté de
  "Synchroniser" dans la topbar, visible si `isTeacher`. Modale minimale avec
  deux inputs + Créer/Annuler.

**Patterns réutilisables déjà en place** :
- `requireGithubClient(req)` pour obtenir l'octokit authentifié.
- `requirePromoAdmin(promoFromIdParam)` pour le check d'autorisation.
- `handleOctokit(err)` pour mapper les erreurs GitHub en AppError.
- `syncPromoRepos` à déclencher après création pour ramener le nouveau repo.

**Scopes GitHub nécessaires** : le PAT doit avoir `repo` (pour créer un repo
privé). À documenter dans `LumenGithubConnect.vue` si ce n'est pas déjà fait.

## Transcription

<details><summary>Voir les Q&R (5 rounds)</summary>

**Round 1** — Quelle douleur prioritaire ?
→ **Workflow auteur prof** (écarte : preuve d'apprentissage, offline, intégration Cursus)

**Round 2** — Quelle étape précise du workflow ?
→ **Créer un nouveau cours à partir de zéro** (écarte : boucle édition, maintenance année sur année)

**Round 3** — Où vit le scaffold ?
→ **Bouton "Nouveau cours" dans Lumen** (écarte : template repo, CLI, wizard multi-étapes)

**Round 4** — [Contradicteur] Pour qui ?
→ **Pour Rohan d'abord, généralisable ensuite** (dogfood, pas produit pédagogique CESI immédiat)

**Round 5** — Quel niveau de scaffold ?
→ **Squelette étoffé** — dossiers + README structuré + un prosit exemple de référence

</details>
