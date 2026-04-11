---
subject: Pivot de Lumen (sous-app Cursus) vers lecteur/éditeur Markdown adossé à GitHub
type: brownfield
rounds: 7
ambiguity: 18%
created: 2026-04-11
---

# Specification : Pivot Lumen → GitHub

## Scores de clarté finaux

| Dimension | Score | Poids | Contribution |
|---|---|---|---|
| Objectif | 0.9 | 35% | 0.315 |
| Contraintes | 0.9 | 25% | 0.225 |
| Critères de succès | 0.6 | 25% | 0.150 |
| Contexte (brownfield) | 0.85 | 15% | 0.128 |
| **Total clarté** | | | **0.818** |
| **Ambiguïté résiduelle** | | | **18.2%** |

## Objectif

**Lumen, c'est l'app où l'étudiant lit les cours de sa promo.** Une liseuse Markdown, intégrée à Cursus, qui agrège les cours de tous les repos GitHub de l'organisation de la promo. Le prof écrit ses cours où il veut (Lumen, VS Code, github.com) — tout vit dans GitHub, Lumen synchronise et affiche magnifiquement. Le cœur du produit est la **qualité de lecture côté étudiant** : beau et rapide.

## Contraintes

- **Source de vérité = GitHub.** Les `.md` vivent dans les repos, pas en SQLite. SQLite devient un cache de lecture + stockage des métadonnées locales (notes privées, tracking lecture, stats).
- **Modèle d'organisation** : 1 promo = 1 orga GitHub, 1 projet pédagogique = 1 repo dans l'orga.
- **Repos privés** avec auth OAuth GitHub par étudiant (flow device ou PAT). Chaque étudiant doit être membre de l'orga de sa promo.
- **Édition multi-endroits** : le prof édite depuis Lumen, VS Code (+ Copilot), ou github.com. Lumen doit détecter les changements externes et se resynchroniser.
- **Intégration Cursus obligatoire** : notifications de nouveau cours dans le canal du projet, liens devoirs ↔ cours, badges unread, widgets dashboard. L'expérience étudiante reste unifiée dans Cursus.
- **Cursus reste intact.** Le pivot ne touche QUE la sous-app Lumen. Pulse, Spark, devoirs, canaux, notation, etc. restent inchangés.
- **Table rase sur l'existant Lumen** : pas de migration des cours en SQLite (brouillons de dev), on repart de zéro.

## Non-objectifs (hors scope v1)

- **Workflow de PR côté étudiant** dans l'UI Lumen (ils peuvent toujours contribuer via github.com, mais pas exposé dans l'app).
- **Co-édition temps réel style Google Docs** entre profs (git gère les conflits, pas de CRDT).
- **Historique git visible dans l'UI étudiant** (git est invisible, l'étudiant voit juste "des cours").
- **Recherche full-text cross-repos** (v1 = recherche titre + cours ouvert seulement).
- **Formats non-Markdown** (pas de PDF, docx, notebooks — uniquement `.md` + images).
- **Migration des cours SQLite existants.**

## Critères d'acceptation

Scénario jour-J : 25 étudiants d'une promo ouvrent Lumen, le prof a publié 3 cours dans `cesi-2026-promoA/projet-01-python`.

- [ ] L'étudiant se connecte via OAuth GitHub (device flow) au premier lancement, une seule fois.
- [ ] Lumen détecte automatiquement les repos de l'orga de la promo de l'étudiant.
- [ ] La sidebar affiche la liste des cours agrégée depuis tous les repos de l'orga.
- [ ] Clic sur un cours → rendu Markdown affiché en **< 1 seconde** après premier chargement.
- [ ] Rendu inclut : titres + TOC, code coloré (highlight.js déjà en place), admonitions Obsidian `[!NOTE]` (déjà en place), images du repo.
- [ ] Le prof pousse un commit depuis VS Code → les 25 étudiants voient le nouveau cours dans la prochaine sync (ou en forçant refresh).
- [ ] Offline : un étudiant qui a déjà ouvert un cours peut le relire sans réseau (cache SQLite).
- [ ] Les notes privées étudiant continuent de fonctionner (déjà impl), attachées aux cours GitHub par clé stable (repo + path).
- [ ] Une notification "nouveau cours publié" arrive dans le canal du projet concerné (hook existant préservé).

## Contexte technique (code existant à réutiliser ou remplacer)

### À RÉUTILISER (ne pas toucher)
- **Rendu Markdown** : `src/renderer/src/utils/markdown.ts` (marked + highlight.js + DOMPurify + admonitions). Excellent, ready to go.
- **Éditeur CodeMirror** : `src/renderer/src/composables/useLumenEditor.ts`. Utilisable tel quel pour l'édition prof.
- **Notes privées étudiant** : table `lumen_course_notes` + API. Juste changer la clé primaire (au lieu de `course_id` interne, utiliser `repo_url + path`).
- **Tracking lecture** : table `lumen_course_reads` + API. Même remarque sur la clé.
- **Socket "cours publié"** : event `lumen:course-published` dans le canal du projet. À réémettre sur push git détecté.
- **Widgets dashboard** : `WidgetLumenCourses`, `WidgetLumenNotes`, `WidgetLumenProgress`. À réadapter pour pointer sur les cours GitHub.

