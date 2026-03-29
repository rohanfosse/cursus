---
name: canaux-ameliorations
status: backlog
created: 2026-03-29T20:35:30Z
progress: 0%
prd: .claude/prds/canaux-ameliorations.md
github: https://github.com/rohanfosse/cursus/issues/79
---

# Epic: canaux-ameliorations

## Overview

Ameliorer les canaux sur trois axes : gestion des membres post-creation, archivage (invisible + lecture seule), et robustesse UX (header, toasts, roles, badges).

## Architecture Decisions

1. **Membres** : reutiliser `updateChannelMembers` existant. Le panneau `ChannelMembersPanel` est enrichi avec boutons +/x. Pas de nouveau composant.

2. **Archivage** : colonne `archived` sur la table channels (meme pattern que promotions). Filtrage cote `getChannels()`, pas de nouvelle table.

3. **Header** : enrichir `MessagesView.vue` avec les donnees deja presentes dans `appStore` (description, type). Le compteur membres vient d'un simple `getChannelMembers` ou du count en sidebar.

4. **Toasts** : ajouter `showToast()` dans les handlers existants de `useSidebarActions.ts`.

## Technical Approach

| Composant | Action | Complexite |
|-----------|--------|-----------|
| `server/db/schema.js` | Migration : colonne `archived` | Faible |
| `server/db/models/promotions.js` | archiveChannel, restoreChannel, filtrer getChannels | Faible |
| `server/routes/promotions.js` | Endpoint archive/restore | Faible |
| `ChannelMembersPanel.vue` | Boutons +/x, recherche, ROLE_LABELS | Moyenne |
| `MessagesView.vue` | Header enrichi (description, compteur, badge type) | Faible |
| `useSidebarActions.ts` | Action archiver, toasts CRUD | Faible |
| `Sidebar.vue` | Filtrer archives, section archives pour responsable | Moyenne |

## Task Breakdown Preview

### T1 : Backend archivage (schema + model + routes)
- Migration colonne `archived`
- `archiveChannel(id)`, `restoreChannel(id)`, `getArchivedChannels(promoId)`
- Filtrer `getChannels` avec `WHERE archived = 0`
- Endpoint `POST /channels/:id/archive`
- Bloquer les messages dans un canal archive

### T2 : Gestion membres dans ChannelMembersPanel
- Bouton "+" avec recherche etudiants promo
- Bouton "x" pour retirer (responsable uniquement)
- Appel `updateChannelMembers` existant
- Afficher ROLE_LABELS sur chaque membre
- Toasts de confirmation

### T3 : Header canal enrichi + toasts + badges
- Description + compteur membres + badge type dans MessagesView header
- Toasts sur create/rename/delete/archive
- Badge mention distinct du badge unread dans la sidebar

### T4 : Frontend archivage sidebar
- Menu contextuel "Archiver" / "Restaurer"
- Filtrer les canaux archives dans la sidebar
- Section "Canaux archives" pour les responsables
- Canal archive = lecture seule (isReadonly)

### T5 : Tests
- Tests backend : archiveChannel, restoreChannel, messages bloques
- Tests backend : endpoint archive/restore
- Tests frontend : panneau membres +/x
- Tests frontend : header enrichi

## Dependencies

- T1 prerequis pour T4 (backend archive avant frontend)
- T2 et T3 parallelisables
- T4 depend de T1
- T5 depend de T1 + T2 + T3 + T4

## Estimated Effort

| Tache | Estimation | Parallelisable |
|-------|-----------|----------------|
| T1 Backend archivage | 2h | Non (prerequis) |
| T2 Gestion membres | 3h | Oui (avec T3) |
| T3 Header + toasts + badges | 2h | Oui (avec T2) |
| T4 Frontend archivage | 2h | Non (depend T1) |
| T5 Tests | 2h | Non (depend tout) |
| **Total** | **11h** | |
