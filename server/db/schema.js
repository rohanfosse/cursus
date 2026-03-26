const { getDb } = require('./connection');

const CURRENT_VERSION = 41;

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
      start_date  TEXT,
      room        TEXT DEFAULT NULL,
      aavs        TEXT DEFAULT NULL,
      requires_submission INTEGER NOT NULL DEFAULT 1
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
      category    TEXT NOT NULL DEFAULT 'autre',
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
      travail_id  INTEGER REFERENCES travaux(id) ON DELETE SET NULL,
      file_size   INTEGER,
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
// tryAlter() ignore silencieusement si la colonne existe déjà - safe pour
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

    // v14 : citations (reply-to) sur les messages
    (db) => {
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN reply_to_id      INTEGER DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN reply_to_author  TEXT    DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN reply_to_preview TEXT    DEFAULT NULL');
    },

    // v15 : table pivot teacher_channels (assignation canaux aux intervenants)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_channels (
          teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
          channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          PRIMARY KEY (teacher_id, channel_id)
        );
      `);
    },

    // v16 : sécurité - hashage bcrypt + must_change_password
    (db) => {
      const bcrypt = require('bcryptjs');
      tryAlter(db, 'ALTER TABLE students ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1');
      tryAlter(db, 'ALTER TABLE teachers ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1');

      // Hasher les mots de passe en clair existants (migration transparente)
      const students = db.prepare('SELECT id, password FROM students').all();
      const updateStudent = db.prepare('UPDATE students SET password = ? WHERE id = ?');
      for (const s of students) {
        if (s.password && !s.password.startsWith('$2')) {
          updateStudent.run(bcrypt.hashSync(s.password, 10), s.id);
        }
      }

      const teachers = db.prepare('SELECT id, password FROM teachers').all();
      const updateTeacher = db.prepare('UPDATE teachers SET password = ? WHERE id = ?');
      for (const t of teachers) {
        if (t.password && !t.password.startsWith('$2')) {
          updateTeacher.run(bcrypt.hashSync(t.password, 10), t.id);
        }
      }
    },

    // v17 : salle, AAVs, flag requires_submission
    (db) => {
      tryAlter(db, 'ALTER TABLE travaux ADD COLUMN room TEXT DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE travaux ADD COLUMN aavs TEXT DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE travaux ADD COLUMN requires_submission INTEGER NOT NULL DEFAULT 1');
      // Les événements existants n'attendent pas de dépôt
      db.prepare("UPDATE travaux SET requires_submission = 0 WHERE type IN ('soutenance', 'cctl', 'etude_de_cas')").run();
    },

    // v18 : audit_log + login_attempts (admin console)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id   INTEGER NOT NULL,
          actor_name TEXT NOT NULL,
          actor_type TEXT NOT NULL,
          action     TEXT NOT NULL,
          target     TEXT,
          details    TEXT,
          ip         TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log(action);

        CREATE TABLE IF NOT EXISTS login_attempts (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          email      TEXT NOT NULL,
          success    INTEGER NOT NULL DEFAULT 0,
          ip         TEXT,
          user_agent TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_login_email   ON login_attempts(email);
        CREATE INDEX IF NOT EXISTS idx_login_created ON login_attempts(created_at);
      `);
    },

    // v19 : signalements, annonces planifiées, sessions, archivage promos, mode lecture seule
    (db) => {
      db.exec(`
        -- Signalements de messages
        CREATE TABLE IF NOT EXISTS reports (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          reporter_id INTEGER NOT NULL,
          reporter_name TEXT NOT NULL,
          reporter_type TEXT NOT NULL,
          reason      TEXT NOT NULL DEFAULT 'other'
              CHECK(reason IN ('spam','harassment','inappropriate','off_topic','other')),
          details     TEXT,
          status      TEXT NOT NULL DEFAULT 'pending'
              CHECK(status IN ('pending','reviewed','dismissed')),
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          resolved_at TEXT,
          resolved_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
        CREATE INDEX IF NOT EXISTS idx_reports_message ON reports(message_id);

        -- Annonces planifiées
        CREATE TABLE IF NOT EXISTS scheduled_messages (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          author_name TEXT NOT NULL,
          author_type TEXT NOT NULL DEFAULT 'teacher',
          content     TEXT NOT NULL,
          send_at     TEXT NOT NULL,
          sent        INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_send ON scheduled_messages(send_at, sent);

        -- Sessions actives
        CREATE TABLE IF NOT EXISTS active_sessions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL,
          user_name  TEXT NOT NULL,
          user_type  TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          ip         TEXT,
          user_agent TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id);

        -- Config globale (mode lecture seule, etc.)
        CREATE TABLE IF NOT EXISTS app_config (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        INSERT OR IGNORE INTO app_config (key, value) VALUES ('read_only', '0');
      `);

      // Archivage promos
      tryAlter(db, 'ALTER TABLE promotions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
    },

    // v20 : photo de profil enseignants
    (db) => {
      tryAlter(db, 'ALTER TABLE teachers ADD COLUMN photo_data TEXT DEFAULT NULL');
    },

    // v21 : feedback étudiants (bugs + améliorations)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS feedback (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL,
          user_name   TEXT NOT NULL,
          user_type   TEXT NOT NULL DEFAULT 'student',
          type        TEXT NOT NULL DEFAULT 'bug'
              CHECK(type IN ('bug','improvement','question')),
          title       TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status      TEXT NOT NULL DEFAULT 'open'
              CHECK(status IN ('open','in_progress','resolved','wontfix')),
          admin_reply TEXT,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          resolved_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
        CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
      `);
    },

    // v22 : rappels prof (échéancier scolarité)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_reminders (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_tag   TEXT NOT NULL,
          date        TEXT NOT NULL,
          title       TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          bloc        TEXT,
          done        INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_reminders_date ON teacher_reminders(date);
        CREATE INDEX IF NOT EXISTS idx_reminders_promo ON teacher_reminders(promo_tag);
      `);
    },

    // v23 : live quiz (sessions interactives en direct)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS live_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          promo_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          join_code TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','active','ended')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          ended_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_live_sessions_code ON live_sessions(join_code);

        CREATE TABLE IF NOT EXISTS live_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('qcm','sondage','nuage')),
          title TEXT NOT NULL,
          options TEXT DEFAULT NULL,
          multi INTEGER NOT NULL DEFAULT 0,
          max_words INTEGER NOT NULL DEFAULT 3,
          position INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','live','closed')),
          started_at TEXT,
          closed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS live_responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL REFERENCES live_activities(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          answer TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(activity_id, student_id)
        );
      `);
    },
    // v24 : métriques de visites (page views / DAU / WAU / MAU)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS page_visits (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER,
          user_name  TEXT,
          user_type  TEXT,
          path       TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_visits_created ON page_visits(created_at);
        CREATE INDEX IF NOT EXISTS idx_visits_user ON page_visits(user_id);
      `);
    },

    // v25 : Kahoot-style scoring (timer, correct answers, leaderboard)
    (db) => {
      tryAlter(db, 'ALTER TABLE live_activities ADD COLUMN timer_seconds INTEGER NOT NULL DEFAULT 30');
      tryAlter(db, 'ALTER TABLE live_activities ADD COLUMN correct_answers TEXT DEFAULT NULL');
      db.exec(`
        CREATE TABLE IF NOT EXISTS live_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          student_name TEXT NOT NULL,
          activity_id INTEGER NOT NULL REFERENCES live_activities(id) ON DELETE CASCADE,
          points INTEGER NOT NULL DEFAULT 0,
          answer_time_ms INTEGER NOT NULL DEFAULT 0,
          is_correct INTEGER NOT NULL DEFAULT 0,
          UNIQUE(activity_id, student_id)
        );
        CREATE INDEX IF NOT EXISTS idx_live_scores_session ON live_scores(session_id);
      `);
    },

    // v26 : REX (Retour d'Experience) - sessions, activites, reponses anonymes
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS rex_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          promo_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          join_code TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','active','ended')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          ended_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_rex_sessions_code ON rex_sessions(join_code);

        CREATE TABLE IF NOT EXISTS rex_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES rex_sessions(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('sondage_libre','nuage','echelle','question_ouverte')),
          title TEXT NOT NULL,
          max_words INTEGER NOT NULL DEFAULT 3,
          max_rating INTEGER NOT NULL DEFAULT 5,
          position INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','live','closed')),
          started_at TEXT,
          closed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_rex_activities_session ON rex_activities(session_id);

        CREATE TABLE IF NOT EXISTS rex_responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL REFERENCES rex_activities(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          answer TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(activity_id, student_id)
        );
        CREATE INDEX IF NOT EXISTS idx_rex_responses_activity ON rex_responses(activity_id);
      `);
    },
    // v27 : indexes de performance sur colonnes fréquemment filtrées
    (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_live_sessions_promo  ON live_sessions(promo_id);
        CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_rex_sessions_promo   ON rex_sessions(promo_id);
        CREATE INDEX IF NOT EXISTS idx_rex_sessions_status  ON rex_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_travaux_promo        ON travaux(promo_id);
        CREATE INDEX IF NOT EXISTS idx_depots_student       ON depots(student_id);
      `);
    },

    // v28 : REX asynchrone — sondages différés avec date de clôture
    (db) => {
      tryAlter(db, 'ALTER TABLE rex_sessions ADD COLUMN is_async INTEGER NOT NULL DEFAULT 0');
      tryAlter(db, 'ALTER TABLE rex_sessions ADD COLUMN open_until TEXT DEFAULT NULL');
    },

    // v29 : Kanban de projet — suivi de tâches par groupe
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS kanban_cards (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          travail_id  INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
          group_id    INTEGER NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
          title       TEXT    NOT NULL,
          description TEXT    NOT NULL DEFAULT '',
          status      TEXT    NOT NULL DEFAULT 'todo'
                      CHECK(status IN ('todo','doing','blocked','done')),
          position    INTEGER NOT NULL DEFAULT 0,
          created_by  TEXT    NOT NULL DEFAULT '',
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_kanban_travail_group ON kanban_cards(travail_id, group_id);
      `);
    },
    // v30 : index sur les messages pour la recherche et les performances
    (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_channel    ON messages(channel_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_dm         ON messages(dm_student_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_author     ON messages(author_name);
        CREATE INDEX IF NOT EXISTS idx_channels_promo      ON channels(promo_id);
      `);
    },
    // v31 : carnet de suivi etudiant (notes privees du prof)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_notes (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id  INTEGER NOT NULL,
          student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          content     TEXT    NOT NULL,
          tag         TEXT    NOT NULL DEFAULT 'observation' CHECK(tag IN ('progression','objectif','observation','alerte','autre')),
          category    TEXT    NOT NULL DEFAULT 'generale',
          created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_teacher_notes_student  ON teacher_notes(student_id);
        CREATE INDEX IF NOT EXISTS idx_teacher_notes_promo    ON teacher_notes(promo_id);
        CREATE INDEX IF NOT EXISTS idx_teacher_notes_teacher  ON teacher_notes(teacher_id);
        CREATE INDEX IF NOT EXISTS idx_teacher_notes_category ON teacher_notes(category);
      `);
    },
    // v32 : carnet de suivi — ajout catégorie sur bases existantes
    (db) => {
      tryAlter(db, "ALTER TABLE teacher_notes ADD COLUMN category TEXT NOT NULL DEFAULT 'generale'");
      db.exec(`CREATE INDEX IF NOT EXISTS idx_teacher_notes_category ON teacher_notes(category)`);
    },
    // v33 : ressources — ajout catégorie (Moodle, Github, LinkedIn, Site Web, Autre)
    (db) => {
      tryAlter(db, "ALTER TABLE ressources ADD COLUMN category TEXT NOT NULL DEFAULT 'autre'");
    },
    // v34 : documents — lien vers un devoir (travail_id)
    (db) => {
      tryAlter(db, 'ALTER TABLE channel_documents ADD COLUMN travail_id INTEGER REFERENCES travaux(id) ON DELETE SET NULL');
    },
    // v35 : documents — taille du fichier (file_size en octets)
    (db) => {
      tryAlter(db, 'ALTER TABLE channel_documents ADD COLUMN file_size INTEGER');
    },
    // v36 : indexes DM performance
    (db) => {
      db.exec('CREATE INDEX IF NOT EXISTS idx_messages_dm_author ON messages(dm_student_id, author_name, created_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_teachers_name ON teachers(name)');
    },
    // v37 : signature requests
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS signature_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL,
          dm_student_id INTEGER NOT NULL,
          file_url TEXT NOT NULL,
          file_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          rejection_reason TEXT,
          signed_file_url TEXT,
          signer_name TEXT,
          signed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (dm_student_id) REFERENCES students(id)
        );
        CREATE INDEX IF NOT EXISTS idx_sig_req_student ON signature_requests(dm_student_id);
        CREATE INDEX IF NOT EXISTS idx_sig_req_status ON signature_requests(status);
        CREATE INDEX IF NOT EXISTS idx_sig_req_message ON signature_requests(message_id);
      `);
    },
    // v38 : soft delete des messages + index
    (db) => {
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN deleted_at TEXT DEFAULT NULL');
      db.exec('CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_at)');
    },
    // v39 : sécurité signatures — hash document, audit, IP
    (db) => {
      tryAlter(db, 'ALTER TABLE signature_requests ADD COLUMN file_hash TEXT DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE signature_requests ADD COLUMN created_by INTEGER DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE signature_requests ADD COLUMN created_ip TEXT DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE signature_requests ADD COLUMN signer_id INTEGER DEFAULT NULL');
      tryAlter(db, 'ALTER TABLE signature_requests ADD COLUMN signer_ip TEXT DEFAULT NULL');
    },
    // v40 : indexes performance documents
    (db) => {
      db.exec('CREATE INDEX IF NOT EXISTS idx_doc_promo ON channel_documents(promo_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_doc_promo_project ON channel_documents(promo_id, project)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_doc_channel ON channel_documents(channel_id)');
    },
    // v41 : author_id sur messages (ownership par ID numerique au lieu de author_name)
    (db) => {
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN author_id INTEGER');
      // Backfill author_id depuis author_name (négatif pour teachers, positif pour students)
      db.exec(`
        UPDATE messages SET author_id = -(
          SELECT t.id FROM teachers t WHERE t.name = messages.author_name LIMIT 1
        ) WHERE author_type = 'teacher' AND author_id IS NULL
      `);
      db.exec(`
        UPDATE messages SET author_id = (
          SELECT s.id FROM students s WHERE s.name = messages.author_name LIMIT 1
        ) WHERE author_type = 'student' AND author_id IS NULL
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id)');
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
  try { db.exec(sql); } catch { /* colonne déjà présente - ignoré */ }
}

module.exports = { initSchema, runMigrations };
