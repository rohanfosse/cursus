# RACI — Matrice des permissions par role

> Mise a jour : 2026-04-02 (post-migration `requireRole` + separation admin/teacher)

## Hierarchie des roles

```
admin (3) > teacher (2) > ta (1) > student (0)
```

- **Student** — Etudiant, restreint a sa propre promo
- **TA** — Intervenant, assigne a des projets specifiques
- **Teacher** — Enseignant responsable, gere les promos
- **Admin** — Administrateur systeme, acces illimite

Chaque role herite des permissions des roles inferieurs.

### Differences admin vs teacher

| Capacite | Teacher | Admin |
|----------|---------|-------|
| Gerer promos, canaux, devoirs, projets | ✓ creer/modifier | ✓ tout |
| **Supprimer une promo** | ✗ | ✓ |
| **Supprimer un intervenant** | ✗ (peut ajouter/desassigner) | ✓ |
| **Supprimer une categorie** | ✗ | ✓ |
| Supprimer session live/REX | ✓ ses propres sessions | ✓ toutes |
| Marquer absents (note D) | ✓ ses propres promos | ✓ toutes |
| Panel admin (stats, users, moderation) | ✓ | ✓ |
| Modules systeme (security, deploy, maintenance) | ✗ | ✓ |

**Principe** : un teacher ne peut pas effectuer d'actions destructives irreversibles sur des donnees partagees. L'admin est le seul a pouvoir supprimer des entites structurelles (promos, intervenants, categories).

---

## Legende

| Symbole | Signification |
|---------|---------------|
| ✓ | Acces autorise |
| ✗ | Acces refuse (403) |
| ✓* | Acces conditionnel (propre promo, propre ressource, etc.) |

---

## Auth (`/api/auth`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| POST | `/login` | ✓ | ✓ | ✓ | ✓ | Public |
| POST | `/register` | ✓ | ✓ | ✓ | ✓ | Public |
| GET | `/identities` | ✗ | ✗ | ✓ | ✓ | — |
| GET | `/student-by-email` | ✗ | ✓ | ✓ | ✓ | — |
| GET | `/find-user` | ✓ | ✓ | ✓ | ✓ | — |
| GET | `/teachers` | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/change-password` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre compte |
| GET | `/export/:studentId` | ✓* | ✓ | ✓ | ✓ | Etudiant : propres donnees |

---

## Travaux / Devoirs (`/api/assignments`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id/suivi` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id/group-members` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/categories` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/gantt` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/rendus` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/teacher-schedule` | ✗ | **✓** | ✓ | ✓ | `requireRole('ta')` |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | Creer un devoir |
| POST | `/publish` | ✗ | ✗ | ✓ | ✓ | Publier |
| POST | `/schedule` | ✗ | ✗ | ✓ | ✓ | Programmer la publication |
| POST | `/group-member` | ✗ | ✗ | ✓ | ✓ | Affecter a un groupe |
| POST | `/:id/mark-missing` | ✗ | ✗ | ✓* | ✓ | Propres promos uniquement (`requireTravailOwner`) |
| PATCH | `/:id` | ✗ | ✗ | ✓ | ✓ | Modifier |
| DELETE | `/:id` | ✗ | ✗ | ✓ | ✓ | Supprimer |
| GET | `/reminders` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/reminders` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/reminders/:id` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/reminders/:id` | ✗ | ✗ | ✓ | ✓ | — |

---

## Documents (`/api/documents`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/channel/:channelId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/channel/:channelId/categories` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/promo/:promoId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/search` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/project` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/project/categories` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/channel` | ✗ | ✗ | ✓ | ✓ | Creer doc canal |
| POST | `/project` | ✗ | **✓** | ✓ | ✓ | `requireRole('ta')` — Creer doc projet |
| PATCH | `/project/:id` | ✗ | ✗ | ✓ | ✓ | + proprietaire du doc |
| PATCH | `/link/:id` | ✗ | ✗ | ✓ | ✓ | + proprietaire du doc |
| DELETE | `/channel/:id` | ✗ | ✗ | ✓ | ✓ | + proprietaire du doc |

---

## Depots (`/api/depots`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/` | ✓* | ✓ | ✓ | ✓ | Etudiant : propres depots |
| POST | `/` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre compte |
| POST | `/note` | ✗ | **✓** | ✓ | ✓ | Guard manuel (non-etudiant) |
| POST | `/feedback` | ✗ | **✓** | ✓ | ✓ | Guard manuel (non-etudiant) |

---

