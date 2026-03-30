---
name: workflow-pedagogique
description: Publication programmee, notation rapide en lot, vue multi-promo — adapter Cursus au workflow reel CESI
status: active
created: 2026-03-30T21:02:15Z
---

# PRD: workflow-pedagogique

## Executive Summary

Adapter Cursus au workflow pedagogique reel de Rohan au CESI, identifie par deep interview (17% ambiguite). Trois chantiers prioritaires pour le pilote de septembre 2026 : (1) publication programmee des devoirs, (2) notation rapide en lot sans friction, (3) vue multi-promo pour gerer 2 promotions simultanement.

## Problem Statement

Rohan gere 2 promotions (~60 etudiants) avec ~8 projets/an. Son workflow est lineaire : creer -> publier -> attendre -> noter. Trois frictions majeures bloquent l'adoption :

1. **Pas de publication programmee** : Il cree des devoirs a l'avance mais doit revenir manuellement les publier au bon moment pour ne pas surcharger les etudiants. Il n'y a aucun mecanisme de planification.

2. **Notation lente** : Il note directement dans Cursus (pas d'intermediaire), toujours en lettres A/B/C/D avec commentaire court. Mais le flux actuel oblige a ouvrir chaque depot individuellement dans la DepotsModal. Pour 25 etudiants, c'est beaucoup de clics.

3. **Pas de vue multi-promo** : Il gere 2 promos mais doit switcher constamment entre elles via le sidecar de promo. Aucune vue ne lui donne une vision transversale de ses 2 promos.

## User Stories

### US-1 : Publication programmee
**En tant que** responsable de promo,
**je veux** programmer la date de publication d'un devoir lors de sa creation,
**afin de** preparer mes devoirs a l'avance sans surcharger les etudiants.

**Criteres d'acceptation :**
- [ ] Champ `scheduled_publish_at` (datetime) dans le formulaire de creation de devoir
- [ ] Le devoir reste en brouillon jusqu'a la date programmee
- [ ] A la date prevue, le devoir est publie automatiquement (server-side ou cron client)
- [ ] Notification automatique aux etudiants a la publication
- [ ] Le prof peut annuler/modifier la programmation avant publication
- [ ] Indicateur visuel "Publie le..." dans la liste et la modale de gestion

### US-2 : Notation rapide en lot
**En tant que** responsable de promo,
**je veux** noter tous les etudiants d'un devoir dans un flux continu (depot -> note A/B/C/D -> commentaire -> suivant),
**afin de** noter 25 etudiants en une seule session sans friction.

**Criteres d'acceptation :**
- [ ] Vue de notation en lot accessible depuis GestionDevoirModal (bouton "Noter tous")
- [ ] Navigation clavier : fleches haut/bas pour changer d'etudiant, A/B/C/D pour la note, Tab pour le commentaire, Enter pour passer au suivant
- [ ] Apercu du depot (fichier/lien) a cote du formulaire de notation
- [ ] Indicateur de progression (X/Y notes)
- [ ] Auto-save au changement d'etudiant (pas de bouton "sauvegarder" explicite)
- [ ] Filtres : tous / non notes / notes (pour reprendre une session)

### US-3 : Vue multi-promo
**En tant que** responsable de 2 promotions,
**je veux** voir une vue transversale de mes promos (devoirs a venir, rendus en attente, notes a donner),
**afin de** gerer mes 2 promos sans switcher constamment.

**Criteres d'acceptation :**
- [ ] Nouvelle vue ou section du dashboard avec les 2 promos cote a cote
- [ ] Par promo : prochains devoirs, rendus en attente de note, progression globale
- [ ] Clic pour naviguer vers le devoir dans la promo concernee
- [ ] Badge/compteur "X a noter" par promo visible en permanence

## Functional Requirements

### FR-1 : Publication programmee
- Nouveau champ `scheduled_publish_at` (TEXT, ISO datetime nullable) dans la table `travaux`
- Migration DB : `ALTER TABLE travaux ADD COLUMN scheduled_publish_at TEXT`
- Server-side : scheduler (setInterval 60s) qui verifie les devoirs a publier
- IPC : `updateTravailScheduled({ travailId, scheduledAt })` pour modifier la programmation
- UI : DateTimePicker dans NewDevoirModal + indicateur dans GestionDevoirModal

### FR-2 : Notation rapide en lot
- Nouveau composant `BatchGradingView.vue` (modale ou panneau lateral)
- Utilise `useTeacherGrading.ts` existant (setNote, setFeedback)
- Navigation clavier via `@keydown` sur le conteneur
- Apercu du depot : iframe pour fichiers, lien cliquable pour URLs
- Appels API sequentiels : setNote puis setFeedback au changement d'etudiant

### FR-3 : Vue multi-promo
- Nouveau composant `MultiPromoOverview.vue` dans le dashboard
- Appels API : `getGanttData(promoId)` pour chaque promo (deja existant)
- Computed : agreation des compteurs (a noter, en attente, prochaines deadlines)
- Navigation : clic ouvre le devoir dans la bonne promo (switch promo + open modal)

## Non-Functional Requirements

- **Performance** : La notation en lot doit auto-sauvegarder en < 500ms (pas de spinner visible)
- **Accessibilite** : Navigation clavier complete pour la notation (A/B/C/D = raccourcis directs)
- **Responsive** : Vue multi-promo lisible sur tablette (min 768px, empilement vertical)
- **Dark mode** : Tous les composants respectent les CSS variables existantes
- **Offline** : La publication programmee necessite le serveur ; la notation en lot doit fonctionner meme en mode degrade (queue locale)

## Success Criteria

1. **Publication programmee** : Un devoir cree avec `scheduled_publish_at` se publie automatiquement a l'heure prevue (+-2 min de tolerance)
2. **Notation en lot** : Noter 25 etudiants en < 10 minutes avec clavier seul (vs ~20 min actuellement)
3. **Multi-promo** : Voir les metriques des 2 promos sans changer de contexte
4. **Zero regression** : Les 1758+ tests existants passent, couverture >= 60%

## Constraints & Assumptions

- **SQLite** : Pas de cron system-level. Le scheduler tourne cote serveur Express (setInterval)
- **Electron + Web** : La publication programmee doit marcher en mode web (server-side) ET desktop (ipc)
- **2 promos max** pour le pilote. Pas besoin de scaler a N promos pour septembre
- **Grilles du referentiel national** : L'import de grilles est hors scope (chantier separe)
- **Notation /20** : Existe dans le code, on ne la retire pas (open core), mais l'UX de lot est optimisee pour les lettres A/B/C/D

## Out of Scope

- Import de grilles d'evaluation du referentiel CESI (chantier futur)
- Refonte de la vue etudiant (report ulterieur)
- Suppression de la notation /20 (gardee pour l'open core)
- Systeme de notification push/email (chantier separe)
- Historique d'audit des notes (pas necessaire pour le pilote)

## Dependencies

- `DateTimePicker.vue` existant (utilise pour le champ scheduled_publish_at)
- `useTeacherGrading.ts` existant (setNote, setFeedback)
- `useDevoirsTeacher.ts` existant (gantt, rendus views)
- `travaux.ts` store Pinia (actions fetch/mutation)
- Table `travaux` et `depots` existantes
- GestionDevoirModal refonde (v2.4.0, vue unique scrollable)
