---
subject: Devoirs de groupe — modèle de dépôt v1 (un pour tous)
type: brownfield
rounds: 7
ambiguity: 9%
created: 2026-04-20
---

# Specification : Devoirs de groupe — modèle de dépôt "un pour tous"

## Scores de clarté

| Dimension | Score | Poids | Contribution |
|---|---|---|---|
| Objectif | 0.95 | 35% | 0.3325 |
| Contraintes | 0.95 | 25% | 0.2375 |
| Critères | 0.85 | 25% | 0.2125 |
| Contexte | 0.85 | 15% | 0.1275 |
| **Total clarté** | | | **0.91 (ambiguité 9%)** |

## Objectif

Dans Cursus, un devoir de groupe (`travaux.group_id IS NOT NULL`) doit suivre le modèle **"un dépôt = toute l'équipe a rendu"**. Quand n'importe quel membre dépose, les autres voient ce dépôt dans leur propre vue. La note et le feedback sont partagés entre tous les membres.

Aujourd'hui (v2.198.0), le code fait implicitement **"chaque membre dépose individuellement"** — les depots sont liés à `student_id`, pas au groupe. Conséquence : si Alice dépose, Bob voit "pas rendu" dans sa propre vue, le teacher voit 1/4 au lieu de 1 équipe/1. Ce n'est pas aligné avec la pratique pédagogique réelle CESI et va causer des frictions dès le pilote sept 2026.

## Contraintes (règles v1)

