---
subject: Strategie de stabilite et tests pour le pilote
type: brownfield
rounds: 8
ambiguity: 19%
created: 2026-03-28
---

# Specification : Stabilite et tests pour le pilote

## Scores de clarte

| Dimension | Score | Poids | Contribution |
|-----------|-------|-------|-------------|
| Objectif | 0.9 | 35% | 0.315 |
| Contraintes | 0.7 | 25% | 0.175 |
| Criteres de succes | 0.85 | 25% | 0.213 |
| Contexte brownfield | 0.7 | 15% | 0.105 |

## Objectif

Passer de "je n'ai pas confiance" a "je deploie devant 30 etudiants" en construisant une **preuve automatisee** que l'app est sure et fonctionnelle. Les trois peurs a eliminer : fuite de donnees (securite), messagerie cassee (fonctionnel), bugs silencieux (fiabilite).

## Les 3 peurs concretes

1. **Fuite de donnees** (securite) : un etudiant voit ce qu'il ne devrait pas — donnees d'un autre, panel admin, DMs. Plus grave qu'un crash car invisible et irreversible cote confiance.
2. **Messagerie cassee** (fonctionnel) : le coeur de l'app ne fonctionne pas — messages qui n'arrivent pas, canaux inaccessibles.
3. **Bugs silencieux** (fiabilite) : des choses se perdent sans que personne ne le voie — notification manquante, devoir invisible, note non-affichee.

## Le probleme est double

Le code a des trous connus (TA permissif par defaut, routes potentiellement non-protegees) ET il n'y a pas de tests pour les detecter. Il faut a la fois **corriger les trous** (epic roles-permissions) et **ecrire les tests de preuve**.

## Criteres de confiance pour deployer

### 1. Tests d'isolation (securite)

Prouver automatiquement que :
- Un etudiant A ne peut PAS voir les canaux, devoirs, DMs de l'etudiant B (promo differente)
- Un etudiant ne peut PAS acceder au panel admin
- Un etudiant ne peut PAS modifier les messages d'un autre
- Un TA sans assignation a zero acces (apres refonte roles)

### 2. E2E sur les 4 coeurs (fonctionnel)

3 tests E2E critiques :
- **Parcours etudiant complet** : login → dashboard → canal → envoyer message → voir devoir → soumettre fichier → consulter document → recevoir notification de note
- **Cycle enseignant-etudiant** : enseignant cree devoir → etudiant le voit et soumet → enseignant note → etudiant voit sa note
- **Isolation cross-promo** : 2 etudiants de promos differentes, verifier qu'aucun ne voit les donnees de l'autre

### 3. Couverture 80% global (backend + frontend)

- Backend : routes, modeles DB, middlewares
- Frontend : stores, composables, utils
- Composants Vue : inclus dans le 80%
- Strategie : **Claude ecrit les tests**, le developpeur review et corrige

## Contraintes

- **TDD en parallele des features** : pas de semaines dediees "tests only". Chaque feature livree avec ses tests.
- **Claude comme multiplicateur** : utiliser Claude Code pour generer les tests a vitesse 5-10x. Review humaine sur le resultat.
- **Budget temps** : 10-20h/semaine, tests inclus dans chaque tache (pas en plus)
- **Pas de service externe payant** : pas de Sentry, pas de Datadog

## Monitoring en production

**Endpoint interne `/api/report-error`** au lieu d'un service externe :
- Le frontend catch les erreurs (error boundary Vue, uncaughtException) et les POST au serveur
- Les erreurs sont stockees en DB (table `error_reports`)
- Visibles dans le panel admin avec : timestamp, user, page, stack trace, user agent
- Zero cout, zero dependance externe, donnees chez soi
- Permet de voir les bugs AVANT que l'etudiant ne le signale

## Non-objectifs

- Sentry/Bugsnag/Datadog (service externe payant)
- Tests de performance/charge (30 utilisateurs, pas 30 000)
- Tests visuels / screenshot comparison
- 100% de couverture (80% est le seuil)
- Tests des features secondaires (quiz, kanban, frise, REX, signature PDF)

## Etat actuel vs cible

| Metrique | Actuel | Cible |
|----------|--------|-------|
| Fichiers de test | 37 | ~100+ |
| Couverture backend | ~50% routes | 80% |
| Couverture frontend | ~8% composables | 80% |
| E2E | 3 cas (auth only) | 3 suites (etudiant, cycle, isolation) |
| Tests isolation | 1 fichier | Suite exhaustive (toutes les routes) |
| Monitoring prod | Zero | Endpoint interne + panel admin |
| Bugs silencieux detection | Zero | Error reporting automatique |

## Plan d'execution

### Phase 1 : Fondation tests (en parallele de l'epic roles-permissions)
1. **Ecrire la suite d'isolation** : tester CHAQUE route avec un etudiant d'une autre promo → 403
2. **Endpoint error reporting** : `/api/report-error` + table DB + panel admin
3. **Configurer le rapport de couverture** dans la CI (badge + seuil minimum)