## Projets (`/api/projects`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/ta/my-projects` | ✗ | **✓** | ✓ | ✓ | `requireRole('ta')` |
| GET | `/promo/:promoId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id/travaux` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id/documents` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id/tas` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | Creer projet |
| PUT | `/:id` | ✗ | ✗ | ✓ | ✓ | Modifier projet |
| DELETE | `/:id` | ✗ | ✗ | ✓ | ✓ | Supprimer projet |
| POST | `/:id/travaux/:travailId` | ✗ | ✗ | ✓ | ✓ | Lier devoir |
| DELETE | `/:id/travaux/:travailId` | ✗ | ✗ | ✓ | ✓ | Delier devoir |
| POST | `/:id/documents/:documentId` | ✗ | ✗ | ✓ | ✓ | Lier document |
| POST | `/:id/assign-ta` | ✗ | ✗ | ✓ | ✓ | Assigner TA |
| DELETE | `/:id/unassign-ta/:teacherId` | ✗ | ✗ | ✓ | ✓ | Retirer TA |

---

## Promotions & Canaux (`/api/promotions`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/` | ✓ | ✓ | ✓ | ✓ | Public |
| GET | `/:promoId/students` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:promoId/channels` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:promoId/channels/archived` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | Creer promo |
| PATCH | `/:id` | ✗ | ✗ | ✓ | ✓ | Modifier promo |
| DELETE | `/:id` | ✗ | ✗ | **✗** | ✓ | **Admin only** — Supprimer promo |
| POST | `/categories/rename` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/categories/delete` | ✗ | ✗ | **✗** | ✓ | **Admin only** — Supprimer categorie |
| POST | `/channels` | ✗ | ✗ | ✓ | ✓ | Creer canal |
| PATCH | `/channels/:id/name` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/channels/:id/category` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/channels/:id/privacy` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/channels/:id` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/channels/members` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/channels/:id/archive` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/channels/:id/restore` | ✗ | ✗ | ✓ | ✓ | — |

---

## Messages (`/api/messages`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/channel/:channelId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/channel/:channelId/page` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/search` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/pinned/:channelId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/dm/:studentId` | ✓* | ✓* | ✓ | ✓ | Participant DM |
| GET | `/dm/:studentId/page` | ✓* | ✓* | ✓ | ✓ | Participant DM |
| GET | `/dm/:studentId/search` | ✓* | ✓* | ✓ | ✓ | Participant DM |
| GET | `/dm-contacts/:studentId` | ✓* | ✓* | ✓ | ✓ | Participant DM |
| POST | `/search-all` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre promo |
| POST | `/` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre promo |
| POST | `/reactions` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre promo |
| POST | `/:id/report` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre promo |
| PATCH | `/:id` | ✓* | ✓ | ✓ | ✓ | Auteur du message |
| DELETE | `/:id` | ✓* | ✓ | ✓ | ✓ | Auteur du message |
| GET | `/dm-files` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/pin` | ✗ | ✗ | ✓ | ✓ | — |

---

## Groupes (`/api/groups`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id/members` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/:id` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/:id/members` | ✗ | ✗ | ✓ | ✓ | — |

---

