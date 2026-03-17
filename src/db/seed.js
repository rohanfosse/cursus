const { getDb } = require('./connection');
const path = require('path');
const fs   = require('fs');

// ─── Générateur de PDF minimal ────────────────────────────────────────────────
function makePdfBuffer(title, author, bodyLines) {
  function esc(s) {
    const ascii = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ' ')
    return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  }
  let stream = 'BT\n/F1 15 Tf\n50 790 Td\n(' + esc(title) + ') Tj\n0 -22 TD\n/F1 10 Tf\n'
  stream += '(' + esc(author) + ') Tj\n0 -20 TD\n'
  for (const line of bodyLines.slice(0, 30)) {
    stream += '(' + esc(line) + ') Tj\n0 -16 TD\n'
  }
  stream += 'ET'

  function b(s) { return Buffer.from(s, 'latin1') }
  const h  = b('%PDF-1.4\n')
  const o1 = b('1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n')
  const o2 = b('2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n')
  const o3 = b('3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n')
  const o4 = b(`4 0 obj\n<</Length ${Buffer.byteLength(stream,'latin1')}>>\nstream\n${stream}\nendstream\nendobj\n`)
  const o5 = b('5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n')

  const offs = []; let cur = h.length
  for (const o of [o1, o2, o3, o4, o5]) { offs.push(cur); cur += o.length }

  const xref = b('xref\n0 6\n0000000000 65535 f \n' +
    offs.map(n => String(n).padStart(10,'0') + ' 00000 n \n').join(''))
  const trailer = b(`trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${cur}\n%%EOF\n`)
  return Buffer.concat([h, o1, o2, o3, o4, o5, xref, trailer])
}

// ─── Création des PDFs de test ─────────────────────────────────────────────────
function ensureTestFiles() {
  const dir = path.join(__dirname, 'test-files')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)

  const files = {
    'cahier_charges_web.pdf': ['Cahier des charges — Projet Web Full-Stack', 'Rohan Fosse — CESI Cours', [
      'Objectif : Developper une application web full-stack (Flask + SQLite)',
      'Fonctionnalites attendues :',
      '  - Authentification utilisateur (inscription / connexion)',
      '  - Gestion des articles (CRUD complet)',
      '  - Interface responsive (HTML/CSS/JS)',
      '  - API REST documentee',
      '  - Tests unitaires (couverture > 70%)',
      '',
      'Livrables :',
      '  1. Maquette + specifications (semaine 10)',
      '  2. Version beta fonctionnelle (semaine 20)',
      '  3. Soutenance + demo (semaine 25)',
      '',
      'Evaluation : qualite du code (40%), fonctionnalites (40%), presentation (20%)',
    ]],
    'grille_eval_dev.pdf': ['Grille d\'evaluation — Developpement Web', 'Rohan Fosse', [
      'Critere 1 : Architecture et qualite du code (40 pts)',
      '  A (36-40) : Code propre, structure MVC respectee, DRY, tests',
      '  B (28-35) : Bonne structure, quelques repetitions, tests partiels',
      '  C (20-27) : Fonctionnel mais peu structure, peu teste',
      '  D (<20)   : Code peu lisible, pas de tests, architecture absente',
      '',
      'Critere 2 : Fonctionnalites (40 pts)',
      '  A : Toutes les features + extras',
      '  B : Toutes les features requises',
      '  C : Fonctionnalites principales OK, manques secondaires',
      '  D : Fonctionnalites manquantes importantes',
      '',
      'Critere 3 : Presentation orale (20 pts)',
      '  Duree : 15 min + 5 min questions',
    ]],
    'referentiel_e5.pdf': ['Referentiel BTS FISAA — Epreuve E5', 'Direction pedagogique CESI', [
      'Epreuve E5 : Presentation du contexte professionnel',
      '',
      'Structure du dossier (5 a 8 pages) :',
      '  1. Presentation de l\'entreprise (contexte, secteur, taille)',
      '  2. Description du projet confie (enjeux, perimetre)',
      '  3. Missions realisees et livrables produits',
      '  4. Competences acquises et mises en oeuvre',
      '  5. Bilan et perspectives',
      '',
      'Grille d\'evaluation :',
      '  Contexte professionnel (40%) : pertinence, precision, exhaustivite',
      '  Maitrise technique (30%) : demonstration des competences metier',
      '  Communication orale (30%) : clarte, structure, gestion questions',
      '',
      'Duree de la soutenance : 20 min expose + 10 min questions',
    ]],
    'rapport_maquette_dupont.pdf': ['Maquette Projet Web — Lucas DUPONT', 'Lucas Dupont — CPIA2 25-26', [
      'Rapport de maquette — Application de gestion de stocks',
      '',
      '1. Description du projet',
      '   Application web permettant la gestion d\'un stock de produits.',
      '   Utilisateurs : gestionnaire, employe, administrateur.',
      '',
      '2. Architecture technique',
      '   Frontend : HTML5 / CSS3 / JavaScript vanilla',
      '   Backend  : Flask (Python 3.11)',
      '   Base de donnees : SQLite3',
      '',
      '3. Wireframes',
      '   Page accueil : dashboard avec statistiques',
      '   Page produits : liste + filtres + pagination',
      '   Page detail : fiche produit + historique',
      '   Page admin : gestion utilisateurs + export CSV',
      '',
      '4. Modele de donnees',
      '   Tables : produits, categories, mouvements, utilisateurs',
    ]],
    'rapport_maquette_bernard.pdf': ['Maquette Projet Web — Manon BERNARD', 'Manon Bernard — CPIA2 25-26', [
      'Rapport de maquette — Plateforme de reservation de salles',
      '',
      '1. Perimetre fonctionnel',
      '   - Reservation de salles de reunion',
      '   - Calendrier interactif',
      '   - Gestion des conflits de reservation',
      '   - Notifications email',
      '   - Exports PDF',
      '',
      '2. Choix techniques documentes',
      '   Flask-SQLAlchemy, FullCalendar.js, Bootstrap 5',
      '',
      '3. Maquettes validees (10 ecrans documentes)',
      '   Tous les etats (vide, rempli, erreur) sont representes.',
      '   Responsive design : desktop + mobile.',
      '',
      '4. Planning de developpement',
      '   Sprint 1 : authentification + CRUD salles',
      '   Sprint 2 : calendrier + reservations',
      '   Sprint 3 : notifications + export + tests',
    ]],
    'dm_uml_petit.pdf': ['DM Modelisation UML — Jade PETIT', 'Jade Petit — CPIA2 25-26', [
      'Sujet : Systeme de reservation de bibliotheque',
      '',
      'Diagramme de cas d\'utilisation :',
      '  Acteurs : Adherent, Bibliothecaire, Systeme',
      '  CU : Rechercher ouvrage, Reserver, Emprunter, Rendre, Gerer catalogues',
      '  Relations : include (authentification), extend (alertes retard)',
      '',
      'Diagramme de classes :',
      '  Ouvrage (isbn, titre, auteur, disponible)',
      '  Exemplaire (id, etat, ouvrage[1..*])',
      '  Adherent (id, nom, email, actif)',
      '  Emprunt (id, dateDebut, dateFin, exemplaire, adherent)',
      '  Reservation (id, dateDemande, ouvrage, adherent)',
      '',
      'Diagramme de sequence : Emprunter un ouvrage',
      '  Adherent -> IHM -> Bibliothecaire -> Systeme -> BDD',
    ]],
    'dm_uml_rousseau.pdf': ['DM Modelisation UML — Camille ROUSSEAU', 'Camille Rousseau — CPIA2 25-26', [
      'Sujet : Systeme de gestion de commandes e-commerce',
      '',
      'Diagramme de cas d\'utilisation :',
      '  Acteurs : Client, Vendeur, Admin, Systeme paiement',
      '  CU : Consulter catalogue, Commander, Payer, Suivre livraison',
      '',
      'Diagramme de classes :',
      '  Produit, Commande, LigneCommande, Client, Paiement',
      '  Quelques erreurs de multiplicite sur les associations.',
      '',
      'Diagramme de sequence : Passer une commande',
      '  Bon niveau general, la gestion des erreurs est incomplete.',
    ]],
    'tp_algo_leclerc.pdf': ['TP Structures de donnees — Theo LECLERC', 'Theo Leclerc — CPIA2 25-26', [
      'Implementation en Python — Structures de donnees fondamentales',
      '',
      'Pile (Stack) :',
      '  Methodes : push(), pop(), peek(), is_empty(), size()',
      '  Complexite : O(1) pour toutes les operations',
      '',
      'File (Queue) :',
      '  Implementation avec collections.deque',
      '  Methodes : enqueue(), dequeue(), front(), is_empty()',
      '',
      'Table de hachage :',
      '  Gestion des collisions par chaining (liste chainee)',
      '  Facteur de charge : seuil a 0.75 pour redimensionnement',
      '',
      'Tests unitaires : 12 tests passes sur 15',
      'Couverture : 80% (manque tests sur cas limites)',
    ]],
    'dossier_e5_moreau.pdf': ['Dossier E5 — Alexandre MOREAU', 'Alexandre Moreau — FISAA4 24-27', [
      'Contexte professionnel — Projet E5',
      '',
      '1. Presentation de l\'entreprise',
      '   Schneider Electric — Site de Grenoble (fabrication tableaux electriques)',
      '   Effectif : 850 personnes, CA : 2.1 Md EUR',
      '',
      '2. Contexte du projet',
      '   Modernisation de la ligne de production L7 :',
      '   remplacement des automates Siemens S5 par des S7-1500,',
      '   integration d\'une supervision SCADA WinCC Unified.',
      '',
      '3. Missions realisees',
      '   - Analyse fonctionnelle de la ligne existante (GRAFCET)',
      '   - Redaction des specifications techniques',
      '   - Programmation des blocs fonctionnels TIA Portal V17',
      '   - Tests en FAT (Factory Acceptance Test)',
      '   - Formation des operateurs (2 sessions)',
      '',
      '4. Livrables produits',
      '   - Dossier d\'analyse fonctionnelle (50 pages)',
      '   - Programme automate valide (3 000 blocs)',
      '   - Manuel operateur',
      '   - Rapport de tests FAT',
    ]],
    'dossier_e5_simon.pdf': ['Dossier E5 — Chloe SIMON', 'Chloe Simon — FISAA4 24-27', [
      'Contexte professionnel — Projet E5 (English version)',
      '',
      '1. Company overview',
      '   Bosch Rexroth — Hydraulics division, Vénissieux',
      '   700 employees, production of hydraulic systems for industry',
      '',
      '2. Project context',
      '   Design and commissioning of an automated test bench',
      '   for hydraulic cylinder validation.',
      '',
      '3. Missions accomplished',
      '   - Requirements analysis with R&D team',
      '   - Design of the electrical cabinet (Eplan P8)',
      '   - PLC programming (Beckhoff TwinCAT 3)',
      '   - SCADA interface (LabVIEW)',
      '   - Commissioning and validation report',
      '',
      '4. Skills demonstrated',
      '   IEC 61131-3, structured text programming,',
      '   industrial network integration (EtherCAT),',
      '   technical documentation in English.',
    ]],
    'tp_s71200_roux.pdf': ['TP Programmation S7-1200 — Quentin ROUX', 'Quentin Roux — FISAA4 24-27', [
      'Sujet : Controle d\'un convoyeur simule avec TIA Portal V17',
      '',
      '1. Analyse fonctionnelle',
      '   GRAFCET de niveau 1 et niveau 2 realises.',
      '   Etapes, transitions et actions documentees.',
      '',
      '2. Programmation Ladder',
      '   Blocs OB1, FC1 (demarrage), FC2 (arret urgence)',
      '   Gestion des defauts avec diagnostic.',
      '',
      '3. Supervision basique',
      '   Table de variables TIA Portal configuree.',
      '   Test avec simulateur PLCSIM.',
      '',
      'Resultats : convoyeur fonctionnel, arret urgence OK.',
      'Points a ameliorer : gestion du redemarrage apres defaut.',
    ]],
    'tp_wincc_garnier.pdf': ['TP Interface WinCC — Elisa GARNIER', 'Elisa Garnier — FISAA4 24-27', [
      'Sujet : Supervision d\'un process de remplissage avec WinCC',
      '',
      '1. Architecture de supervision',
      '   3 ecrans : vue generale, detail cuves, alarmes',
      '   Communication OPC-UA avec l\'automate S7-1500',
      '',
      '2. Objets graphiques realises',
      '   - Niveaux de cuves (bargraphes dynamiques)',
      '   - Vannes (animation ouvert/ferme)',
      '   - Courbes de tendance (2h glissantes)',
      '   - Tableau d\'alarmes avec acquittement',
      '',
      '3. Archivage',
      '   Variables process archivees toutes les 30 secondes.',
      '   Export CSV disponible.',
      '',
      'Note : ecran d\'alarmes tres bien realise, courbes a ameliorer.',
    ]],
  }

  const created = {}
  for (const [filename, [title, author, bodyLines]] of Object.entries(files)) {
    const fp = path.join(dir, filename)
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, makePdfBuffer(title, author, bodyLines))
    created[filename] = fp
  }
  return created
}

