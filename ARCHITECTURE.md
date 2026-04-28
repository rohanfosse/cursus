# Architecture & Scaling

> Document court qui explique les choix de design et comment Cursus se comporte sous charge. Pour la liste de features, voir [README.md](./README.md). Pour la procédure de déploiement, voir la section dédiée du README.

---

## Vue d'ensemble

```
┌──────────────────────┐      ┌────────────────────────────────────────┐
│  Clients             │      │  Serveur Node.js (single process)      │
│  ─ Electron desktop  │      │  ─ Express REST                        │
│  ─ PWA web           │ ◀──▶ │  ─ Socket.IO (presence, typing, push)  │
│  ─ Mobile (PWA)      │      │  ─ Auth JWT + rate limit               │
└──────────────────────┘      │  ─ Better-SQLite3 (mode WAL)           │
                              └────────────────┬───────────────────────┘
                                               │
                                ┌──────────────┴───────────────┐
                                │  cursus.db (~50-300 utils)   │
                                │  WAL = lectures non-bloquées │
                                └──────────────────────────────┘
```

---

## Choix #1 : Single-tenant assumé

**Une instance Cursus = une école.** Un seul process Node.js, un seul fichier SQLite. Pas de logique multi-tenant dans les tables (les rows sont scopées par `promo_id`, mais la base est partagée par toute l'école).

### Pourquoi pas multi-tenant ?

- Une école = ~50-300 utilisateurs simultanés au pic, ~50k messages, ~10k devoirs. SQLite encaisse ça sans broncher (empreinte mémoire 30-50 Mo).
- Le multi-tenant logique (préfixes/colonnes `tenant_id` partout) coûte cher en complexité : audits cross-tenant, risques de fuite par requête mal cadrée, performance dégradée par les conditions tenant systématiques sur chaque jointure.
- Le multi-tenant physique (multi-fichier SQLite avec dispatch en tête) demande un router applicatif. Trop pour le bénéfice.

### Conséquence opérationnelle

Pour héberger plusieurs écoles, on lance N instances Cursus :

```bash
docker run -d --name cursus-cesi  -p 3001:3001 -v /data/cesi:/data  cursus
docker run -d --name cursus-test  -p 3002:3001 -v /data/test:/data  cursus
```

Chaque école a son port, son volume, son fichier SQLite. **Isolation physique > isolation logique.**

---

## Choix #2 : SQLite avec Write-Ahead Logging (WAL)

SQLite est ouvert dès la création avec :

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
```

### Ce que WAL change

| Sans WAL (rollback journal) | Avec WAL |
|---|---|
| Écriture verrouille toute la DB | Lectures et écriture en parallèle |
| Lectures bloquées pendant un write | Lectures jamais bloquées |
| 1 transaction concurrente max | 1 writer + N readers concurrents |

Pour Cursus, le profil de charge est `~30 r/w/s` au pic (envoi de message + presence + read tracking). WAL gère ça nativement.

### Quand passer à PostgreSQL ?

À partir de plusieurs centaines de writes/seconde soutenus (> 1000 utilisateurs très actifs simultanés). Migration linéaire car le code passe par `better-sqlite3` derrière une couche de queries paramétrées (`server/db/models/`). Aucune query n'utilise de syntaxe SQLite-spécifique non-portable. Le critère de bascule est ressenti, pas théorique.

---

## Choix #3 : Better-SQLite3 plutôt que `sqlite3`

`better-sqlite3` est :
- **synchrone** : pas de promesse autour de chaque query, code plus lisible
- **plus rapide** : pas de surcoût de marshalling async
- **prepared statements** par défaut, ce qui rend le code plus sécurisé contre l'injection

> [!WARNING]
> **C'est un binding natif C++ compilé via `node-gyp`.** Toute machine qui fait `npm install` doit avoir une toolchain de build :
>
> | OS | Prérequis |
> |---|---|
> | **Windows** | Python 3 + Visual Studio Build Tools (workload "C++ build tools") OU `npm install --global windows-build-tools` |
> | **macOS** | Xcode Command Line Tools (`xcode-select --install`) |
> | **Linux** (Debian/Ubuntu) | `apt install build-essential python3` |
> | **Linux** (Alpine, Docker) | `apk add --no-cache python3 make g++` |
> | **Docker** | L'image base `node:22` Debian inclut déjà tout. Si tu pars d'Alpine, ajoute le bloc ci-dessus. |
>
> Pour **Electron**, après chaque mise à jour d'Electron, il faut `npm rebuild better-sqlite3` car les ABI Node et Electron diffèrent. Le script `postinstall` du `package.json` appelle déjà `electron-rebuild` qui recompile pour la bonne ABI.

### Symptômes d'un build raté

```
Error: The module 'better_sqlite3.node' was compiled against a different Node.js version
```

→ Lancer `npm rebuild better-sqlite3` (Node) ou `npm run rebuild` (Electron).

```
gyp ERR! find Python: Python is not set from command line or npm configuration
```

→ Installer Python 3 et le mettre dans le `PATH`.

```
gyp ERR! stack Error: not found: make
```

→ Installer la toolchain C++ (cf. tableau ci-dessus).

---

## Choix #4 : Schéma versionné via `PRAGMA user_version`

Toutes les modifications de schéma sont des migrations numérotées dans `server/db/schema.js`. Au boot, `runMigrations()` lit `user_version`, puis applique séquentiellement les steps manquants jusqu'à `CURRENT_VERSION`.

```js
const CURRENT_VERSION = 86 // bump à chaque ajout

const steps = [
  null, // v0
  (db) => { /* migration v1 */ },
  // ...
  (db) => { /* migration v86 : FTS5 sur messages */ },
]
```

Avantages :
- **Idempotent** : on peut relancer le serveur 100 fois, les migrations ne ré-exécutent pas
- **Forward-only** : pas de down-migration. Les rollbacks se font par restauration de backup
- **Pas de framework lourd** (Knex, Sequelize migrations) : 50 lignes de plomberie suffisent

### Ajouter une migration

1. Bumper `CURRENT_VERSION` à `N+1`
2. Ajouter un step à la fin du tableau `steps`
3. Tester localement : supprimer `cursus.db`, relancer, vérifier que la DB est créée from scratch
4. Tester sur une copie d'une vraie base (pour la migration ascendante)

---

## Choix #5 : DMs chiffrés au repos

Les messages directs (table `messages`, colonne `dm_student_id NOT NULL`) sont **chiffrés AES-256-GCM avant l'INSERT**. Le serveur a la clé (variable `ENCRYPTION_KEY`), donc ce n'est **pas** du chiffrement bout-en-bout — l'opérateur peut techniquement déchiffrer s'il a accès au fichier `.env`. C'est un cran au-dessus de "stockage en clair" : la DB volée seule ne révèle rien.

Conséquence : la recherche FTS5 (v86) **n'indexe pas les DMs**. Le path "decrypt-then-filter" reste sur les DMs (cf. `searchDmMessages` dans `server/db/models/messages.js`).

---

## Choix #6 : Auth JWT stateless

Les sessions sont des JWT signés `HS256` avec une durée d'expiration de 24h, refresh proactif côté client. Pas de table `sessions` à maintenir. Inconvénient : pas de "revoke session" centralisé — on attend l'expiration ou on rotate `JWT_SECRET` (kick tout le monde).

Pour le mode démo, le token est préfixé `demo-` ; le middleware `demoMode` les route vers `/api/demo/*` au lieu des routes prod. La séparation est **physique** : tables `demo_*` distinctes, donc pas de risque de fuite entre démo et prod.

---

## Choix #7 : Frontend Vue 3 + Pinia + Vite

- **Vue 3 Composition API** : code plus testable et lisible que Options API. La plupart des composants utilisent `<script setup>`.
- **Pinia** : remplace Vuex. API plus simple, hot-reload Vite, types TS first-class.
- **Vite** : dev server instantané, HMR rapide.

### Build modes

| Cible | Commande | Résultat |
|---|---|---|
| Electron desktop | `npm run build` | `out/` (Win/Mac installers) |
| PWA web | `npm run build:web` | `dist-web/` (servi par Express) |
| Dev local | `npm run dev` (electron) ou `npm run dev:web` (web) | HMR Vite |

---

## Sentinelles et limites

| Limite | Valeur | Conséquence si dépassée |
|---|---|---|
| Messages par canal lus en page | 100 | Pagination (déjà implémentée) |
| Recherche FTS5 résultats | 200 | Tronqué silencieusement |
| Upload fichier | 50 Mo | Rejet 413 |
| Rate limit global | 300 req/min/IP | 429 |
| Rate limit auth | 20 req/min/IP | 429 |
| Rate limit write | 60 req/min/user | 429 |
| Sessions démo simultanées | illimité techniquement, ~50 conseillé | Aucune (purge auto à 24h) |
| Bots démo | tick toutes les 60s, 30%+20%+8% par session | Charge négligeable |

---

## Points d'amélioration connus

- **Pas de séparation read/write replica** : si un jour la charge dépasse SQLite WAL, passer à PostgreSQL avec un replica de lecture.
- **Pas de queue de jobs** : les rappels d'échéance et les emails partent en `setTimeout` au boot. Une `bull-queue` Redis serait plus fiable mais ajoute une dépendance.
- **Backups automatiques** : un job toutes les 6h copie `cursus.db` dans `backups/`. Pas de rotation distante (S3/B2). À ajouter pour une vraie prod.
- **Observabilité** : `console.log` + fichier `logs/server.log`. Pas de Sentry/Datadog. À ajouter quand on dépasse une école pilote.

---

## Ressources

- [Better-SQLite3 docs](https://github.com/WiseLibs/better-sqlite3)
- [SQLite WAL mode](https://www.sqlite.org/wal.html)
- [SQLite FTS5](https://www.sqlite.org/fts5.html) (utilisé pour la recherche messages v86)
- [Vue 3 Composition API](https://vuejs.org/api/composition-api-setup.html)
- [Pinia stores](https://pinia.vuejs.org/)
- [Electron-vite](https://electron-vite.org/)
