---
subject: Mini-jeu TypeRace + leaderboard Cursus
type: brownfield
rounds: 7
ambiguity: 12%
created: 2026-04-19
---

# Specification : Mini-jeu TypeRace + leaderboard

## Scores de clarte finaux

| Dimension   | Score | Poids | Contribution |
|-------------|-------|-------|-------------|
| Objectif    | 0.95  | 35%   | 0.333 |
| Contraintes | 0.90  | 25%   | 0.225 |
| Criteres    | 0.80  | 25%   | 0.200 |
| Contexte    | 0.80  | 15%   | 0.120 |

**Ambiguite finale : 12%** (seuil de clarte : 20%)

---

## Objectif

Jeu de typing speed en francais, solo asynchrone, leaderboard brut, integre
au Dashboard etudiant. **Seul objectif** : creer un sujet de chambrage
spontane entre etudiants ("personne bat Paul ce mois-ci", "Marie fait 90 WPM
c'est pas humain"). Pousser l'usage de l'app est un effet de bord accepte
mais **non metrique**.

Mecanique : pour chaque partie, une phrase FR aleatoire (domaine public +
memes CESI internes) apparait. 60 secondes max pour la taper. Score =
WPM x precision.

## Contraintes

- **Empreinte UI minimale** : 1 widget sur le Dashboard etudiant + 1 route
  plein ecran `/typerace`. Pas d'entree sidebar, pas de notif push.
- **Zero curation hebdomadaire** : banque de ~100 phrases FR figee au lancement,
  ajoutable plus tard mais non obligatoire. Phrases aleatoires sans repetition
  immediate (garder les 20 dernieres en localStorage pour anti-rejeu perso).
- **Leaderboard brut assume** : pas de handicap, pas de progression. Le
  meilleur typer gagne. Le design social repose sur le chambrage autour,
  pas sur l'equite.
- **Re-jouable sans limite** : chaque partie est enregistree, le leaderboard
  affiche le **meilleur score du jour** par etudiant (pas la moyenne). Le
  `meilleur score all-time` par etudiant est visible dans l'historique perso.
- **Desktop-first** : clavier physique. Mobile fonctionnel mais non prioritaire
  (clavier virtuel penalise, c'est accepte).
- **Budget dev** : 1 a 2 weekends. Pas de dependance externe nouvelle.
- **Pas d'integration chat automatique en MVP** : les etudiants partagent
  leurs scores manuellement (screenshot, comme les debuts de Wordle). Une
  integration chat pourra etre ajoutee en v2 si le jeu prend.

## Non-objectifs (hors scope MVP)

- Temps reel / multijoueur / matchmaking
- Defis quotidiens avec thematique (les phrases sont independantes du jour)
- Achievements / badges / systeme de ranks ou de saisons
- Auto-post des scores dans un canal chat
- Classement inter-promos (le leaderboard est **par promo** pour preserver le
  sens de la competition a petite echelle)
- Tournois, evenements, modes speciaux
- Anti-triche rigoureux (copier-coller bloque, c'est tout ; on assume la
  bonne foi pour 50 etudiants)

## Criteres d'acceptation

- [ ] **Participation hebdo** : >=60% des etudiants de chaque promo jouent
      au moins 1 fois par semaine pendant le premier mois = garde.
      30-60% = itere (revoir la visibilite ou le genre). <30% = sabre.
- [ ] Le widget Dashboard affiche : top 3 du jour (nom + WPM) + mon meilleur
      score de la semaine + un CTA "Jouer".
- [ ] Une partie dure <= 60 secondes chrono, demarre en 1 clic, affiche le
      score instantanement + la position dans le leaderboard du jour.
- [ ] Le leaderboard du jour se remet a zero a minuit (fuseau Europe/Paris).
- [ ] Les scores persistent individuellement : chaque etudiant voit son
      historique perso avec graphique d'evolution.
- [ ] Un prof peut jouer (compte teacher) mais **n'apparait pas** dans le
      leaderboard etudiant (filtrage cote query).
- [ ] 100 phrases FR seedees au lancement, longueur 40-120 caracteres chacune.
- [ ] Accessibilite : zone de saisie `aria-label`, focus clavier a l'ouverture,
      timer visible et annonce en fin de partie.
- [ ] Les parties sont tracees dans engagement (participation compte comme
      activite recente, bonus minime genre +0.5/partie capee a 3/jour).

## Hypotheses exposees et resolues

| Hypothese | Challenge (Round 5 Contradicteur) | Resolution |
|-----------|----------------------------------|-----------|
| "Le jeu stimulera la cohesion" | Le top-typer ecrasera chaque jour, les derniers arreteront = inverse de l'objectif | **Assume** : le chambrage se fera autour du dominant, pas malgre lui. Pattern culturel constate (cf. Wordle, Strava). |
| "Arcade = zero contenu" (Round 3) | Typing race demande une banque de phrases FR | Cap a 100 phrases figees (3-4h de curation une fois, pas de maintenance) |
| "Widget Dashboard suffit pour le trash-talk" (Round 7) | Sans integration chat auto, le trash-talk doit etre manuel (screenshot) | Assume : pattern Wordle initial. V2 pourra ajouter un bouton "Partager dans le chat" si justifie par la metric |

## Contexte technique (brownfield)

**Pattern a suivre** (widgets Dashboard etudiant) :
- `src/renderer/src/views/DashboardView.vue` — vue racine
- `src/renderer/src/components/dashboard/StudentBento.vue:109-149` — composition
- `src/renderer/src/components/dashboard/registry.ts:52` — registre des widgets
- `src/renderer/src/components/dashboard/student-widgets/` — dossier cible pour
  le nouveau `WidgetTypeRace.vue`
- Tailles existantes : `2x2`, `2x1`, `1x1`. Recommande `2x1` (top 3 + CTA)
  ou `1x1` (CTA + mon score, details en modal)

**Composant reutilisable** :
- `src/renderer/src/components/live/Leaderboard.vue` — medal icons + couleurs
  or/argent/bronze deja definies (`['#eab308', '#94a3b8', '#c2884d']`). Reuser
  ou adapter. Actuellement couple a `live_scores`, donc une version generique
  `<LeaderboardList>` pourrait etre extraite.

**Engagement tracking** (existant, a etendre) :
- `server/db/models/engagement.js` lignes 1-92 — `computeEngagementScores`
  prend en compte messages + assignments. Ajouter un petit bonus pour
  participation TypeRace (cap a 3 parties/jour pour eviter farm).

**Nouvelle migration requise (v73)** :
```sql
CREATE TABLE typerace_scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_type   TEXT NOT NULL CHECK(user_type IN ('student','teacher')),
  user_id     INTEGER NOT NULL,
  promo_id    INTEGER,                          -- null pour teachers
  phrase_id   INTEGER NOT NULL,
  wpm         REAL NOT NULL,                    -- mots par minute
  accuracy    REAL NOT NULL,                    -- 0.0 a 1.0
  score       INTEGER NOT NULL,                 -- round(wpm * accuracy)
  duration_ms INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_typerace_user_day ON typerace_scores(user_type, user_id, created_at);
CREATE INDEX idx_typerace_promo_day ON typerace_scores(promo_id, created_at);
```

**Banque de phrases** : fichier JSON statique `server/data/typerace-phrases-fr.json`
(pas de table SQL — pas de CRUD a offrir aux profs en MVP).

**Routes backend** (nouveau `server/routes/typerace.js`) :
- `GET /api/typerace/phrases/random` — renvoie une phrase (id + texte) avec
  exclusion des N dernieres ids vues (via query param `exclude=1,2,3`)
- `POST /api/typerace/scores` — { phraseId, wpm, accuracy, durationMs } avec
  validation Zod (wpm 0-300, accuracy 0-1, durationMs <= 65000). Anti-triche
  cote serveur : verifier que `wpm ~= mots_dans_phrase / (durationMs/60000)`.
- `GET /api/typerace/leaderboard?scope=day|week|all&promoId=X` — top 10,
  filtre les teachers, agregation "meilleur score par user dans la fenetre".
- `GET /api/typerace/me` — historique perso + stats (meilleur all-time,
  courbe evolution 30 derniers jours).

**IPC** (preload + api-shim + env.d.ts) : 4 endpoints correspondants.

## Plan de livraison suggere (2 weekends)

**Weekend 1 — Backend + mecanique**
- Migration v73 + modele `typerace.js`
- Fichier JSON 100 phrases FR (citations, proverbes, extraits domaine public)
- 4 routes backend + tests
- Anti-triche basique (copy-paste detection cote front + coherence durationMs/wpm cote back)

**Weekend 2 — Frontend**
- Vue plein ecran `TypeRaceView.vue` avec route `/typerace`
- Composant jeu : phrase affichee, zone saisie, timer, coloration erreurs
- `WidgetTypeRace.vue` + enregistrement registry + StudentBento
- Extraction `<LeaderboardList>` generique depuis `live/Leaderboard.vue`
- E2E : flow lancer -> taper -> voir score -> voir leaderboard

## Transcription

<details>
<summary>Voir les 7 rounds de Q&R</summary>

**Round 1** (Objectif, 35%) — Boussole du succes ?
> Rigolades + trash-talk → design cohesion/social

**Round 2** (Objectif, suite) — Moment social pendant ou autour du jeu ?
> Autour du jeu (solo + buzz) → pattern Wordle-like, pas de temps reel

**Round 3** (Contraintes) — Genre de jeu avec contrainte contenu ?
> Score-arcade (reflexe/skill) → procedural, zero curation contenu

**Round 4** (Contraintes, precision) — Mecanique arcade precise ?
> Typing Speed (FR) → discrimination forte, mais contenu limite (100 phrases)

**Round 5** (Contraintes) — MODE CONTRADICTEUR : Comment proteger la cohesion du
top-typer dominant ?
> J'assume : leaderboard brut → choix eclaire, pattern culturel connu

**Round 6** (Criteres) — Metric de decision garde/sabre ?
> Participation hebdo (>= 60% de la promo par semaine)

**Round 7** (Contexte) — MODE SIMPLIFICATEUR : Empreinte UI minimale ?
> Widget Dashboard + route dediee → pas de sidebar, pas de notif push

</details>
