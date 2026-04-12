<p align="center">
  <img src="src/renderer/src/assets/logo.png" alt="Cursus" width="80" />
</p>

<h1 align="center">Cursus</h1>

<p align="center">
  L'app tout-en-un pour ta promo.<br />
  Chat, devoirs et documents. Un seul endroit.
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
</p>

<p align="center">
  <a href="https://app.cursus.school">Application</a>
  &nbsp;&middot;&nbsp;
  <a href="https://cursus.school">Site web</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/rohanfosse/cursus/releases">Telecharger</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/rohanfosse/cursus/discussions">Discussions</a>
</p>

<br />

## Pourquoi Cursus

Les etudiants et enseignants naviguent chaque jour entre 5 a 8 outils : Moodle, Teams, WhatsApp, Drive, mails. Les annonces se perdent, les deadlines aussi. La frustration monte.

**Cursus supprime cette charge mentale.** Un etudiant ouvre Cursus le matin et n'a jamais a se demander "c'est ou ?".

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>Un seul endroit</h4>
      Chat, devoirs, documents, dashboard. Plus besoin de jongler entre 5 onglets.
    </td>
    <td width="33%" valign="top">
      <h4>Sur-mesure educatif</h4>
      Types de devoirs specifiques, notation par rubriques, suivi de promo. Pas un outil generique adapte.
    </td>
    <td width="33%" valign="top">
      <h4>Moins de logistique</h4>
      Grilles d'evaluation, deadlines automatiques, notifications instantanees. Plus de temps pour la pedagogie.
    </td>
  </tr>
</table>

<br />

## Fonctionnalites

### Coeur

| Fonctionnalite | Description |
|----------------|-------------|
| **Chat temps reel** | Canaux par promotion (archivables), annonces en lecture seule, DMs etudiant-etudiant, reactions, mentions `@nom` et `@tous`, slash commands `/devoir` `/doc` `/annonce`, recherche plein texte, indicateur de frappe, notifications desktop, offline queue avec retry |
| **Devoirs et evaluation** | 5 types (livrable, soutenance, CCTL, etude de cas, memoire), brouillon, verrouillage apres deadline, grilles multicriteres, notation A-F, feedback individuel, export CSV |
| **Documents et ressources** | Upload avec validation (taille max 50 Mo, extensions bloquees), liens, categorisation, viewers integres (PDF, Word, Excel), drag-and-drop, recherche, liaison aux devoirs |
| **Dashboard personnalisable** | Widgets reorganisables par drag-and-drop, deadlines proches, dernieres notes, progression, pomodoro, calendrier. Vues differentes enseignant/etudiant |

### Enrichissement

| Fonctionnalite | Description |
|----------------|-------------|
| **Lumen — Liseuse de cours** | Cours markdown adosses a GitHub (1 promo = 1 organisation, 1 cours = 1 repo). Detection automatique des chapitres depuis l'arbre du repo, scaffold "Nouveau cours" en 1 clic, recherche fulltext FTS5, KaTeX + Mermaid + admonitions, mode focus plein-ecran, auto-resume du dernier chapitre. Visibilite par repo (le prof publie explicitement). |
| **Quiz en direct** | QCM, sondages, nuages de mots en temps reel pendant le cours |
| **Kanban projet** | Suivi par groupe avec drag-and-drop (a faire, en cours, termine) |
| **Frise chronologique** | Timeline interactive des devoirs, zoom semaine/mois/trimestre/annee |
| **REX** | Sessions de retour d'experience avec feedback en temps reel |
| **Signature PDF** | Circuit de signature en DM avec tampon, reference unique, sauvegarde locale |
| **Messages prives** | DMs chiffres, indicateur en ligne, envoi de fichiers, cache 60s |
| **Mode Focus** | Masque les distractions, sidebar proactive avec priorites |
| **Mobile PWA** | Navigation tactile, barre inferieure, optimise pour petits ecrans |

<br />

## Securite

| Couche | Mecanisme |
|--------|-----------|
| **Isolation promo** | Chaque etudiant n'accede qu'a sa promotion. Middleware `requirePromo` + rooms Socket.IO par promo |
| **Controle par role** | 4 roles hierarchiques : admin > enseignant > intervenant > etudiant. Permissions centralisees |
| **DMs confidentiels** | Un etudiant n'accede qu'a ses propres conversations (`requireDmParticipant`) |
| **Auth et chiffrement** | JWT 7j, bcrypt, validation Zod, CSRF, Content-Security-Policy stricte |
| **IPC securise** | Les handlers Electron verifient role et promo (`handleTeacher`, `handlePromo`) |
| **RGPD** | Export des donnees personnelles (Art. 20) |

