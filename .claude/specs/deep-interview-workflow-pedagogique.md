---
subject: Workflow pedagogique reel de Rohan au CESI
type: greenfield
rounds: 9
ambiguity: 17%
created: 2026-03-30
---

# Specification : Workflow pedagogique reel

## Scores de clarte

| Dimension | Score | Poids | Contribution |
|-----------|-------|-------|-------------|
| Objectif | 0.90 | 40% | 0.36 |
| Contraintes | 0.80 | 30% | 0.24 |
| Criteres de succes | 0.75 | 30% | 0.23 |
| **Total** | | | **0.83 (17% ambiguite)** |

## Profil enseignant

Rohan est **Responsable de promotion** au CESI (pas juste prof d'une matiere). Il gere :
- **2 promotions** simultanement
- **~4 projets/an/promo** (8 au total), sequentiels en informatique
- Des projets transversaux longs (maths, anglais) en parallele sur le semestre/annee
- Communication actuelle : **Slack** (limite 90 jours sur messages/docs) + presentiel

## Workflow type d'un devoir

Le cycle est **lineaire et simple** :

```
Creer -> Publier -> Attendre la deadline -> Noter tout d'un coup
```

- Pas de brouillons iteratifs (sauf pour la publication programmee)
- Pas de rappels systematiques (ponctuels si besoin)
- Le suivi temps reel des rendus est utile pour les documents longs (memoires, fiches de validation)

### Besoin identifie : Publication programmee

Rohan cree parfois des devoirs a l'avance et veut **programmer la date de publication** pour ne pas surcharger les etudiants. Cette feature n'existe pas dans Cursus aujourd'hui.

## Systeme de notation CESI

### Regles fondamentales
- **Toujours en lettres** : A, B, C, D. Jamais de note /20 au CESI.
- **Toujours avec grille d'evaluation** : les criteres viennent du **referentiel national CESI**, pas de l'enseignant
- **Les CCTL ne sont PAS notes par l'enseignant** : c'est le national qui gere et injecte dans le dossier de synthese

### Par type de devoir
| Type | Note par Rohan ? | Format | Grille |
|------|-----------------|--------|--------|
| CCTL | Non (national) | - | - |
| Soutenance | Oui | Lettre A-D | Referentiel national |
| Etude de cas | Oui | Lettre A-D | Referentiel national |
| Livrable | Oui | Lettre A-D | Referentiel national |
| Memoire | Oui | Lettre A-D | Referentiel national |

### Session de notation
- Notation **directement dans Cursus** (pas de papier/Excel intermediaire)
- **Note + commentaire court** par etudiant
- Parfois renvoi de la grille d'evaluation remplie
- Complement en presentiel si necessaire
- UX de notation = zone critique (c'est la ou le prof passe du temps)

## Communication

- **Presentiel + Slack** aujourd'hui
- Pain point majeur : **Slack limite a 90 jours** pour messages et documents, perte de suivi
- Cursus = Slack sans la limite, avec devoirs integres
- Les rappels existent dans Cursus, utilises ponctuellement (pas systematiquement)

## Implications pour Cursus

### Features manquantes identifiees
1. **Publication programmee** : champ `scheduled_publish_at` sur les devoirs, publication automatique a la date prevue
2. **Import de grilles referentiel** : pouvoir charger les grilles nationales plutot que les saisir manuellement

### Features sur-dimensionnees pour le CESI
1. **Notation /20** : inutile au CESI (garder pour l'open core multi-ecoles)
2. **Creation de rubrique from scratch** : les grilles viennent du national, l'enseignant les applique
3. **Rappels elabores** : le constructeur de rappel est complet mais rarement utilise

### Priorites UX
1. **Notation rapide en lot** : ouvrir un depot, lire, mettre A/B/C/D + commentaire, passer au suivant sans friction
2. **Vue multi-promo** : gerer 2 promos sans switcher constamment
3. **Historique persistant** : garantir que les messages et docs ne disparaissent jamais (avantage vs Slack)
4. **Suivi des rendus** : savoir qui a rendu, qui manque, surtout pour les documents longs

## Hypotheses exposees et resolues

| Hypothese | Challenge | Resolution |
|-----------|-----------|-----------|
| "L'enseignant cree ses grilles" | Les grilles viennent-elles du prof ou du referentiel ? | Du referentiel national CESI, l'enseignant les applique |
| "Les CCTL sont notes dans Cursus" | Qui note les CCTL ? | Le national, pas l'enseignant. La note est injectee dans le dossier |
| "Les rappels sont essentiels" | Le prof envoie-t-il des rappels regulierement ? | Non, ponctuellement. Le workflow est lineaire |
| "1 promo = le cas d'usage" | Combien de promos gere-t-il ? | 2 promos, ~8 projets/an au total |
| "La notation /20 est importante" | Quel format de note au CESI ? | Toujours lettres A-D, jamais /20 |
| "Le feedback est ecrit" | Comment le retour etudiant se fait ? | Note + commentaire court + parfois grille + complement presentiel |
| "Slack est secondaire" | Quel est le pain point communication ? | Slack a une limite de 90 jours, les messages et docs disparaissent |
| "Publication immediate" | Le prof publie-t-il toujours immediatement ? | Non, il veut parfois programmer la publication a l'avance |

## Transcription

<details><summary>Voir les Q&R</summary>

**Round 1 -- Objectif** : Quels types de devoirs donnes-tu reellement ?
-> Mix equilibre entre epreuves en salle et rendus projet

**Round 2 -- Objectif** : Comment notes-tu concretement ?
-> CCTL non notes par moi (national). Etudes de cas, soutenances, livrables = grille d'evaluation + lettre A/B/C/D. Jamais de /20 au CESI.

**Round 3 -- Objectif** : Quel est ton parcours de creation a notation ?
-> Creer -> Publier -> Attendre -> Noter (lineaire)

**Round 4 -- Contradicteur** : Les rappels et le suivi temps reel sont-ils du luxe ?
-> Rappels utiles ponctuellement. Suivi temps reel utile pour memoires/fiches. Brouillons utiles pour creer a l'avance. BESOIN : publication programmee.

**Round 5 -- Contraintes** : Comment se passe une session de notation ?
-> Directement dans Cursus, pas d'intermediaire

**Round 6 -- Simplificateur** : D'ou viennent les grilles d'evaluation ?
-> Du referentiel national CESI, pas de l'enseignant

**Round 7 -- Criteres** : Comment communiques-tu avec les etudiants ?
-> Presentiel + Slack. Pain point : Slack limite a 90 jours pour messages et docs.

**Round 8 -- Criteres** : A quoi ressemble ta semaine type ?
-> 2 promos, ~4 projets/an/promo, projets sequentiels en info + transversaux en parallele

**Round 9 -- Criteres** : Comment se fait le retour aux etudiants ?
-> Note lettre + commentaire court, parfois grille remplie, complement presentiel si besoin

</details>
