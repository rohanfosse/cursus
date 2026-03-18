const { getDb } = require('./connection');

const CURRENT_VERSION = 13;

// ─── Schema initial ───────────────────────────────────────────────────────────
// Crée toutes les tables avec leur schéma complet (colonnes UTC, toutes colonnes incluses).
// Pour les bases existantes, runMigrations() ajoute les colonnes manquantes.

function initSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS promotions (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#4A90D9'
    );

    CREATE TABLE IF NOT EXISTS channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      type        TEXT NOT NULL DEFAULT 'chat' CHECK(type IN ('chat', 'annonce')),
      is_private  INTEGER NOT NULL DEFAULT 0,
      members     TEXT DEFAULT NULL,
      category    TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id        INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      avatar_initials TEXT NOT NULL,
      photo_data      TEXT,
      password        TEXT DEFAULT 'cesi1234'
    );

    CREATE TABLE IF NOT EXISTS groups (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id    INTEGER REFERENCES channels(id) ON DELETE CASCADE,
      dm_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      author_name   TEXT NOT NULL,
      author_type   TEXT NOT NULL CHECK(author_type IN ('teacher', 'student')),
      content       TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      pinned        INTEGER NOT NULL DEFAULT 0,
      reactions     TEXT DEFAULT NULL,
      CHECK(
        (channel_id IS NULL AND dm_student_id IS NOT NULL) OR
        (channel_id IS NOT NULL AND dm_student_id IS NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS travaux (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      channel_id  INTEGER REFERENCES channels(id) ON DELETE SET NULL,
      group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      description TEXT,
      deadline    TEXT NOT NULL,
      category    TEXT,
      type        TEXT NOT NULL DEFAULT 'devoir' CHECK(type IN ('devoir', 'jalon', 'projet')),
      published   INTEGER NOT NULL DEFAULT 1,
      start_date  TEXT
    );

    CREATE TABLE IF NOT EXISTS travail_group_members (
      travail_id INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (travail_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS ressources (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      travail_id  INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK(type IN ('file', 'link')),
      name        TEXT NOT NULL,
      path_or_url TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channel_documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      channel_id  INTEGER REFERENCES channels(id) ON DELETE SET NULL,
      project     TEXT,
      category    TEXT NOT NULL DEFAULT 'Général',
      type        TEXT NOT NULL CHECK(type IN ('file', 'link')),
      name        TEXT NOT NULL,
      path_or_url TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS depots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      travail_id   INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      file_name    TEXT NOT NULL,
      file_path    TEXT NOT NULL,
      note         REAL,
      feedback     TEXT,
      link_url     TEXT,
      deploy_url   TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(travail_id, student_id)
    );
  `);

  runMigrations(db);
}

// ─── Migrations versionnées (PRAGMA user_version) ─────────────────────────────
// Chaque entrée correspond à un numéro de version (index = version cible).
// tryAlter() ignore silencieusement si la colonne existe déjà — safe pour
// les bases créées avant l'introduction de ce système.

function runMigrations(db) {
  const version = db.pragma('user_version', { simple: true });
  if (version >= CURRENT_VERSION) return;

  const steps = [
    null, // v0 → placeholder

    // v1 : colonnes ajoutées post-lancement initial
    (db) => {
      tryAlter(db, "ALTER TABLE channels ADD COLUMN type TEXT NOT NULL DEFAULT 'chat'");
      tryAlter(db, 'ALTER TABLE depots ADD COLUMN feedback TEXT');
      tryAlter(db, 'ALTER TABLE travaux ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL');
      tryAlter(db, "ALTER TABLE travaux ADD COLUMN category TEXT NOT NULL DEFAULT 'TP'");
      tryAlter(db, "ALTER TABLE travaux ADD COLUMN type TEXT NOT NULL DEFAULT 'devoir'");
      tryAlter(db, 'ALTER TABLE travaux ADD COLUMN published INTEGER NOT NULL DEFAULT 1');
    },

    // v2 : photo profil & date de début
    (db) => {
      tryAlter(db, 'ALTER TABLE students ADD COLUMN photo_data TEXT');
      tryAlter(db, 'ALTER TABLE travaux ADD COLUMN start_date TEXT');
    },

    // v3 : nouvelles tables (idempotent via IF NOT EXISTS)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS channel_documents (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          category    TEXT NOT NULL DEFAULT 'Général',
          type        TEXT NOT NULL CHECK(type IN ('file', 'link')),
          name        TEXT NOT NULL,
          path_or_url TEXT NOT NULL,
          description TEXT,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS travail_group_members (
          travail_id INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          PRIMARY KEY (travail_id, student_id)
        );
      `);
    },

    // v4 : épinglage, réactions, dépôts par lien
    (db) => {
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
      tryAlter(db, 'ALTER TABLE depots ADD COLUMN link_url TEXT');
      tryAlter(db, 'ALTER TABLE depots ADD COLUMN deploy_url TEXT');
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT NULL');
    },

    // v5 : canaux privés & mots de passe étudiants
    (db) => {
      tryAlter(db, 'ALTER TABLE channels ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0');
      tryAlter(db, 'ALTER TABLE channels ADD COLUMN members TEXT DEFAULT NULL');
      tryAlter(db, "ALTER TABLE students ADD COLUMN password TEXT DEFAULT 'cesi1234'");
    },

    // v6 : catégories de canaux
    (db) => {
      tryAlter(db, 'ALTER TABLE channels ADD COLUMN category TEXT DEFAULT NULL');
    },

    // v7 : supprimer le CHECK sur travaux.category (SQLite = recréation de table)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS travaux_v7 (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          title       TEXT NOT NULL,
          description TEXT,
          deadline    TEXT NOT NULL,
          category    TEXT,
          type        TEXT NOT NULL DEFAULT 'devoir' CHECK(type IN ('devoir', 'jalon', 'projet')),
          published   INTEGER NOT NULL DEFAULT 1,
          start_date  TEXT
        );
        INSERT INTO travaux_v7 SELECT id, channel_id, group_id, title, description, deadline, category, type, published, start_date FROM travaux;
        DROP TABLE travaux;
        ALTER TABLE travaux_v7 RENAME TO travaux;
      `);
    },

    // v8 : travaux et documents indépendants des canaux (promo_id direct)
    (db) => {
      db.exec(`
        -- Reconstruction de travaux avec promo_id direct et channel_id nullable
        CREATE TABLE IF NOT EXISTS travaux_v8 (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          channel_id  INTEGER REFERENCES channels(id) ON DELETE SET NULL,
          group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          title       TEXT NOT NULL,
          description TEXT,
          deadline    TEXT NOT NULL,
          category    TEXT,
          type        TEXT NOT NULL DEFAULT 'devoir' CHECK(type IN ('devoir', 'jalon', 'projet')),
          published   INTEGER NOT NULL DEFAULT 1,
          start_date  TEXT
        );
        INSERT INTO travaux_v8
          SELECT t.id,
            COALESCE((SELECT ch.promo_id FROM channels ch WHERE ch.id = t.channel_id), 1),
            t.channel_id, t.group_id, t.title, t.description, t.deadline,
            t.category, t.type, t.published, t.start_date
          FROM travaux t;
        DROP TABLE travaux;
        ALTER TABLE travaux_v8 RENAME TO travaux;

        -- (suite v8) Reconstruction de channel_documents avec promo_id + project et channel_id nullable
        CREATE TABLE IF NOT EXISTS channel_documents_v8 (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          channel_id  INTEGER REFERENCES channels(id) ON DELETE SET NULL,
          project     TEXT,
          category    TEXT NOT NULL DEFAULT 'Général',
          type        TEXT NOT NULL CHECK(type IN ('file', 'link')),
          name        TEXT NOT NULL,
          path_or_url TEXT NOT NULL,
          description TEXT,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO channel_documents_v8
          SELECT cd.id,
            COALESCE((SELECT ch.promo_id FROM channels ch WHERE ch.id = cd.channel_id), 1),
            cd.channel_id,
            (SELECT ch.category FROM channels ch WHERE ch.id = cd.channel_id),
            cd.category, cd.type, cd.name, cd.path_or_url, cd.description, cd.created_at
          FROM channel_documents cd;
        DROP TABLE channel_documents;
        ALTER TABLE channel_documents_v8 RENAME TO channel_documents;
      `);
    },

    // v9 : nouveau système de types (livrable / soutenance / cctl / etude_de_cas / memoire / autre)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS travaux_v9 (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          channel_id  INTEGER REFERENCES channels(id) ON DELETE SET NULL,
          group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          title       TEXT NOT NULL,
          description TEXT,
          deadline    TEXT NOT NULL,
          category    TEXT,
          type        TEXT NOT NULL DEFAULT 'livrable'
                      CHECK(type IN ('livrable','soutenance','cctl','etude_de_cas','memoire','autre')),
          published   INTEGER NOT NULL DEFAULT 1,
          start_date  TEXT
        );
        INSERT INTO travaux_v9
          SELECT id, promo_id, channel_id, group_id, title, description, deadline, category,
            CASE type
              WHEN 'jalon'  THEN 'soutenance'
              WHEN 'projet' THEN 'livrable'
              ELSE               'livrable'
            END,
            published, start_date
          FROM travaux;
        DROP TABLE travaux;
        ALTER TABLE travaux_v9 RENAME TO travaux;
      `);
    },

    // v10 : canal privé lié au groupe
    (db) => {
      tryAlter(db, 'ALTER TABLE channels ADD COLUMN group_id INTEGER DEFAULT NULL');
    },

    // v11 : rubrics (grilles d'évaluation multi-critères)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS rubrics (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          travail_id INTEGER NOT NULL UNIQUE REFERENCES travaux(id) ON DELETE CASCADE,
          title      TEXT NOT NULL DEFAULT 'Grille d''évaluation'
        );
        CREATE TABLE IF NOT EXISTS rubric_criteria (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          rubric_id INTEGER NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
          label     TEXT    NOT NULL,
          max_pts   INTEGER NOT NULL DEFAULT 4,
          weight    REAL    NOT NULL DEFAULT 1.0,
          position  INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS rubric_scores (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          depot_id     INTEGER NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
          criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          points       INTEGER NOT NULL DEFAULT 0,
          UNIQUE(depot_id, criterion_id)
        );
      `);
    },

    // v12 : table teachers avec rôles (teacher / ta)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS teachers (
          id       INTEGER PRIMARY KEY AUTOINCREMENT,
          name     TEXT NOT NULL,
          email    TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL DEFAULT 'admin',
          role     TEXT NOT NULL DEFAULT 'teacher' CHECK(role IN ('teacher','ta'))
        );
        INSERT OR IGNORE INTO teachers (name, email, password, role)
          VALUES ('Rohan Fosse', 'rfosse@cesi.fr', 'admin', 'teacher');
        INSERT OR IGNORE INTO teachers (name, email, password, role)
          VALUES ('Assistant TA', 'ta@cesi.fr', 'admin', 'ta');
      `);
    },

    // v13 : colonne edited sur messages (suivi des modifications)
    (db) => {
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN edited INTEGER NOT NULL DEFAULT 0');
    },
  ];

  db.transaction(() => {
    for (let v = version + 1; v <= CURRENT_VERSION; v++) {
      steps[v](db);
      db.pragma(`user_version = ${v}`);
    }
  })();
}

function tryAlter(db, sql) {
  try { db.exec(sql); } catch { /* colonne déjà présente — ignoré */ }
}

module.exports = { initSchema };