// ─── Seed principal ────────────────────────────────────────────────────────────
function seedIfEmpty() {
  const db    = getDb()
  const count = db.prepare('SELECT COUNT(*) AS n FROM promotions').get().n
  if (count > 0) return
  doSeed(db)
}

function resetAndSeed() {
  const db = getDb()
  db.transaction(() => {
    for (const t of ['depots','travail_group_members','ressources','channel_documents',
                     'messages','group_members','groups','travaux','students','channels','promotions']) {
      db.prepare(`DELETE FROM ${t}`).run()
    }
    // Réinitialiser les auto-increment
    db.prepare("DELETE FROM sqlite_sequence").run()
  })()
  doSeed(db)
}

function doSeed(db) {
  const pdfs = ensureTestFiles()
  function pdf(name) { return pdfs[name] || '' }

  const ip   = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)')
  const ic   = db.prepare('INSERT INTO channels (promo_id, name, description, type, category) VALUES (?, ?, ?, ?, ?)')
  const is_  = db.prepare('INSERT INTO students (promo_id, name, email, avatar_initials) VALUES (?, ?, ?, ?)')
  const ig   = db.prepare('INSERT INTO groups (promo_id, name) VALUES (?, ?)')
  const im   = db.prepare('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)')
  const imsg = db.prepare('INSERT INTO messages (channel_id, dm_student_id, author_name, author_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  const it   = db.prepare('INSERT INTO travaux (channel_id, group_id, title, description, start_date, deadline, category, type, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const itgm = db.prepare('INSERT OR IGNORE INTO travail_group_members (travail_id, student_id, group_id) VALUES (?, ?, ?)')
  const ir   = db.prepare('INSERT INTO ressources (travail_id, type, name, path_or_url) VALUES (?, ?, ?, ?)')
  const id_  = db.prepare('INSERT INTO depots (travail_id, student_id, file_name, file_path, note, feedback, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const icd  = db.prepare('INSERT INTO channel_documents (channel_id, category, type, name, path_or_url, description) VALUES (?, ?, ?, ?, ?, ?)')

  // ════════════════════════════════════════
  //  PROMOTION 1 — CPIA2 25-26
  // ════════════════════════════════════════
  const p1 = ip.run('CPIA2 25-26', '#E8742A').lastInsertRowid

  const c1_ann    = ic.run(p1, 'annonces',      'Informations importantes',           'annonce', null).lastInsertRowid
  const c1_gen    = ic.run(p1, 'general',        'Canal principal de la promo',        'chat', '💬 Communication').lastInsertRowid
  const c1_dev    = ic.run(p1, 'cours-dev',      'Cours de développement logiciel',    'chat', '💻 Développement').lastInsertRowid
  const c1_rdev   = ic.run(p1, 'remise-dev',     'Dépôt des travaux de développement', 'chat', '💻 Développement').lastInsertRowid
  const c1_algo   = ic.run(p1, 'cours-algo',     'Algorithmique et structures',         'chat', '⚙️ Algorithmique').lastInsertRowid
  const c1_tpalgo = ic.run(p1, 'tp-algo',        'Dépôt des TPs algorithmique',         'chat', '⚙️ Algorithmique').lastInsertRowid
  const c1_bdd    = ic.run(p1, 'cours-bdd',      'Bases de données et modélisation',    'chat', '🗄️ Bases de données').lastInsertRowid
  const c1_tpbdd  = ic.run(p1, 'tp-bdd',         'Dépôt des TPs bases de données',     'chat', '🗄️ Bases de données').lastInsertRowid
  const c1_net    = ic.run(p1, 'reseaux',        'Réseaux & administration système',    'chat', '📡 Réseaux').lastInsertRowid

  const s1 = is_.run(p1, 'Lucas Dupont',    'lucas.dupont@viacesi.fr',    'LD').lastInsertRowid
  const s2 = is_.run(p1, 'Manon Bernard',   'manon.bernard@viacesi.fr',   'MB').lastInsertRowid
  const s3 = is_.run(p1, 'Theo Leclerc',    'theo.leclerc@viacesi.fr',    'TL').lastInsertRowid
  const s4 = is_.run(p1, 'Camille Rousseau','camille.rousseau@viacesi.fr','CR').lastInsertRowid
  const s5 = is_.run(p1, 'Hugo Martin',     'hugo.martin@viacesi.fr',     'HM').lastInsertRowid
  const s6 = is_.run(p1, 'Jade Petit',      'jade.petit@viacesi.fr',      'JP').lastInsertRowid
  const s7 = is_.run(p1, 'Nathan Dubois',   'nathan.dubois@viacesi.fr',   'ND').lastInsertRowid
  const s8 = is_.run(p1, 'Lea Fontaine',    'lea.fontaine@viacesi.fr',    'LF').lastInsertRowid

  const g1 = ig.run(p1, 'Groupe 1').lastInsertRowid
  const g2 = ig.run(p1, 'Groupe 2').lastInsertRowid
  const g3 = ig.run(p1, 'Groupe 3').lastInsertRowid
  im.run(g1,s1); im.run(g1,s2); im.run(g1,s3)
  im.run(g2,s4); im.run(g2,s5); im.run(g2,s6)
  im.run(g3,s7); im.run(g3,s8)

  // ── Messages CPIA2 ─────────────────────
  imsg.run(c1_ann,null,'Rohan Fosse','teacher','Bienvenue en CPIA2 25-26 ! Consultez regulierement ce canal pour les informations importantes.','2026-01-06 08:00:00')
  imsg.run(c1_ann,null,'Rohan Fosse','teacher','Planning des livrables mis a jour. Maquette projet Web a remettre avant le 27 mars.','2026-03-01 09:00:00')
  imsg.run(c1_ann,null,'Rohan Fosse','teacher','Rappel : TP Algorithmique (structures de donnees) — deadline le 3 avril.','2026-03-15 10:00:00')

  imsg.run(c1_gen,null,'Rohan Fosse','teacher','Bonjour a tous ! Cette annee vous travaillerez sur 4 projets : Dev Web, Algo, BDD et Reseaux.','2026-01-06 09:00:00')
  imsg.run(c1_gen,null,'Lucas Dupont','student','Bonjour M. Fosse, on va travailler en groupes pour tous les projets ?','2026-01-06 09:15:00')
  imsg.run(c1_gen,null,'Rohan Fosse','teacher','Seuls les TDs sont en groupes. Les devoirs individuels et les examens sont personnels.','2026-01-06 09:20:00')
  imsg.run(c1_gen,null,'Manon Bernard','student','Les projets auront une soutenance en fin de semestre ?','2026-01-07 10:00:00')
  imsg.run(c1_gen,null,'Rohan Fosse','teacher','Oui, chaque projet se termine par une soutenance. Le calendrier est visible dans la section Travaux.','2026-01-07 10:10:00')

  imsg.run(c1_dev,null,'Rohan Fosse','teacher','Cours 1 disponible : introduction a Flask et aux architectures MVC. Cahier des charges du projet en ressource.','2026-01-13 09:00:00')
  imsg.run(c1_dev,null,'Jade Petit','student','On peut utiliser un framework CSS comme Bootstrap ?','2026-01-13 10:00:00')
  imsg.run(c1_dev,null,'Rohan Fosse','teacher','Oui, Bootstrap ou Tailwind sont autorises. L\'essentiel est que le HTML/CSS soit propre et structure.','2026-01-13 10:10:00')
  imsg.run(c1_dev,null,'Nathan Dubois','student','Flask ou FastAPI pour l\'API REST ?','2026-01-14 11:00:00')
  imsg.run(c1_dev,null,'Rohan Fosse','teacher','Flask pour ce projet. FastAPI sera vu en semestre 2.','2026-01-14 11:05:00')

  imsg.run(c1_rdev,null,'Rohan Fosse','teacher','Livrable 1 ouvert : Maquette + specifications. Deadline le 27 mars. Cahier des charges en ressource.','2026-01-15 08:00:00')
  imsg.run(c1_rdev,null,'Camille Rousseau','student','On rend un PDF des wireframes ou une maquette interactive ?','2026-01-15 09:00:00')
  imsg.run(c1_rdev,null,'Rohan Fosse','teacher','PDF des wireframes + document de specifications. Figma est accepte si vous exportez en PDF.','2026-01-15 09:10:00')

  imsg.run(c1_algo,null,'Rohan Fosse','teacher','Debut du module algorithmique. On commence par les structures de donnees fondamentales.','2026-02-03 09:00:00')
  imsg.run(c1_algo,null,'Theo Leclerc','student','Les listes chainees sont au programme ?','2026-02-03 10:00:00')
  imsg.run(c1_algo,null,'Rohan Fosse','teacher','Pile, file, table de hachage et arbres binaires. Les listes chainees sont en complement.','2026-02-03 10:05:00')

  imsg.run(c1_bdd,null,'Rohan Fosse','teacher','Module BDD : on commence par la modelisation UML, puis SQL avance. DM UML a rendre le 28 mars.','2026-02-17 09:00:00')
  imsg.run(c1_bdd,null,'Hugo Martin','student','On doit utiliser un outil specifique pour les diagrammes ?','2026-02-17 10:00:00')
  imsg.run(c1_bdd,null,'Rohan Fosse','teacher','Draw.io ou PlantUML recommandes. Enterprise Architect aussi si vous y avez acces.','2026-02-17 10:05:00')

  // DMs CPIA2
  imsg.run(null,s1,'Lucas Dupont','student','M. Fosse, puis-je utiliser Figma pour ma maquette ?','2026-01-20 14:00:00')
  imsg.run(null,s1,'Rohan Fosse','teacher','Oui, Figma est parfait. Exportez en PDF pour le rendu.','2026-01-20 14:05:00')
  imsg.run(null,s3,'Theo Leclerc','student','Je bloque sur la table de hachage, les collisions ne sont pas bien gerees.','2026-03-20 16:00:00')
  imsg.run(null,s3,'Rohan Fosse','teacher','Utilise le chaining (liste chainee pour chaque bucket). Je peux partager un exemple si besoin.','2026-03-20 16:10:00')

  // ── Travaux CPIA2 ──────────────────────
  // Projet : 💻 Développement Web
  const t_web1 = it.run(c1_rdev,null,
    'Livrable 1 — Maquette & spécifications',
    'Concevoir et documenter la maquette de votre application web :\n- Wireframes de tous les ecrans (desktop + mobile)\n- Diagramme de cas d\'utilisation\n- Modele de donnees (schema BDD)\n- Charte graphique\nRendu PDF via la section Travaux.',
    '2026-01-15','2026-03-27 23:59:00','💻 Développement Web','devoir',1).lastInsertRowid
  ir.run(t_web1,'file','Cahier des charges projet Web', pdf('cahier_charges_web.pdf'))
  ir.run(t_web1,'link','Draw.io — Diagrammes gratuits','https://app.diagrams.net/')
  ir.run(t_web1,'link','Figma — Maquettes UI','https://figma.com/')

  const t_web2 = it.run(c1_rdev,null,
    'Livrable 2 — Version bêta fonctionnelle',
    'Remettre une version beta de votre application :\n- Authentification fonctionnelle\n- Au moins 2 fonctionnalites CRUD completes\n- Tests unitaires (couverture > 60%)\n- README avec instructions d\'installation\nRendu : archive ZIP (code source) + rapport PDF.',
    '2026-03-28','2026-05-08 23:59:00','💻 Développement Web','devoir',1).lastInsertRowid
  ir.run(t_web2,'link','Flask documentation','https://flask.palletsprojects.com/')
  ir.run(t_web2,'link','pytest — Tests Python','https://docs.pytest.org/')

  it.run(c1_rdev,null,
    'Soutenance finale — Projet Web',
    'Presentation de votre application finalisee.\nDuree : 15 min demo + 5 min questions.\nCriteres : qualite du code, fonctionnalites, design, tests.',
    '2026-06-12','2026-06-12 09:00:00','💻 Développement Web','jalon',1)

  // Projet : ⚙️ Algorithmique
  const t_algo1 = it.run(c1_tpalgo,null,
    'TP — Structures de données fondamentales',
    'Implementer en Python :\n1. Pile (Stack) avec push/pop/peek\n2. File (Queue) avec enqueue/dequeue\n3. Table de hachage avec gestion des collisions\nChaque structure doit avoir ses tests unitaires. Fichier .py unique.',
    '2026-02-01','2026-04-03 23:59:00','⚙️ Algorithmique','devoir',1).lastInsertRowid
  ir.run(t_algo1,'link','Visualgo — Structures de données','https://visualgo.net/en/list')
  ir.run(t_algo1,'link','Documentation Python collections','https://docs.python.org/3/library/collections.html')

  const t_algo2 = it.run(c1_tpalgo,null,
    'TP — Algorithmes de tri & complexité',
    'Implementer et comparer :\n- Bubble sort, Insertion sort, Merge sort, Quicksort\nMesurer les performances avec timeit sur des tableaux de 100, 1000, 10000 elements.\nRendu : .py + tableau de complexites commenté.',
    '2026-04-04','2026-05-02 23:59:00','⚙️ Algorithmique','devoir',1).lastInsertRowid
  ir.run(t_algo2,'link','Big-O Cheat Sheet','https://www.bigocheatsheet.com/')

  it.run(c1_tpalgo,null,
    'Examen algorithmique — Mi-parcours',
    'Examen sur table, 2h. Programme : structures de donnees + complexite + tris.\nQCM (20 pts) + exercice de code (20 pts). Pas de ressources autorisees.',
    '2026-05-22','2026-05-22 09:00:00','⚙️ Algorithmique','jalon',1)

  // Projet : 🗄️ Bases de données
  const t_bdd1 = it.run(c1_tpbdd,null,
    'DM — Modélisation UML',
    'Modeliser un systeme de gestion de bibliotheque :\n- Diagramme de cas d\'utilisation (avec acteurs, includes, extends)\n- Diagramme de classes (avec multiplicites et types)\n- Diagramme de sequence pour "Emprunter un ouvrage"\nRendu PDF.',
    '2026-02-15','2026-03-28 23:59:00','🗄️ Bases de données','devoir',1).lastInsertRowid
  ir.run(t_bdd1,'link','PlantUML — UML en texte','https://plantuml.com/')
  ir.run(t_bdd1,'link','UML Resource Center','https://www.uml.org/')

  const t_bdd2 = it.run(c1_tpbdd,null,
    'TP — Requêtes SQL avancées',
    'Exercices sur :\n- Jointures (INNER, LEFT, FULL)\n- Sous-requetes correlees\n- Fonctions d\'agregation et GROUP BY / HAVING\n- Vues et index\nBase de donnees fournie en ressource. Rendu : fichier .sql.',
    '2026-03-29','2026-05-09 23:59:00','🗄️ Bases de données','devoir',1).lastInsertRowid
  ir.run(t_bdd2,'link','SQLZoo — Pratique SQL interactive','https://sqlzoo.net/')

  it.run(c1_tpbdd,null,
    'Examen BDD — Modélisation & SQL',
    'Examen 2h. Partie 1 : modelisation UML (40%) — Partie 2 : requetes SQL (60%).\nBDD fournie. Pas de ressources autorisees.',
    '2026-05-28','2026-05-28 09:00:00','🗄️ Bases de données','jalon',1)

  // Projet : 📡 Réseaux
  const t_net1 = it.run(c1_net,null,
    'TP — Configuration réseau d\'entreprise',
    'Configurer un petit reseau d\'entreprise sous Cisco Packet Tracer :\n- 2 VLANs (utilisateurs / serveurs)\n- Routage inter-VLAN\n- DHCP + DNS\n- Pare-feu basique\nRendu : fichier .pkt + rapport PDF.',
    '2026-03-01','2026-04-17 23:59:00','📡 Réseaux','devoir',1).lastInsertRowid
  ir.run(t_net1,'link','Cisco Packet Tracer (telechargement)','https://www.netacad.com/courses/packet-tracer')

  it.run(c1_net,null,
    'Rapport — Mini-réseau d\'entreprise (projet final)',
    'Concevoir et documenter un reseau complet pour une PME de 50 employes :\n- Schema d\'architecture logique et physique\n- Adressage IP et plan de sous-reseaux\n- Choix des equipements justifies\n- Politique de securite\nRendu : rapport PDF (15-20 pages).',
    '2026-04-18','2026-06-05 23:59:00','📡 Réseaux','devoir',1)

  it.run(c1_net,null,
    'Soutenance — Projet Réseaux',
    'Presentation de votre architecture reseau.\nDuree : 10 min presentation + 5 min questions.\nSupport : slides + Packet Tracer demo.',
    '2026-06-19','2026-06-19 14:00:00','📡 Réseaux','jalon',1)

  // ── Dépôts CPIA2 ───────────────────────
  // t_web1 : Maquette
  id_.run(t_web1,s1,'DUPONT_Lucas_maquette_web.pdf',pdf('rapport_maquette_dupont.pdf'),'B','Bonne maquette. L\'arborescence est logique et les wireframes sont lisibles. Le modele de donnees manque de quelques relations. Pensez a documenter les contraintes de validation.','2026-03-24 21:00:00')
  id_.run(t_web1,s2,'BERNARD_Manon_maquette_web.pdf',pdf('rapport_maquette_bernard.pdf'),'A','Excellent travail. Maquette complete et tres professionnelle. Les 10 ecrans sont tous documentes avec les etats (vide, rempli, erreur). Le planning de developpement est realiste.','2026-03-22 18:30:00')
  id_.run(t_web1,s3,'LECLERC_Theo_maquette.pdf','depots/LECLERC_Theo_maquette.pdf','C','Correct mais incomplet. Les wireframes mobile manquent. Le diagramme de cas d\'utilisation est trop vague. A retravailler avant la version beta.','2026-03-27 22:00:00')
  id_.run(t_web1,s4,'ROUSSEAU_Camille_maquette.pdf',pdf('dm_uml_rousseau.pdf'),'B','Bien dans l\'ensemble. La charte graphique est un vrai plus. Quelques incoherences entre le schema BDD et les wireframes.','2026-03-25 20:00:00')
  id_.run(t_web1,s5,'MARTIN_Hugo_maquette.pdf','depots/MARTIN_Hugo_maquette.pdf','D','Rendu insuffisant. Seuls 3 ecrans sont documentes sur les 8 attendus. Le modele de donnees est absent. A completer rapidement.','2026-03-27 23:50:00')
  id_.run(t_web1,s6,'PETIT_Jade_maquette.pdf',pdf('dm_uml_petit.pdf'),'A','Remarquable. Tous les ecrans documentes, responsive design soigne, persona utilisateurs inclus. Reference pour la promo.','2026-03-21 17:00:00')
  id_.run(t_web1,s7,'DUBOIS_Nathan_maquette.pdf','depots/DUBOIS_Nathan_maquette.pdf','B','Bon travail. Les diagrammes de flux utilisateur sont particulierement bien realises. Quelques coquilles dans les specs.','2026-03-23 16:00:00')
  id_.run(t_web1,s8,'FONTAINE_Lea_maquette.pdf','depots/FONTAINE_Lea_maquette.pdf','A','Tres bien. Maquette interactive Figma exportee en PDF. Toutes les interactions documentees. Tres professionnel.','2026-03-26 20:00:00')

  // t_web2 : Version beta (rendu recent, notes partielles)
  id_.run(t_web2,s1,'DUPONT_Lucas_beta.zip','depots/DUPONT_Lucas_beta.zip','B','Application fonctionnelle, authentification + CRUD articles OK. Quelques bugs sur le formulaire d\'edition. Tests a 65%.','2026-05-04 21:00:00')
  id_.run(t_web2,s2,'BERNARD_Manon_beta.zip','depots/BERNARD_Manon_beta.zip','A','Excellent. Toutes les fonctionnalites presentes, code tres propre, tests a 85%. Le README est exemplaire.','2026-05-02 18:00:00')
  id_.run(t_web2,s4,'ROUSSEAU_Camille_beta.zip','depots/ROUSSEAU_Camille_beta.zip','C','Fonctionnalites de base OK mais design approximatif. Tests a 40%. Quelques erreurs non gerees cote serveur.','2026-05-07 22:00:00')
  id_.run(t_web2,s6,'PETIT_Jade_beta.zip','depots/PETIT_Jade_beta.zip','A','Superbe rendu. Interface tres soignee, API REST bien documentee (Swagger), tests a 90%.','2026-05-01 19:00:00')
  id_.run(t_web2,s7,'DUBOIS_Nathan_beta.zip','depots/DUBOIS_Nathan_beta.zip',null,null,'2026-05-08 23:30:00')
  id_.run(t_web2,s8,'FONTAINE_Lea_beta.zip','depots/FONTAINE_Lea_beta.zip','B','Bonne version beta. Quelques fonctionnalites secondaires manquantes mais le coeur est solide.','2026-05-05 20:00:00')

  // t_algo1 : TP structures de données
  id_.run(t_algo1,s1,'DUPONT_Lucas_structures.py','depots/DUPONT_Lucas_structures.py','B','Pile et File correctes. Table de hachage : le redimensionnement dynamique est bien implemente. Ameliorer la gestion des cas limites (pile vide).','2026-03-28 21:00:00')
  id_.run(t_algo1,s2,'BERNARD_Manon_structures.py','depots/BERNARD_Manon_structures.py','A','Excellent. Code tres propre, docstrings completes, 15 tests passes. La table de hachage avec sondage quadratique est un bonus apprecie.','2026-03-25 19:00:00')
  id_.run(t_algo1,s3,'LECLERC_Theo_structures.py',pdf('tp_algo_leclerc.pdf'),'C','Correct. 12 tests sur 15 passes. La gestion des collisions dans la table de hachage est incomplete (pas de redimensionnement).','2026-04-01 20:00:00')
  id_.run(t_algo1,s4,'ROUSSEAU_Camille_structures.py','depots/ROUSSEAU_Camille_structures.py','B','Bien. Les 3 structures sont implementees et testees. Quelques ameliorations possibles sur la complexite de la table de hachage.','2026-03-30 22:00:00')
  id_.run(t_algo1,s5,'MARTIN_Hugo_structures.py','depots/MARTIN_Hugo_structures.py','D','Seules la Pile et la File sont implementees. La table de hachage est absente. Rendu incomplet.','2026-04-02 23:00:00')
  id_.run(t_algo1,s6,'PETIT_Jade_structures.py','depots/PETIT_Jade_structures.py','A','Remarquable. Implementation tres efficace, tests exhaustifs, documentation claire. La table de hachage avec chaining et rehashing est parfaite.','2026-03-27 17:00:00')
  id_.run(t_algo1,s7,'DUBOIS_Nathan_structures.py','depots/DUBOIS_Nathan_structures.py','B','Bon travail. Toutes les structures presentes et testees. Le code pourrait etre plus Pythonique (use of __len__, __contains__).','2026-03-29 16:00:00')
  id_.run(t_algo1,s8,'FONTAINE_Lea_structures.py','depots/FONTAINE_Lea_structures.py','A','Tres bien. Code elegante avec protocoles Python (iterateurs, context managers). Reference.','2026-03-26 15:00:00')

  // t_bdd1 : DM UML
  id_.run(t_bdd1,s2,'BERNARD_Manon_UML.pdf','depots/BERNARD_Manon_UML.pdf','A','Excellent. Les 3 diagrammes sont coherents et complets. Le diagramme de sequence est particulierement detaille.','2026-03-25 18:00:00')
  id_.run(t_bdd1,s4,'ROUSSEAU_Camille_UML.pdf',pdf('dm_uml_rousseau.pdf'),'C','Correct. Quelques erreurs de multiplicite. Le diagramme de sequence ne couvre pas les cas d\'erreur.','2026-03-26 20:00:00')
  id_.run(t_bdd1,s6,'PETIT_Jade_UML.pdf',pdf('dm_uml_petit.pdf'),'A','Tres bien. Structure claire, les relations entre classes sont bien justifiees. Tres propre.','2026-03-23 17:00:00')
  id_.run(t_bdd1,s7,'DUBOIS_Nathan_UML.pdf','depots/DUBOIS_Nathan_UML.pdf','B','Bien. Les 3 diagrammes sont presents et globalement corrects. Quelques coquilles dans les noms de methodes.','2026-03-24 16:00:00')
  id_.run(t_bdd1,s8,'FONTAINE_Lea_UML.pdf','depots/FONTAINE_Lea_UML.pdf','B','Bonne modelisation. Le diagramme de classes est tres propre. Le diagramme de sequence pourrait etre plus exhaustif.','2026-03-27 20:00:00')

  // ── Documents de canal CPIA2 ───────────────────────
  icd.run(c1_dev,'💻 Développement Web','file','Cahier des charges — Projet Web Full-Stack',pdf('cahier_charges_web.pdf'),'Specifications completes du projet web annuel')
  icd.run(c1_dev,'💻 Développement Web','file','Grille d\'evaluation developpement',pdf('grille_eval_dev.pdf'),'Criteres et bareme de notation')
  icd.run(c1_dev,'Ressources','link','Documentation Flask','https://flask.palletsprojects.com/','Framework web Python utilise dans le projet')
  icd.run(c1_dev,'Ressources','link','MDN Web Docs — HTML/CSS/JS','https://developer.mozilla.org/fr/','Reference complete du developpement web')
  icd.run(c1_dev,'Outils','link','Python Tutor — Debogueur visuel','http://pythontutor.com/','Executer du code Python pas-a-pas')
  icd.run(c1_algo,'Cours','link','Visualgo — Algorithmes interactifs','https://visualgo.net/','Visualisation animee des structures de donnees')
  icd.run(c1_algo,'Cours','link','Big-O Cheat Sheet','https://www.bigocheatsheet.com/','Complexite des algorithmes courants')
  icd.run(c1_bdd,'Cours UML','link','Draw.io — Diagrammes gratuits','https://app.diagrams.net/','Outil en ligne pour diagrammes UML')
  icd.run(c1_bdd,'Cours SQL','link','SQLZoo — Pratique interactive','https://sqlzoo.net/','Exercices SQL interactifs')

  // ════════════════════════════════════════
  //  PROMOTION 2 — FISAA4 24-27
  // ════════════════════════════════════════
  const p2 = ip.run('FISAA4 24-27', '#2ECC71').lastInsertRowid

  const c2_ann      = ic.run(p2,'annonces',         'Informations importantes',               'annonce', null).lastInsertRowid
  const c2_gen      = ic.run(p2,'general',           'Canal principal',                         'chat','💬 Communication').lastInsertRowid
  const c2_auto     = ic.run(p2,'cours-automates',   'Cours automatisme industriel',            'chat','🔌 Automatisme').lastInsertRowid
  const c2_tp_auto  = ic.run(p2,'tp-automates',      'Dépôt des TPs automatisme',               'chat','🔌 Automatisme').lastInsertRowid
  const c2_scada    = ic.run(p2,'cours-scada',       'Cours supervision industrielle',          'chat','📊 Supervision').lastInsertRowid
  const c2_proj_sc  = ic.run(p2,'projet-supervision','Projet supervision SCADA',               'chat','📊 Supervision').lastInsertRowid
  const c2_profinet = ic.run(p2,'reseaux-industriels','Réseaux industriels & Profinet',         'chat','🌐 Réseaux industriels').lastInsertRowid
  const c2_e5       = ic.run(p2,'preparation-e5',    'Préparation projet E5',                  'chat','🎓 Projet E5').lastInsertRowid

  const f1  = is_.run(p2,'Alexandre Moreau',  'alexandre.moreau@viacesi.fr',  'AM').lastInsertRowid
  const f2  = is_.run(p2,'Chloe Simon',       'chloe.simon@viacesi.fr',       'CS').lastInsertRowid
  const f3  = is_.run(p2,'Maxime Laurent',    'maxime.laurent@viacesi.fr',    'ML').lastInsertRowid
  const f4  = is_.run(p2,'Elisa Garnier',     'elisa.garnier@viacesi.fr',     'EG').lastInsertRowid
  const f5  = is_.run(p2,'Raphael Lefebvre',  'raphael.lefebvre@viacesi.fr',  'RL').lastInsertRowid
  const f6  = is_.run(p2,'Ines Thomas',       'ines.thomas@viacesi.fr',       'IT').lastInsertRowid
  const f7  = is_.run(p2,'Quentin Roux',      'quentin.roux@viacesi.fr',      'QR').lastInsertRowid
  const f8  = is_.run(p2,'Amelie Girard',     'amelie.girard@viacesi.fr',     'AG').lastInsertRowid
  const f9  = is_.run(p2,'Pierre Bonnet',     'pierre.bonnet@viacesi.fr',     'PB').lastInsertRowid
  const f10 = is_.run(p2,'Sofia Dumont',      'sofia.dumont@viacesi.fr',      'SD').lastInsertRowid
  const f11 = is_.run(p2,'Antoine Chevalier', 'antoine.chevalier@viacesi.fr', 'AC').lastInsertRowid
  const f12 = is_.run(p2,'Laura Vincent',     'laura.vincent@viacesi.fr',     'LV').lastInsertRowid

  const ga = ig.run(p2,'Groupe A').lastInsertRowid
  const gb = ig.run(p2,'Groupe B').lastInsertRowid
  const gc = ig.run(p2,'Groupe C').lastInsertRowid
  im.run(ga,f1);im.run(ga,f2);im.run(ga,f3);im.run(ga,f4)
  im.run(gb,f5);im.run(gb,f6);im.run(gb,f7);im.run(gb,f8)
  im.run(gc,f9);im.run(gc,f10);im.run(gc,f11);im.run(gc,f12)

  // ── Messages FISAA4 ────────────────────
  imsg.run(c2_ann,null,'Rohan Fosse','teacher','Bienvenue en FISAA4 24-27. Les soutenances E5 approchent — consultez #preparation-e5 pour le calendrier.','2026-01-06 08:00:00')
  imsg.run(c2_ann,null,'Rohan Fosse','teacher','Planning des TPs Automatisme : S7-1200 le 25 mars, Projet ligne de tri a partir du 4 avril.','2026-03-01 09:00:00')
  imsg.run(c2_ann,null,'Rohan Fosse','teacher','Rappel : dossier contexte professionnel E5 a deposer avant le 1er avril, 23h59.','2026-03-15 10:00:00')

  imsg.run(c2_gen,null,'Rohan Fosse','teacher','Bonjour. Cette annee est decisive avec les soutenances E5 et 3 projets industriels importants.','2026-01-06 09:00:00')
  imsg.run(c2_gen,null,'Alexandre Moreau','student','Bonjour M. Fosse. Les groupes pour les projets sont fixes ?','2026-01-06 09:15:00')
  imsg.run(c2_gen,null,'Rohan Fosse','teacher','Oui, groupes A/B/C de 4. Chaque groupe aura un projet industriel different (tri, SCADA, reseaux).','2026-01-06 09:20:00')

  imsg.run(c2_auto,null,'Rohan Fosse','teacher','Debut du module automatisme. Revision du GRAFCET, puis programmation Ladder/ST sur S7-1200 avec TIA Portal V17.','2026-01-20 09:00:00')
  imsg.run(c2_auto,null,'Quentin Roux','student','On a acces a TIA Portal sur nos PC perso ?','2026-01-20 10:00:00')
  imsg.run(c2_auto,null,'Rohan Fosse','teacher','TIA Portal est disponible sur les postes du labo uniquement (licence Siemens). Utilisez PLCSIM pour simuler.','2026-01-20 10:05:00')

  imsg.run(c2_scada,null,'Rohan Fosse','teacher','Debut du module SCADA. Concepts : architecture, OPC-UA, alarmes, historisation. TP WinCC en avril.','2026-02-10 09:00:00')
  imsg.run(c2_scada,null,'Elisa Garnier','student','On utilise WinCC Basic ou WinCC Unified ?','2026-02-10 10:00:00')
  imsg.run(c2_scada,null,'Rohan Fosse','teacher','WinCC Comfort pour le TP, WinCC Unified pour le projet. Les deux sont sur les postes du labo.','2026-02-10 10:05:00')

  imsg.run(c2_e5,null,'Rohan Fosse','teacher','Calendrier E5 confirme : Groupe A le 18 avril, B le 19, C le 20. Jury : M. Fosse + tuteur entreprise.','2026-01-15 10:00:00')
  imsg.run(c2_e5,null,'Chloe Simon','student','Ma soutenance peut se faire en anglais ? Mon maitre de stage est anglophone.','2026-01-15 11:00:00')
  imsg.run(c2_e5,null,'Rohan Fosse','teacher','Oui, tout a fait possible et valorise. Prevenez-moi pour que je prepare le jury en consequence.','2026-01-15 11:05:00')
  imsg.run(c2_e5,null,'Pierre Bonnet','student','On peut deposer des versions intermediaires du dossier ?','2026-02-01 14:00:00')
  imsg.run(c2_e5,null,'Rohan Fosse','teacher','Oui. Chaque depot remplace le precedent. Envoyez aussi en DM pour un retour avant le rendu final.','2026-02-01 14:08:00')

  // DMs FISAA4
  imsg.run(null,f1,'Alexandre Moreau','student','M. Fosse, puis-je vous envoyer mon plan de dossier E5 pour un retour ?','2026-02-10 14:00:00')
  imsg.run(null,f1,'Rohan Fosse','teacher','Oui, envoyez-moi en DM. Je lis et commente sous 48h.','2026-02-10 14:05:00')
  imsg.run(null,f9,'Pierre Bonnet','student','J\'ai change d\'entreprise en cours de formation. Ca impacte mon dossier E5 ?','2026-02-15 10:00:00')
  imsg.run(null,f9,'Rohan Fosse','teacher','Un peu. Adaptez la partie 1 pour presenter les deux contextes et focalisez sur le projet le plus representatif.','2026-02-15 10:10:00')

  // ── Travaux FISAA4 ─────────────────────
  // Projet : 🔌 Automatisme Siemens
  const f_auto1 = it.run(c2_tp_auto,null,
    'TP — Programmation S7-1200 (TIA Portal)',
    'Programmer un automate Siemens S7-1200 pour controler un convoyeur simule :\n- GRAFCET de niveau 1 et 2\n- Traduction en Ladder (OB1 + FC)\n- Gestion des defauts et arret urgence\n- Test avec PLCSIM V17\nRendu : fichier projet TIA (.zap) + rapport PDF.',
    '2026-01-20','2026-04-03 17:00:00','🔌 Automatisme Siemens','devoir',1).lastInsertRowid
  ir.run(f_auto1,'link','Documentation TIA Portal Siemens','https://support.industry.siemens.com/')
  ir.run(f_auto1,'link','Introduction GRAFCET','https://www.plcopen.org/')

  const f_auto2 = it.run(c2_tp_auto,null,
    'Projet — Ligne de tri automatique',
    'Concevoir et programmer une ligne de tri automatique selon le CDC fourni :\n- Analyse fonctionnelle complete (GRAFCET multi-niveau)\n- Programme automate (TIA Portal V17)\n- Interface SCADA basique (WinCC Basic)\n- Rapport de tests\nTravail par groupes (A/B/C).',
    '2026-04-04','2026-05-22 17:00:00','🔌 Automatisme Siemens','devoir',1).lastInsertRowid
  ir.run(f_auto2,'link','Siemens Industry Online Support','https://support.industry.siemens.com/')

  it.run(c2_tp_auto,null,
    'Soutenance — Automatisme Siemens',
    'Presentation et demo de votre projet ligne de tri.\nDuree : 20 min presentation + 10 min questions.\nJury : M. Fosse + ingenieur partenaire.',
    '2026-06-05','2026-06-05 09:00:00','🔌 Automatisme Siemens','jalon',1)

  // Projet : 📊 Supervision SCADA
  const f_scada1 = it.run(c2_proj_sc,null,
    'TP — Interface WinCC (supervision de process)',
    'Creer une interface de supervision WinCC Comfort pour un process de remplissage :\n- 3 ecrans : vue generale, detail cuves, historique alarmes\n- Communication OPC-UA avec automate S7-1500\n- Courbes de tendance\n- Archivage des variables\nRendu : projet WinCC + rapport PDF.',
    '2026-02-10','2026-04-17 17:00:00','📊 Supervision SCADA','devoir',1).lastInsertRowid
  ir.run(f_scada1,'link','WinCC Unified documentation','https://support.industry.siemens.com/')

  it.run(c2_proj_sc,null,
    'Projet — Supervision complète (SCADA avancé)',
    'Developper une solution de supervision complete pour un atelier de production :\n- Interface multi-ecrans\n- Gestion des alarmes (priorites, acquittement, rapport)\n- Historisation et export CSV\n- Rapport de sécurité (droits utilisateurs)\nRendu complet attendu.',
    '2026-04-18','2026-06-06 17:00:00','📊 Supervision SCADA','devoir',1)

  it.run(c2_proj_sc,null,
    'Soutenance — Projet SCADA',
    'Presentation de votre solution de supervision.\nDuree : 20 min demo + 10 min questions.\nCriteres : ergonomie, fonctionnalites, securite, gestion alarmes.',
    '2026-06-19','2026-06-19 14:00:00','📊 Supervision SCADA','jalon',1)

  // Projet : 🌐 Réseaux industriels
  const f_net1 = it.run(c2_profinet,null,
    'TP — Réseaux industriels Profinet',
    'Configurer un reseau Profinet avec TIA Portal :\n- 1 CPU S7-1500 + 2 ET200SP en reseau\n- Adressage Profinet (Device Name, IP)\n- Echange de donnees I/O\n- Diagnostic reseau\nRendu : projet TIA + rapport PDF.',
    '2026-02-20','2026-04-10 17:00:00','🌐 Réseaux industriels','devoir',1).lastInsertRowid
  ir.run(f_net1,'link','Profinet University','https://profinetuniversity.com/')

  it.run(c2_profinet,null,
    'Projet — Intégration réseau industriel',
    'Integrer un reseau industriel complet pour un atelier simule :\n- Profinet (capteurs, actionneurs, variateurs)\n- OPC-UA (communication avec SCADA)\n- Diagnostic et maintenance preventive\nRendu : architecture + programme + rapport.',
    '2026-04-11','2026-05-29 17:00:00','🌐 Réseaux industriels','devoir',1)

  it.run(c2_profinet,null,
    'Examen — Réseaux industriels',
    'Examen 2h sur table. QCM (40%) + exercice de configuration (60%).\nProgramme : Profinet, OPC-UA, diagnostic reseau.',
    '2026-06-05','2026-06-05 14:00:00','🌐 Réseaux industriels','jalon',1)

  // Projet : 🎓 Projet E5
  const f_e5_1 = it.run(c2_e5,null,
    'Dossier — Contexte professionnel E5',
    'Rediger le contexte professionnel selon le referentiel BTS FISAA :\n- Presentation entreprise\n- Contexte et enjeux du projet\n- Missions realisees et livrables\n- Competences demontrées\n- Bilan\nFormat : PDF, 5-8 pages hors annexes.',
    '2025-09-01','2026-04-01 23:59:00','🎓 Projet E5','devoir',1).lastInsertRowid
  ir.run(f_e5_1,'file','Référentiel officiel E5 BTS FISAA',pdf('referentiel_e5.pdf'))
  ir.run(f_e5_1,'link','Eduscol — Épreuves BTS','https://eduscol.education.fr/')

  const f_e5_2 = it.run(c2_e5,null,
    'Rapport de stage — Période industrie',
    'Rediger le rapport de stage de votre periode industrie :\n- Introduction et presentation de l\'entreprise\n- Deroulement de la periode (planning, missions)\n- Competences acquises\n- Retour d\'experience et perspectives\nFormat : PDF, 20-30 pages.',
    '2025-09-01','2026-04-15 23:59:00','🎓 Projet E5','devoir',1).lastInsertRowid
  ir.run(f_e5_2,'link','Guide de redaction rapport de stage CESI','https://www.cesi.fr/')

  const f_e5_3a = it.run(c2_e5,ga,
    'Soutenance E5 — Groupe A',
    'Soutenance individuelle devant jury.\nDuree : 20 min expose + 10 min questions.\nJury : M. Fosse + representant entreprise.\nLieu : salle conference CESI.',
    '2026-04-18','2026-04-18 09:00:00','🎓 Projet E5','jalon',1).lastInsertRowid
  itgm.run(f_e5_3a,f1,ga); itgm.run(f_e5_3a,f2,ga); itgm.run(f_e5_3a,f3,ga); itgm.run(f_e5_3a,f4,ga)

  const f_e5_3b = it.run(c2_e5,gb,
    'Soutenance E5 — Groupe B',
    'Memes modalites que Groupe A.',
    '2026-04-19','2026-04-19 09:00:00','🎓 Projet E5','jalon',1).lastInsertRowid
  itgm.run(f_e5_3b,f5,gb); itgm.run(f_e5_3b,f6,gb); itgm.run(f_e5_3b,f7,gb); itgm.run(f_e5_3b,f8,gb)

  const f_e5_3c = it.run(c2_e5,gc,
    'Soutenance E5 — Groupe C',
    'Memes modalites que Groupe A.',
    '2026-04-20','2026-04-20 09:00:00','🎓 Projet E5','jalon',1).lastInsertRowid
  itgm.run(f_e5_3c,f9,gc); itgm.run(f_e5_3c,f10,gc); itgm.run(f_e5_3c,f11,gc); itgm.run(f_e5_3c,f12,gc)

  // ── Dépôts FISAA4 ──────────────────────
  // f_e5_1 : Dossier E5
  id_.run(f_e5_1,f1,'MOREAU_Alexandre_E5_v2.pdf',pdf('dossier_e5_moreau.pdf'),'A','Excellent dossier. Contexte professionnel tres precis, missions bien decrites avec livrables concrets. Tres bonne maitrise des outils industriels (TIA Portal, Eplan). Reference pour la promotion.','2026-03-28 20:00:00')
  id_.run(f_e5_1,f2,'SIMON_Chloe_E5.pdf',pdf('dossier_e5_simon.pdf'),'A','Remarquable. Redige en anglais avec un niveau professionnel eleve. La partie competences est particulierement bien argumentee. Jury sera impressionne.','2026-03-25 18:00:00')
  id_.run(f_e5_1,f3,'LAURENT_Maxime_E5.pdf','depots/LAURENT_Maxime_E5.pdf','B','Bon dossier dans l\'ensemble. La partie livrables manque de concret (pas de chiffres, pas de schema). Quelques fautes a corriger avant la soutenance.','2026-03-30 22:00:00')
  id_.run(f_e5_1,f4,'GARNIER_Elisa_E5.pdf','depots/GARNIER_Elisa_E5.pdf','B','Tres bien. Structure claire et bien ecrite. Ajoutez quelques schemas techniques pour illustrer les missions.','2026-03-29 19:00:00')
  id_.run(f_e5_1,f5,'LEFEBVRE_Raphael_E5.pdf','depots/LEFEBVRE_Raphael_E5.pdf',null,null,'2026-03-31 23:50:00')
  id_.run(f_e5_1,f6,'THOMAS_Ines_E5.pdf','depots/THOMAS_Ines_E5.pdf','C','Correct mais superficiel. La description du projet est trop vague. Aucun livrable concret mentionne. A enrichir considerablement avant la soutenance.','2026-03-30 21:00:00')
  id_.run(f_e5_1,f7,'ROUX_Quentin_E5.pdf','depots/ROUX_Quentin_E5.pdf',null,null,'2026-04-01 23:30:00')
  id_.run(f_e5_1,f8,'GIRARD_Amelie_E5.pdf','depots/GIRARD_Amelie_E5.pdf','C','Contexte correct mais la partie competences est trop generale. Aucune competence technique specifiquement demontrée.','2026-03-27 17:00:00')
  id_.run(f_e5_1,f9,'BONNET_Pierre_E5_v2.pdf','depots/BONNET_Pierre_E5_v2.pdf','B','Bien malgre le changement d\'entreprise en cours de formation. La transition est bien expliquee et le projet final est pertinent.','2026-04-01 20:00:00')
  id_.run(f_e5_1,f11,'CHEVALIER_Antoine_E5.pdf','depots/CHEVALIER_Antoine_E5.pdf',null,null,'2026-03-31 16:00:00')
  id_.run(f_e5_1,f12,'VINCENT_Laura_E5.pdf','depots/VINCENT_Laura_E5.pdf','A','Tres bon dossier. Projet d\'integration complexe tres bien documentes. Competences techniques clairement demontrées.','2026-03-30 23:00:00')

  // f_auto1 : TP S7-1200
  id_.run(f_auto1,f3,'LAURENT_Maxime_convoyeur.zip','depots/LAURENT_Maxime_convoyeur.zip','B','GRAFCET complet et coherent. Programme Ladder fonctionnel. La gestion du redemarrage apres defaut est incomplete.','2026-03-28 16:00:00')
  id_.run(f_auto1,f4,'GARNIER_Elisa_TP_S7.pdf',pdf('tp_wincc_garnier.pdf'),'A','Excellent. GRAFCET multi-niveaux tres propre, gestion des defauts complete. Le rapport est exemplaire avec schema electrique inclus.','2026-03-25 19:00:00')
  id_.run(f_auto1,f7,'ROUX_Quentin_TP_S7.pdf',pdf('tp_s71200_roux.pdf'),'B','Bon travail. Convoyeur fonctionnel. Points a ameliorer : gestion redemarrage et mode maintenance.','2026-03-30 20:00:00')
  id_.run(f_auto1,f9,'BONNET_Pierre_convoyeur.zip','depots/BONNET_Pierre_convoyeur.zip','C','Correct mais GRAFCET de niveau 2 incomplet. Les blocs FC sont pas assez structures. Fonctionnel en simulation.','2026-04-02 11:00:00')

  // f_scada1 : TP WinCC
  id_.run(f_scada1,f1,'MOREAU_Alexandre_WinCC.zip','depots/MOREAU_Alexandre_WinCC.zip','A','Tres bonne interface. Les 3 ecrans sont complets et ergonomiques. La communication OPC-UA est bien configuree. Les courbes de tendance fonctionnent parfaitement.','2026-04-14 20:00:00')
  id_.run(f_scada1,f4,'GARNIER_Elisa_WinCC.pdf',pdf('tp_wincc_garnier.pdf'),'A','Interface tres soignee, gestion des alarmes complete avec niveaux de priorite. L\'archivage et l\'export CSV fonctionnent. Tres bon niveau.','2026-04-12 17:00:00')
  id_.run(f_scada1,f6,'THOMAS_Ines_WinCC.zip','depots/THOMAS_Ines_WinCC.zip','B','Bien. Les 3 ecrans sont realises. Les courbes de tendance pourraient etre mieux parametrees. Alarmes fonctionnelles.','2026-04-16 21:00:00')
  id_.run(f_scada1,f8,'GIRARD_Amelie_WinCC.zip','depots/GIRARD_Amelie_WinCC.zip','C','Ecrans corrects mais communication OPC-UA non configuree. Archivage absent. A completer.','2026-04-17 10:00:00')
  id_.run(f_scada1,f10,'DUMONT_Sofia_WinCC.zip','depots/DUMONT_Sofia_WinCC.zip',null,null,'2026-04-17 16:00:00')

  // ── Documents de canal FISAA4 ──────────────────────────
  icd.run(c2_auto,'🔌 Automatisme','file','Référentiel officiel E5 BTS FISAA',pdf('referentiel_e5.pdf'),'Référentiel des compétences et critères d\'évaluation')
  icd.run(c2_auto,'Cours','link','Documentation TIA Portal V17','https://support.industry.siemens.com/','Documentation officielle Siemens TIA Portal')
  icd.run(c2_auto,'Cours','link','Introduction GRAFCET','https://www.plcopen.org/','Standards IEC 61131-3 et GRAFCET')
  icd.run(c2_scada,'Cours','link','Introduction SCADA & WinCC','https://support.industry.siemens.com/','Guide WinCC Unified')
  icd.run(c2_scada,'Cours','link','OPC-UA — Introduction','https://opcfoundation.org/','Standard OPC-UA pour l\'interopérabilité industrielle')
  icd.run(c2_profinet,'Cours','link','Profinet University','https://profinetuniversity.com/','Ressources de formation Profinet')
  icd.run(c2_e5,'🎓 Projet E5','file','Référentiel BTS FISAA — Épreuve E5',pdf('referentiel_e5.pdf'),'Document officiel des épreuves E5')
  icd.run(c2_e5,'Méthodologie','link','Guide de rédaction contexte pro','https://eduscol.education.fr/','Conseils pour structurer le dossier E5')
}

module.exports = { seedIfEmpty, resetAndSeed }
