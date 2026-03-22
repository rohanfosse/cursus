<p align="center">
  <img src="src/renderer/src/assets/logo.png" alt="Cursus" width="80" />
</p>

<h1 align="center">Cursus</h1>

<p align="center">
  Plateforme pedagogique tout-en-un pour l'enseignement superieur.<br />
  Messagerie, devoirs, quiz en direct, documents. Un seul espace pour toute la promotion.
</p>

<p align="center">
  <a href="https://github.com/rohanfosse/cursus/actions"><img src="https://img.shields.io/github/actions/workflow/status/rohanfosse/cursus/test.yml?style=flat-square&label=tests&logo=vitest&logoColor=white" alt="Tests" /></a>
  <a href="https://github.com/rohanfosse/cursus/actions"><img src="https://img.shields.io/badge/typecheck-strict-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://github.com/rohanfosse/cursus/releases"><img src="https://img.shields.io/github/v/release/rohanfosse/cursus?style=flat-square&label=version&color=22c55e" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/rohanfosse/cursus?style=flat-square" alt="License" /></a>
  <a href="https://github.com/rohanfosse/cursus/stargazers"><img src="https://img.shields.io/github/stars/rohanfosse/cursus?style=flat-square" alt="Stars" /></a>
  <a href="https://app.cursus.school"><img src="https://img.shields.io/website?url=https%3A%2F%2Fapp.cursus.school&style=flat-square&label=app&logo=statuspage&logoColor=white" alt="App Status" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue_3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/SSL-A+-22c55e?style=flat-square&logo=letsencrypt&logoColor=white" alt="SSL A+" />
</p>

<p align="center">
  <a href="https://app.cursus.school">Application</a>
  &nbsp;&middot;&nbsp;
  <a href="https://cursus.school">Site web</a>
  &nbsp;&middot;&nbsp;
  <a href="https://admin.cursus.school">Administration</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/rohanfosse/cursus/releases">Telecharger</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/rohanfosse/cursus/discussions">Discussions</a>
</p>

<br />

## Le probleme

Les formations s'appuient sur un patchwork d'outils : mails, groupes WhatsApp, Moodle, dossiers partages sur Teams ou Drive. Les etudiants ratent des annonces, les deadlines se perdent, les enseignants passent plus de temps a relancer qu'a accompagner.

**Cursus reunit tout dans un seul endroit** : messagerie, devoirs, quiz, documents. Accessible en desktop (Electron), en web (PWA) et sur mobile.

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>Moins de friction</h4>
      Chaque action est a un ou deux clics. L'etudiant voit directement ses canaux, ses devoirs et ses documents.
    </td>
    <td width="33%" valign="top">
      <h4>Droit a l'erreur</h4>
      L'etudiant remplace son rendu avant l'echeance sans intervention. Apres la deadline, les depots se verrouillent.
    </td>
    <td width="33%" valign="top">
      <h4>Plus de temps pour l'humain</h4>
      Grilles d'evaluation, notation par lettres, export CSV. Moins de logistique, plus de retours qualitatifs.
    </td>
  </tr>
</table>

<br />

## Fonctionnalites

### Messagerie temps reel

Canaux par promotion, canaux d'annonce en lecture seule, messages prives. Reponses avec citation, reactions emoji, epinglage, mentions `@nom` et `@everyone`, recherche plein texte, notifications desktop. Commandes slash integrees : `/devoir`, `/doc`, `/annonce`, `/sondage`, `/code`.

### Devoirs et evaluation

Cinq types de devoirs : livrable, soutenance, CCTL, etude de cas, memoire. Mode brouillon, blocage automatique apres deadline, grilles multicriteres avec ponderation, notation A-F depuis la liste des rendus, feedback individuel, export CSV. Notifications en temps reel a l'etudiant des qu'une note est attribuee.

### Quiz en direct

Sessions interactives avec trois formats : QCM (correction instantanee), sondages (vote libre), nuage de mots (reponses en direct). Resultats affiches en temps reel pour le pilote et partageables avec la classe.

### Documents

Upload fichiers et liens, categorisation, description. Visionneuse integree pour PDF, images, Word (.docx) et Excel (.xlsx). Drag and drop depuis n'importe quelle page.

### Dashboards

**Pilote** : layout Bento-box avec focus widget adaptatif, stats par promotion, frise chronologique, analytique (distribution notes, taux de depot), centre d'actions prioritaires.

**Etudiant** : widgets personnalisables (prochaines epreuves, livrables, soutenances, projet en cours, conversations recentes), notifications de notes en temps reel.

### Smart Focus

Sidebar proactive : devoirs a rendre bientot, annonces non lues, notes recentes. Mode Focus pour masquer les distractions.

### Mobile PWA

Navigation tactile avec barre inferieure, swipe entre les vues, optimise pour les petits ecrans.

<br />

## Demarrage rapide

**Prerequis** : Node.js 18+ et npm.

```bash
git clone https://github.com/rohanfosse/cursus.git
cd cursus
npm install
npm run dev
```

La base SQLite est creee automatiquement au premier lancement.

<br />

## Deploiement

### Docker (recommande)

```bash
docker compose build
docker compose up -d
```

Le Dockerfile multi-stage compile le frontend et ne garde que le serveur Node.js en production.

### Serveur web

```bash
npm run build:web    # compile le SPA dans dist-web/
npm run server       # lance le serveur Express
```

### Domaines

| Domaine | Usage |
|---------|-------|
| [app.cursus.school](https://app.cursus.school) | Application |
| [cursus.school](https://cursus.school) | Page vitrine |
| [admin.cursus.school](https://admin.cursus.school) | Console d'administration |

<br />

## Stack

| Couche | Technologies |
|--------|-------------|
| Desktop | Electron 29, context isolation, auto-update |
| Frontend | Vue 3 (Composition API), TypeScript, Pinia, Vue Router |
| Backend | Express, Socket.IO, SQLite (Better-SQLite3) |
| Build | electron-vite, Vite, electron-builder |
| Mobile | PWA, service worker, manifest |
| Deploiement | Docker multi-stage, Nginx, Let's Encrypt |
| Tests | Vitest, supertest |

<br />

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les instructions detaillees.

```bash
git checkout dev          # travailler sur la branche dev
npm run dev               # lancer en developpement
npx vue-tsc --noEmit      # verifier les types
npm test                  # lancer les tests
```

Workflow : `dev` > Pull Request > `main` (tests CI obligatoires).

<br />

## Securite

Voir [SECURITY.md](SECURITY.md).

<br />

## Licence

[MIT](LICENSE). Projet developpe par [Rohan Fosse](https://github.com/rohanfosse).