- **Un seul dépôt par (travail, groupe)** : peu importe qui du groupe soumet, il n'y a qu'un objet `depot` pour toute l'équipe.
- **Note et feedback partagés** : la note (A-D) et le feedback texte donnés par le prof s'appliquent identiquement à tous les membres du groupe. Pas de différenciation v1.
- **N'importe quel membre peut écraser** : tous les membres du groupe ont droit de remplacer le dépôt avant la deadline. Simple et démocratique, le groupe se gère en interne.
- **Pas d'historique des versions** : écrasement = perte de la version précédente. Pas de trace "v1 par Alice → v2 par Bob". Acceptable en v1.
- **Vue étudiante cohérente** : Bob voit "Rendu par Alice à 14:00" sur son propre Dashboard / DevoirsView, avec le même fichier/lien qu'Alice.
- **Vue teacher cohérente** : le compteur `depots_count / students_total` compte 1 équipe/1 équipe, pas 1 membre/1 membre (ou, de façon équivalente, compte les 4 membres comme soumis dès qu'un membre dépose).

## Non-objectifs (hors scope v1)

- **Override de note par membre** (free-rider problem) : un membre qui n'a rien fait reçoit la même note A que le groupe. Accepté comme prix de la simplicité. Si le retour terrain pendant le pilote remonte ça comme blocker, add en v2.
- **Feedback individuel différencié** : pas possible v1, tout le monde voit le même feedback.
- **Désignation d'un leader** : pas de rôle "leader de groupe" v1, tous les membres sont égaux.
- **Co-signature / validation** : pas de workflow "Bob doit valider que c'est bien notre rendu" v1.
- **Historique de versions** : perte de la version précédente OK v1.
- **Gestion change de membre post-dépôt** : si un étudiant quitte/rejoint le groupe après dépôt, le comportement est le comportement par défaut du schéma (étudiant retiré perd la visibilité, étudiant ajouté voit le dépôt existant). Pas de logique spéciale.

## Critères d'acceptation

- [ ] Quand Alice (membre du groupe G) dépose pour le travail T (group_id = G), Bob (autre membre de G) voit dans sa vue `StudentDevoirCard` : "Rendu" avec le fichier/lien d'Alice.
- [ ] Le prof voit `depots_count = 1` pour le groupe G (et pas `depots_count = 1` sur 4 étudiants individuels).
- [ ] `students_total` pour ce travail reflète le nombre de groupes concernés (ou équivalent : 1 compteur par groupe), pas le nombre d'étudiants. **À clarifier pendant l'implémentation : l'interprétation la plus simple est de garder students_total = nb membres mais incrémenter depots_count du nb de membres dès qu'un membre dépose, ce qui donne 4/4 visuellement.**
- [ ] Quand le prof note le dépôt "A" + feedback "Super archi", Bob/Chloé/David voient "Note A · Super archi" dans leur vue.
- [ ] Quand Bob remplace le fichier d'Alice avant deadline, Alice voit le nouveau fichier dans sa vue au refresh suivant.
- [ ] Le teacher `markNonSubmittedAsD` ne met **pas** "D" aux membres d'un groupe qui a rendu (actuellement ce bug existe : Alice depot, les 3 autres se prennent "D" au bulk mark).

## Hypothèses exposées et résolues

| Hypothèse | Challenge (contradicteur R5) | Résolution |
|---|---|---|
| "1 dépôt = toute l'équipe" est assez simple pour v1 | Free-rider récupère A sans rien faire → injuste | Accepté comme prix de simplicité. Override en v2 si terrain remonte le problème. |
| Tous les membres peuvent écraser | Si Alice rend un fichier propre et David écrase avec merde, Alice n'a aucun recours | Accepté. Version control = v2. Le groupe se gère en interne. |
| Feedback partagé | Les membres inégaux méritent feedback individuel | Accepté v1, feedback individuel en v2 si besoin. |

## Contexte technique (brownfield)

### Fichiers impactés

**Backend DB (server/db/)** :
- `schema.js` : potentielle migration v77 — ajouter `group_id` sur `depots` ? OU laisser `depots.student_id` et normaliser via `travail_group_members` ?
- `models/assignments.js` : `getTravaux` / `getGanttData` / `getStudentTravaux` / `getTravauxSuivi` doivent refléter le modèle "groupe". `markNonSubmittedAsD` doit skiper les membres dont un membre du groupe a déjà rendu.
- `models/submissions.js` (ou équivalent) : la création de dépôt doit savoir si travail.group_id → écrit un seul dépôt pour le groupe (logique à designer).

**Frontend (src/renderer/src/)** :
- `stores/travaux.ts` : `devoirs.filter((t) => t.depot_id == null && ...)` — la logique "a-t-il déposé" pour l'étudiant doit considérer le dépôt du groupe.
- `composables/useDevoirsStudent.ts` : idem.
- `components/devoirs/StudentDevoirCard.vue` : affichage "Rendu par Alice" vs "Rendu" simple.
- `components/modals/DepotsModal.vue` : côté prof, grouper les dépôts par groupe, pas par étudiant.
- `components/modals/SuiviModal.vue` : suivi par équipe, pas par étudiant, pour les travaux de groupe.

### Schéma actuel à examiner

```sql
depots (id, travail_id, student_id, file_name, file_path, link_url, deploy_url, note, feedback, submitted_at)
travaux (id, promo_id, channel_id, group_id, ...)
travail_group_members (travail_id, student_id, group_id)  -- junction pour savoir qui est dans quel groupe pour ce travail
group_members (group_id, student_id)  -- appartenance globale au groupe
```

### 2 pistes d'implémentation pour la migration

**Piste A : ajouter `group_id` à `depots` (denormalisation)**
- Simple à écrire, simple à query.
- Pour un travail de groupe : un seul row dans `depots` avec `group_id` set, `student_id` = l'auteur (pour traçabilité).
- Migration : `ALTER TABLE depots ADD COLUMN group_id INTEGER REFERENCES groups(id)`.

**Piste B : table `group_depots` séparée**
- Plus propre conceptuellement (1 table = 1 unité).
- Plus de code à refactorer (2 chemins pour "rendu" : individuel vs groupe).
- Pas recommandé v1.

**Recommandation** : piste A, migration DB v77, + garde-fou backend pour que tout create/select dépot de groupe route via la bonne logique.

## Bugs collatéraux déjà identifiés pendant l'interview

- `markNonSubmittedAsD(travailId)` (assignments.js:270-294) dans le code actuel : `SELECT s.id FROM students s LEFT JOIN depots d ON d.travail_id = ? AND d.student_id = s.id WHERE s.promo_id = ? AND d.id IS NULL` — ignore complètement la logique de groupe. Un membre dont son groupe a rendu (via un autre membre) se retrouve quand même marqué D. **C'est un bug prod potentiel**.

## Transcription

<details><summary>Voir les 7 Q&R</summary>

**Round 1** — Zone de stress max → UX étudiant (dépôt / visibilité)
**Round 2** — Étape critique → Faire le dépôt lui-même
**Round 3** — Scénario qui flippe → Dépôt de groupe
**Round 4** — Modèle conceptuel → 1 dépôt = toute l'équipe a rendu
**Round 5** — Propagation note → Même note + même feedback pour tous
**Round 6** — Challenge contradicteur free-rider → Pas maintenant, voir en v2
**Round 7** — Re-upload → N'importe quel membre écrase, pas d'historique v1

</details>
