# Changelog

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