## Live Quiz (`/api/live`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/sessions/:id` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/sessions/code/:code` | ✓ | ✓ | ✓ | ✓ | Public |
| GET | `/sessions/promo/:promoId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/sessions/promo/:promoId/active` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/sessions/promo/:promoId/history` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/sessions/promo/:promoId/stats` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/sessions/:id/leaderboard` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/activities/:id/results` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/activities/:id/respond` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/sessions` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/sessions/:id/clone` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/sessions/:id/activities` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/sessions/:id/status` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/sessions/:id/activities/reorder` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/activities/:id` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/activities/:id/status` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/sessions/:id` | ✗ | ✗ | ✓* | ✓ | Propre session uniquement (`requireSessionOwner`) |
| DELETE | `/activities/:id` | ✗ | ✗ | ✓ | ✓ | — |

---

## REX (`/api/rex`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/sessions/:id` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/sessions/code/:code` | ✓ | ✓ | ✓ | ✓ | Public |
| GET | `/sessions/promo/:promoId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/sessions/promo/:promoId/*` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/activities/:id/results` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/activities/:id/respond` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/sessions` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/sessions/:id/clone` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/sessions/:id/activities` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/sessions/:id/status` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/sessions/:id/activities/reorder` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/activities/:id` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/activities/:id/status` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/responses/:id/pin` | ✗ | ✗ | ✓ | ✓ | — |
| GET | `/sessions/:id/export` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/sessions/:id` | ✗ | ✗ | ✓* | ✓ | Propre session uniquement (`requireSessionOwner`) |
| DELETE | `/activities/:id` | ✗ | ✗ | ✓ | ✓ | — |

---

## Rubrics (`/api/rubrics`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/:travailId` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/scores/:depotId` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/scores` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/:travailId` | ✗ | ✗ | ✓ | ✓ | — |

---

## Signatures (`/api/signatures`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| POST | `/` | ✓* | ✗ | ✗ | ✗ | Etudiant : propre DM |
| GET | `/by-message/:messageId` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre DM |
| GET | `/` | ✗ | ✗ | ✓ | ✓ | Lister demandes |
| GET | `/pending-count` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/:id/sign` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/:id/reject` | ✗ | ✗ | ✓ | ✓ | — |

---

## Etudiants (`/api/students`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre promo |
| GET | `/:id/profile` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| GET | `/:id/assignments` | ✓* | ✓ | ✓ | ✓ | Etudiant : propres devoirs |
| GET | `/:id/export` | ✓* | ✓ | ✓ | ✓ | Etudiant : propres donnees |
| GET | `/onboarding-status` | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/complete-onboarding` | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/photo` | ✓* | ✓ | ✓ | ✓ | Etudiant : propre photo |
| GET | `/stats` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/bulk-import` | ✗ | ✗ | ✓ | ✓ | — |

---

## Enseignants (`/api/teachers`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/:id/channels` | ✓ | ✓ | ✓ | ✓ | Public |
| GET | `/` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/:id` | ✗ | ✗ | **✗** | ✓ | **Admin only** — Supprimer intervenant |
| POST | `/:id/channels` | ✗ | ✗ | ✓ | ✓ | Affecter canaux |
| POST | `/photo` | ✗ | ✗ | ✓ | ✓ | — |

---

## Notes enseignant (`/api/teacher-notes`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/student/:studentId` | ✗ | ✗ | ✓ | ✓ | — |
| GET | `/promo/:promoId` | ✗ | ✗ | ✓ | ✓ | — |
| GET | `/promo/:promoId/summary` | ✗ | ✗ | ✓ | ✓ | — |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | — |
| PATCH | `/:id` | ✗ | ✗ | ✓ | ✓ | Auteur uniquement |
| DELETE | `/:id` | ✗ | ✗ | ✓ | ✓ | Auteur uniquement |

---

## Engagement (`/api/engagement`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/:promoId` | ✗ | ✗ | ✓ | ✓ | — |

---

## Ressources (`/api/resources`)

| Methode | Route | Student | TA | Teacher | Admin | Condition |
|---------|-------|---------|-----|---------|-------|-----------|
| GET | `/` | ✓* | ✓ | ✓ | ✓ | Meme promo |
| POST | `/` | ✗ | ✗ | ✓ | ✓ | — |
| DELETE | `/:id` | ✗ | ✗ | ✓ | ✓ | — |

---

## Administration (`/api/admin`)

### Modules promo (teacher + admin)

| Methode | Route | Student | TA | Teacher | Admin | Module |
|---------|-------|---------|-----|---------|-------|--------|
| GET | `/me` | ✗ | ✗ | ✓ | ✓ | — |
| GET | `/config` | ✗ | ✗ | ✓ | ✓ | settings-read |
| GET | `/modules` | ✗ | ✗ | ✓ | ✓ | settings-read |
| GET | `/stats` | ✗ | ✗ | ✓ | ✓ | stats |
| GET | `/heatmap` | ✗ | ✗ | ✓ | ✓ | stats |
| GET | `/visits` | ✗ | ✗ | ✓ | ✓ | stats |
| GET | `/adoption` | ✗ | ✗ | ✓ | ✓ | stats |
| GET | `/last-seen` | ✗ | ✗ | ✓ | ✓ | stats |
| GET | `/inactive` | ✗ | ✗ | ✓ | ✓ | stats |
| GET | `/error-reports` | ✗ | ✗ | ✓ | ✓ | stats |
| GET | `/users` | ✗ | ✗ | ✓ | ✓ | users |
| GET | `/users/:id` | ✗ | ✗ | ✓ | ✓ | users |
| PATCH | `/users/:id` | ✗ | ✗ | ✓ | ✓ | users |
| POST | `/users/:id/reset-password` | ✗ | ✗ | ✓ | ✓ | users |
| DELETE | `/users/:id` | ✗ | ✗ | ✓ | ✓ | users |
| GET | `/messages` | ✗ | ✗ | ✓ | ✓ | moderation |
| DELETE | `/messages/:id` | ✗ | ✗ | ✓ | ✓ | moderation |
| GET | `/channels` | ✗ | ✗ | ✓ | ✓ | moderation |
| GET | `/reports` | ✗ | ✗ | ✓ | ✓ | moderation |
| POST | `/reports/:id/resolve` | ✗ | ✗ | ✓ | ✓ | moderation |
| POST | `/feedback` | ✓ | ✓ | ✓ | ✓ | feedback (submit) |
| GET | `/feedback` | ✗ | ✗ | ✓ | ✓ | feedback |
| GET | `/feedback/mine` | ✓ | ✓ | ✓ | ✓ | feedback (own) |
| GET | `/feedback/stats` | ✗ | ✗ | ✓ | ✓ | feedback |
| POST | `/feedback/:id/status` | ✗ | ✗ | ✓ | ✓ | feedback |
| GET | `/scheduled` | ✗ | ✗ | ✓ | ✓ | scheduled |
| POST | `/scheduled` | ✗ | ✗ | ✓ | ✓ | scheduled |
| DELETE | `/scheduled/:id` | ✗ | ✗ | ✓ | ✓ | scheduled |
| POST | `/import-examens` | ✗ | ✗ | ✓ | ✓ | import |
| POST | `/seed-promos` | ✗ | ✗ | ✓ | ✓ | import |
| GET | `/promos-list` | ✗ | ✗ | ✓ | ✓ | import |
| POST | `/import-rappels` | ✗ | ✗ | ✓ | ✓ | import |
| GET | `/rappels` | ✗ | ✗ | ✓ | ✓ | import |
| POST | `/rappels/:id/done` | ✗ | ✗ | ✓ | ✓ | import |

### Modules systeme (admin uniquement)

| Methode | Route | Student | TA | Teacher | Admin | Module |
|---------|-------|---------|-----|---------|-------|--------|
| DELETE | `/error-reports` | ✗ | ✗ | ✗ | ✓ | stats (delete) |
| GET | `/security` | ✗ | ✗ | ✗ | ✓ | security |
| POST | `/reset-seed` | ✗ | ✗ | ✗ | ✓ | maintenance |
| POST | `/backup` | ✗ | ✗ | ✗ | ✓ | maintenance |
| GET | `/backups` | ✗ | ✗ | ✗ | ✓ | maintenance |
| DELETE | `/backups/:filename` | ✗ | ✗ | ✗ | ✓ | maintenance |
| GET | `/db-info` | ✗ | ✗ | ✗ | ✓ | maintenance |
| POST | `/cleanup-logs` | ✗ | ✗ | ✗ | ✓ | maintenance |
| POST | `/purge` | ✗ | ✗ | ✗ | ✓ | maintenance |
| GET | `/deploy-info` | ✗ | ✗ | ✗ | ✓ | deploy |
| GET | `/git-status` | ✗ | ✗ | ✗ | ✓ | deploy |
| POST | `/git-pull` | ✗ | ✗ | ✗ | ✓ | deploy |
| POST | `/docker-rebuild` | ✗ | ✗ | ✗ | ✓ | deploy |
| GET | `/server-info` | ✗ | ✗ | ✗ | ✓ | deploy |
| POST | `/nginx-apply` | ✗ | ✗ | ✗ | ✓ | deploy |
| GET | `/sessions` | ✗ | ✗ | ✗ | ✓ | sessions |
| DELETE | `/sessions/:id` | ✗ | ✗ | ✗ | ✓ | sessions |
| POST | `/sessions/revoke-user` | ✗ | ✗ | ✗ | ✓ | sessions |
| POST | `/config` | ✗ | ✗ | ✗ | ✓ | settings |
| POST | `/modules` | ✗ | ✗ | ✗ | ✓ | settings |
| POST | `/promos/:id/archive` | ✗ | ✗ | ✗ | ✓ | settings |
| GET | `/audit` | ✗ | ✗ | ✗ | ✓ | audit |

---

## Middleware de reference

| Middleware | Role minimum | Description |
|------------|-------------|-------------|
| `requireRole('admin')` | admin | Admin uniquement |
| `requireRole('teacher')` | teacher | Enseignants + admin |
| `requireRole('ta')` | ta | Intervenants + enseignants + admin |
| `requirePromo(fn)` | student+ | Isole l'etudiant a sa promo |
| `requirePromoAdmin(fn)` | teacher | Verifie l'affectation enseignant-promo |
| `requireProject(fn)` | ta | Verifie l'affectation TA-projet |
| `requireMessageOwner` | student+ | Auteur du message uniquement |
| `requireDmParticipant` | student+ | Participant du DM (boite partagee / TA scope) |
| `requireDocOwnership` | teacher | Proprietaire du document |
| `requireSystemAdmin` | admin | Admin systeme uniquement (routes admin) |
| `requireAdmin` | teacher | Enseignant+ (modules promo admin) |
