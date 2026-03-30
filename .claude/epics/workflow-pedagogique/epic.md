---
name: workflow-pedagogique
status: in-progress
created: 2026-03-30T21:02:15Z
updated: 2026-03-30T21:09:31Z
progress: 0%
prd: .claude/prds/workflow-pedagogique.md
github: https://github.com/rohanfosse/cursus/issues/90
---

# Epic: workflow-pedagogique

## Overview

Trois chantiers pour adapter Cursus au workflow reel d'un responsable de promotion CESI qui gere 2 promos, note en lettres A-D avec grille nationale, et veut programmer ses publications. Issu du deep interview workflow pedagogique (17% ambiguite).

## Architecture Decisions

### AD-1 : Publication programmee via le scheduler existant

Le `server/services/scheduler.js` tourne deja toutes les 30s pour les messages programmes (`scheduled_messages`). On **etend ce scheduler** pour verifier aussi les devoirs a publier, plutot que creer un second mecanisme.

- Ajout d'une colonne `scheduled_publish_at TEXT` a la table `travaux`
- Le scheduler verifie : `scheduled_publish_at <= now() AND published = 0`
- A publication : met `published = 1`, notifie via socket `devoir:published`
- Optionnel : envoie un message d'annonce dans le canal lie

### AD-2 : Notation en lot via panneau lateral (pas une modale separee)

La DepotsModal (434 lignes) a deja un systeme de notation inline avec feedback bank, grades A-D, et statistiques. Plutot que recreer un composant from scratch, on ajoute un **mode "lot"** a la DepotsModal existante :

- Toggle "Mode notation rapide" qui switch la vue en mode split : liste a gauche, depot + notation a droite
- Navigation clavier : fleches pour changer d'etudiant, A/B/C/D direct, Tab pour commentaire
- Auto-save au changement d'etudiant (debounce 300ms)
- Reutilise `useTeacherGrading.ts`, le feedback bank existant, et les actions du store

### AD-3 : Vue multi-promo comme widget dashboard (pas une page separee)

Le dashboard teacher a deja un systeme de widgets (cards). On ajoute un **widget `MultiPromoCard.vue`** qui affiche les metriques des 2 promos cote a cote. Pas de nouvelle page -- ca s'integre dans le dashboard existant.

- Charge `getGanttData(promoId)` pour chaque promo du prof
- Affiche : devoirs a venir, rendus en attente, notes a donner
- Clic navigue vers le devoir (switch promo automatique via `appStore.openChannel`)

## Technical Approach

### Frontend Components

| Composant | Action | Lignes estimees |
|-----------|--------|-----------------|
| `NewDevoirModal.vue` | Ajouter champ DateTimePicker pour `scheduled_publish_at` | +30 |
| `GestionDevoirModal.vue` | Afficher indicateur "Publication programmee le..." | +15 |
| `DevoirMetaSection.vue` | Badge "Programme" avec date | +20 |
| `DepotsModal.vue` | Mode notation rapide (split view + keyboard nav) | +150 |
| `MultiPromoCard.vue` | Nouveau widget dashboard | ~200 |
| `useDevoirsTeacher.ts` | Ajouter computed multi-promo | +40 |

### Backend Services

| Fichier | Action | Lignes estimees |
|---------|--------|-----------------|
| `server/db/schema.js` | Migration : colonne `scheduled_publish_at` | +5 |
| `server/db/models/assignments.js` | CRUD : lire/ecrire `scheduled_publish_at` | +15 |
| `server/services/scheduler.js` | Etendre : checker les devoirs a publier | +25 |
| `server/routes/travaux.js` | Endpoint : update scheduled_publish_at | +10 |
| `src/preload/index.ts` + IPC | Exposer `updateTravailScheduled` | +10 |

### Infrastructure

Rien de nouveau. Le scheduler setInterval(30s) existant est suffisant.

## Implementation Strategy

