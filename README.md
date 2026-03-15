# Plateforme de Communication pour l'Enseignement

Ce projet est une application de bureau collaborative conçue spécifiquement pour le milieu éducatif. Elle associe la réactivité d'une messagerie instantanée à la structure d'un environnement d'apprentissage numérique, offrant ainsi un espace de travail optimisé pour les étudiants et les équipes pédagogiques.

## Philosophie du projet

L'application a été pensée et développée autour de trois axes majeurs :

* Réduction de la charge cognitive : Une interface minimaliste basée sur une navigation contextuelle (barre supérieure, palette de commandes globale) pour limiter les distractions et recentrer l'attention sur l'apprentissage.
* Droit à l'erreur : Un système de dépôt de travaux sécurisant, offrant aux étudiants la possibilité d'annuler ou de remplacer un rendu de manière autonome avant son échéance.
* Optimisation du temps de correction : Des fonctionnalités d'évaluation rapide permettant aux enseignants de privilégier la rédaction de retours qualitatifs plutôt que la simple saisie de notes.

## Fonctionnalités principales

### Espace Étudiant

* Tableau de bord centralisé : Suivi direct de la progression du semestre, des jalons et des travaux en attente.
* Soumission de travaux simplifiée : Prise en charge du glisser-déposer et de l'intégration de liens externes (dépôts de code, maquettes web), avec gestion d'un délai de rétractation.
* Consultation intégrée : Visionneuse de documents native permettant de lire des consignes ou des ressources pédagogiques sans quitter le fil de discussion.

### Espace Enseignant

* Évaluation rapide : Notation fluide (système par lettres) directement depuis la liste des rendus, accompagnée d'un module de commentaires rapides.
* Suivi de promotion : Vue d'ensemble des groupes permettant d'identifier immédiatement les étudiants en retard et d'analyser la répartition des résultats.
* Gestion de la communication : Épinglage des informations essentielles et structuration des échanges pour faciliter le suivi individuel.

### Ergonomie et Navigation

* Fils de discussion : Isolement des réponses spécifiques pour maintenir la lisibilité des canaux principaux.
* Palette de commandes : Raccourci clavier global permettant une navigation instantanée entre les cours, les discussions et les devoirs.
* Interface modulable : Panneaux latéraux redimensionnables pour adapter l'espace de travail à la taille de l'écran.

## Technologies utilisées

Le projet repose sur des standards web encapsulés pour une utilisation native sur ordinateur, garantissant de bonnes performances et une intégration fluide au système d'exploitation.

* Environnement d'exécution : Electron.js (basé sur Node.js et Chromium)
* Interface utilisateur : HTML5, CSS3 (variables natives) et JavaScript natif (Modules ES6)
* Approche design : Composants épurés, interface en mode sombre par défaut, iconographie vectorielle allégée.

## Installation et démarrage

Pour configurer et lancer le projet en environnement de développement local :

1. Cloner le dépôt sur votre machine.
2. Installer les dépendances requises via le terminal :
```bash
npm install

```


3. Lancer l'application :
```bash
npm start

```