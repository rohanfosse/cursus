const { getDb } = require('./connection');

// ─── Seed ─────────────────────────────────────────────────────────────────────
// Peuple la base uniquement si elle est vide (aucune promotion).
// Les dates de test sont des chaînes fixes — pas de datetime('now').

function seedIfEmpty() {
  const db    = getDb();
  const count = db.prepare('SELECT COUNT(*) AS n FROM promotions').get().n;
  if (count > 0) return;

  const ip   = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)');
  const ic   = db.prepare('INSERT INTO channels (promo_id, name, description, type) VALUES (?, ?, ?, ?)');
  const is_  = db.prepare('INSERT INTO students (promo_id, name, email, avatar_initials) VALUES (?, ?, ?, ?)');
  const ig   = db.prepare('INSERT INTO groups (promo_id, name) VALUES (?, ?)');
  const im   = db.prepare('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)');
  const imsg = db.prepare('INSERT INTO messages (channel_id, dm_student_id, author_name, author_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const it   = db.prepare('INSERT INTO travaux (channel_id, group_id, title, description, deadline, category, type, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const itgm = db.prepare('INSERT OR IGNORE INTO travail_group_members (travail_id, student_id, group_id) VALUES (?, ?, ?)');
  const ir   = db.prepare('INSERT INTO ressources (travail_id, type, name, path_or_url) VALUES (?, ?, ?, ?)');
  const id_  = db.prepare('INSERT INTO depots (travail_id, student_id, file_name, file_path, note, feedback, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const icd  = db.prepare('INSERT INTO channel_documents (channel_id, category, type, name, path_or_url, description) VALUES (?, ?, ?, ?, ?, ?)');

  // ══════════════════════════════════════════════
  //  PROMOTION 1 — CPIA2 25-26
  // ══════════════════════════════════════════════

  const p1 = ip.run('CPIA2 25-26', '#E8742A').lastInsertRowid;

  const c1_ann = ic.run(p1, 'annonces',            'Informations importantes',        'annonce').lastInsertRowid;
  const c1_gen = ic.run(p1, 'general',              'Canal principal',                 'chat').lastInsertRowid;
  const c1_dev = ic.run(p1, 'cours-developpement',  'Cours et exercices de code',      'chat').lastInsertRowid;
  const c1_tp  = ic.run(p1, 'remise-tp',            'Depot des travaux pratiques',     'chat').lastInsertRowid;
  const c1_prj = ic.run(p1, 'projets',              'Coordination des projets annuels','chat').lastInsertRowid;

  const s1  = is_.run(p1, 'Lucas Dupont',    'lucas.dupont@viacesi.fr',    'LD').lastInsertRowid;
  const s2  = is_.run(p1, 'Manon Bernard',   'manon.bernard@viacesi.fr',   'MB').lastInsertRowid;
  const s3  = is_.run(p1, 'Theo Leclerc',    'theo.leclerc@viacesi.fr',    'TL').lastInsertRowid;
  const s4  = is_.run(p1, 'Camille Rousseau','camille.rousseau@viacesi.fr','CR').lastInsertRowid;
  const s5  = is_.run(p1, 'Hugo Martin',     'hugo.martin@viacesi.fr',     'HM').lastInsertRowid;
  const s6  = is_.run(p1, 'Jade Petit',      'jade.petit@viacesi.fr',      'JP').lastInsertRowid;
  const s7  = is_.run(p1, 'Nathan Dubois',   'nathan.dubois@viacesi.fr',   'ND').lastInsertRowid;
  const s8  = is_.run(p1, 'Lea Fontaine',    'lea.fontaine@viacesi.fr',    'LF').lastInsertRowid;

  const g1 = ig.run(p1, 'Groupe 1').lastInsertRowid;
  const g2 = ig.run(p1, 'Groupe 2').lastInsertRowid;
  const g3 = ig.run(p1, 'Groupe 3').lastInsertRowid;
  im.run(g1, s1); im.run(g1, s2); im.run(g1, s3);
  im.run(g2, s4); im.run(g2, s5); im.run(g2, s6);
  im.run(g3, s7); im.run(g3, s8);

  // ── Messages CPIA2 ──────────────────────────────

  imsg.run(c1_ann, null, 'Rohan Fosse', 'teacher',
    'Bienvenue en CPIA2 25-26. Toutes les informations importantes seront publiees ici. Consultez regulierement ce canal.',
    '2026-03-01 08:00:00');
  imsg.run(c1_ann, null, 'Rohan Fosse', 'teacher',
    'Planning des rendus mis a jour. Le TP Python est a remettre avant le 15 avril, 23h59.',
    '2026-03-10 09:00:00');
  imsg.run(c1_ann, null, 'Rohan Fosse', 'teacher',
    'Les groupes pour les projets annuels sont affiches dans le canal #projets.',
    '2026-03-15 10:30:00');

  const m_gen1 = imsg.run(c1_gen, null, 'Rohan Fosse',    'teacher',  'Bonjour a tous, bienvenue sur CESI Classroom.', '2026-03-01 09:00:00').lastInsertRowid;
  imsg.run(c1_gen, null, 'Lucas Dupont',   'student',  'Bonjour M. Fosse, merci pour cet espace.', '2026-03-01 09:10:00');
  imsg.run(c1_gen, null, 'Manon Bernard',  'student',  'On pourra deposer les TP ici directement ?', '2026-03-01 09:12:00');
  imsg.run(c1_gen, null, 'Rohan Fosse',    'teacher',  'Oui, chaque TP a son propre travail dans #remise-tp avec la deadline visible.', '2026-03-01 09:15:00');
  const m_gen5 = imsg.run(c1_gen, null, 'Theo Leclerc',   'student',  'Super, c\'est bien plus pratique que par email.', '2026-03-01 09:17:00').lastInsertRowid;
  imsg.run(c1_gen, null, 'Camille Rousseau','student', 'Est-ce qu\'on peut voir nos notes directement ici ?', '2026-03-02 10:00:00');
  imsg.run(c1_gen, null, 'Rohan Fosse',    'teacher',  'Oui, dans "Mes travaux" vous verrez vos notes et commentaires au fur et a mesure.', '2026-03-02 10:05:00');
  imsg.run(c1_gen, null, 'Hugo Martin',    'student',  'On sera en groupes pour tous les TP ?', '2026-03-03 14:00:00');
  imsg.run(c1_gen, null, 'Rohan Fosse',    'teacher',  'Seulement pour les TDs. Le TP Python individuel est pour toute la promo.', '2026-03-03 14:10:00');
  imsg.run(c1_gen, null, 'Nathan Dubois',  'student',  'Les groupes sont les memes pour tous les projets ?', '2026-03-05 11:00:00');
  imsg.run(c1_gen, null, 'Rohan Fosse',    'teacher',  'Non, je peux recomposer les groupes selon les projets. Regardez bien votre groupe dans chaque travail.', '2026-03-05 11:05:00');

  imsg.run(c1_dev, null, 'Rohan Fosse',    'teacher',  'Cours Python - chapitre 3 : les structures de donnees. Slides disponibles en ressource du TP.', '2026-03-08 10:00:00');
  imsg.run(c1_dev, null, 'Jade Petit',     'student',  'Les listes chainées sont au programme ?', '2026-03-08 10:30:00');
  imsg.run(c1_dev, null, 'Rohan Fosse',    'teacher',  'On couvre les listes, tuples, dictionnaires et sets. Pas les listes chainees pour l\'instant.', '2026-03-08 10:35:00');
  imsg.run(c1_dev, null, 'Lea Fontaine',   'student',  'La comprehension de liste c\'est exige dans le TP ?', '2026-03-09 14:00:00');
  imsg.run(c1_dev, null, 'Rohan Fosse',    'teacher',  'C\'est conseille mais pas obligatoire. Cela montre une bonne maitrise.', '2026-03-09 14:05:00');

  const m_tp1 = imsg.run(c1_tp,  null, 'Rohan Fosse',    'teacher',  'Le TP Python est ouvert. Deadline : 15 avril 23h59. Lisez bien la consigne avant de commencer.', '2026-03-15 08:00:00').lastInsertRowid;
  imsg.run(c1_tp,  null, 'Lucas Dupont',   'student',  'On peut utiliser des bibliotheques externes ?', '2026-03-15 09:00:00');
  imsg.run(c1_tp,  null, 'Rohan Fosse',    'teacher',  'Bibliotheque standard uniquement (os, sys, collections…). Pas de numpy ni pandas.', '2026-03-15 09:05:00');
  imsg.run(c1_tp,  null, 'Manon Bernard',  'student',  'Format du rendu : .py seulement ou aussi un rapport ?', '2026-03-15 09:10:00');
  imsg.run(c1_tp,  null, 'Rohan Fosse',    'teacher',  'Le fichier .py suffit. Bien commenter votre code.', '2026-03-15 09:12:00');

  imsg.run(c1_prj, null, 'Rohan Fosse',    'teacher',  'Projet annuel : application de gestion. Cahier des charges en ressource. Rendu final en juin.', '2026-03-10 11:00:00');
  imsg.run(c1_prj, null, 'Camille Rousseau','student', 'On travaille en groupe ou individuellement ?', '2026-03-10 11:15:00');
  imsg.run(c1_prj, null, 'Rohan Fosse',    'teacher',  'En groupes de 2-3. Les groupes sont les memes que pour les TDs.', '2026-03-10 11:20:00');
  imsg.run(c1_prj, null, 'Nathan Dubois',  'student',  'Revue de code prevue quand ?', '2026-03-10 11:25:00');
  imsg.run(c1_prj, null, 'Rohan Fosse',    'teacher',  'Un jalon de revue de code est prevu fin avril. Details dans les travaux.', '2026-03-10 11:30:00');

  imsg.run(null, s1, 'Lucas Dupont',  'student',  'Bonjour M. Fosse, j\'ai un souci avec mon environnement Python, pip ne fonctionne plus.', '2026-03-12 14:00:00');
  const m_dm1 = imsg.run(null, s1, 'Rohan Fosse',   'teacher',  'Essaie "python -m pip install --upgrade pip" en tant qu\'admin. Si ca ne marche pas, reinstalle Python 3.11.', '2026-03-12 14:10:00').lastInsertRowid;
  imsg.run(null, s1, 'Lucas Dupont',  'student',  'Ca a marche, merci beaucoup !', '2026-03-12 14:15:00');
  imsg.run(null, s2, 'Manon Bernard', 'student',  'M. Fosse, je peux remettre mon TP en avance ?', '2026-03-20 16:00:00');
  imsg.run(null, s2, 'Rohan Fosse',   'teacher',  'Bien sur, tu peux deposer quand tu veux avant la deadline.', '2026-03-20 16:05:00');
  imsg.run(null, s7, 'Nathan Dubois', 'student',  'Pour le groupe 3, on est seulement 2. Est-ce que le projet est adapte ?', '2026-03-14 10:00:00');
  imsg.run(null, s7, 'Rohan Fosse',   'teacher',  'Oui, le scope du projet est allegé pour les groupes de 2. Voir la note dans les consignes.', '2026-03-14 10:08:00');

  const upReact = db.prepare('UPDATE messages SET reactions = ? WHERE id = ?');
  upReact.run('{"check":2,"eye":5}',  m_gen1);
  upReact.run('{"thumb":3,"bulb":1}', m_gen5);
  upReact.run('{"check":4,"eye":2}',  m_tp1);
  upReact.run('{"thumb":1,"eye":3}',  m_dm1);

  // ── Travaux CPIA2 ──────────────────────────────

  const t1 = it.run(c1_tp, null,
    'TP Python - Structures de donnees',
    'Implementer les structures de donnees suivantes en Python :\n- Pile (Stack) avec push/pop\n- File (Queue) avec enqueue/dequeue\n- Table de hachage avec gestion des collisions\nChaque structure doit avoir des tests unitaires. Fichier .py unique.',
    '2026-04-15 23:59:00', 'TP', 'devoir', 1).lastInsertRowid;
  ir.run(t1, 'link', 'Documentation Python - Collections', 'https://docs.python.org/3/library/collections.html');
  ir.run(t1, 'link', 'Tutoriel structures de donnees', 'https://realpython.com/python-data-structures/');

  const t2 = it.run(c1_dev, null,
    'Devoir maison - Diagrammes UML',
    'Modeliser un systeme de reservation de salle avec :\n- 1 diagramme de cas d\'utilisation\n- 1 diagramme de classes\n- 1 diagramme de sequence pour la reservation\nRendu PDF.',
    '2026-03-28 23:59:00', 'Devoir', 'devoir', 1).lastInsertRowid;
  ir.run(t2, 'link', 'Cours UML - Introduction', 'https://www.uml.org/');

  const t3 = it.run(c1_tp, null,
    'Examen Python - Mi-parcours',
    'Examen sur table, 2h. Programme : chapitres 1 a 5 du cours. Pas de ressource externe autorisee. Rendu : fichier .py unique avec vos reponses.',
    '2026-04-05 10:00:00', 'Examen', 'devoir', 1).lastInsertRowid;

  const t4 = it.run(c1_prj, g1,
    'TD Algorithmique - Tri et recherche (Groupe 1)',
    'Implementer et comparer les algorithmes de tri : bubble sort, merge sort, quicksort.\nMesurer les performances avec timeit. Rendu : .py + mini-rapport PDF.',
    '2026-04-22 18:00:00', 'TP', 'devoir', 1).lastInsertRowid;
  itgm.run(t4, s1, g1); itgm.run(t4, s2, g1); itgm.run(t4, s3, g1);
  ir.run(t4, 'link', 'Visualisation des algorithmes de tri', 'https://visualgo.net/en/sorting');

  const t5 = it.run(c1_prj, g2,
    'TD Algorithmique - Graphes (Groupe 2)',
    'Implementer les algorithmes de parcours de graphe : BFS et DFS.\nAppliquer a un probleme de labyrinthe. Rendu : .py + mini-rapport PDF.',
    '2026-04-22 18:00:00', 'TP', 'devoir', 1).lastInsertRowid;
  itgm.run(t5, s4, g2); itgm.run(t5, s5, g2); itgm.run(t5, s6, g2);
  ir.run(t5, 'link', 'Visualisation BFS / DFS', 'https://visualgo.net/en/dfsbfs');

  const t6 = it.run(c1_prj, g3,
    'TD Algorithmique - Arbres binaires (Groupe 3)',
    'Implementer un arbre binaire de recherche (BST) avec insertion, suppression et parcours.\nRendu : .py + mini-rapport PDF.',
    '2026-04-22 18:00:00', 'TP', 'devoir', 1).lastInsertRowid;
  itgm.run(t6, s7, g3); itgm.run(t6, s8, g3);
  ir.run(t6, 'link', 'Visualisation BST', 'https://visualgo.net/en/bst');

  const t7 = it.run(c1_prj, null,
    'Projet annuel - Application de gestion',
    'Developper une application Python de gestion d\'inventaire avec :\n- Interface CLI ou graphique (tkinter)\n- Persistance JSON ou SQLite\n- CRUD complet sur les articles\n- Recherche et filtrage\n- Export CSV\nTravail en groupes. Soutenance en juin.',
    '2026-06-15 17:00:00', 'Projet', 'devoir', 1).lastInsertRowid;
  ir.run(t7, 'link', 'Cahier des charges projet', 'https://www.python.org/');
  ir.run(t7, 'link', 'Documentation tkinter', 'https://docs.python.org/3/library/tkinter.html');
  ir.run(t7, 'link', 'Documentation SQLite3 Python', 'https://docs.python.org/3/library/sqlite3.html');

  it.run(c1_tp, null,
    'TP Bases de donnees - Requetes SQL avancees',
    'Exercices sur les JOIN, sous-requetes et fonctions d\'agregation. Base de donnees fournie.',
    '2026-05-10 23:59:00', 'TP', 'devoir', 0);

  const t9 = it.run(c1_prj, g1,
    'Revue de code - Groupe 1',
    'Presentation de votre avancement sur le projet annuel. Montrez votre architecture, votre code et vos tests.\nDuree : 15 min par groupe.',
    '2026-04-28 14:00:00', 'Projet', 'jalon', 1).lastInsertRowid;
  itgm.run(t9, s1, g1); itgm.run(t9, s2, g1); itgm.run(t9, s3, g1);

  const t10 = it.run(c1_prj, g2,
    'Revue de code - Groupe 2',
    'Presentation de votre avancement. Memes modalites que Groupe 1.',
    '2026-04-28 15:00:00', 'Projet', 'jalon', 1).lastInsertRowid;
  itgm.run(t10, s4, g2); itgm.run(t10, s5, g2); itgm.run(t10, s6, g2);

  const t11 = it.run(c1_prj, g3,
    'Revue de code - Groupe 3',
    'Presentation de votre avancement. Memes modalites.',
    '2026-04-28 16:00:00', 'Projet', 'jalon', 1).lastInsertRowid;
  itgm.run(t11, s7, g3); itgm.run(t11, s8, g3);

  it.run(c1_prj, null,
    'Soutenance finale - Projet annuel',
    'Presentation de votre projet finalisé devant jury. 20 min de presentation + 10 min de questions.',
    '2026-06-20 09:00:00', 'Projet', 'jalon', 1);

  // ── Dépôts CPIA2 ──────────────────────────────

  id_.run(t2, s1, 'DUPONT_Lucas_UML.pdf',      'depots/DUPONT_Lucas_UML.pdf',      'B',  'Bonne modelisation, le diagramme de sequence manque de detail sur les cas d\'erreur.', '2026-03-25 21:00:00');
  id_.run(t2, s2, 'BERNARD_Manon_UML.pdf',     'depots/BERNARD_Manon_UML.pdf',     'A',  'Excellent travail. Tres propre et complet. Le diagramme de classes est remarquable.', '2026-03-24 18:30:00');
  id_.run(t2, s3, 'LECLERC_Theo_UML.pdf',      'depots/LECLERC_Theo_UML.pdf',      'D',  'Diagramme de cas d\'utilisation incomplet. Le systeme acteur/cas n\'est pas bien delimite.', '2026-03-27 23:30:00');
  id_.run(t2, s4, 'ROUSSEAU_Camille_UML.pdf',  'depots/ROUSSEAU_Camille_UML.pdf',  'C',  'Correct. Quelques erreurs de multiplicite dans les associations.', '2026-03-26 20:00:00');
  id_.run(t2, s5, 'MARTIN_Hugo_UML.pdf',       'depots/MARTIN_Hugo_UML.pdf',       'B',  'Bien dans l\'ensemble. Le diagramme de sequence est bon.', '2026-03-26 22:00:00');
  id_.run(t2, s7, 'DUBOIS_Nathan_UML.pdf',     'depots/DUBOIS_Nathan_UML.pdf',     'A',  'Tres bon travail. Les trois diagrammes sont coherents entre eux.', '2026-03-23 16:00:00');
  id_.run(t2, s8, 'FONTAINE_Lea_UML.pdf',      'depots/FONTAINE_Lea_UML.pdf',      'A',  'Tres bien. Quelques types de donnees a preciser dans le diagramme de classes.', '2026-03-28 20:00:00');

  id_.run(t3, s1, 'DUPONT_Lucas_exam.py',      'depots/DUPONT_Lucas_exam.py',      'B',  null, '2026-04-05 12:00:00');
  id_.run(t3, s2, 'BERNARD_Manon_exam.py',     'depots/BERNARD_Manon_exam.py',     'A',  null, '2026-04-05 12:00:00');
  id_.run(t3, s3, 'LECLERC_Theo_exam.py',      'depots/LECLERC_Theo_exam.py',      'D',  null, '2026-04-05 12:00:00');
  id_.run(t3, s4, 'ROUSSEAU_Camille_exam.py',  'depots/ROUSSEAU_Camille_exam.py',  'C',  null, '2026-04-05 12:00:00');
  id_.run(t3, s5, 'MARTIN_Hugo_exam.py',       'depots/MARTIN_Hugo_exam.py',       'B',  null, '2026-04-05 12:00:00');
  id_.run(t3, s6, 'PETIT_Jade_exam.py',        'depots/PETIT_Jade_exam.py',        'A',  null, '2026-04-05 12:00:00');
  id_.run(t3, s7, 'DUBOIS_Nathan_exam.py',     'depots/DUBOIS_Nathan_exam.py',     'A',  null, '2026-04-05 12:00:00');
  id_.run(t3, s8, 'FONTAINE_Lea_exam.py',      'depots/FONTAINE_Lea_exam.py',      'C',  null, '2026-04-05 12:00:00');

  id_.run(t1, s1, 'DUPONT_Lucas_tp_python.py',     'depots/DUPONT_Lucas_tp_python.py',     'B',  'Bon travail. La Stack et la Queue sont correctes. La table de hachage gere bien les collisions. Penser aux cas limites.', '2026-04-10 21:00:00');
  id_.run(t1, s2, 'BERNARD_Manon_tp_python.py',    'depots/BERNARD_Manon_tp_python.py',    'A',  'Excellent. Code tres propre, bien documente, tests complets. Bravo.', '2026-04-08 19:00:00');
  id_.run(t1, s4, 'ROUSSEAU_Camille_tp_python.py', 'depots/ROUSSEAU_Camille_tp_python.py', null, null, '2026-04-12 22:00:00');
  id_.run(t1, s7, 'DUBOIS_Nathan_tp_python.py',    'depots/DUBOIS_Nathan_tp_python.py',    null, null, '2026-04-13 16:30:00');

  id_.run(t4, s1, 'DUPONT_Lucas_tri.py',           'depots/DUPONT_Lucas_tri.py',           null, null, '2026-04-18 20:00:00');
  id_.run(t4, s3, 'LECLERC_Theo_tri.py',           'depots/LECLERC_Theo_tri.py',           null, null, '2026-04-20 14:00:00');
  id_.run(t5, s4, 'ROUSSEAU_Camille_graphes.py',   'depots/ROUSSEAU_Camille_graphes.py',   null, null, '2026-04-19 22:00:00');
  id_.run(t6, s7, 'DUBOIS_Nathan_BST.py',          'depots/DUBOIS_Nathan_BST.py',          null, null, '2026-04-20 18:00:00');
  id_.run(t6, s8, 'FONTAINE_Lea_BST.py',           'depots/FONTAINE_Lea_BST.py',           null, null, '2026-04-21 10:00:00');

  // ══════════════════════════════════════════════
  //  PROMOTION 2 — FISAA4 24-27
  // ══════════════════════════════════════════════

  const p2 = ip.run('FISAA4 24-27', '#2ECC71').lastInsertRowid;

  const c2_ann = ic.run(p2, 'annonces',            'Informations importantes',        'annonce').lastInsertRowid;
  const c2_gen = ic.run(p2, 'general',              'Canal principal',                 'chat').lastInsertRowid;
  const c2_sys = ic.run(p2, 'systemes-industriels', 'Cours et TP systemes industriels','chat').lastInsertRowid;
  const c2_ang = ic.run(p2, 'anglais-pro',          'Cours et evaluations anglais',    'chat').lastInsertRowid;
  const c2_e5  = ic.run(p2, 'projets-e5',           'Coordination du projet E5',       'chat').lastInsertRowid;

  const f1  = is_.run(p2, 'Alexandre Moreau',   'alexandre.moreau@viacesi.fr',   'AM').lastInsertRowid;
  const f2  = is_.run(p2, 'Chloe Simon',        'chloe.simon@viacesi.fr',        'CS').lastInsertRowid;
  const f3  = is_.run(p2, 'Maxime Laurent',     'maxime.laurent@viacesi.fr',     'ML').lastInsertRowid;
  const f4  = is_.run(p2, 'Elisa Garnier',      'elisa.garnier@viacesi.fr',      'EG').lastInsertRowid;
  const f5  = is_.run(p2, 'Raphael Lefebvre',   'raphael.lefebvre@viacesi.fr',   'RL').lastInsertRowid;
  const f6  = is_.run(p2, 'Ines Thomas',        'ines.thomas@viacesi.fr',        'IT').lastInsertRowid;
  const f7  = is_.run(p2, 'Quentin Roux',       'quentin.roux@viacesi.fr',       'QR').lastInsertRowid;
  const f8  = is_.run(p2, 'Amelie Girard',      'amelie.girard@viacesi.fr',      'AG').lastInsertRowid;
  const f9  = is_.run(p2, 'Pierre Bonnet',      'pierre.bonnet@viacesi.fr',      'PB').lastInsertRowid;
  const f10 = is_.run(p2, 'Sofia Dumont',       'sofia.dumont@viacesi.fr',       'SD').lastInsertRowid;
  const f11 = is_.run(p2, 'Antoine Chevalier',  'antoine.chevalier@viacesi.fr',  'AC').lastInsertRowid;
  const f12 = is_.run(p2, 'Laura Vincent',      'laura.vincent@viacesi.fr',      'LV').lastInsertRowid;

  const ga = ig.run(p2, 'Groupe A').lastInsertRowid;
  const gb = ig.run(p2, 'Groupe B').lastInsertRowid;
  const gc = ig.run(p2, 'Groupe C').lastInsertRowid;
  im.run(ga, f1); im.run(ga, f2); im.run(ga, f3); im.run(ga, f4);
  im.run(gb, f5); im.run(gb, f6); im.run(gb, f7); im.run(gb, f8);
  im.run(gc, f9); im.run(gc, f10); im.run(gc, f11); im.run(gc, f12);

  // ── Messages FISAA4 ─────────────────────────────

  imsg.run(c2_ann, null, 'Rohan Fosse', 'teacher',
    'Bienvenue en FISAA4 24-27. Les soutenances E5 approchent. Consultez le canal #projets-e5 pour les dates et les consignes.',
    '2026-03-01 08:00:00');
  imsg.run(c2_ann, null, 'Rohan Fosse', 'teacher',
    'Planning des soutenances E5 publie. Groupe A : 18 avril, Groupe B : 19 avril, Groupe C : 20 avril.',
    '2026-03-12 09:00:00');
  imsg.run(c2_ann, null, 'Rohan Fosse', 'teacher',
    'Rappel : les rapports de stage sont a deposer avant le 15 mai.',
    '2026-03-20 08:30:00');

  imsg.run(c2_gen, null, 'Rohan Fosse',      'teacher', 'Bonjour a tous. Cette annee est decisive avec les soutenances E5. Vous pouvez compter sur moi.', '2026-03-01 09:00:00');
  imsg.run(c2_gen, null, 'Alexandre Moreau', 'student', 'Merci M. Fosse. Les dates des soutenances sont fixes ?', '2026-03-01 09:10:00');
  imsg.run(c2_gen, null, 'Rohan Fosse',      'teacher', 'Oui, voir l\'annonce. Planifiez bien votre preparation.', '2026-03-01 09:15:00');
  imsg.run(c2_gen, null, 'Chloe Simon',      'student', 'Le jury sera compose de qui ?', '2026-03-02 10:00:00');
  imsg.run(c2_gen, null, 'Rohan Fosse',      'teacher', 'Moi-meme et un representant de votre entreprise. Parfois un second jury interne.', '2026-03-02 10:10:00');
  imsg.run(c2_gen, null, 'Raphael Lefebvre', 'student', 'Combien de pages pour le contexte pro ?', '2026-03-03 11:00:00');
  imsg.run(c2_gen, null, 'Rohan Fosse',      'teacher', 'Entre 5 et 8 pages. Consultez le referentiel en ressource du travail.', '2026-03-03 11:05:00');
  imsg.run(c2_gen, null, 'Ines Thomas',      'student', 'On peut deposer des version intermediaires ?', '2026-03-04 14:00:00');
  imsg.run(c2_gen, null, 'Rohan Fosse',      'teacher', 'Oui, chaque depot ecrase le precedent. Pensez a bien nommer vos fichiers avec une version.', '2026-03-04 14:08:00');
  imsg.run(c2_gen, null, 'Pierre Bonnet',    'student', 'Est-ce qu\'on peut vous envoyer un brouillon pour relecture ?', '2026-03-05 09:00:00');
  imsg.run(c2_gen, null, 'Rohan Fosse',      'teacher', 'Oui, envoyez-moi en DM. Je lirai et commente sous 48h.', '2026-03-05 09:05:00');
  imsg.run(c2_gen, null, 'Laura Vincent',    'student', 'M. Fosse, le rapport de stage est different du contexte pro ?', '2026-03-06 10:00:00');
  imsg.run(c2_gen, null, 'Rohan Fosse',      'teacher', 'Oui. Le contexte pro est le document E5 officiel. Le rapport de stage est votre retour d\'experience de periode industrie.', '2026-03-06 10:10:00');

  const m_e5_1 = imsg.run(c2_e5, null, 'Rohan Fosse', 'teacher', 'Les jalons de soutenance sont maintenant visibles dans votre planning. Preparez votre presentation (15-20 slides max).', '2026-03-12 10:00:00').lastInsertRowid;
  imsg.run(c2_e5, null, 'Maxime Laurent',   'student', 'On est evalue sur quels criteres principalement ?', '2026-03-12 10:30:00');
  imsg.run(c2_e5, null, 'Rohan Fosse',      'teacher', 'Contexte professionnel (40%), maitrise technique (30%), communication orale (30%).', '2026-03-12 10:35:00');
  imsg.run(c2_e5, null, 'Elisa Garnier',    'student', 'Merci, c\'est clair. On peut s\'entrainer avec vous avant ?', '2026-03-12 10:40:00');
  imsg.run(c2_e5, null, 'Rohan Fosse',      'teacher', 'Je propose des creneaux de simulation la semaine du 7 avril. Inscrivez-vous en DM.', '2026-03-12 10:45:00');
  imsg.run(c2_e5, null, 'Quentin Roux',     'student', 'Mon entreprise peut-elle participer au jury ?', '2026-03-13 09:00:00');
  imsg.run(c2_e5, null, 'Rohan Fosse',      'teacher', 'Oui, c\'est meme recommande. Contactez votre tuteur entreprise.', '2026-03-13 09:05:00');

  imsg.run(c2_ang, null, 'Rohan Fosse',      'teacher', 'Compte rendu de reunion en anglais : vous recevrez un audio d\'une reunion de 5 min. Rediger un compte-rendu formel.', '2026-03-15 10:00:00');
  imsg.run(c2_ang, null, 'Amelie Girard',    'student', 'Format impose ? Longueur ?', '2026-03-15 10:15:00');
  imsg.run(c2_ang, null, 'Rohan Fosse',      'teacher', 'Format Word ou PDF, 1-2 pages. Respecter les conventions du compte-rendu professionnel (en-tete, participants, ordre du jour, actions).', '2026-03-15 10:20:00');
  imsg.run(c2_ang, null, 'Sofia Dumont',     'student', 'On a acces au transcript audio ou seulement l\'enregistrement ?', '2026-03-15 10:25:00');
  imsg.run(c2_ang, null, 'Rohan Fosse',      'teacher', 'Seulement l\'enregistrement. C\'est un exercice de comprehension orale.', '2026-03-15 10:28:00');

  imsg.run(c2_sys, null, 'Rohan Fosse',       'teacher', 'TP Automates : vous utiliserez TIA Portal V17 sur les postes de labo. Logiciel installe, pas besoin de licence perso.', '2026-03-10 08:00:00');
  imsg.run(c2_sys, null, 'Antoine Chevalier', 'student', 'On travaille sur les automates Siemens S7-1200 comme en entreprise ?', '2026-03-10 08:15:00');
  imsg.run(c2_sys, null, 'Rohan Fosse',       'teacher', 'Exactement, meme modele que dans vos entreprises pour la plupart.', '2026-03-10 08:20:00');

  imsg.run(null, f1, 'Alexandre Moreau', 'student',  'Bonjour M. Fosse, je voudrais un retour sur mon plan de contexte pro avant de rediger.', '2026-03-08 14:00:00');
  imsg.run(null, f1, 'Rohan Fosse',      'teacher',  'Envoie-moi ton plan en document joint. Je regarde ca rapidement.', '2026-03-08 14:10:00');
  imsg.run(null, f1, 'Alexandre Moreau', 'student',  'Je l\'ai depose dans le canal #projets-e5. Merci d\'avance.', '2026-03-08 14:15:00');
  imsg.run(null, f5, 'Raphael Lefebvre', 'student',  'Je suis en teletravail toute la semaine, pas de souci pour les TP en presentiel ?', '2026-03-10 09:00:00');
  imsg.run(null, f5, 'Rohan Fosse',      'teacher',  'Le TP automates necessite le materiel en labo. Prevois d\'etre present le 25 avril.', '2026-03-10 09:05:00');
  imsg.run(null, f9, 'Pierre Bonnet',    'student',  'M. Fosse, j\'ai change d\'entreprise en cours de formation. Ca impacte mon E5 ?', '2026-03-12 11:00:00');
  imsg.run(null, f9, 'Rohan Fosse',      'teacher',  'Ca complexifie un peu le contexte pro. Viens me voir en dehors des cours pour qu\'on adapte ton plan.', '2026-03-12 11:10:00');
  imsg.run(null, f2, 'Chloe Simon',      'student',  'Est-ce que je peux faire ma soutenance en anglais ? Mon maitre de stage est anglophone.', '2026-03-14 15:00:00');
  imsg.run(null, f2, 'Rohan Fosse',      'teacher',  'Oui, c\'est tout a fait possible et valorise. Previens-moi pour que je prepare le jury.', '2026-03-14 15:05:00');

  upReact.run('{"check":3,"eye":4}', m_e5_1);

  // ── Travaux FISAA4 ──────────────────────────────

  const f_t1 = it.run(c2_e5, null,
    'Dossier E5 - Contexte professionnel',
    'Rediger le contexte professionnel de votre projet E5 selon le referentiel BTS FISAA.\nStructure imposee : presentation entreprise, contexte du projet, missions, livrables, bilan.\nFormat PDF, 5 a 8 pages hors annexes.',
    '2026-04-01 23:59:00', 'Projet', 'devoir', 1).lastInsertRowid;
  ir.run(f_t1, 'link', 'Referentiel BTS FISAA', 'https://www.education.gouv.fr');
  ir.run(f_t1, 'link', 'Guide de redaction E5', 'https://eduscol.education.fr');

  const f_t2 = it.run(c2_e5, ga,
    'Soutenance E5 - Groupe A',
    'Soutenance de 20 min + 10 min de questions. Jury : M. Fosse + representant entreprise.\nLieu : salle de conference CESI Montpellier.',
    '2026-04-18 09:00:00', 'Projet', 'jalon', 1).lastInsertRowid;
  itgm.run(f_t2, f1, ga); itgm.run(f_t2, f2, ga); itgm.run(f_t2, f3, ga); itgm.run(f_t2, f4, ga);

  const f_t3 = it.run(c2_e5, gb,
    'Soutenance E5 - Groupe B',
    'Soutenance de 20 min + 10 min de questions. Memes modalites que Groupe A.',
    '2026-04-19 09:00:00', 'Projet', 'jalon', 1).lastInsertRowid;
  itgm.run(f_t3, f5, gb); itgm.run(f_t3, f6, gb); itgm.run(f_t3, f7, gb); itgm.run(f_t3, f8, gb);

  const f_t4 = it.run(c2_e5, gc,
    'Soutenance E5 - Groupe C',
    'Soutenance de 20 min + 10 min de questions. Memes modalites.',
    '2026-04-20 09:00:00', 'Projet', 'jalon', 1).lastInsertRowid;
  itgm.run(f_t4, f9, gc); itgm.run(f_t4, f10, gc); itgm.run(f_t4, f11, gc); itgm.run(f_t4, f12, gc);

  const f_t5 = it.run(c2_e5, null,
    'Rapport de stage - Periode industrie',
    'Rediger votre rapport de stage sur la periode industrie.\nStructure : introduction, entreprise, missions realisees, competences acquises, conclusion.\nFormat PDF, 20 a 30 pages.',
    '2026-05-15 23:59:00', 'Rendu', 'devoir', 1).lastInsertRowid;
  ir.run(f_t5, 'link', 'Guide rapport de stage CESI', 'https://www.cesi.fr');

  const f_t6 = it.run(c2_ang, null,
    'TD Anglais - Compte rendu de reunion',
    'A partir de l\'enregistrement audio fourni en ressource, rediger un compte-rendu de reunion professionnel.\nFormat : document Word ou PDF, 1-2 pages.',
    '2026-04-08 23:59:00', 'TP', 'devoir', 1).lastInsertRowid;
  ir.run(f_t6, 'link', 'Modele de compte-rendu professionnel', 'https://www.thebalancemoney.com/how-to-write-meeting-minutes-1917759');
  ir.run(f_t6, 'link', 'Business English phrases', 'https://www.bbc.co.uk/learningenglish/english/features/english-you-need');

  const f_t7 = it.run(c2_ang, null,
    'Examen Anglais Professionnel',
    'Examen de 2h. Comprehension ecrite (40%), expression ecrite (60%).\nThematiques : industrie, management de projet, securite industrielle.',
    '2026-05-06 14:00:00', 'Examen', 'devoir', 1).lastInsertRowid;
  void f_t7;

  const f_t8 = it.run(c2_sys, null,
    'TP Systemes industriels - Programmation automate',
    'Programmer un automate Siemens S7-1200 avec TIA Portal pour controler un convoyeur simule.\nLangage : GRAFCET puis Ladder. Rendu : fichier de projet TIA + rapport PDF.',
    '2026-04-25 17:00:00', 'TP', 'devoir', 1).lastInsertRowid;
  ir.run(f_t8, 'link', 'Documentation TIA Portal Siemens', 'https://support.industry.siemens.com');
  ir.run(f_t8, 'link', 'Introduction GRAFCET', 'https://www.instructables.com/GRAFCET-Introduction/');

  const f_t9 = it.run(c2_sys, ga,
    'Projet industriel - Ligne de tri automatique (Groupe A)',
    'Concevoir et programmer une ligne de tri automatique selon le cahier des charges fourni.\nLivrables : analyse fonctionnelle, programme automate, rapport de test.',
    '2026-05-30 17:00:00', 'Projet', 'devoir', 1).lastInsertRowid;
  itgm.run(f_t9, f1, ga); itgm.run(f_t9, f2, ga); itgm.run(f_t9, f3, ga); itgm.run(f_t9, f4, ga);

  const f_t10 = it.run(c2_sys, gb,
    'Projet industriel - Supervision SCADA (Groupe B)',
    'Developper une interface de supervision SCADA pour un processus de production.\nOutil : WinCC ou FactoryTalk. Rendu : application + rapport.',
    '2026-05-30 17:00:00', 'Projet', 'devoir', 1).lastInsertRowid;
  itgm.run(f_t10, f5, gb); itgm.run(f_t10, f6, gb); itgm.run(f_t10, f7, gb); itgm.run(f_t10, f8, gb);

  const f_t11 = it.run(c2_sys, gc,
    'Projet industriel - Maintenance predictive (Groupe C)',
    'Mettre en place un systeme de maintenance predictive sur un equipement industriel.\nCapture de donnees capteurs + analyse + alertes. Rendu : rapport + demo.',
    '2026-05-30 17:00:00', 'Projet', 'devoir', 1).lastInsertRowid;
  itgm.run(f_t11, f9, gc); itgm.run(f_t11, f10, gc); itgm.run(f_t11, f11, gc); itgm.run(f_t11, f12, gc);

  it.run(c2_e5, null,
    'Point avancement - Mi-projet E5',
    'Bilan intermediaire de votre projet E5. Presentation de 5 min par personne : avancement, risques, plan de finition.',
    '2026-03-20 14:00:00', 'Projet', 'jalon', 1);

  it.run(c2_e5, null,
    'Preparation dossier FASEC',
    'Compiler les justificatifs de competences pour le dossier FASEC. Liste detaillee fournie en ressource.',
    '2026-06-01 23:59:00', 'Rendu', 'devoir', 0);

  // ── Dépôts FISAA4 ──────────────────────────────

  id_.run(f_t1, f1,  'MOREAU_Alexandre_E5_v2.pdf',  'depots/MOREAU_Alexandre_E5_v2.pdf',  'A',  'Tres bon contexte. La description des missions est precise et bien illustree.', '2026-03-28 20:00:00');
  id_.run(f_t1, f2,  'SIMON_Chloe_E5.pdf',          'depots/SIMON_Chloe_E5.pdf',          'A',  'Excellent. Structure claire, ecriture professionnelle. Le bilan de competences est particulierement bien redige.', '2026-03-25 18:00:00');
  id_.run(f_t1, f3,  'LAURENT_Maxime_E5.pdf',       'depots/LAURENT_Maxime_E5.pdf',       'B',  'Correct mais la partie livrables manque de details concrets. Revoir avant la soutenance.', '2026-03-30 22:00:00');
  id_.run(f_t1, f4,  'GARNIER_Elisa_E5.pdf',        'depots/GARNIER_Elisa_E5.pdf',        'B',  'Tres bien dans l\'ensemble. Quelques fautes d\'orthographe a corriger.', '2026-03-29 19:00:00');
  id_.run(f_t1, f5,  'LEFEBVRE_Raphael_E5.pdf',     'depots/LEFEBVRE_Raphael_E5.pdf',     null, null, '2026-03-31 23:50:00');
  id_.run(f_t1, f6,  'THOMAS_Ines_E5.pdf',          'depots/THOMAS_Ines_E5.pdf',          null, null, '2026-03-30 21:00:00');
  id_.run(f_t1, f7,  'ROUX_Quentin_E5.pdf',         'depots/ROUX_Quentin_E5.pdf',         null, null, '2026-04-01 23:30:00');
  id_.run(f_t1, f8,  'GIRARD_Amelie_E5.pdf',        'depots/GIRARD_Amelie_E5.pdf',        13,   'Contexte un peu court. Les missions ne sont pas assez detaillees. A completer avant la soutenance.', '2026-03-27 17:00:00');
  id_.run(f_t1, f9,  'BONNET_Pierre_E5_v2.pdf',     'depots/BONNET_Pierre_E5_v2.pdf',     null, null, '2026-04-01 20:00:00');
  id_.run(f_t1, f11, 'CHEVALIER_Antoine_E5.pdf',    'depots/CHEVALIER_Antoine_E5.pdf',    null, null, '2026-03-31 16:00:00');
  id_.run(f_t1, f12, 'VINCENT_Laura_E5.pdf',        'depots/VINCENT_Laura_E5.pdf',        null, null, '2026-03-30 23:00:00');

  id_.run(f_t6, f1,  'MOREAU_Alexandre_meeting_minutes.docx', 'depots/MOREAU_Alexandre_meeting_minutes.docx', 16,   'Bonne structure. Quelques tournures trop informelles.', '2026-04-05 20:00:00');
  id_.run(f_t6, f2,  'SIMON_Chloe_meeting_minutes.pdf',       'depots/SIMON_Chloe_meeting_minutes.pdf',       18.5, 'Excellent. Vocabulaire professionnel tres riche. Formatage parfait.', '2026-04-04 17:00:00');
  id_.run(f_t6, f4,  'GARNIER_Elisa_meeting_minutes.docx',    'depots/GARNIER_Elisa_meeting_minutes.docx',    14.5, 'Correct. Certaines actions ne sont pas suffisamment detaillees.', '2026-04-06 22:00:00');
  id_.run(f_t6, f6,  'THOMAS_Ines_meeting_minutes.docx',      'depots/THOMAS_Ines_meeting_minutes.docx',      null, null, '2026-04-07 21:00:00');
  id_.run(f_t6, f8,  'GIRARD_Amelie_meeting_minutes.pdf',     'depots/GIRARD_Amelie_meeting_minutes.pdf',     null, null, '2026-04-08 10:00:00');
  id_.run(f_t6, f10, 'DUMONT_Sofia_meeting_minutes.pdf',      'depots/DUMONT_Sofia_meeting_minutes.pdf',      null, null, '2026-04-07 19:00:00');
  id_.run(f_t6, f12, 'VINCENT_Laura_meeting_minutes.docx',    'depots/VINCENT_Laura_meeting_minutes.docx',    15,   'Tres bien. Structure professionnelle, bon niveau d\'anglais.', '2026-04-07 23:00:00');

  id_.run(f_t8, f3,  'LAURENT_Maxime_convoyeur.zip', 'depots/LAURENT_Maxime_convoyeur.zip', null, null, '2026-04-22 16:00:00');
  id_.run(f_t8, f7,  'ROUX_Quentin_convoyeur.zip',   'depots/ROUX_Quentin_convoyeur.zip',   null, null, '2026-04-23 20:00:00');
  id_.run(f_t8, f9,  'BONNET_Pierre_convoyeur.zip',  'depots/BONNET_Pierre_convoyeur.zip',  null, null, '2026-04-24 11:00:00');

  // ── Documents de canal ──────────────────────────────

  icd.run(c1_dev, 'Cours Python',    'link', 'Documentation officielle Python 3', 'https://docs.python.org/3/', 'Reference complete du langage Python 3');
  icd.run(c1_dev, 'Cours Python',    'link', 'Real Python — Tutoriels pratiques',  'https://realpython.com/',   'Tutoriels Python de qualite, du debutant a l\'expert');
  icd.run(c1_dev, 'Algorithmique',   'link', 'Visualgo — Algorithmes interactifs', 'https://visualgo.net/',     'Visualisation animee des structures de donnees et algorithmes');
  icd.run(c1_dev, 'Algorithmique',   'link', 'Big-O Cheat Sheet',                  'https://www.bigocheatsheet.com/', 'Tableau de complexite des algorithmes courants');
  icd.run(c1_dev, 'Outils',          'link', 'Python Tutor — Debogueur visuel',    'http://pythontutor.com/',   'Executer et visualiser du code Python pas-a-pas dans le navigateur');
  icd.run(c1_dev, 'UML',             'link', 'Draw.io — Diagrammes gratuits',      'https://app.diagrams.net/', 'Outil en ligne pour creer des diagrammes UML');
  icd.run(c1_dev, 'UML',             'link', 'PlantUML — UML en texte',            'https://plantuml.com/',     'Generer des diagrammes UML a partir de texte');

  icd.run(c1_gen, 'Organisation',    'link', 'Planning de l\'annee CPIA2 25-26',   'https://www.google.com/calendar', 'Calendrier des cours, evaluations et conges');
  icd.run(c1_gen, 'Organisation',    'link', 'Reglement interieur CESI',           'https://www.cesi.fr/',      'Charte et regles de vie en formation');

  icd.run(c1_prj, 'Projet annuel',   'link', 'Cahier des charges — Application de gestion', 'https://www.python.org/', 'Specifications completes et criteres d\'evaluation du projet annuel');
  icd.run(c1_prj, 'Methodologie',    'link', 'Pro Git — Livre de reference',       'https://git-scm.com/book/fr/v2', 'Guide complet de Git en francais (gratuit)');
  icd.run(c1_prj, 'Methodologie',    'link', 'PEP 8 — Style Guide Python',         'https://peps.python.org/pep-0008/', 'Convention de style officielle pour le code Python');
  icd.run(c1_prj, 'Methodologie',    'link', 'Guide de redaction de rapport',      'https://www.cesi.fr/',      'Conseils pour structurer et rediger un rapport technique');

  icd.run(c2_sys, 'Automates',       'link', 'Introduction aux API industriels',   'https://fr.wikipedia.org/wiki/Automate_programmable_industriel', 'Vue d\'ensemble des automates programmables');
  icd.run(c2_sys, 'Automates',       'link', 'PLCopen — Standard IEC 61131-3',     'https://www.plcopen.org/',  'Organisation internationale pour la programmation automate');
  icd.run(c2_sys, 'SCADA',           'link', 'Introduction aux systemes SCADA',    'https://fr.wikipedia.org/wiki/SCADA', 'Concepts fondamentaux de la supervision industrielle');
  icd.run(c2_sys, 'SCADA',           'link', 'Ignition SCADA — Documentation',     'https://docs.inductiveautomation.com/', 'Documentation officielle de la plateforme Ignition');
  icd.run(c2_sys, 'Reseaux indus.',  'link', 'Profibus & Profinet — Tutoriel',     'https://profinetuniversity.com/', 'Introduction aux reseaux industriels Profibus et Profinet');

  icd.run(c2_ang, 'Vocabulaire',     'link', 'BBC Learning English',               'https://www.bbc.co.uk/learningenglish/', 'Ressources BBC pour l\'anglais professionnel');
  icd.run(c2_ang, 'Vocabulaire',     'link', 'EngVid — Videos anglais pro',        'https://www.engvid.com/',   'Vocabulaire et grammaire pour le milieu professionnel');
  icd.run(c2_ang, 'Exercices',       'link', 'British Council — Anglais pro',      'https://learnenglish.britishcouncil.org/business-english', 'Exercices d\'anglais des affaires du British Council');

  icd.run(c2_e5, 'Referentiel',      'link', 'Referentiel BTS SN — Epreuve E5',   'https://www.education.gouv.fr/', 'Referentiel officiel de l\'epreuve E5 du BTS SN');
  icd.run(c2_e5, 'Referentiel',      'link', 'Grille d\'evaluation E5',            'https://www.education.gouv.fr/', 'Criteres et baremes d\'evaluation de la soutenance');
  icd.run(c2_e5, 'Methodologie',     'link', 'Guide de redaction du rapport E5',   'https://www.education.gouv.fr/', 'Structure et conseils de redaction pour le rapport de stage');
  icd.run(c2_e5, 'Methodologie',     'link', 'Exemples de dossiers E5 (anonymises)', 'https://www.education.gouv.fr/', 'Exemples de rapports pour se reperer dans les attentes');
}

module.exports = { seedIfEmpty };
