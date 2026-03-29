---
name: canaux-ameliorations
description: Gestion membres post-creation, archivage canaux, et ameliorations UX (header, toasts, roles, badges)
status: backlog
created: 2026-03-29T20:35:30Z
---

# PRD: canaux-ameliorations

## Executive Summary

Ameliorer le systeme de canaux existant sur trois axes : permettre la gestion des membres apres la creation d'un canal prive, ajouter l'archivage de canaux (invisible + lecture seule + restaurable), et renforcer l'UX avec un header enrichi, des toasts de feedback, des roles affiches dans le panneau membres, et des badges de mentions distincts.

## Problem Statement

1. **Gestion des membres figee** : une fois un canal prive cree, il est impossible d'ajouter ou retirer des membres depuis l'UI. Le backend `updateChannelMembers` existe mais n'est pas connecte au frontend.

2. **Suppression destructive** : supprimer un canal detruit tous les messages en cascade. Il n'y a aucun moyen d'archiver un canal inactif tout en preservant l'historique.

3. **UX incomplete** : le header de canal est vide (pas de description ni compteur), aucun feedback visuel sur les actions CRUD, le panneau membres n'affiche pas les roles, et les badges unread/mentions ne sont pas distingues visuellement.

## User Stories

### US1 : Gestion des membres
**En tant que** responsable,
**je veux** ajouter ou retirer des etudiants d'un canal prive depuis le panneau membres,
**afin de** gerer les acces sans devoir recreer le canal.

**Criteres d'acceptation :**
- [ ] Bouton "+" dans le panneau membres pour ajouter un etudiant (recherche par nom)
- [ ] Bouton "x" sur chaque membre pour le retirer
- [ ] L'etudiant voit/ne voit plus le canal immediatement
- [ ] Toast de confirmation a chaque action

### US2 : Archivage
**En tant que** responsable,
**je veux** archiver un canal inactif au lieu de le supprimer,
**afin de** preserver l'historique des conversations tout en nettoyant la sidebar.

**Criteres d'acceptation :**
- [ ] Option "Archiver" dans le menu contextuel du canal
- [ ] Le canal disparait de la sidebar pour tous les utilisateurs
- [ ] Les messages sont preserves en base
- [ ] Le canal est en lecture seule (personne ne peut poster)
- [ ] Un responsable peut restaurer un canal archive

### US3 : Header enrichi
**En tant qu'** utilisateur,
**je veux** voir la description du canal, le nombre de membres et le type dans le header,
**afin de** comprendre le contexte du canal sans chercher ailleurs.

**Criteres d'acceptation :**
- [ ] La description s'affiche sous le nom du canal dans le header
- [ ] Le compteur de membres est visible (ex: "24 membres")
- [ ] Un badge indique le type (Chat / Annonces)

### US4 : Feedback et roles
**En tant qu'** utilisateur,
**je veux** des confirmations visuelles sur les actions et voir les roles dans le panneau membres,
**afin de** savoir que mes actions ont fonctionne et qui a quel role.

**Criteres d'acceptation :**
- [ ] Toast sur creation/renommage/suppression/archivage de canal
- [ ] Le panneau membres affiche le role via ROLE_LABELS (Responsable, Intervenant, Etudiant)
- [ ] Les badges mentions (@) sont visuellement distincts des badges unread

## Functional Requirements

### FR1 : Gestion membres dans ChannelMembersPanel
- Bouton "+" ouvre une recherche par nom parmi les etudiants de la promo
- Bouton "x" sur chaque etudiant (pas sur les responsables)
- Appelle `window.api.updateChannelMembers({ channelId, members })` existant
- Rafraichit la liste apres chaque action
- Visible uniquement pour les responsables sur les canaux prives

### FR2 : Archivage de canaux
- Nouvelle colonne `archived INTEGER NOT NULL DEFAULT 0` sur la table channels
- `getChannels()` filtre `WHERE archived = 0` par defaut
- Nouveau endpoint `POST /api/promotions/channels/:id/archive` (toggle)
- Nouveau model `archiveChannel(id)` et `restoreChannel(id)`
- Menu contextuel sidebar : "Archiver" / "Restaurer"
- Section "Canaux archives" accessible au responsable (dans les parametres ou sidebar)
- Un canal archive rejette les nouveaux messages (check dans sendMessage ou route)

### FR3 : Header canal enrichi
- Afficher `description` dans le header de MessagesView (sous le nom du canal)
- Afficher compteur membres (query count ou length de la liste)
- Badge type : "Annonces" ou "Chat" avec icone

### FR4 : Toasts et roles
- `showToast` apres chaque action CRUD sur les canaux
- Panneau membres : afficher ROLE_LABELS[type] a cote du nom
- Badge mention (@) avec couleur accent distincte du badge unread

## Non-Functional Requirements

- Pas de regression sur les canaux existants
- L'archivage ne supprime aucune donnee
- Les toasts disparaissent apres 4 secondes (TOAST_DURATION_MS existant)

## Success Criteria

- Un responsable peut ajouter/retirer des membres sans recreer le canal
- Un canal archive disparait de la sidebar mais ses messages sont accessibles en lecture
- Le header de canal montre description + membres + type
- Chaque action CRUD produit un toast de confirmation

## Constraints & Assumptions

- Le backend `updateChannelMembers` existe deja
- Le pattern `archived` est deja utilise sur la table promotions
- ROLE_LABELS est centralise dans constants.ts
- Le panneau ChannelMembersPanel existe et affiche les membres

## Out of Scope

- Recherche de canaux dans la sidebar
- Permissions granulaires par canal
- Nouveaux types de canaux (forums, threads)
- Parametres de notification par canal
- Edition inline de la description

## Dependencies

- `server/db/models/promotions.js` : updateChannelMembers (existe)
- `src/renderer/src/constants.ts` : ROLE_LABELS (existe)
- `src/renderer/src/composables/useToast.ts` : showToast (existe)
- `src/renderer/src/components/panels/ChannelMembersPanel.vue` (existe)
