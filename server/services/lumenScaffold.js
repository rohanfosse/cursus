/**
 * Template fige du scaffold "Nouveau cours" Lumen.
 *
 * Le contenu est inline en dur (pas de fichiers a lire sur disque) pour
 * que le scaffold soit deployable n'importe ou et que le builder Electron
 * embarque le template sans configuration. Si tu changes le pattern de
 * tes blocs, modifie ces constantes — pas de systeme de templates
 * pluggable, c'est volontaire (cf. spec deep-interview-lumen-scaffold).
 *
 * Le scaffold ne contient pas de cursus.yaml : l'auto-manifest (v2.43)
 * gere les nouveaux repos sans manifest. Le prof peut toujours en ajouter
 * un plus tard pour reprendre la main.
 */

/**
 * Genere les fichiers du scaffold pour un nouveau cours.
 * @param {{ blocTitle: string }} params
 * @returns {Array<{path: string, content: string}>}
 */
function buildScaffoldFiles({ blocTitle }) {
  // Strip backticks/newlines pour eviter qu'un titre malicieux casse le H1
  // (ex: "foo\n\n# something" cree un faux titre dans le markdown).
  const title = (blocTitle || '').replace(/[`\n\r]/g, '').trim() || 'Nouveau bloc'

  const readme = `# ${title}

## Introduction

TODO — Decris en quelques lignes l'objectif general du bloc, les competences
visees et le contexte dans lequel il s'inscrit.

## Deroulement

### Activites Autonomes (AA)

- TODO

### Boucles PBL

- TODO

### Phases du projet

| Phase | Description | Periode indicative |
|-------|-------------|--------------------|
| TODO  | TODO        | TODO               |

## Livrables

- TODO
`

  const projet = `# Projet fil rouge

## 1. Presentation du projet

TODO — Contexte, parties prenantes, enjeux. Une page max.

## 2. Besoins

TODO — Liste des besoins fonctionnels et non-fonctionnels.

## 3. Cahier des charges

TODO — Specifications techniques, contraintes, livrables attendus.

## 4. Criteres d'evaluation

TODO
`

  const processDaily = `# Processus Daily Scrum

Ce document definit la routine quotidienne de votre equipe. L'objectif est de
vous aligner rapidement le matin et de valider l'avancement le soir.

**Ou poster :** Canal Slack de votre groupe.
**Format :** Copiez-collez les modeles ci-dessous et remplissez vos sections.

---

## 1. Daily du Matin (Lancement)

**Quand :** En debut de journee (avant 9h30).
**Duree :** 15 min max.
**Action :** Chaque membre remplit sa section et la poste sur le canal.

\`\`\`text
DAILY SCRUM - MATIN

-- [Votre nom] --
Hier : [Taches terminees hier]
Aujourd'hui : [1 objectif principal pour la journee]
Blocages : Aucun / [Besoin d'aide sur...]
\`\`\`

---

## 2. Daily du Soir (Cloture)

**Quand :** En fin de journee (vers 16h00).
**Duree :** 10 min max.
**Action :** Verifiez vos objectifs et mettez a jour votre tableau de taches.

\`\`\`text
DAILY SCRUM - SOIR

-- [Votre nom] --
Objectif atteint : Oui / Non
Outil de suivi a jour : Oui / Non
Priorite pour demain : [Tache a demarrer demain matin]
\`\`\`

---

## Regles d'or

1. **Soyez brefs :** Ce n'est pas un rapport detaille, c'est un point de synchro.
2. **Soyez honnetes :** Si un objectif n'est pas atteint, indiquez "Non" et pourquoi.
3. **Mettez a jour vos outils :** Votre tableau de gestion de projet doit
   toujours refleter l'etat reel du travail.
`

  const prositExemple = `# Prosit 1 - [Theme du prosit]

**Type :** Prosit — **Theme :** TODO

## Contexte

TODO — Le scenario qui motive le prosit. 3-5 lignes pour planter le decor
sans donner la solution.

## Mots cles

- TODO
- TODO
- TODO

## Questions

1. TODO
2. TODO
3. TODO

## Generalisation

TODO — Une fois le prosit resolu, quelle est la regle generale qu'on retient ?
Quel concept theorique a-t-on cristallise ?

## Application

TODO — Donne un mini-exercice ou une mise en situation differente pour que
l'etudiant teste si son modele mental tient.

## Pour aller plus loin

- TODO (lien, ressource, lecture)
`

  return [
    { path: 'README.md',                       content: readme },
    { path: 'projet.md',                       content: projet },
    { path: 'process-daily.md',                content: processDaily },
    { path: 'prosits/1-exemple.md',            content: prositExemple },
    // Dossiers vides : .gitkeep est la convention pour qu'un dossier
    // existe en git sans contenir de vrai fichier.
    { path: 'workshops/.gitkeep',              content: '' },
    { path: 'guides/.gitkeep',                 content: '' },
    { path: 'guides/methodologie/.gitkeep',    content: '' },
    { path: 'mini-projet/.gitkeep',            content: '' },
  ]
}

module.exports = { buildScaffoldFiles }
