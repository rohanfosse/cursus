<h1 align="center">Cursus</h1>

<p align="center">
  <strong>La plateforme de communication pensée pour l'enseignement.</strong>
  <br />
  Messagerie, travaux, documents - tout au même endroit.
</p>

<p align="center">
  <a href="https://github.com/rohanfosse/slack-like-electron/actions"><img src="https://img.shields.io/github/actions/workflow/status/rohanfosse/slack-like-electron/release.yml?style=flat-square&label=build" alt="Build" /></a>
  <a href="https://github.com/rohanfosse/slack-like-electron/releases"><img src="https://img.shields.io/github/v/release/rohanfosse/slack-like-electron?style=flat-square&label=version" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/rohanfosse/slack-like-electron?style=flat-square" alt="License" /></a>
  <a href="https://github.com/rohanfosse/slack-like-electron/stargazers"><img src="https://img.shields.io/github/stars/rohanfosse/slack-like-electron?style=flat-square" alt="Stars" /></a>
</p>

<p align="center">
  <a href="https://cursus.devrohan.cloud">Site web</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/rohanfosse/slack-like-electron/issues">Issues</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/rohanfosse/slack-like-electron/releases">Releases</a>
</p>

<br />

## Pourquoi Cursus ?

Les formations s'appuient sur un patchwork d'outils : mails institutionnels, groupes WhatsApp, Moodle, dossiers partagés sur Teams ou Drive. Chaque outil couvre un besoin, mais aucun ne couvre le quotidien. Les étudiants ratent des annonces parce qu'elles sont sur le mauvais canal. Les enseignants passent plus de temps à relancer qu'à accompagner. Les deadlines se perdent entre trois plateformes.

Cursus part d'un constat simple : **une promo a besoin d'un seul endroit pour communiquer, déposer du travail et accéder à ses ressources**. L'application remplace la dispersion par un espace unifié, accessible en version desktop (Electron) et en version web (PWA).

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Moins de friction</strong><br />
      L'interface est construite pour que chaque action soit à un ou deux clics. Un étudiant qui ouvre l'application voit directement ses canaux, ses devoirs en cours et ses documents.
    </td>
    <td width="33%" valign="top">
      <strong>Droit à l'erreur</strong><br />
      Un étudiant peut remplacer son rendu avant l'échéance sans demander à l'enseignant. Après la deadline, les dépôts se verrouillent automatiquement.
    </td>
    <td width="33%" valign="top">
      <strong>Plus de temps pour l'humain</strong><br />
      Grilles d'évaluation par critères, notation par lettres, export CSV. L'enseignant passe moins de temps sur la logistique et plus sur les retours qualitatifs.
    </td>
  </tr>
</table>

<br />

## Fonctionnalités

### Messagerie

Canaux publics organisés par promotion ou par thématique. Canaux d'annonce en lecture seule pour les communications officielles. Messages privés entre étudiants ou avec les enseignants. Chaque message supporte les réponses avec citation du message d'origine, les réactions par emoji, l'épinglage (jusqu'à 5 par canal) et les mentions `@nom` ou `@everyone` avec compteur de non-lus. La recherche plein texte permet de retrouver n'importe quel message dans un canal. Les notifications de bureau signalent les mentions et les messages directs.

### Travaux et évaluation

L'enseignant crée un devoir en choisissant son type (livrable, soutenance, CCTL, étude de cas, mémoire) et sa date limite. Un mode brouillon permet de préparer un devoir sans le rendre visible. Une fois publié, les étudiants déposent leur travail depuis l'application. Les dépôts sont automatiquement bloqués après l'échéance, sauf pour les soutenances et CCTL qui suivent un calendrier différent.

Chaque devoir peut avoir sa propre grille d'évaluation multicritères avec pondération. La notation se fait par lettres (A à F) directement depuis la liste des rendus, avec possibilité d'ajouter un commentaire de retour individuel. Les notes sont exportables en CSV pour intégration dans les outils de scolarité.

### Documents et ressources

Fichiers et liens externes attachés à un canal ou à un projet entier. Les documents peuvent être catégorisés et décrits. La visionneuse intégrée ouvre les PDF, les images, les documents Word (.docx) et les tableurs Excel (.xlsx) sans quitter l'application.

### Promotions et groupes

Chaque promotion dispose de sa couleur et de ses canaux dédiés. Les groupes de travail sont créés par l'enseignant avec des membres assignés, un canal privé automatique et des devoirs ciblés. L'import en masse des étudiants se fait par fichier CSV.

### Dashboard enseignant

Vue d'ensemble de l'avancement des dépôts par promotion avec indicateurs visuels. Frise chronologique des jalons (deadlines, soutenances, examens). Rappels automatiques envoyés la veille de chaque échéance. Analytique par promotion : répartition des notes, taux de dépôt, activité récente.

### Dashboard étudiant

Vue personnalisée avec les devoirs à rendre classés par urgence, les notes reçues (système A/B/C/D), les annonces récentes et l'accès rapide aux canaux et documents de sa promotion.

<br />

## Démarrage rapide

**Prérequis** : Node.js 18+ et npm.

```bash
git clone https://github.com/rohanfosse/slack-like-electron.git
cd slack-like-electron
npm install
```

Lancer en développement :

```bash
npm run dev
```

Construire l'exécutable :

```bash
npm run build
```

La base de données SQLite est créée automatiquement au premier lancement dans le répertoire utilisateur. Pour charger des données de démonstration, ouvrir le panneau d'administration et utiliser **Réinitialiser et peupler**.

<br />

## Version web

L'application est aussi disponible en version web (PWA), déployée automatiquement à chaque push sur `main`. Le build web utilise un shim qui remplace les appels IPC Electron par des requêtes HTTP vers le serveur Node.js.

```bash
npm run build:web
```

Les fichiers sont générés dans `dist-web/` et servis par le serveur Express intégré.

<br />

## Stack technique

| Couche | Technologie |
|--------|------------|
| Desktop | Electron 29, context isolation, Node integration désactivé côté renderer |
| Frontend | Vue 3 (Composition API), TypeScript, Pinia, Vue Router |
| Base de données | SQLite via Better-SQLite3, schéma versionné avec migrations |
| Build | electron-vite + Vite, packaging via electron-builder |
| Serveur web | Express, Socket.IO pour le temps réel, déployé derrière Nginx |

<br />

## Licence

MIT - voir le fichier [LICENSE](LICENSE) pour les détails.

Projet développé par [Rohan Fossé](https://github.com/rohanfosse)