**Phase 1 — Publication programmee** (le plus simple, fondation pour la suite)
1. Migration DB + model
2. Etendre le scheduler
3. UI dans NewDevoirModal + GestionDevoirModal
4. Tests

**Phase 2 — Notation rapide en lot** (le plus impactant sur l'UX quotidienne)
5. Mode split dans DepotsModal
6. Navigation clavier + auto-save
7. Tests

**Phase 3 — Vue multi-promo** (le moins critique pour le pilote)
8. Widget MultiPromoCard + composable
9. Integration dashboard
10. Tests

## Task Breakdown Preview

| # | Tache | Phase | Parallele ? | Effort |
|---|-------|-------|-------------|--------|
| 1 | Migration DB + model scheduled_publish_at | 1 | oui | S |
| 2 | Etendre scheduler pour publier les devoirs | 1 | non (depend 1) | S |
| 3 | UI publication programmee (NewDevoirModal + GestionDevoirModal) | 1 | non (depend 1) | M |
| 4 | Tests publication programmee (unit + integration) | 1 | non (depend 2,3) | S |
| 5 | DepotsModal mode notation rapide (split view) | 2 | oui | L |
| 6 | Navigation clavier + auto-save notation | 2 | non (depend 5) | M |
| 7 | Tests notation rapide | 2 | non (depend 6) | S |
| 8 | MultiPromoCard widget + composable useMultiPromo | 3 | oui | M |
| 9 | Integration dashboard + navigation cross-promo | 3 | non (depend 8) | S |
| 10 | Tests multi-promo | 3 | non (depend 9) | S |

Effort : S = 1-2h, M = 2-4h, L = 4-6h. Total estime : ~20-28h (2 semaines a 10-20h/sem)

## Dependencies

- `DateTimePicker.vue` (existant, v2.3.0)
- `useTeacherGrading.ts` (existant)
- `server/services/scheduler.js` (existant, a etendre)
- `DepotsModal.vue` (existant, ~434 lignes)
- Dashboard teacher widgets (existant)
- GestionDevoirModal refonde (v2.4.0, cette session)

## Success Criteria (Technical)

1. `scheduled_publish_at` fonctionne end-to-end : creer devoir programme -> scheduler publie -> etudiants notifies
2. Notation 25 etudiants en < 10 min clavier seul (A/B/C/D + Tab + commentaire + Enter)
3. Widget multi-promo affiche les metriques de 2 promos sans switch
4. Zero regression sur les 1758+ tests existants
5. Couverture >= 60% maintenue
6. Build TypeScript clean (zero errors vue-tsc)

## Estimated Effort

- **Phase 1 (Publication programmee)** : 5-8h
- **Phase 2 (Notation rapide)** : 8-12h
- **Phase 3 (Multi-promo)** : 5-8h
- **Total** : ~20-28h sur 2-3 semaines

## Tasks Created
- [ ] 001.md - Migration DB + model scheduled_publish_at (parallel: true)
- [ ] 002.md - Etendre scheduler pour publier les devoirs (parallel: false, depends: 1)
- [ ] 003.md - UI publication programmee NewDevoirModal + GestionDevoirModal (parallel: false, depends: 1)
- [ ] 004.md - Tests publication programmee (parallel: false, depends: 2, 3)
- [ ] 005.md - DepotsModal mode notation rapide split view (parallel: true)
- [ ] 006.md - Navigation clavier + auto-save notation (parallel: false, depends: 5)
- [ ] 007.md - Tests notation rapide (parallel: false, depends: 6)
- [ ] 008.md - MultiPromoCard widget + composable useMultiPromo (parallel: true)
- [ ] 009.md - Integration dashboard + navigation cross-promo (parallel: false, depends: 8)
- [ ] 010.md - Tests multi-promo (parallel: false, depends: 9)

Total tasks: 10
Parallel tasks: 3 (001, 005, 008 peuvent demarrer simultanement)
Sequential tasks: 7
Estimated total effort: 20-28 hours
