---
name: widget-sizing-system
description: Systeme de tailles de widgets Android-style avec picker visuel et presets de layout
status: active
created: 2026-03-28T19:39:02Z
---

# PRD: widget-sizing-system

## Executive Summary

Transformer le dashboard Cursus (etudiant + prof) d'une grille rigide 2 colonnes avec widgets taille unique en un systeme de widgets multi-tailles inspire d'Android/iOS, avec un picker visuel par categorie et des presets de layout pre-configures.

## Problem Statement

Les dashboards etudiant (19 widgets) et prof (~17 widgets) utilisent une grille fixe a 2 colonnes ou tous les widgets ont la meme taille. Cela pose 3 problemes :

1. **Densite d'information inegale** : un widget "Horloge" (3 lignes) occupe autant d'espace qu'un widget "Projets" (tableau complexe). L'espace est gaspille ou insuffisant.
2. **Pas de hierarchie visuelle** : l'utilisateur ne peut pas mettre en avant les widgets importants pour lui (ex: un prof qui veut voir les rendus a noter en grand).
3. **Decouverte limitee** : le customizer actuel est une liste de checkboxes sans apercu visuel. Les utilisateurs ne savent pas ce que fait un widget avant de l'activer.

## User Stories

### US-1 : Redimensionner un widget
**En tant qu'** utilisateur (etudiant ou prof),
**je veux** pouvoir choisir la taille de mes widgets (petit, moyen, grand, pleine largeur),
**afin de** donner plus de place aux informations importantes pour moi.

**Criteres d'acceptation :**
- En mode edit, un menu contextuel ou des poignees permettent de choisir parmi les tailles supportees par le widget
- La taille choisie est sauvegardee et restauree au prochain lancement
- Le widget s'adapte visuellement a sa taille (plus de contenu en grand, resume en petit)
- La grille se reorganise automatiquement sans trous

### US-2 : Parcourir les widgets disponibles
**En tant qu'** utilisateur,
**je veux** voir un picker visuel avec apercu et categories,
**afin de** decouvrir les widgets que je ne connais pas et comprendre leur utilite.

**Criteres d'acceptation :**
- Le picker affiche une preview/illustration de chaque widget
- Les widgets sont organises par categorie (Essentiel, Communication, Suivi, Productivite, Fun)
- Un bouton "Ajouter" place le widget dans le dashboard
- La taille par defaut est indiquee
- L'utilisateur peut changer la taille depuis le picker avant d'ajouter

### US-3 : Appliquer un preset de layout
**En tant qu'** utilisateur qui ne veut pas configurer widget par widget,
**je veux** choisir parmi des layouts pre-configures,
**afin d'** avoir un dashboard fonctionnel en un clic.

**Criteres d'acceptation :**
- 3-4 presets disponibles avec apercu miniature
- L'application d'un preset remplace le layout actuel (avec confirmation)
- Les presets definissent quels widgets sont visibles et a quelle taille
- Presets differents pour etudiant et prof
- L'utilisateur peut personnaliser apres avoir applique un preset

### US-4 : Dashboard responsive
**En tant qu'** utilisateur sur differentes tailles d'ecran,
**je veux** que la grille s'adapte automatiquement,
**afin que** le dashboard reste utilisable sur tablette et petit ecran.

**Criteres d'acceptation :**
- Desktop (>1024px) : grille 4 colonnes
- Tablette (600-1024px) : grille 2 colonnes, widgets 2x1 deviennent pleine largeur
- Mobile (<600px) : grille 1 colonne, tous les widgets en pleine largeur
- Les transitions sont fluides (pas de saut)

## Functional Requirements

### FR-1 : Systeme de tailles

| Taille | Colonnes x Lignes | Cas d'usage |
| ------ | ----------------- | ----------- |
| Small (1x1) | 1 col, 1 row | Clock, Countdown, Stats unitaires |
| Medium (2x1) | 2 cols, 1 row | Livrables, Feedback, Grades, Quick actions |
| Large (2x2) | 2 cols, 2 rows | Projets, Agenda 48h, Activity feed |
| Wide (4x1) | 4 cols, 1 row | Schedule strip, Announcements, Sante classe |

