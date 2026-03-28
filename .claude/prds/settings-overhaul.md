---
name: settings-overhaul
description: Refonte professionnelle des Settings - bugs, nouvelles prefs, polish UX, architecture
status: active
created: 2026-03-28T20:16:47Z
---

# PRD: settings-overhaul

## Executive Summary

Refonte complete du systeme de Settings de Cursus pour atteindre un niveau professionnel (objectif 9/10, actuellement 6/10). Corrige 4 bugs critiques, ajoute 3 features manquantes (theme systeme, notifications granulaires, mode DND), et ameliore le polish UX (live preview, raccourcis, navigation mobile).

## Problem Statement

L'audit revele un score de 6/10 avec des bugs critiques (CSS variable conflict, progress bar invisible), des manques fonctionnels (pas de detection theme OS, pas de controle granulaire des notifications, pas de mode silence), et des problemes UX (pas de preview live, navigation mobile cassee, confusion density/spacing).

## User Stories

### US-1 : Theme suit le systeme
**En tant qu'** utilisateur, **je veux** que l'app detecte automatiquement si mon OS est en mode sombre/clair, **afin de** ne pas avoir a configurer le theme manuellement.
- AC: Option "Automatique" dans le theme picker, detecte `prefers-color-scheme`, se met a jour en temps reel.

### US-2 : Notifications granulaires
**En tant qu'** utilisateur, **je veux** choisir quels types de notifications je recois (mentions, DMs, devoirs, annonces), **afin de** reduire le bruit sans tout couper.
- AC: Section dediee avec toggles par type, persistence en localStorage.

### US-3 : Mode Ne Pas Deranger
**En tant qu'** etudiant ou prof, **je veux** planifier des heures de silence (ex: 22h-8h), **afin de** ne pas etre derange la nuit.
- AC: Toggle DND + planning horaire, badge "DND" visible dans la sidebar, notifications supprimees pendant les heures actives.

### US-4 : Preview live des changements d'apparence
**En tant qu'** utilisateur, **je veux** voir en temps reel l'effet de mes changements de theme/taille/densite, **afin de** choisir sans tester a l'aveugle.

### US-5 : Raccourcis clavier visibles
**En tant qu'** utilisateur, **je veux** consulter la liste de tous les raccourcis clavier, **afin de** les decouvrir et les utiliser.

## Functional Requirements

- FR-1: Detection `prefers-color-scheme` + theme "Auto" dans le picker
- FR-2: Toggles de notification par type (mentions, DMs, devoirs, annonces)
- FR-3: Mode DND avec planning horaire (heure debut/fin, jours actifs)
- FR-4: Preview mini dans le settings pane pour theme/font/densite
- FR-5: Section "Raccourcis clavier" (lecture seule, 15+ shortcuts)
- FR-6: Fusionner density et msgSpacing en un controle unique
- FR-7: Navigation mobile (tabs horizontales quand sidebar cachee)
- FR-8: Fix bugs critiques (CSS var, progress bar, roleIcon)

## Success Criteria

- Zero bug critique restant dans les Settings
- Theme systeme detecte et applique en < 100ms
- Navigation mobile fonctionnelle sur ecran < 600px
- 359+ tests passent sans regression
- Score audit UX/UI >= 8.5/10

## Out of Scope

- Custom theme editor (couleur accent configurable)
- Raccourcis clavier editables
- Sync preferences serveur
- Multi-langue
- Two-factor authentication