### À SUPPRIMER (table rase partielle)
- Colonne `lumen_courses.content` (Markdown en DB) → remplacée par fetch depuis repo.
- Colonne `lumen_courses.status` (`draft|published`) → remplacée par branche (`main` = publié, autre branche = brouillon) OU préfixe dossier.
- Corbeille / soft delete `deleted_at` → git gère l'historique, plus besoin.
- `scheduled_publish_at` → hors scope, git ne planifie pas (ou alors via workflow GitHub Actions, plus tard).
- Service `server/services/lumenSnapshot.js` (fetch REST publique, rate-limité à 60/h) → remplacé par une couche authentifiée (octokit) et/ou `isomorphic-git`.

### À AJOUTER
- **Couche auth GitHub** : OAuth device flow (pas de serveur web nécessaire), stockage du token via `safeStorage` Electron.
- **Couche "repo provider"** : abstraction qui sait lister les repos d'une orga, fetch un fichier, détecter les changements (polling ou webhook).
- **Modèle orga↔promo** : mapping `promo_id → github_org_name` (nouvelle colonne sur `promos` ou table dédiée).
- **Convention de structure de repo** (à définir dans les propositions) : où vivent les `.md`, comment nommer les modules/chapitres, fichier de métadonnées optionnel (`cursus.yaml` ou frontmatter).
- **Cache local** : tables `lumen_cached_files` ou réutiliser `lumen_courses` repurposée comme cache.

### Fichiers critiques à toucher
- `src/renderer/src/views/LumenView.vue` (la vue principale — refactor du modèle de données)
- `src/renderer/src/stores/lumen.ts` (store Pinia — nouvelle logique de sync)
- `server/routes/lumen.js` (14 endpoints — la moitié devient obsolète, l'autre mute)
- `server/db/models/lumen.js` (45 fonctions SQL — grand nettoyage)
- `src/preload/index.ts` lignes 527-608 (API bridge à réduire et renommer)

## Hypothèses exposées et résolues

| Hypothèse initiale | Challenge | Résolution |
|---|---|---|
| "Lumen est l'app Cursus entière" | L'utilisateur a corrigé : Lumen est une sous-app | Cartographié via Explore : Lumen = module quasi-autonome "cours" |
| "Il faut tout supprimer chat/devoirs/quiz" | Pivot ne touche que Lumen, pas Cursus | Scope resserré : cohabitation avec le reste, juste Lumen mute |
| "SQLite peut rester source de vérité" | Édition multi-endroits (VS Code, github.com) exigée | GitHub = source unique, SQLite = cache |
| "Repos publics suffisent" | Contenu peut être confidentiel, CESI doit contrôler | Repos privés + auth GitHub par étudiant |
| "GitHub Pages suffirait, pourquoi une app ?" | Intégration Cursus (notifs, canal, devoirs, unicité UX) | Lumen justifié par intégration |
| "Critère succès = 'tout marche'" | Trop flou | Critère minimal = rendu beau et rapide < 1s côté étudiant |

## Transcription

<details><summary>Voir les 6 rounds Q&R</summary>

**Round 1 — Objectif (ontologique)** : Finir la phrase "Lumen, c'est l'app où tu..."
→ Réponse : **"...lis les cours de ta promo"** (liseuse étudiant-first)

**Round 2 (corrigé après Explore) — Contraintes (source de vérité)** : Qui commande, GitHub ou SQLite ?
→ Réponse : **"Je ne sais pas, aide-moi à trancher"** → round 3 de suivi

**Round 3 — Contraintes (workflow édition)** : Est-ce que le prof veut éditer ailleurs que dans Lumen ?
→ Réponse : **"Oui, absolument — je travaille aussi depuis VS Code/web"** → GitHub source de vérité

**Round 4 — Critères de succès** : Scénario jour-J, quel critère minimal non-négociable ?
→ Réponse : **"L'étudiant lit beau et vite"** → performance + beauté du rendu = cœur

**Round 5 — Contradicteur** : Pourquoi Lumen et pas juste GitHub Pages/Docusaurus ?
→ Réponse : **"Parce que ça doit vivre dans Cursus"** → intégration = raison d'être

**Round 6 — Contraintes (auth & visibilité)** : Repos publics ou privés ?
→ Réponse : **"Privés — chaque étudiant a un token GitHub"** → OAuth GitHub obligatoire

**Round 7 — Contraintes (migration)** : Que faire des cours SQLite existants ?
→ Réponse : **"Table rase — on repart de zéro"** → pivot clean, pas de script migration

</details>
