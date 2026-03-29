---
subject: Refonte affichage frise chronologique
type: brownfield
rounds: 8
ambiguity: 19%
created: 2026-03-29
---

# Specification : Refonte affichage frise chronologique

## Scores de clarte
| Dimension | Score | Poids | Contribution |
|-----------|-------|-------|-------------|
| Objectif | 0.9 | 35% | 0.315 |
| Contraintes | 0.8 | 25% | 0.200 |
| Criteres de succes | 0.7 | 25% | 0.175 |
| Contexte technique | 0.7 | 15% | 0.105 |
| **Total** | | | **0.795 (ambiguite 19%)** |

## Objectif

Refondre l'affichage de la frise chronologique en un calendrier lineaire horizontal unifie pour les vues responsable (TabFrise) et etudiant (StudentTimelineModal), avec un axe temporel lisible et des dots agreges pour eliminer les chevauchements.

## Contraintes

- Garder la frise horizontale existante comme base (pas de refonte architecturale)
- Unifier l'UX : la StudentTimelineModal passe de liste verticale a frise horizontale
- Conserver les filtres etudiants (A rendre / Rendus / Evenements) et la legende interactive dans la frise horizontale
- Le detail (notes, countdown, recherche) s'affiche dans le popup au clic sur un dot
- Les donnees backend (getGanttData) restent inchangees

## Non-objectifs (hors scope)

- Refonte du backend / schema de donnees
- Ajout de nouveaux types de milestones (cours, stages, evenements hors devoirs)
- Refonte de la TimelineModal responsable (liste verticale) — elle reste telle quelle
- Vue multi-lanes par projet (option ecartee)

## Criteres d'acceptation

- [ ] Identifier la date d'un milestone en moins de 2 secondes sans hover, grace aux reperes visuels
- [ ] Zero chevauchement visuel meme avec 10+ deadlines le meme jour
- [ ] Separateurs de mois visibles (fond alterne ou lignes verticales)
- [ ] Marqueur "aujourd'hui" evident et toujours visible
- [ ] Dots agreges avec compteur numerique quand plusieurs milestones le meme jour
- [ ] Clic sur un dot agrege ouvre un dropdown/popup avec le detail de chaque milestone
- [ ] StudentTimelineModal affiche une frise horizontale (plus de liste verticale)
- [ ] Filtres etudiants (A rendre / Rendus / Evenements) et legende interactive fonctionnels sur la frise horizontale
- [ ] Detail etudiant (notes, feedback, countdown) accessible via popup au clic

## Hypotheses exposees et resolues

| Hypothese | Challenge | Resolution |
|-----------|-----------|-----------|
| Un filtre par projet suffirait a resoudre le chevauchement | Round 4 — Contradicteur | Rejete : l'utilisateur veut les deux (lisibilite temporelle ET anti-chevauchement) |
| La StudentTimelineModal n'a pas besoin de changer | Round 6 — Simplificateur | Rejete : l'utilisateur veut une UX horizontale unifiee |
| Toutes les features etudiantes doivent etre dans la frise | Round 8 | Compromis : filtres + legende dans la frise, detail dans le popup |

## Contexte technique

### Fichiers concernes

| Fichier | Action |
|---------|--------|
| `src/renderer/src/composables/useFrise.ts` | Modifier : logique de groupement par jour → dots agreges |
| `src/renderer/src/components/dashboard/TabFrise.vue` | Modifier : axe temporel avec separateurs mois, dots agreges |
| `src/renderer/src/components/modals/StudentTimelineModal.vue` | Refondre : liste verticale → frise horizontale avec filtres |
| `src/renderer/src/constants.ts` | Eventuellement : constantes de zoom/couleurs |

### Patterns existants a reutiliser

- `useFrise.ts` contient deja : calcul de position (left %), zoom 4 niveaux, drag/scroll, axe adaptatif
- `TabFrise.vue` a deja le rendu des dots, couleurs par projet, hover labels
- `StudentTimelineModal.vue` a les filtres, la legende, le countdown — a migrer vers la frise horizontale

### Donnees backend

Pas de changement. `getGanttData(promoId)` retourne deja toutes les donnees necessaires (GanttRow[]).

## Transcription

<details><summary>Voir les Q&R</summary>

**Round 1 (Objectif)** : Qu'est-ce qui ne te satisfait pas dans la frise actuelle ?
→ L'affichage — UX confuse

**Round 2 (Objectif)** : Quel aspect precis de l'affichage pose probleme ?
→ A (chevauchement dots) + C (axe temporel confus)

**Round 3 (Contraintes)** : Quel type de frise comme reference ?
→ B — Style calendrier lineaire avec marqueurs clairs par mois

**Round 4 (Criteres — Contradicteur)** : Comment saurais-tu que la nouvelle frise est reussie ?
→ C — Identification date < 2s ET zero chevauchement

**Round 5 (Contraintes)** : Comment gerer les milestones multiples sur un meme jour ?
→ B — Dot agrege avec compteur + dropdown

**Round 6 (Objectif — Simplificateur)** : TabFrise uniquement ou aussi StudentTimelineModal ?
→ B — Les deux vues

**Round 7 (Criteres)** : Qu'est-ce qui ne va pas cote etudiant ?
→ B — Cohérence visuelle, StudentTimelineModal doit devenir horizontale

**Round 8 (Contexte)** : Features etudiantes a conserver dans la frise horizontale ?
→ B — Filtres + legende, detail dans le popup

</details>
