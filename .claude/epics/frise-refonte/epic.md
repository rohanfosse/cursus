---
name: frise-refonte
status: backlog
created: 2026-03-29T18:23:47Z
progress: 0%
prd: .claude/prds/frise-refonte.md
github: https://github.com/rohanfosse/cursus/issues/67
---

# Epic: frise-refonte

## Overview

Refonte de l'affichage de la frise chronologique pour resoudre les problemes de chevauchement et de lisibilite temporelle. Unifie l'experience responsable (TabFrise) et etudiant (StudentTimelineModal) autour d'un calendrier lineaire horizontal partage.

## Architecture Decisions

1. **Composable partage** : `useFrise.ts` reste le point central. La logique de groupement par jour est modifiee pour produire des dots agreges au lieu d'empiler verticalement.

2. **Composant de frise reutilisable** : extraire le rendu de la frise (axe temporel + dots + popup) dans un composant generique `FriseCalendar.vue` utilise par TabFrise ET StudentTimelineModal. Evite la duplication.

3. **Popup/dropdown unifie** : un composant `FriseDotPopup.vue` affiche le detail des milestones groupes. Le contenu varie selon le contexte (responsable : lien gestion devoir / etudiant : notes, feedback, countdown).

4. **Backend inchange** : `getGanttData()` retourne deja toutes les donnees necessaires.

## Technical Approach

### Frontend Components

| Composant | Action | Complexite |
|-----------|--------|-----------|
| `useFrise.ts` | Modifier la logique de groupement : produire `DayGroup[]` avec compteur au lieu d'empiler | Moyenne |
| `FriseCalendar.vue` (nouveau) | Composant generique : axe temporel + dots agreges + interactions | Haute |
| `FriseDotPopup.vue` (nouveau) | Popup au clic sur dot agrege : liste milestones avec actions contextuelles | Faible |
| `TabFrise.vue` | Simplifier : deleguer le rendu a FriseCalendar, garder la toolbar | Faible |
| `StudentTimelineModal.vue` | Refondre : remplacer la liste verticale par FriseCalendar + filtres + legende | Moyenne |

### Backend Services

Aucun changement backend. `getGanttData(promoId)` et le type `GanttRow` restent tels quels.

### Infrastructure

Aucun changement infrastructure.

## Implementation Strategy

Approche incrementale en 4 taches, avec parallelisation possible sur les taches 2 et 3 :

```
Tache 1 : useFrise — logique dots agreges
    ↓
Tache 2 : FriseCalendar + FriseDotPopup    ←→    Tache 3 : Tests unitaires
    ↓                                                  ↓
Tache 4 : Integration TabFrise + StudentTimelineModal
```

## Task Breakdown Preview

### Tache 1 : Logique de groupement par dots agreges (useFrise.ts)
- Modifier `teacherFrise` et `studentFrise` computed pour grouper les milestones par date
- Produire un `DayGroup { date, milestones[], left% }` au lieu d'un milestone individuel
- Un DayGroup avec 1 milestone = dot normal, 2+ = dot agrege avec compteur
- Conserver toute la logique de zoom, drag, scroll existante

### Tache 2 : Composant FriseCalendar.vue + FriseDotPopup.vue
- Extraire le rendu de la frise depuis TabFrise.vue dans un composant generique
- Axe temporel ameliore : separateurs de mois (lignes verticales + fond alterne), labels de mois persistants
- Marqueur "aujourd'hui" : ligne rouge avec label
- Dots agreges : taille proportionnelle, badge compteur
- FriseDotPopup : dropdown positionne sous le dot, liste des milestones avec titre/type/projet
- Slot ou prop pour le contenu contextuel (responsable vs etudiant)

### Tache 3 : Tests unitaires
- Tests useFrise : groupement correct (1 milestone = dot normal, N = agrege)
- Tests useFrise : positions left% correctes avec separateurs de mois
- Tests FriseDotPopup : rendu, clic item, fermeture
- Couverture cible : 80%+

### Tache 4 : Integration dans TabFrise + StudentTimelineModal
- TabFrise : remplacer le rendu inline par FriseCalendar, garder la toolbar existante
- StudentTimelineModal : remplacer la liste verticale par FriseCalendar
- Ajouter les filtres etudiants (A rendre / Rendus / Evenements) au-dessus de FriseCalendar
- Ajouter la legende interactive sous la toolbar
- Popup etudiant : afficher notes, feedback, countdown dans FriseDotPopup

## Dependencies

- Tache 2 depend de Tache 1 (types DayGroup)
- Tache 3 peut demarrer en parallele de Tache 2 (tests sur la logique de Tache 1)
- Tache 4 depend de Tache 1 + 2

## Success Criteria (Technical)

- [ ] `useFrise.ts` produit des DayGroup[] avec compteur correct
- [ ] FriseCalendar.vue affiche les separateurs de mois et le marqueur "aujourd'hui"
- [ ] Les dots agreges affichent le compteur et le popup au clic
- [ ] TabFrise.vue utilise FriseCalendar sans regression visuelle
- [ ] StudentTimelineModal.vue affiche une frise horizontale avec filtres et legende
- [ ] Tests unitaires couvrent le groupement, le rendu popup, et les interactions
- [ ] Zero chevauchement visuel avec les donnees du seed (blocs CCTL 8+ deadlines meme jour)
- [ ] Couverture tests >= 80% sur les fichiers modifies

## Estimated Effort

| Tache | Estimation | Parallelisable |
|-------|-----------|----------------|
| 1. Logique groupement | 1-2h | Non (prerequis) |
| 2. FriseCalendar + Popup | 3-4h | Oui (avec T3) |
| 3. Tests unitaires | 1-2h | Oui (avec T2) |
| 4. Integration | 2-3h | Non (depend T1+T2) |
| **Total** | **7-11h** | |
