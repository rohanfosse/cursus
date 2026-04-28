<div align="center">

<img src="src/renderer/src/assets/logo.png" alt="Cursus" width="96" />

# Cursus

### L'app tout-en-un pour ta promo

**Chat &middot; Devoirs &middot; Quiz &middot; Cours &middot; Rendez-vous**
<br />
Un seul endroit, plus de charge mentale.

<br />

[![Tests](https://img.shields.io/github/actions/workflow/status/rohanfosse/cursus/test.yml?style=for-the-badge&label=tests&logo=vitest&logoColor=white)](https://github.com/rohanfosse/cursus/actions)
[![Version](https://img.shields.io/github/v/release/rohanfosse/cursus?style=for-the-badge&label=version&color=22c55e)](https://github.com/rohanfosse/cursus/releases)
[![License AGPL-3.0](https://img.shields.io/github/license/rohanfosse/cursus?style=for-the-badge&color=blue&label=license)](LICENSE)
[![App Status](https://img.shields.io/website?url=https%3A%2F%2Fapp.cursus.school&style=for-the-badge&label=app&logo=statuspage&logoColor=white)](https://app.cursus.school)

<br />

### [▶ Tester la démo live](https://app.cursus.school/#/demo)

**Sans inscription. 30 secondes.** Bascule entre profil prof et étudiant pour explorer toute l'app.

<br />

[**Application**](https://app.cursus.school) &nbsp;&nbsp;&middot;&nbsp;&nbsp; [**Site web**](https://cursus.school) &nbsp;&nbsp;&middot;&nbsp;&nbsp; [**Télécharger**](https://github.com/rohanfosse/cursus/releases) &nbsp;&nbsp;&middot;&nbsp;&nbsp; [**Discussions**](https://github.com/rohanfosse/cursus/discussions)

<br />

<img src="https://img.shields.io/badge/Vue_3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Electron_38-47848F?style=flat-square&logo=electron&logoColor=white" />
<img src="https://img.shields.io/badge/Vite_6-646CFF?style=flat-square&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white" />
<img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" />
<img src="https://img.shields.io/badge/Pinia-FFD43B?style=flat-square&logo=pinia&logoColor=black" />
<img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />

</div>

<br />

> Les étudiants et enseignants jonglent entre 5 à 8 outils chaque jour : Moodle,
> Teams, WhatsApp, Drive, mails. Les annonces se perdent, les deadlines aussi,
> la frustration monte. **Cursus supprime cette charge mentale.** On ouvre
> l'app le matin et on n'a jamais à se demander « c'est où ? ».

<br />

## Captures

> **TODO** : remplacer les liens ci-dessous par les vraies captures.
> Recommandé : un GIF animé pour le dashboard, des PNG pour les autres.

![Démo Dashboard étudiant](https://placehold.co/1280x720/1a1a2e/ffffff?text=Dashboard+%C3%A9tudiant+%E2%80%94+%C3%A9ch%C3%A9ances+%2B+messages+%2B+Live)

| Messagerie | Lumen (cours GitHub) | Live Quiz |
|:---:|:---:|:---:|
| ![Messagerie](https://placehold.co/640x400/1a1a2e/ffffff?text=Chat+par+canal) | ![Lumen](https://placehold.co/640x400/d97706/ffffff?text=Liseuse+markdown) | ![Live](https://placehold.co/640x400/ef4444/ffffff?text=Quiz+en+direct) |

| Devoirs | Cahier collaboratif | Booking RDV |
|:---:|:---:|:---:|
| ![Devoirs](https://placehold.co/640x400/059669/ffffff?text=Notation+A-D) | ![Cahier](https://placehold.co/640x400/6366f1/ffffff?text=TipTap+%2B+Yjs) | ![Booking](https://placehold.co/640x400/0ea5e9/ffffff?text=Mini-Calendly) |

<br />

## Pourquoi

<table>
<tr>
<td width="33%" valign="top">

### Un seul endroit

Chat, devoirs, documents, dashboard, quiz live, RDV. Plus besoin de jongler
entre 5 onglets ouverts.

</td>
<td width="33%" valign="top">

### Sur-mesure éducatif

Types de devoirs spécifiques, notation par rubriques, suivi de promo,
campagnes de visites tripartites. Pas un outil générique adapté.

</td>
<td width="33%" valign="top">

### Moins de logistique

Grilles d'évaluation, deadlines auto, notifications instantanées, sync
Outlook. Plus de temps pour la pédagogie.

</td>
</tr>
</table>

<br />

## Fonctionnalités

<table>
<tr>
<th>Module</th>
<th>Description</th>
</tr>

<tr>
<td valign="top">

**Chat temps réel**

</td>
<td>

Canaux par promotion (archivables), annonces lecture seule, DMs étudiants,
réactions, mentions <code>@nom</code> / <code>@tous</code>, slash commands
<code>/devoir</code> <code>/doc</code> <code>/annonce</code>, recherche
plein texte, indicateur de frappe, notifications desktop, **offline queue
avec retry**.

</td>
</tr>

<tr>
<td valign="top">

**Devoirs et évaluation**

</td>
<td>

5 types (livrable, soutenance, CCTL, étude de cas, mémoire). Brouillon,
verrouillage post-deadline, **grilles multicritères**, notation A-D,
feedback individuel, export CSV.

</td>
</tr>

<tr>
<td valign="top">

**Documents et ressources**

</td>
<td>

Upload avec validation (taille max 50 Mo, extensions bloquées), liens,
catégorisation, viewers intégrés (PDF, Word, Excel), drag-and-drop,
recherche, liaison aux devoirs.

</td>
</tr>

<tr>
<td valign="top">

**Dashboard personnalisable**

</td>
<td>

Widgets réorganisables par drag-and-drop, deadlines proches, dernières
notes, progression, calendrier. Vues dédiées enseignant / étudiant.

</td>
</tr>

<tr>
<td valign="top">

**Lumen**<br /><sub>Liseuse de cours</sub>

</td>
<td>

Cours markdown adossés à GitHub (1 promo = 1 organisation, 1 cours = 1 repo).
Détection auto des chapitres, scaffold « Nouveau cours » en 1 clic,
**recherche FTS5**, KaTeX + Mermaid + admonitions, édition inline, notes
privées, tracking de lecture, **PDF intégré** (pdf.js), **runner notebooks
.ipynb** (Pyodide).

</td>
</tr>

<tr>
<td valign="top">

**Live**<br /><sub>4 modes interactifs</sub>

</td>
<td>

Module unifié avec 4 catégories :<br />
&middot; **Spark** &mdash; quiz QCM, vrai/faux, association, estimation,
réponse courte, scoring + podium<br />
&middot; **Pulse** &mdash; feedback anonyme : nuage de mots, échelle,
humeur, sondage, matrice, priorité<br />
&middot; **Code** &mdash; éditeur live avec coloration syntaxique<br />
&middot; **Board** &mdash; brainstorming collaboratif, post-its, votes,
drag &amp; drop, export Markdown

</td>
</tr>

<tr>
<td valign="top">

**Rendez-vous**<br /><sub>mini-Calendly</sub>

</td>
<td>

Page dédiée <code>/booking</code>. Types d'événements, grille de
disponibilités hebdomadaire, lien de réservation par étudiant, sync
**Microsoft Outlook + Teams** ou **Jitsi Meet** (alternative libre),
e-mails de confirmation, rate limiting sur les routes publiques.

</td>
</tr>

<tr>
<td valign="top">

**Campagnes RDV**<br /><sub>visites tripartites</sub>

</td>
<td>

Planification automatique de visites prof + étudiant + tuteur entreprise
sur une période donnée. Génération des créneaux à partir de règles
hebdomadaires, **invitations en 1 clic**, lien personnel par étudiant,
suivi en temps réel, relances automatiques.

</td>
</tr>

<tr>
<td valign="top">

**Kanban projet**

</td>
<td>

Suivi par groupe avec drag-and-drop (à faire, en cours, terminé).
Synchronisation temps réel.

</td>
</tr>

<tr>
<td valign="top">

**Frise chronologique**

</td>
<td>

Timeline interactive des devoirs, zoom semaine / mois / trimestre / année.

</td>
</tr>

<tr>
<td valign="top">

**Signature PDF**

</td>
<td>

Circuit de signature en DM avec tampon, référence unique, sauvegarde locale.

</td>
</tr>

<tr>
<td valign="top">

**DMs**<br /><sub>chiffrés AES-256-GCM au repos en base</sub>

</td>
<td>

Conversations privées chiffrées **AES-256-GCM**, indicateur en ligne,
envoi de fichiers, brouillons par conversation.

</td>
</tr>

<tr>
<td valign="top">

**Agenda et calendrier**

</td>
<td>

Reminders, deadlines, export ICS, sync Outlook bidirectionnelle.

</td>
</tr>

<tr>
<td valign="top">

**Mini-jeux**

</td>
<td>

TypeRace (vitesse de frappe), Snake, Space Invaders. Leaderboard par promo,
scopes <code>day</code> / <code>week</code> / <code>all</code>. Activable
par module dans l'admin.

</td>
</tr>

<tr>
<td valign="top">

**Mobile PWA**

</td>
<td>

Navigation tactile, barre inférieure, optimisé pour petits écrans, service
worker pour le mode hors-ligne.

</td>
</tr>
</table>

<br />

## Démarrage rapide

> **Prérequis** : [Node.js](https://nodejs.org/) 20+ (CI sur 22) et npm.

```bash
git clone https://github.com/rohanfosse/cursus.git
cd cursus
npm install
npm run dev
```

La base SQLite est créée automatiquement au premier lancement. Pour charger
des données de démonstration, ouvrir l'admin et cliquer sur **Réinitialiser
et peupler**.

<details>
<summary><b>Tous les scripts npm</b></summary>

| Commande                  | Description                                  |
|---------------------------|----------------------------------------------|
| `npm run dev`             | Electron + Vite HMR                          |
| `npm run dev:web`         | PWA web seulement (Vite, port 5174)          |
| `npm run server:dev`      | Serveur Express + Socket.IO en watch         |
| `npm run build`           | Build complet (main + preload + renderer)   |
| `npm run build:web`       | SPA web (PWA) dans `dist-web/`               |
| `npm run build:win`       | Packaging Windows (.exe NSIS)                |
| `npm run build:mac`       | Packaging macOS (.dmg)                       |
| `npm run server`          | Serveur Express en production                |
| `npm test`                | Tests Vitest (frontend + backend)            |
| `npm run test:e2e`        | Tests E2E Playwright                         |
| `npm run test:coverage`   | Tests + couverture (objectif 80%+)           |
| `npm run typecheck`       | Vérification TypeScript stricte (vue-tsc)    |

</details>

<br />

## Architecture

```mermaid
flowchart LR
    subgraph Clients
        D[Electron Desktop<br/>Win / macOS]
        W[PWA Web<br/>app.cursus.school]
        M[Mobile PWA]
    end

    subgraph Server[Server &mdash; Node.js + Express]
        API[REST API<br/>~20 domaines]
        WS[Socket.IO<br/>presence, typing,<br/>push notifications]
        AUTH[Auth JWT<br/>+ rate limit]
    end

    subgraph Storage
        SQ[(SQLite<br/>Better-SQLite3)]
        FS[Uploads<br/>local filesystem]
    end

    subgraph External[Services externes]
        MS[Microsoft Graph<br/>Outlook + Teams]
        SMTP[SMTP<br/>e-mails RDV]
        GH[GitHub API<br/>Lumen courses]
    end

    D -->|IPC + HTTP| Server
    W -->|HTTP + WSS| Server
    M -->|HTTP + WSS| Server

    API --> SQ
    API --> FS
    WS --> SQ

    Server -->|OAuth2| MS
    Server --> SMTP
    Server -->|REST| GH
```

<br />

### Architecture & Scaling

**Single-tenant assume.** Une instance Cursus = une école. Un seul process Node.js + un seul fichier SQLite. Pas de multi-tenant logique au niveau des tables (toutes les rows sont scopées par `promo_id`, mais la base est partagée). Si tu veux héberger plusieurs écoles, tu lances plusieurs instances avec leurs propres ports, dossiers et fichiers SQLite — chaque école a son monde isolé physiquement.

**Pourquoi pas multi-tenant ?** Une école = ~50-300 utilisateurs simultanés au pic, ~50k messages, ~10k devoirs. SQLite gère ça en O(log n) avec une empreinte mémoire de 30-50 Mo. Le multi-tenant logique aurait coûté en complexité (préfixes partout, audits cross-tenant, risques de fuite) sans gain visible. Le déploiement Docker rend trivial le fait de lancer N instances.

**Concurrence SQLite : mode WAL.** SQLite est ouvert en `PRAGMA journal_mode = WAL` (Write-Ahead Logging) dès la création. Un writer parallèle aux lecteurs sans verrou global, ce qui suffit pour les ~30 r/w/s qu'une promo génère. La WAL fait que les lectures ne bloquent jamais les écritures et inversement, jusqu'à l'unique writer simultané que SQLite tolère. Si jamais une école atteint plusieurs centaines de writes/s en pic, on bascule sur PostgreSQL avec une migration linéaire (le code utilise `better-sqlite3` derrière une couche de queries paramétrées).

> [!WARNING]
> **`better-sqlite3` se compile via `node-gyp` à l'install.** C'est un binding natif C++. Pour que `npm install` réussisse, tu dois avoir sur ta machine :
>
> | OS | Prérequis |
> |---|---|
> | **Windows** | Python 3 + Visual Studio Build Tools (workload "C++ build tools") OU `npm install --global windows-build-tools` |
> | **macOS** | Xcode Command Line Tools (`xcode-select --install`) |
> | **Linux** | `build-essential` + `python3` (`apt install build-essential python3`) |
> | **Docker** | L'image base inclut déjà ces deps. Si tu modifies le `Dockerfile`, ne pas oublier `apk add --no-cache python3 make g++` (Alpine) ou `apt-get install -y build-essential python3` (Debian/Ubuntu). |
>
> Pour Electron en particulier, `npm rebuild better-sqlite3` est nécessaire après chaque mise à jour d'Electron, car les ABI Node.js et Electron diffèrent. Le script `postinstall` du `package.json` s'en charge automatiquement.

<br />

## Stack technique

| Couche       | Technologies                                                                                                     |
|--------------|------------------------------------------------------------------------------------------------------------------|
| **Desktop**  | Electron 38, context isolation, sandbox, auto-update (electron-updater, NSIS)                                    |
| **Frontend** | Vue 3.5 Composition API, TypeScript strict, Pinia, Vue Router                                                    |
| **Backend**  | Express 4, Socket.IO 4, SQLite (Better-SQLite3), JWT, Zod, bcrypt, MSAL Node, nodemailer                          |
| **Build**    | electron-vite 3, Vite 6, electron-builder                                                                        |
| **Mobile**   | PWA, service worker, Web App Manifest                                                                            |
| **CI/CD**    | GitHub Actions (Vitest, Playwright, deploy Docker, release Win/macOS, Lighthouse, CodeQL, Dependabot)            |
| **Qualité**  | Vitest, Supertest, Playwright, vue-tsc strict                                                                    |

<details>
<summary><b>Structure du repo</b></summary>

```
cursus/
  src/
    main/              Processus principal Electron (IPC, DB, fenêtre)
    preload/           Bridge IPC type-safe (contextBridge)
    renderer/          Frontend Vue 3 + TypeScript + Pinia
    web/               Shim PWA (remplace IPC par fetch + socket.io)
    landing/           Page vitrine cursus.school
  server/
    db/                SQLite : connexion, schéma, migrations, models
    routes/            36 fichiers, ~20 domaines métier
    services/          E-mail (nodemailer), Microsoft Graph (MSAL), unfurl
    middleware/        Auth JWT, validation Zod, rate limit, rôle + promo
    public/            Console d'administration
  tests/
    frontend/          Tests unitaires utils + stores
    backend/           Tests models + routes + middleware + sécurité
    e2e/               Playwright (auth, isolation cross-promo)
```

</details>

<br />

## Sécurité

| Couche                  | Mécanisme                                                                                                |
|-------------------------|----------------------------------------------------------------------------------------------------------|
| **Isolation promo**     | Middleware `requirePromo` + rooms Socket.IO par promotion                                                |
| **Contrôle par rôle**   | 4 rôles hiérarchiques (admin > enseignant > intervenant > étudiant), permissions centralisées            |
| **DMs confidentiels**   | `requireDmParticipant` + chiffrement AES-256-GCM au repos                                                |
| **Auth + chiffrement**  | JWT 7j, bcrypt 10 rounds, validation Zod, CSRF (OAuth state HMAC), CSP stricte, tokens MS chiffrés       |
| **IPC sécurisé**        | `contextIsolation`, `sandbox`, `nodeIntegration: false`, vérifications rôle + promo dans les handlers   |
| **RGPD**                | Export des données personnelles (Art. 20), suppression de compte                                         |

Pour signaler une vulnérabilité : [SECURITY.md](SECURITY.md).

<br />

## Déploiement

### Docker (recommandé)

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

<details>
<summary><b>Variables d'environnement</b></summary>

| Variable               | Description                                | Défaut                  |
|------------------------|--------------------------------------------|-------------------------|
| `PORT`                 | Port HTTP                                  | `3001`                  |
| `JWT_SECRET`           | Clé JWT (min 32 chars en prod)             | `changeme-dev-secret`   |
| `CORS_ORIGIN`          | Origine CORS                               | `*`                     |
| `DB_PATH`              | Chemin SQLite                              | Auto                    |
| `UPLOAD_DIR`           | Répertoire uploads                         | `uploads/`              |
| `VITE_SERVER_URL`      | URL serveur pour le frontend               | `http://localhost:3001` |
| `AZURE_TENANT_ID`      | Azure AD tenant ID (booking)               | -                       |
| `AZURE_CLIENT_ID`      | Azure AD client ID (booking)               | -                       |
| `AZURE_CLIENT_SECRET`  | Azure AD client secret (booking)           | -                       |
| `SMTP_HOST`            | Serveur SMTP (e-mails RDV)                 | -                       |
| `SMTP_USER`            | Utilisateur SMTP                           | -                       |
| `SMTP_PASS`            | Mot de passe SMTP                          | -                       |

</details>

### Infrastructure live

| Service        | Domaine                                                              |
|----------------|----------------------------------------------------------------------|
| Application    | [app.cursus.school](https://app.cursus.school)                       |
| Page vitrine   | [cursus.school](https://cursus.school)                               |
| Administration | [admin.cursus.school](https://admin.cursus.school)                   |

Docker + Nginx + Let's Encrypt sur VPS. Déploiement automatique via GitHub
Actions sur chaque push `main`.

<br />

## Contribuer

Les contributions sont les bienvenues. Voir [CONTRIBUTING.md](CONTRIBUTING.md)
pour le workflow détaillé.

```bash
git checkout -b feat/ma-feature   # branche descriptive
npm run dev                       # dev avec HMR
npm test                          # tests
npx vue-tsc --noEmit              # types
git push origin feat/ma-feature   # ouvrir une PR vers main
```

**Conventions** : commits préfixés (`feat:`, `fix:`, `docs:`, `chore:`,
`refactor:`, `test:`), TypeScript strict, Composition API, variables CSS
(pas de couleurs hardcodées), pas d'emojis dans l'UI ni les commits.

<br />

## Licence

Distribué sous licence [GNU AGPL v3](LICENSE) &middot; &copy; 2025-2026
[Rohan Fossé](https://github.com/rohanfosse).

L'AGPL est une licence copyleft forte&nbsp;: tu peux utiliser, modifier et
redistribuer Cursus librement, mais si tu héberges une **version modifiée**
comme service réseau, tu dois publier les modifications sous la même licence.
Voir [LICENSE](LICENSE) pour les termes complets, ou la
[FAQ AGPL](https://www.gnu.org/licenses/agpl-3.0.faq.html) pour une explication
plus accessible.

<br />

<div align="center">

<sub>
Conçu et développé avec soin par <a href="https://github.com/rohanfosse">@rohanfosse</a>.
<br />
Si Cursus te plaît, mets une <a href="https://github.com/rohanfosse/cursus/stargazers">étoile</a> sur GitHub &mdash; ça aide énormément.
</sub>

</div>