Chaque widget declare :
- `sizes: WidgetSize[]` — tailles supportees
- `defaultSize: WidgetSize` — taille par defaut
- Le widget adapte son rendu selon la taille active

### FR-2 : Grille CSS Grid

- Base : `grid-template-columns: repeat(4, 1fr)` avec `grid-auto-rows: minmax(140px, auto)`
- Les widgets utilisent `grid-column: span N` et `grid-row: span N`
- Algorithme de placement : `grid-auto-flow: dense` pour combler les trous
- Gap : 12px (14px en mode edit)

### FR-3 : Widget Registry etendu

Etendre `WidgetDef` avec :
```typescript
interface WidgetDef {
  id: string
  label: string
  icon: Component
  description: string
  category: 'essential' | 'communication' | 'tracking' | 'productivity' | 'fun'
  sizes: WidgetSize[]
  defaultSize: WidgetSize
  defaultEnabled: boolean
  role: 'student' | 'teacher' | 'both'
}
```

### FR-4 : Persistence des tailles

Etendre le schema de preferences :
```typescript
interface BentoPrefs {
  order: string[]
  hidden: string[]
  sizes: Record<string, WidgetSize>  // widgetId → taille choisie
  preset?: string                     // preset actif (null = custom)
}
```

### FR-5 : Presets de layout

Presets etudiant :
- **Compact** : tous en 1x1, dense, maximum de widgets visibles
- **Focus** : Projet 2x2 + Livrables 2x1 + Notes 2x1, minimal
- **Equilibre** (defaut) : mix de tailles, tous les essentiels

Presets prof :
- **Vue d'ensemble** : Action Center 2x2 + Stats 1x1 + Agenda 2x1
- **Communication** : DMs 2x2 + Mentions 2x1 + Activity 2x1
- **Suivi** : Rendus 2x2 + Projets 2x1 + Sante classe 4x1

### FR-6 : Widget Picker visuel

- Drawer/panel lateral (pas une modale plein ecran)
- Organise par categories avec icones
- Chaque widget montre : icone, nom, description, taille par defaut, apercu miniature
- Toggle "Ajouter/Retirer" directement depuis le picker
- Selecteur de taille (radio buttons small/medium/large) avant ajout

## Non-Functional Requirements

- **Performance** : le re-layout de la grille doit etre < 16ms (1 frame) pour rester fluide
- **Accessibilite** : navigation clavier dans le picker, aria-labels sur les controles de taille
- **Migration** : les preferences existantes (localStorage) doivent etre migrees automatiquement sans perte
- **Retrocompatibilite** : les widgets existants fonctionnent sans modification avec leur taille par defaut

## Success Criteria

- Un utilisateur peut redimensionner un widget en < 3 clics (mode edit → clic droit/menu → choisir taille)
- Le picker affiche les 19+ widgets etudiants et 17+ widgets prof avec categories
- L'application d'un preset reconfigure le dashboard en < 1 seconde
- La grille est responsive sur 3 breakpoints (mobile, tablette, desktop)
- Zero regression sur les tests existants (359 tests)
- Les preferences existantes sont migrees sans intervention utilisateur

## Constraints & Assumptions

- **Lib existante** : `vue-draggable-plus` deja utilisee, a conserver pour le drag-and-drop
- **CSS Grid only** : pas de lib de grid externe (pas de gridstack, vue-grid-layout, etc.)
- **localStorage** : persistence cote client uniquement (pas de sync serveur pour V1)
- **Vue 3 + TypeScript** : coherent avec le stack existant
- **Pas de SSR** : app Electron, pas de contrainte SSR

## Out of Scope

- Sync des preferences widget cote serveur (future V2)
- Widgets custom/plugins par l'utilisateur
- Widgets avec contenu editable inline (ex: notes post-it)
- Mode tablette dedie (responsive suffit)
- Animations de resize type "morph" (transition CSS simple suffit)

## Dependencies

- Aucune nouvelle dependance npm requise
- Repose sur : `vue-draggable-plus`, CSS Grid natif, `localStorage`
- Fichiers cles existants : `useBentoPrefs.ts`, `useTeacherBento.ts`, `StudentBento.vue`, `TabAccueil.vue`, `student-widgets/registry.ts`, `BentoCustomizer.vue`
