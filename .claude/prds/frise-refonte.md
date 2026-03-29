---
name: frise-refonte
description: Refonte de la frise chronologique en calendrier lineaire horizontal unifie (responsable + etudiant)
status: backlog
created: 2026-03-29T18:23:47Z
---

# PRD: frise-refonte

## Executive Summary

Refondre l'affichage de la frise chronologique de Cursus pour resoudre deux problemes majeurs : le chevauchement des milestones quand plusieurs deadlines tombent le meme jour, et le manque de reperes temporels qui rend la navigation confuse. L'objectif est d'unifier l'experience responsable et etudiant autour d'un calendrier lineaire horizontal lisible.

## Problem Statement

La frise actuelle souffre de deux defauts critiques :

1. **Chevauchement des dots** : quand 5+ devoirs tombent le meme jour (frequent pour les blocs CCTL), les dots s'empilent verticalement avec un offset fixe de 18px et debordent de la lane. L'utilisateur ne peut pas distinguer ni cliquer sur les milestones individuels.

2. **Axe temporel confus** : les labels adaptatifs (jours/semaines/mois selon le zoom) ne fournissent pas assez de reperes visuels. L'utilisateur ne peut pas localiser rapidement une date sans hover sur un dot. Il n'y a pas de separateurs de mois, pas de fond alterne, et le marqueur "aujourd'hui" est discret.

3. **Incoherence UX** : la vue responsable (TabFrise) est une frise horizontale, mais la vue etudiant (StudentTimelineModal) est une liste verticale groupee par mois. Les deux interfaces n'ont rien en commun visuellement.

## User Stories

### US1 : Responsable consulte la frise
**En tant que** responsable de promotion,
**je veux** voir les deadlines de mes promos sur un calendrier lineaire horizontal avec des reperes de mois clairs,
**afin de** identifier en un coup d'oeil la charge de travail par periode.

**Criteres d'acceptation :**
- Les mois sont separes visuellement (fond alterne ou lignes verticales)
- Le marqueur "aujourd'hui" est toujours visible et evident
- Je peux identifier la date d'un milestone en moins de 2 secondes sans hover

### US2 : Responsable gere les deadlines groupees
**En tant que** responsable,
**je veux** voir un dot agrege avec compteur quand plusieurs deadlines tombent le meme jour,
**afin de** ne jamais avoir de chevauchement visuel et pouvoir acceder au detail en cliquant.

**Criteres d'acceptation :**
- Un dot unique avec un chiffre (ex: "8") remplace les dots empiles
- Un clic ouvre un dropdown/popup listant chaque milestone individuellement
- Chaque milestone dans le dropdown est cliquable (ouvre la modale de gestion du devoir)
- Zero chevauchement meme avec 10+ deadlines le meme jour

### US3 : Etudiant consulte sa frise
**En tant qu'** etudiant,
**je veux** voir mes devoirs sur une frise horizontale identique a celle du responsable,
**afin d'** avoir une vue calendaire de mes echeances plutot qu'une liste.

**Criteres d'acceptation :**
- La StudentTimelineModal affiche une frise horizontale (pas une liste verticale)
- Les filtres (A rendre / Rendus / Evenements) sont disponibles au-dessus de la frise
- La legende interactive (Rendu, Urgent, En retard, Evenement, A rendre) est presente
- Le clic sur un dot ouvre un popup avec le detail : notes, feedback, countdown

## Functional Requirements

### FR1 : Axe temporel ameliore
- Separateurs de mois visibles (lignes verticales ou fond alterne clair/fonce)
- Labels de mois toujours visibles sur l'axe
- Marqueur "aujourd'hui" : ligne verticale rouge/accent avec label "Aujourd'hui"
- Les 4 niveaux de zoom existants (semaine, mois, trimestre, annee) sont conserves

### FR2 : Dots agreges
- Quand 2+ milestones partagent la meme date, un dot unique est affiche
- Le dot agrege montre le compteur (nombre de milestones)
- Le dot agrege est visuellement distinct (taille plus grande, style badge)
- Un clic ouvre un dropdown/popup avec la liste des milestones
- Le dropdown montre pour chaque milestone : titre, type (badge), projet (couleur), deadline
- Chaque item du dropdown est cliquable

### FR3 : Frise horizontale etudiant
- Remplacer la liste verticale de StudentTimelineModal par une frise horizontale
- Reutiliser le composable useFrise.ts et les composants visuels de TabFrise
- Integrer les filtres etudiants (A rendre / Rendus / Evenements) au-dessus de la frise
- Integrer la legende interactive sous la toolbar
- Le popup au clic montre le detail etudiant : statut, notes, feedback, countdown

### FR4 : Interactions conservees
- Drag horizontal pour naviguer dans le temps
- Molette pour scroller
- Boutons zoom (Semaine, Mois, Trimestre, Annee)
- Bouton "Aujourd'hui" pour recentrer
- Boutons fleches gauche/droite pour naviguer

## Non-Functional Requirements

- **Performance** : le rendu de la frise doit etre fluide avec 100+ milestones (pas de lag au scroll/drag)
- **Responsive** : la frise doit fonctionner sur les ecrans >= 768px de large
- **Accessibilite** : les dots agreges doivent avoir un aria-label avec le nombre de milestones
- **Pas de regression** : les tests existants sur useFrise doivent continuer a passer

## Success Criteria

- Identifier la date d'un milestone en moins de 2 secondes sans hover
- Zero chevauchement visuel meme avec 10+ deadlines le meme jour
- Experience unifiee responsable/etudiant (meme composant de frise, filtres supplementaires pour l'etudiant)

## Constraints & Assumptions

- **Backend inchange** : getGanttData() retourne deja toutes les donnees necessaires
- **Brownfield** : on modifie les fichiers existants, pas de refonte architecturale
- **Composable partage** : useFrise.ts reste le point central de la logique
- La TimelineModal responsable (liste verticale) n'est PAS modifiee

## Out of Scope

- Refonte du backend ou du schema de donnees
- Ajout de nouveaux types de milestones (cours, stages, evenements non-devoirs)
- Refonte de la TimelineModal responsable (elle reste en liste verticale)
- Vue multi-lanes par projet (option ecartee lors de la deep interview)
- Frise sur mobile (< 768px)

## Dependencies

- Composable existant : `src/renderer/src/composables/useFrise.ts`
- Composant existant : `src/renderer/src/components/dashboard/TabFrise.vue`
- Modal existante : `src/renderer/src/components/modals/StudentTimelineModal.vue`
- Store : `src/renderer/src/stores/travaux.ts` (fetchGantt)
- Types : `GanttRow` dans `src/renderer/src/types/index.ts`