### Phase 2 : E2E critiques
4. **E2E parcours etudiant** : Playwright, scenario complet login → note
5. **E2E cycle enseignant-etudiant** : interaction croisee
6. **E2E isolation cross-promo** : 2 sessions paralleles, verification negative

### Phase 3 : Couverture 80% (Claude-assisted)
7. **Backend routes non-testees** : 10 routes manquantes → generer les tests
8. **Frontend stores** : 8 stores non-testes → generer les tests
9. **Frontend composables** : 47 composables non-testes → generer les tests critiques
10. **Composants Vue critiques** : formulaires, modals, sidebar → tests

### Phase 4 : Pre-deploiement
11. **Dogfooding 1 semaine** : utiliser Cursus pour ses cours (meme seul)
12. **Revue des erreurs collectees** : corriger les bugs remontes par l'endpoint
13. **Go/no-go decision** : couverture >= 80%, 3 E2E verts, zero erreur critique dans le monitoring

## Contexte technique

### Fichiers de test existants (37)
- `tests/backend/db/` : 10 fichiers (assignments, live, messages, promotions, rex, signatures, students)
- `tests/backend/routes/` : 9 fichiers (auth, authorization, depots, health, live, messages-security)
- `tests/frontend/composables/` : 4 fichiers (bentoPrefs, clockTimer, debounce, offlineCache)
- `tests/frontend/stores/` : 1 fichier (messages)
- `tests/frontend/utils/` : 9 fichiers (categoryIcon, date, devoir, filters, format, grade, html, projectGrouping)
- `tests/e2e/` : 1 fichier (auth.spec.ts)

### Infrastructure de test
- Framework : Vitest 3.2 + Playwright 1.58
- Couverture : v8 reporter
- CI : GitHub Actions (test.yml) — tourne sur push main/dev et PR
- Setup : `tests/backend/helpers/setup.js` — DB in-memory pour les tests backend

### Fichiers critiques a tester en priorite
- `server/middleware/authorize.js` — guards de securite (1 seul test existe)
- `server/routes/` — 10 routes non testees
- `src/renderer/src/stores/` — 8 stores non testes
- `src/renderer/src/composables/useApi.ts` — wrapper API central, zero test
- `src/renderer/src/composables/useSocket.ts` — wrapper Socket.IO, zero test

## Hypotheses exposees et resolues

| Hypothese | Challenge | Resolution |
|-----------|-----------|-----------|
| "La peur c'est le crash" | Le crash est visible et reparable | La vraie peur c'est la fuite de donnees (invisible, irreversible) |
| "Le dogfooding suffit" | Tu ne peux pas tester l'isolation seul | Tests automatises d'isolation + E2E. La confiance vient de la preuve |
| "80% c'est trop ambitieux pour un dev solo" | En 5 mois a 15h/semaine c'est ~300h | Claude ecrit les tests, le dev review. Multiplicateur 5-10x |
| "Il faut des semaines dediees aux tests" | Ca bloque les features | TDD en parallele : chaque feature livree avec ses tests |
| "Sentry est necessaire pour la prod" | Service externe, cout, donnees chez un tiers | Endpoint interne maison + panel admin. Zero cout, zero dependance |
| "Tester le frontend c'est inutile" | Les bugs silencieux sont cote frontend | 80% global inclut le frontend (stores, composables, composants) |

## Transcription

<details><summary>Voir les Q&R (8 rounds)</summary>

**Round 1 — Objectif** : Les 3 peurs concretes : fuite de donnees (securite), messagerie cassee, bugs silencieux. La peur #1 est la securite, pas le crash.

**Round 2 — Criteres de succes** : Seuil de confiance = tests d'isolation + E2E 4 coeurs + 80% couverture. La confiance vient des tests automatises, pas du dogfooding.

**Round 3 — Contraintes** : Tests en parallele des features (TDD), pas de semaines dediees. Chaque feature livree avec ses tests.

**Round 4 — Contradicteur** : Le probleme est double : des trous dans le code ET pas de tests pour les detecter. Il faut corriger ET prouver.

**Round 5 — Criteres** : 80% de couverture global (backend + frontend). Ambitieux mais coherent avec la volonte de preuve automatisee.

**Round 6 — Simplificateur** : Claude ecrit les tests, le dev review. Multiplicateur 5-10x qui rend le 80% global faisable.

**Round 7 — Contexte** : Endpoint interne `/api/report-error` au lieu de Sentry. Erreurs collectees en DB, visibles dans l'admin. Zero cout.

**Round 8 — E2E critiques** : 3 tests = parcours etudiant complet + cycle enseignant-etudiant + isolation cross-promo. Si ces 3 passent, on deploie.

</details>
