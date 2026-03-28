---
subject: Systeme de quiz en temps reel pour Cursus - V2
type: brownfield
rounds: 7
ambiguity: 18%
created: 2026-03-28T20:47:19Z
---

# Specification : Quiz Live V2

## Scores de clarte

| Dimension | Score | Poids | Contribution |
|-----------|-------|-------|-------------|
| Objectif | 0.90 | 35% | 0.315 |
| Contraintes | 0.75 | 25% | 0.1875 |
| Criteres succes | 0.85 | 25% | 0.2125 |
| Contexte | 0.70 | 15% | 0.105 |
| **Ambiguite finale** | | | **18%** |

## Objectif

Faire evoluer le module Live Quiz existant de Cursus vers un outil pedagogique complet en ajoutant 2 nouveaux types de questions (vrai/faux, reponse courte), un mode asynchrone (quiz en devoir), des stats post-session detaillees, et en ameliorant la fiabilite temps reel. Le live en cours reste prioritaire, l'async est secondaire. Les animations sont hors scope V1.

## Scope V1

### Priorite 1 : Fiabilite temps reel
- Corriger les retards de synchro socket.io (reponses/scores)
- Garantir la coherence des scores en cas de latence reseau
- Reconnexion automatique si un etudiant perd la connexion

### Priorite 2 : Nouveaux types de questions
- **Vrai/Faux** : question binaire avec scoring (comme QCM mais 2 options fixes)
- **Reponse courte** : l'etudiant tape une reponse, matching exact ou fuzzy (insensible a la casse, accents, espaces)
- Integration dans le systeme de scoring existant (points Kahoot si correct)

### Priorite 3 : Mode asynchrone
- Le prof cree un quiz async avec deadline
- L'etudiant fait le quiz a son rythme avant la deadline
- Timer global optionnel (X minutes une fois commence)
- Anti-triche basique : melange des questions/reponses, un seul essai
- Pas un examen (outil pedagogique)
- Le resultat est visible par le prof dans les stats

### Priorite 4 : Stats post-session
- Taux de reussite par question (% bonnes reponses)
- Identification des questions les plus ratees
- Vue par session (pas encore par etudiant ou progression multi-sessions)

## Contraintes

- Le live en cours est le coeur, l'async est un bonus
- Pas d'animations complexes en V1 (confettis, morph, etc.)
- Anti-triche basique seulement (melange, un essai, pas de proctoring)
- Compatible avec l'architecture existante : Express + SQLite + Socket.io + Vue 3
- Pas de nouvelle dependance lourde

## Non-objectifs (hors scope V1)

- Animations Kahoot-style (confettis, countdown anime, podium anime)
- Stats multi-sessions / progression etudiant dans le temps
- Export CSV du classement
- Temps moyen de reponse par question
- Mode equipe
- Questions de type classement/association/drag-and-drop
- Integration avec les notes du systeme de devoirs
- Proctoring ou anti-triche avance

## Criteres d'acceptation

- [ ] Un prof peut creer une question vrai/faux et l'envoyer en live
- [ ] Un prof peut creer une question reponse courte avec matching fuzzy
- [ ] Le scoring fonctionne pour vrai/faux et reponse courte (Kahoot points)
- [ ] Les reponses arrivent en < 500ms apres soumission (fiabilite)
- [ ] Un quiz async peut etre cree avec deadline + timer optionnel
- [ ] Un etudiant peut faire un quiz async a son rythme
- [ ] Les questions sont melangees par etudiant en mode async
- [ ] Le prof voit le taux de reussite par question apres une session
- [ ] Les questions les plus ratees sont identifiees visuellement
- [ ] Zero regression sur les 3 types existants (QCM, sondage, nuage)

## Hypotheses exposees et resolues

| Hypothese | Challenge | Resolution |
|-----------|-----------|-----------|
| L'async et le live sont complementaires | "L'async ne va-t-il pas tuer l'interet du live ?" | Le live = engagement en cours (fun, competition). L'async = revision. Roles differents. Le live est prioritaire. |
| Il faut plein de nouveaux types | "Quels types sont vraiment utiles ?" | Vrai/Faux (rapide) et Reponse courte (evaluation) suffisent en V1. Classement/association en V2. |
| Les animations sont essentielles | "Fonctionnalites d'abord ou polish d'abord ?" | V1 = fonctionnalites. Animations en V2. |

## Contexte technique (brownfield)

### Fichiers existants concernes
- `server/db/models/live.js` : ajout types vrai_faux/reponse_courte + matching fuzzy + mode async
- `server/db/schema.js` : migration pour `is_async`, `deadline`, `shuffle_questions` sur live_sessions
- `server/routes/live.js` : nouveaux endpoints async
- `server/socket/index.js` : amelioration fiabilite (retry, ack)
- `src/renderer/src/stores/live.ts` : support async + nouveaux types
- `src/renderer/src/components/live/ActivityForm.vue` : UI nouveaux types
- `src/renderer/src/components/live/StudentLiveView.vue` : UI reponse courte + vrai/faux
- NOUVEAU : `QuizStatsDetail.vue` : taux reussite par question

### Patterns existants a reutiliser
- Scoring Kahoot : `1000 * (1 - answerTime/timerMs * 0.5)` si correct
- Socket throttle : 500ms minimum entre emissions
- Activity states : pending → live → closed
- Upsert reponses : `ON CONFLICT(activity_id, student_id) DO UPDATE`

<details><summary>Transcription de l'interview (7 rounds)</summary>

**Round 1** — Objectif : 3 axes identifies (nouveaux types, mode async, polish UX)
**Round 2** — Types : Vrai/Faux et Reponse courte prioritaires
**Round 3** — Contraintes async : anti-triche basique, pas un examen
**Round 4** — Contradicteur : le live est prioritaire, l'async est secondaire
**Round 5** — Succes : fiabilite > stats > animations
**Round 6** — Simplificateur : V1 = tout sauf animations
**Round 7** — Stats : taux de reussite par question est le minimum indispensable

</details>