Voir [SECURITY.md](SECURITY.md) pour les details et le signalement de vulnerabilites.

<br />

## Demarrage rapide

> **Prerequis** : [Node.js](https://nodejs.org/) 18+ et npm

```bash
git clone https://github.com/rohanfosse/cursus.git
cd cursus
npm install
npm run dev
```

La base SQLite est creee automatiquement au premier lancement. Pour charger des donnees de demo, ouvrir l'admin et utiliser **Reinitialiser et peupler**.

### Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Electron + Vite HMR |
| `npm run build` | Build complet (main, preload, renderer) |
| `npm run build:win` | Packaging Windows (.exe) |
| `npm run build:mac` | Packaging macOS (.dmg) |
| `npm run build:web` | SPA web (PWA) dans `dist-web/` |
| `npm run server` | Serveur Express (production) |
| `npm run server:dev` | Serveur Express avec watch |
| `npm test` | Tests (Vitest) |
| `npm run test:coverage` | Tests + couverture |
| `npm run typecheck` | Verification TypeScript (vue-tsc) |

<br />

## Deploiement

### Docker (recommande)

```bash
docker compose build
docker compose up -d
docker logs -f cursus-server
```

### Manuel

```bash
npm run build:web
NODE_ENV=production PORT=3001 JWT_SECRET=<secret-32-chars> node server/index.js
```

### Variables d'environnement

| Variable | Description | Defaut |
|----------|-------------|--------|
| `PORT` | Port HTTP | `3001` |
| `JWT_SECRET` | Cle JWT (min 32 chars en production) | `changeme-dev-secret` |
| `CORS_ORIGIN` | Origine CORS | `*` |
| `DB_PATH` | Chemin SQLite | Auto |
| `UPLOAD_DIR` | Repertoire uploads | `uploads/` |
| `VITE_SERVER_URL` | URL serveur pour le frontend | `http://localhost:3001` |

### Infrastructure

| Service | Domaine |
|---------|---------|
| Application | [app.cursus.school](https://app.cursus.school) |
| Page vitrine | [cursus.school](https://cursus.school) |
| Administration | [admin.cursus.school](https://admin.cursus.school) |

Docker + Nginx + Let's Encrypt sur VPS. Deploy automatique via GitHub Actions sur chaque push `main`.

<br />

## Architecture

```
cursus/
  src/
    main/              Processus principal Electron
    preload/           Bridge IPC securise (contextBridge)
    renderer/          Frontend Vue 3 + TypeScript + Pinia
    web/               PWA shim (remplace IPC par HTTP)
    landing/           Page vitrine
  server/
    db/                SQLite : connexion, schema, migrations, models
    routes/            API REST (18 domaines + admin modulaire)
    middleware/        Auth JWT, validation Zod, autorisation (role + promo)
    public/            Console d'administration
  tests/
    frontend/          Tests unitaires utils + stores
    backend/           Tests models + routes + middleware + securite
```

### Stack

| Couche | Technologies |
|--------|-------------|
| Desktop | Electron 29, context isolation, sandbox, auto-update (electron-updater, NSIS) |
| Frontend | Vue 3 Composition API, TypeScript strict, Pinia, Vue Router |
| Backend | Express 4, Socket.IO 4, SQLite (Better-SQLite3), JWT, Zod, bcrypt |
| Build | electron-vite, Vite 6, electron-builder |
| Mobile | PWA, service worker, Web App Manifest |
| CI/CD | GitHub Actions (tests, deploy Docker, release Win/macOS, Lighthouse, CodeQL) |
| Qualite | Vitest, Supertest, vue-tsc strict, Dependabot |

<br />

## Contribuer

Les contributions sont les bienvenues. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git checkout dev              # branche de travail
npm run dev                   # developpement avec HMR
npx vue-tsc --noEmit          # verifier les types
npm test                      # tests
git push origin dev           # pousser
# Ouvrir une PR vers main
```

**Conventions** : commits prefixes (`feat:`, `fix:`, `chore:`), TypeScript strict, Composition API, variables CSS (pas de couleurs hardcodees).

<br />

## Licence

Distribue sous licence [MIT](LICENSE).

Concu et developpe par [Rohan Fosse](https://github.com/rohanfosse).
