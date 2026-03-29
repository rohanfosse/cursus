---
subject: Ameliorations canaux — membres, archivage, UX
type: brownfield
rounds: 7
ambiguity: 19%
created: 2026-03-29
---

# Specification : Ameliorations canaux

## Scores de clarte
| Dimension | Score | Poids | Contribution |
|-----------|-------|-------|-------------|
| Objectif | 0.8 | 35% | 0.280 |
| Contraintes | 0.6 | 25% | 0.150 |
| Criteres de succes | 0.7 | 25% | 0.175 |
| Contexte technique | 0.8 | 15% | 0.120 |
| **Total** | | | **0.725 (ambiguite 19%)** |

## Objectif

Trois axes d'amelioration des canaux :
1. **Gestion des membres** post-creation dans le panneau existant (ChannelMembersPanel)
2. **Archivage** de canaux (invisible + lecture seule, rouvrable par le responsable)
3. **Robustesse UX** : header enrichi, feedback toast, panneau membres avec roles, badges mentions distincts

## Contraintes

- Le backend `updateChannelMembers` existe deja — le frontend doit l'utiliser
- L'archivage utilise une colonne `archived` (meme pattern que promotions)
- Les canaux archives sont filtres du `getChannels()` par defaut
- Pas de permissions granulaires par canal (hors scope MVP)
- Pas de parametres de notification par canal (hors scope MVP)

## Non-objectifs (hors scope)

- Recherche de canaux dans la sidebar
- Permissions granulaires / moderateurs par canal
- Nouveaux types de canaux (forums, threads, Q&A)
- Parametres de notification par canal
- Edition inline de la description
- Animation sur les actions

## Criteres d'acceptation

### Gestion des membres
- [ ] Un responsable peut ajouter un etudiant a un canal prive depuis le panneau membres
- [ ] Un responsable peut retirer un etudiant d'un canal prive
- [ ] L'etudiant voit/ne voit plus le canal immediatement apres ajout/retrait

### Archivage
- [ ] Un responsable peut archiver un canal (disparait de la sidebar pour tous)
- [ ] Un responsable peut restaurer un canal archive
- [ ] Les messages d'un canal archive sont preserves
- [ ] Un canal archive est en lecture seule (personne ne peut poster)

### UX
- [ ] Le header du canal affiche la description, le nombre de membres, le badge type
- [ ] Toast de confirmation sur creation/renommage/suppression de canal
- [ ] Le panneau membres affiche le role via ROLE_LABELS
- [ ] Les mentions sont visuellement distinctes des messages normaux dans les badges

## Hypotheses exposees et resolues

| Hypothese | Challenge | Resolution |
|-----------|-----------|-----------|
| Un seul axe en premier | Round 2 | Les 3 en meme temps, decoupes en phases |
| UI gestion membres : menu contextuel vs panneau | Round 3 | Panneau existant (ChannelMembersPanel) — pas de duplication |
| Canal archive = suppression douce | Round 4 — Contradicteur | Non : invisible + lecture seule, rouvrable par responsable |
| Tous les points UX en MVP | Round 6 — Simplificateur | MVP valide : header, toasts, roles, badges |

## Contexte technique

### Fichiers concernes

| Fichier | Action |
|---------|--------|
| `server/db/schema.js` | Migration : ajouter colonne `archived` a channels |
| `server/db/models/promotions.js` | Filtrer archived dans getChannels, ajouter archiveChannel/restoreChannel |
| `server/routes/promotions.js` | Endpoints archive/restore |
| `src/renderer/src/components/panels/ChannelMembersPanel.vue` | Ajouter boutons +/x pour gestion membres, afficher ROLE_LABELS |
| `src/renderer/src/views/MessagesView.vue` | Header enrichi (description, compteur, badge type) |
| `src/renderer/src/components/sidebar/Sidebar.vue` | Filtrer canaux archives, option menu contextuel archiver |
| `src/renderer/src/composables/useSidebarActions.ts` | Actions archiver/restaurer |

### Patterns existants a reutiliser

- `updateChannelMembers` backend existe deja
- `archived` sur la table promotions = meme pattern pour channels
- `ROLE_LABELS` centralise dans constants.ts
- Toast via `useToast()`

## Transcription

<details><summary>Voir les Q&R</summary>

**Round 1 (Objectif)** : Qu'est-ce que tu veux ameliorer ?
→ A (membres) + B (archivage) + E (UX)

**Round 2 (Objectif)** : Lequel en premier ?
→ D — Les 3 en meme temps

**Round 3 (Contraintes)** : Ou la gestion des membres ?
→ D — Je choisis → Panneau existant ChannelMembersPanel

**Round 4 (Criteres — Contradicteur)** : Que fait un canal archive ?
→ A — Invisible + lecture seule, rouvrable par responsable

**Round 5 (Contraintes)** : Quels aspects UX te genent ?
→ A + B + C + D — tout (header, notifs, feedback, panneau)

**Round 6 (Criteres — Simplificateur)** : Decoupage MVP ok ?
→ A — Le MVP est bon

**Round 7 (Criteres)** : Criteres d'acceptation complets ?
→ A — Cristallise

</details>
