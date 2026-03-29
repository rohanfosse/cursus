# Changelog

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
