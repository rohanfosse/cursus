const { getDb } = require('./connection');

const CURRENT_VERSION = 86;

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
      category    TEXT DEFAULT NULL,
      archived    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS students (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id        INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      avatar_initials TEXT NOT NULL,
      photo_data      TEXT,
      password        TEXT
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

    CREATE TABLE IF NOT EXISTS bookmarks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      user_type  TEXT NOT NULL CHECK(user_type IN ('student','teacher','admin','ta')),
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      note       TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_statuses (
      user_id    INTEGER PRIMARY KEY,
      user_type  TEXT NOT NULL CHECK(user_type IN ('student','teacher','admin','ta')),
      emoji      TEXT,
      text       TEXT,
      expires_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_user_statuses_expires ON user_statuses(expires_at) WHERE expires_at IS NOT NULL;

    CREATE TABLE IF NOT EXISTS link_previews (
      url_hash    TEXT PRIMARY KEY,
      url         TEXT NOT NULL,
      title       TEXT,
      description TEXT,
      image       TEXT,
      site_name   TEXT,
      status      INTEGER,
      fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_link_previews_expires ON link_previews(expires_at);
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
          mode TEXT NOT NULL DEFAULT 'live' CHECK(mode IN ('live','replay')),
          UNIQUE(activity_id, student_id, mode)
        );
        CREATE INDEX IF NOT EXISTS idx_live_scores_session ON live_scores(session_id);
        CREATE INDEX IF NOT EXISTS idx_live_scores_mode ON live_scores(mode);
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
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          max_words INTEGER NOT NULL DEFAULT 3,
          max_rating INTEGER NOT NULL DEFAULT 5,
          options TEXT DEFAULT NULL,
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

    // v42 : entite Projet + role admin + teacher_promos (epic roles-permissions #55)
    (db) => {
      // 1. Etendre le CHECK constraint de teachers.role pour inclure 'admin'
      //    SQLite ne supporte pas ALTER CHECK, on recree la table
      db.exec(`
        CREATE TABLE IF NOT EXISTS teachers_v42 (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          name                TEXT NOT NULL,
          email               TEXT NOT NULL UNIQUE,
          password            TEXT,
          role                TEXT NOT NULL DEFAULT 'teacher' CHECK(role IN ('admin','teacher','ta')),
          must_change_password INTEGER NOT NULL DEFAULT 0,
          photo_data          TEXT
        );
        INSERT INTO teachers_v42 (id, name, email, password, role, must_change_password, photo_data)
          SELECT id, name, email, password, role, COALESCE(must_change_password, 0), photo_data FROM teachers;
        DROP TABLE teachers;
        ALTER TABLE teachers_v42 RENAME TO teachers;
      `);

      // 2. Table projects (entite organisationnelle fondamentale)
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          description TEXT,
          channel_id  INTEGER REFERENCES channels(id) ON DELETE SET NULL,
          deadline    TEXT,
          created_by  INTEGER NOT NULL,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_projects_promo ON projects(promo_id);
      `);

      // 3. Table project_travaux (tout devoir dans un projet)
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_travaux (
          project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          travail_id  INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
          PRIMARY KEY (project_id, travail_id)
        );
        CREATE INDEX IF NOT EXISTS idx_pt_travail ON project_travaux(travail_id);
      `);

      // 4. Table project_documents (documents lies a un projet)
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_documents (
          project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          document_id INTEGER NOT NULL REFERENCES channel_documents(id) ON DELETE CASCADE,
          PRIMARY KEY (project_id, document_id)
        );
      `);

      // 5. Table teacher_projects (assignation TA par projet, remplacera teacher_channels)
      db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_projects (
          teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
          project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          can_grade   INTEGER NOT NULL DEFAULT 1,
          assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (teacher_id, project_id)
        );
        CREATE INDEX IF NOT EXISTS idx_tp_teacher ON teacher_projects(teacher_id);
        CREATE INDEX IF NOT EXISTS idx_tp_project ON teacher_projects(project_id);
      `);

      // 6. Table teacher_promos (liaison enseignant-promo)
      db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_promos (
          teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
          promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          PRIMARY KEY (teacher_id, promo_id)
        );
        CREATE INDEX IF NOT EXISTS idx_tpr_teacher ON teacher_promos(teacher_id);
      `);

      // 7. Promouvoir le premier enseignant en admin s'il n'y en a pas
      const hasAdmin = db.prepare("SELECT 1 FROM teachers WHERE role = 'admin' LIMIT 1").get();
      if (!hasAdmin) {
        const first = db.prepare("SELECT id FROM teachers WHERE role = 'teacher' ORDER BY id LIMIT 1").get();
        if (first) {
          db.prepare("UPDATE teachers SET role = 'admin' WHERE id = ?").run(first.id);
        }
      }

      // 8. Peupler teacher_promos pour les enseignants existants (toutes les promos)
      db.exec(`
        INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id)
          SELECT t.id, p.id FROM teachers t, promotions p WHERE t.role IN ('admin', 'teacher');
      `);
    },

    // v43 : migration donnees — devoirs vers projets + teacher_channels vers teacher_projects (#59)
    (db) => {
      // 1. Creer des projets par defaut pour les devoirs non encore lies a un projet
      const promos = db.prepare(
        'SELECT DISTINCT promo_id FROM travaux WHERE id NOT IN (SELECT travail_id FROM project_travaux)'
      ).all();

      for (const { promo_id } of promos) {
        const categories = db.prepare(
          "SELECT DISTINCT COALESCE(category, 'Général') as cat FROM travaux WHERE promo_id = ? AND id NOT IN (SELECT travail_id FROM project_travaux)"
        ).all(promo_id);

        for (const { cat } of categories) {
          // Creer un projet pour cette categorie dans la promo
          const projectId = db.prepare(
            "INSERT INTO projects (promo_id, name, created_by, created_at) VALUES (?, ?, 1, datetime('now'))"
          ).run(promo_id, cat).lastInsertRowid;

          // Lier tous les devoirs de cette categorie au projet
          db.prepare(
            "INSERT OR IGNORE INTO project_travaux (project_id, travail_id) SELECT ?, id FROM travaux WHERE promo_id = ? AND COALESCE(category, 'Général') = ? AND id NOT IN (SELECT travail_id FROM project_travaux)"
          ).run(projectId, promo_id, cat);
        }
      }

      // 2. Migrer teacher_channels vers teacher_projects
      const tcExists = db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='teacher_channels'"
      ).get();

      if (tcExists) {
        const assignments = db.prepare(
          'SELECT tc.teacher_id, c.promo_id FROM teacher_channels tc JOIN channels c ON tc.channel_id = c.id'
        ).all();

        for (const { teacher_id, promo_id } of assignments) {
          // Assigner l'enseignant a TOUS les projets de cette promo
          db.prepare(
            'INSERT OR IGNORE INTO teacher_projects (teacher_id, project_id) SELECT ?, id FROM projects WHERE promo_id = ?'
          ).run(teacher_id, promo_id);
        }

        // 3. Supprimer teacher_channels apres migration
        db.exec('DROP TABLE IF EXISTS teacher_channels');
      }

      // 4. Indexes de performance manquants
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_students_promo ON students(promo_id);
        CREATE INDEX IF NOT EXISTS idx_depots_travail ON depots(travail_id);
      `);
    },

    // v44 : table error_reports (monitoring interne — remplace Sentry)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS error_reports (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER,
          user_name  TEXT,
          user_type  TEXT,
          page       TEXT,
          message    TEXT NOT NULL,
          stack      TEXT,
          user_agent TEXT,
          app_version TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_error_reports_created ON error_reports(created_at);
        CREATE INDEX IF NOT EXISTS idx_error_reports_user ON error_reports(user_id);
      `);
    },

    // v45 : flag onboarding pour les etudiants
    (db) => {
      tryAlter(db, 'ALTER TABLE students ADD COLUMN onboarding_done INTEGER NOT NULL DEFAULT 0');
    },

    // v46 : indexes performance documents + validation
    (db) => {
      db.exec('CREATE INDEX IF NOT EXISTS idx_docs_promo_project ON channel_documents(promo_id, project)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_docs_created ON channel_documents(created_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_docs_travail ON channel_documents(travail_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_docs_type ON channel_documents(type)');
    },

    // v47 : archivage des canaux (#80)
    (db) => {
      tryAlter(db, 'ALTER TABLE channels ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
    },

    // v48 : publication programmee des devoirs (#91)
    (db) => {
      tryAlter(db, 'ALTER TABLE travaux ADD COLUMN scheduled_publish_at TEXT DEFAULT NULL');
    },

    // v49 : Pulse — 4 nouveaux types (sondage, humeur, priorite, matrice) + colonne options
    (db) => {
      tryAlter(db, 'ALTER TABLE rex_activities ADD COLUMN options TEXT DEFAULT NULL');
      // Relacher le CHECK constraint sur type en recreant la table
      // SQLite ne supporte pas ALTER CHECK, on utilise une approche pragmatique :
      // supprimer le CHECK et le recreer via une table temporaire
      try {
        db.exec(`
          CREATE TABLE rex_activities_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES rex_sessions(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            max_words INTEGER NOT NULL DEFAULT 3,
            max_rating INTEGER NOT NULL DEFAULT 5,
            options TEXT DEFAULT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','live','closed')),
            started_at TEXT,
            closed_at TEXT
          );
          INSERT INTO rex_activities_new (id, session_id, type, title, max_words, max_rating, position, status, started_at, closed_at)
            SELECT id, session_id, type, title, max_words, max_rating, position, status, started_at, closed_at FROM rex_activities;
          DROP TABLE rex_activities;
          ALTER TABLE rex_activities_new RENAME TO rex_activities;
          CREATE INDEX IF NOT EXISTS idx_rex_activities_session ON rex_activities(session_id);
        `);
      } catch { /* migration deja faite */ }
    },

    // v50 : Lumen — cours markdown publies par les enseignants
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_courses (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id   INTEGER NOT NULL,
          promo_id     INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          title        TEXT NOT NULL,
          summary      TEXT DEFAULT '',
          content      TEXT NOT NULL DEFAULT '',
          status       TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
          published_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_lumen_courses_promo  ON lumen_courses(promo_id);
        CREATE INDEX IF NOT EXISTS idx_lumen_courses_status ON lumen_courses(status);
      `);
    },

    // v51 : Lumen — lien projet optionnel + tracking lecture etudiant
    (db) => {
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_lumen_courses_project ON lumen_courses(project_id);`);

      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_course_reads (
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          course_id  INTEGER NOT NULL REFERENCES lumen_courses(id) ON DELETE CASCADE,
          read_at    TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (student_id, course_id)
        );
        CREATE INDEX IF NOT EXISTS idx_lumen_reads_student ON lumen_course_reads(student_id);
      `);

      // Pre-remplit lumen_course_reads : tous les cours deja publies sont
      // consideres "deja lus" pour tous les etudiants existants. Seules les
      // futures publications declencheront des notifications non-lues.
      db.exec(`
        INSERT OR IGNORE INTO lumen_course_reads (student_id, course_id, read_at)
        SELECT s.id, c.id, datetime('now')
        FROM students s
        JOIN lumen_courses c ON c.promo_id = s.promo_id
        WHERE c.status = 'published';
      `);
    },

    // v52 : Lumen — snapshot d'un repo git d'exemple attache au cours
    (db) => {
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN repo_url TEXT`);
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN repo_snapshot TEXT`);
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN repo_commit_sha TEXT`);
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN repo_default_branch TEXT`);
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN repo_snapshot_at TEXT`);
    },

    // v53 : Lumen — notes privees par etudiant sur un cours
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_course_notes (
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          course_id  INTEGER NOT NULL REFERENCES lumen_courses(id) ON DELETE CASCADE,
          content    TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (student_id, course_id)
        );
        CREATE INDEX IF NOT EXISTS idx_lumen_notes_student ON lumen_course_notes(student_id);
      `);
    },

    // v54 : Lumen — soft-delete des cours (corbeille)
    (db) => {
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN deleted_at TEXT`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_lumen_courses_deleted ON lumen_courses(deleted_at);`);
    },

    // v55 : Lumen — publication programmee des cours
    (db) => {
      tryAlter(db, `ALTER TABLE lumen_courses ADD COLUMN scheduled_publish_at TEXT`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_lumen_courses_scheduled ON lumen_courses(scheduled_publish_at) WHERE scheduled_publish_at IS NOT NULL;`);
    },

    // v56 : Lumen — pivot GitHub (table rase)
    // Lumen devient une liseuse de cours adossee a GitHub.
    // 1 promo = 1 org, 1 projet pedagogique = 1 repo, manifest auto-genere depuis l'arbre GitHub.
    // Les cours markdown ne vivent plus en DB : ils sont fetches depuis GitHub et mis en cache.
    (db) => {
      // Table rase : anciens cours en DB = brouillons jetables
      db.exec(`
        DROP TABLE IF EXISTS lumen_course_reads;
        DROP TABLE IF EXISTS lumen_course_notes;
        DROP TABLE IF EXISTS lumen_courses;
      `);

      // Mapping promo -> organisation GitHub
      tryAlter(db, `ALTER TABLE promotions ADD COLUMN github_org TEXT`);

      // Tokens d'acces GitHub stockes par utilisateur (eleve ou prof)
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_github_auth (
          user_type    TEXT NOT NULL CHECK(user_type IN ('student','teacher')),
          user_id      INTEGER NOT NULL,
          github_login TEXT NOT NULL,
          access_token TEXT NOT NULL,
          scopes       TEXT NOT NULL DEFAULT '',
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_type, user_id)
        );
      `);

      // Repo = projet pedagogique lie a une promo
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_repos (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_id        INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
          owner           TEXT NOT NULL,
          repo            TEXT NOT NULL,
          default_branch  TEXT NOT NULL DEFAULT 'main',
          manifest_json   TEXT,
          manifest_error  TEXT,
          last_commit_sha TEXT,
          last_synced_at  TEXT,
          project_id      INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (promo_id, owner, repo)
        );
        CREATE INDEX IF NOT EXISTS idx_lumen_repos_promo ON lumen_repos(promo_id);
      `);

      // Cache de fichiers markdown fetches depuis GitHub (identifies par sha)
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_file_cache (
          repo_id    INTEGER NOT NULL REFERENCES lumen_repos(id) ON DELETE CASCADE,
          path       TEXT NOT NULL,
          sha        TEXT NOT NULL,
          content    TEXT NOT NULL,
          fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (repo_id, path)
        );
      `);

      // Notes privees etudiant, attachees a un chapitre (repo, path)
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_chapter_notes (
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          repo_id    INTEGER NOT NULL REFERENCES lumen_repos(id) ON DELETE CASCADE,
          path       TEXT NOT NULL,
          content    TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (student_id, repo_id, path)
        );
        CREATE INDEX IF NOT EXISTS idx_lumen_chapter_notes_student ON lumen_chapter_notes(student_id);
      `);

      // Tracking de lecture par chapitre
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_chapter_reads (
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          repo_id    INTEGER NOT NULL REFERENCES lumen_repos(id) ON DELETE CASCADE,
          path       TEXT NOT NULL,
          read_at    TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (student_id, repo_id, path)
        );
        CREATE INDEX IF NOT EXISTS idx_lumen_chapter_reads_repo ON lumen_chapter_reads(repo_id);
      `);
    },

    // v57 : Lumen — liaison devoirs <-> chapitres (N:M)
    // Un devoir peut pointer vers un ou plusieurs chapitres Lumen comme
    // prerequis / reference. Un chapitre peut etre reference par plusieurs
    // devoirs. L'UI affiche les deux directions.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lumen_chapter_travaux (
          travail_id   INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
          repo_id      INTEGER NOT NULL REFERENCES lumen_repos(id) ON DELETE CASCADE,
          chapter_path TEXT NOT NULL,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (travail_id, repo_id, chapter_path)
        );
        CREATE INDEX IF NOT EXISTS idx_lct_repo_chapter ON lumen_chapter_travaux(repo_id, chapter_path);
        CREATE INDEX IF NOT EXISTS idx_lct_travail ON lumen_chapter_travaux(travail_id);
      `);
    },

    // v58 : Lumen — visibilite repo (le prof choisit quels repos sont
    // visibles pour les etudiants). Pour les nouveaux repos sync apres
    // cette migration, default 0 (masque) — le prof doit explicitement
    // publier. Mais les repos DEJA presents en base sont marques visible=1
    // pour ne pas casser l'experience etudiante des installations existantes
    // (sinon tout disparait du jour au lendemain). Admin/teacher voient
    // toujours tous les repos quel que soit ce flag.
    (db) => {
      tryAlter(db, `ALTER TABLE lumen_repos ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 0`);
      db.exec(`UPDATE lumen_repos SET is_visible = 1 WHERE is_visible = 0`);
    },

    // v59 : Lumen — index fulltext SQLite FTS5 pour la recherche dans le
    // contenu des chapitres. Table virtuelle alimentee lazily au fetch
    // chapitre (dans fetchChapterContent). Repo_id et chapter_path sont
    // UNINDEXED : on les stocke pour les retrouver, mais on ne cherche pas
    // dessus. Tokenize unicode61 + remove_diacritics pour matcher les
    // accents francais (promesse == promesse). Snippet built-in pour
    // afficher un extrait contextualise des resultats.
    (db) => {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS lumen_chapter_fts USING fts5(
          repo_id UNINDEXED,
          chapter_path UNINDEXED,
          title,
          content,
          tokenize='unicode61 remove_diacritics 2'
        );
      `);
    },

    // v60 : Cahier — editeur collaboratif temps reel (Yjs CRDT + TipTap)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS cahiers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_id INTEGER NOT NULL REFERENCES promotions(id),
          group_id INTEGER REFERENCES groups(id),
          project TEXT,
          title TEXT NOT NULL DEFAULT 'Sans titre',
          yjs_state BLOB,
          created_by INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_cahiers_promo ON cahiers(promo_id);
        CREATE INDEX IF NOT EXISTS idx_cahiers_group ON cahiers(group_id);
        CREATE INDEX IF NOT EXISTS idx_cahiers_project ON cahiers(promo_id, project);
      `);
    },

    // v61 : Live unifie (fusion Spark + Pulse + Code + Board)
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS live_sessions_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          promo_id INTEGER NOT NULL REFERENCES promotions(id),
          title TEXT NOT NULL,
          join_code TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting','active','ended')),
          is_async INTEGER DEFAULT 0,
          open_until TEXT DEFAULT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          ended_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_live_v2_code ON live_sessions_v2(join_code);
        CREATE INDEX IF NOT EXISTS idx_live_v2_promo ON live_sessions_v2(promo_id);
        CREATE INDEX IF NOT EXISTS idx_live_v2_status ON live_sessions_v2(status);

        CREATE TABLE IF NOT EXISTS live_activities_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES live_sessions_v2(id) ON DELETE CASCADE,
          category TEXT NOT NULL CHECK(category IN ('spark','pulse','code','board')),
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          options TEXT DEFAULT NULL,
          multi INTEGER DEFAULT 0,
          max_words INTEGER DEFAULT 3,
          max_rating INTEGER DEFAULT 5,
          timer_seconds INTEGER DEFAULT 30,
          correct_answers TEXT DEFAULT NULL,
          content TEXT DEFAULT NULL,
          language TEXT DEFAULT NULL,
          position INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','live','closed')),
          started_at TEXT,
          closed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_live_act_v2_session ON live_activities_v2(session_id);

        CREATE TABLE IF NOT EXISTS live_responses_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL REFERENCES live_activities_v2(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          answer TEXT NOT NULL,
          pinned INTEGER DEFAULT 0,
          mode TEXT NOT NULL DEFAULT 'live' CHECK(mode IN ('live','replay')),
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(activity_id, student_id, mode)
        );
        CREATE INDEX IF NOT EXISTS idx_live_resp_v2_activity ON live_responses_v2(activity_id);
        CREATE INDEX IF NOT EXISTS idx_live_resp_v2_mode ON live_responses_v2(mode);

        CREATE TABLE IF NOT EXISTS live_board_cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL REFERENCES live_activities_v2(id) ON DELETE CASCADE,
          column_name TEXT NOT NULL DEFAULT 'Idees',
          content TEXT NOT NULL,
          author_id INTEGER NOT NULL,
          author_name TEXT NOT NULL,
          color TEXT DEFAULT '#3b82f6',
          votes INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_live_board_activity ON live_board_cards(activity_id);

        CREATE TABLE IF NOT EXISTS live_board_votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          card_id INTEGER NOT NULL REFERENCES live_board_cards(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          UNIQUE(card_id, student_id)
        );
      `);
    },

    // v62 : Booking (mini-Calendly) — RDV visio tuteurs entreprise
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS booking_event_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          duration_minutes INTEGER NOT NULL DEFAULT 30,
          color TEXT DEFAULT '#3b82f6',
          fallback_visio_url TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          buffer_minutes INTEGER NOT NULL DEFAULT 0,
          timezone TEXT NOT NULL DEFAULT 'Europe/Paris'
        );

        CREATE TABLE IF NOT EXISTS booking_availability_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          is_active INTEGER DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_booking_avail_teacher ON booking_availability_rules(teacher_id);

        CREATE TABLE IF NOT EXISTS booking_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type_id INTEGER NOT NULL REFERENCES booking_event_types(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_booking_tokens_token ON booking_tokens(token);

        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type_id INTEGER NOT NULL REFERENCES booking_event_types(id),
          student_id INTEGER NOT NULL,
          teacher_id INTEGER NOT NULL,
          tutor_name TEXT NOT NULL,
          tutor_email TEXT NOT NULL,
          start_datetime TEXT NOT NULL,
          end_datetime TEXT NOT NULL,
          teams_join_url TEXT,
          outlook_event_id TEXT,
          status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','rescheduled')),
          cancel_token TEXT UNIQUE,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_bookings_teacher ON bookings(teacher_id, start_datetime);
        CREATE INDEX IF NOT EXISTS idx_bookings_cancel ON bookings(cancel_token);

        CREATE TABLE IF NOT EXISTS microsoft_tokens (
          teacher_id INTEGER PRIMARY KEY,
          access_token_enc TEXT NOT NULL,
          refresh_token_enc TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
    },

    // v63 : Booking — buffer time entre RDV
    (db) => {
      tryAlter(db, "ALTER TABLE booking_event_types ADD COLUMN buffer_minutes INTEGER NOT NULL DEFAULT 0");
    },

    // v64 : Booking — reminders, reschedule, timezone
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS booking_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'email_24h',
          scheduled_at TEXT NOT NULL,
          sent_at TEXT,
          UNIQUE(booking_id, type)
        );
        CREATE INDEX IF NOT EXISTS idx_booking_reminders_scheduled ON booking_reminders(scheduled_at);
      `);
      tryAlter(db, "ALTER TABLE bookings ADD COLUMN rescheduled_from_id INTEGER REFERENCES bookings(id)");
      tryAlter(db, "ALTER TABLE booking_event_types ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Europe/Paris'");
    },

    // v65 : Booking — recurrence + availability overrides
    (db) => {
      tryAlter(db, "ALTER TABLE bookings ADD COLUMN recurrence_group_id TEXT DEFAULT NULL");
      db.exec(`
        CREATE TABLE IF NOT EXISTS booking_availability_overrides (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type_id INTEGER NOT NULL REFERENCES booking_event_types(id) ON DELETE CASCADE,
          override_date TEXT NOT NULL,
          start_time TEXT,
          end_time TEXT,
          is_blocked INTEGER NOT NULL DEFAULT 0,
          UNIQUE(event_type_id, override_date, start_time)
        );
        CREATE INDEX IF NOT EXISTS idx_booking_overrides_type ON booking_availability_overrides(event_type_id, override_date);
      `);
    },

    // v66 : Spark replay — mode async apres fin de session
    // Ajoute colonne `mode` (live|replay) aux responses+scores, change la contrainte UNIQUE pour autoriser
    // un etudiant a refaire le quiz en mode entrainement sans ecraser son score live.
    (db) => {
      // Recreation de live_responses_v2 avec la contrainte UNIQUE etendue
      // (SQLite ne permet pas DROP/ADD CONSTRAINT : on recreee la table).
      db.exec(`
        CREATE TABLE IF NOT EXISTS live_responses_v2_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL REFERENCES live_activities_v2(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          answer TEXT NOT NULL,
          pinned INTEGER DEFAULT 0,
          mode TEXT NOT NULL DEFAULT 'live' CHECK(mode IN ('live','replay')),
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(activity_id, student_id, mode)
        );
        INSERT INTO live_responses_v2_new (id, activity_id, student_id, answer, pinned, mode, created_at)
          SELECT id, activity_id, student_id, answer, pinned, 'live', created_at FROM live_responses_v2;
        DROP TABLE live_responses_v2;
        ALTER TABLE live_responses_v2_new RENAME TO live_responses_v2;
        CREATE INDEX IF NOT EXISTS idx_live_resp_v2_activity ON live_responses_v2(activity_id);
        CREATE INDEX IF NOT EXISTS idx_live_resp_v2_mode ON live_responses_v2(mode);

        CREATE TABLE IF NOT EXISTS live_scores_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          student_name TEXT NOT NULL,
          activity_id INTEGER NOT NULL REFERENCES live_activities(id) ON DELETE CASCADE,
          points INTEGER NOT NULL DEFAULT 0,
          answer_time_ms INTEGER NOT NULL DEFAULT 0,
          is_correct INTEGER NOT NULL DEFAULT 0,
          mode TEXT NOT NULL DEFAULT 'live' CHECK(mode IN ('live','replay')),
          UNIQUE(activity_id, student_id, mode)
        );
        INSERT INTO live_scores_new (id, session_id, student_id, student_name, activity_id, points, answer_time_ms, is_correct, mode)
          SELECT id, session_id, student_id, student_name, activity_id, points, answer_time_ms, is_correct, 'live' FROM live_scores;
        DROP TABLE live_scores;
        ALTER TABLE live_scores_new RENAME TO live_scores;
        CREATE INDEX IF NOT EXISTS idx_live_scores_session ON live_scores(session_id);
        CREATE INDEX IF NOT EXISTS idx_live_scores_mode ON live_scores(mode);
      `);
    },

    // v67 : Message Wall — hidden column pour moderation + table confusion signals
    (db) => {
      tryAlter(db, 'ALTER TABLE live_board_cards ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
      db.exec(`
        CREATE TABLE IF NOT EXISTS live_confusion_signals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES live_sessions_v2(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(session_id, student_id)
        );
        CREATE INDEX IF NOT EXISTS idx_confusion_session ON live_confusion_signals(session_id);
      `);
    },

    // v68 : Self-paced mode — colonne sur les sessions
    (db) => {
      tryAlter(db, "ALTER TABLE live_sessions_v2 ADD COLUMN self_paced INTEGER NOT NULL DEFAULT 0");
    },

    // v69 : Texte a trous — pas de migration DB necessaire (type stocke comme string)
    (db) => {
      // noop — texte_a_trous utilise correct_answers JSON existant
    },

    // v70 : Fix `users` manquant
    // 1) Recree les 4 tables qui pointaient sur `REFERENCES users(id)` (table jamais
    //    creee) → supprime les FK cassees. Sinon INSERT echoue avec FK ON.
    // 2) Cree une VIEW `users` unifiant teachers + students pour que les JOINs
    //    existants dans cahiers.js / bookings.js continuent a fonctionner.
    (db) => {
      // ─── 1) Table cahiers : drop FK vers users ────────────────────────────
      db.exec(`
        CREATE TABLE cahiers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          promo_id INTEGER NOT NULL REFERENCES promotions(id),
          group_id INTEGER REFERENCES groups(id),
          project TEXT,
          title TEXT NOT NULL DEFAULT 'Sans titre',
          yjs_state BLOB,
          created_by INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO cahiers_new (id, promo_id, group_id, project, title, yjs_state, created_by, created_at, updated_at)
          SELECT id, promo_id, group_id, project, title, yjs_state, created_by, created_at, updated_at FROM cahiers;
        DROP TABLE cahiers;
        ALTER TABLE cahiers_new RENAME TO cahiers;
        CREATE INDEX IF NOT EXISTS idx_cahiers_promo ON cahiers(promo_id);
        CREATE INDEX IF NOT EXISTS idx_cahiers_group ON cahiers(group_id);
        CREATE INDEX IF NOT EXISTS idx_cahiers_project ON cahiers(promo_id, project);
      `);

      // ─── 1bis) Bookings : 3 tables avec REFERENCES users(id) a nettoyer.
      // Les colonnes buffer_minutes (v63) + timezone (v64) ont ete ajoutees plus tard
      // donc on les inclut dans la nouvelle table.
      db.exec(`
        CREATE TABLE booking_event_types_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          duration_minutes INTEGER NOT NULL DEFAULT 30,
          color TEXT DEFAULT '#3b82f6',
          fallback_visio_url TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          buffer_minutes INTEGER NOT NULL DEFAULT 0,
          timezone TEXT NOT NULL DEFAULT 'Europe/Paris'
        );
        INSERT INTO booking_event_types_new
            (id, teacher_id, title, slug, description, duration_minutes, color,
             fallback_visio_url, is_active, created_at, buffer_minutes, timezone)
          SELECT id, teacher_id, title, slug, description, duration_minutes, color,
                 fallback_visio_url, is_active, created_at, buffer_minutes, timezone
          FROM booking_event_types;
        DROP TABLE booking_event_types;
        ALTER TABLE booking_event_types_new RENAME TO booking_event_types;

        CREATE TABLE booking_availability_rules_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          is_active INTEGER DEFAULT 1
        );
        INSERT INTO booking_availability_rules_new
            (id, teacher_id, day_of_week, start_time, end_time, is_active)
          SELECT id, teacher_id, day_of_week, start_time, end_time, is_active
          FROM booking_availability_rules;
        DROP TABLE booking_availability_rules;
        ALTER TABLE booking_availability_rules_new RENAME TO booking_availability_rules;
        CREATE INDEX IF NOT EXISTS idx_booking_avail_teacher ON booking_availability_rules(teacher_id);

        CREATE TABLE microsoft_tokens_new (
          teacher_id INTEGER PRIMARY KEY,
          access_token_enc TEXT NOT NULL,
          refresh_token_enc TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO microsoft_tokens_new
            (teacher_id, access_token_enc, refresh_token_enc, expires_at, updated_at)
          SELECT teacher_id, access_token_enc, refresh_token_enc, expires_at, updated_at
          FROM microsoft_tokens;
        DROP TABLE microsoft_tokens;
        ALTER TABLE microsoft_tokens_new RENAME TO microsoft_tokens;
      `);

      // ─── 2) VIEW users unifiee pour les JOINs ──────────────────────────────
      const existing = db.prepare("SELECT type FROM sqlite_master WHERE name = 'users'").get();
      if (existing) {
        if (existing.type === 'table') db.exec('DROP TABLE users');
        else if (existing.type === 'view') db.exec('DROP VIEW users');
      }
      db.exec(`
        CREATE VIEW users AS
          SELECT id, name, email, 'teacher' AS role FROM teachers
          UNION ALL
          SELECT id, name, email, 'student' AS role FROM students;
      `);
    },

    // v71 : OAuth state (Booking Microsoft Graph) en DB au lieu d'en memoire
    // Resout la perte d'etat sur multi-instance / redemarrage.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS oauth_states (
          nonce TEXT PRIMARY KEY,
          teacher_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
      `);
    },

    // v72 : Calendar feed tokens — abonnement iCal public par utilisateur
    // Token opaque aleatoire (pas de HMAC stateless) : revocation = DELETE,
    // rotation = upsert avec nouvelle valeur. PK (user_type, user_id) garantit
    // un seul token actif par user. Le token lui-meme est UNIQUE pour lookup.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
          user_type  TEXT NOT NULL CHECK(user_type IN ('student','teacher')),
          user_id    INTEGER NOT NULL,
          token      TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_type, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_calendar_feed_token ON calendar_feed_tokens(token);
      `);
    },

    // v73 : TypeRace — mini-jeu typing speed FR avec leaderboard par promo.
    // Chaque partie (re-jouable illimitee) est enregistree ; le leaderboard
    // aggrege le meilleur score par user sur une fenetre (jour/semaine/all).
    // promo_id nullable : les teachers jouent mais sont filtres de la vue
    // etudiante. Anti-triche : coherence wpm/durationMs verifiee au POST.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS typerace_scores (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_type   TEXT NOT NULL CHECK(user_type IN ('student','teacher')),
          user_id     INTEGER NOT NULL,
          promo_id    INTEGER,
          phrase_id   INTEGER NOT NULL,
          wpm         REAL NOT NULL,
          accuracy    REAL NOT NULL,
          score       INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_typerace_user_day ON typerace_scores(user_type, user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_typerace_promo_day ON typerace_scores(promo_id, created_at);
      `);
    },

    // v74 : Arcade games scores — table generique pour Snake, Space Invaders,
    // Pacman, et tous les mini-jeux arcade a venir. Schema unifie (score
    // INTEGER + duration_ms + meta JSON optionnel) evite 1 table par jeu.
    // TypeRace reste sur son schema riche (wpm/accuracy) historique.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS game_scores (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id     TEXT NOT NULL,
          user_type   TEXT NOT NULL CHECK(user_type IN ('student','teacher')),
          user_id     INTEGER NOT NULL,
          promo_id    INTEGER,
          score       INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          meta        TEXT,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_game_scores_game_day ON game_scores(game_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(game_id, user_type, user_id, created_at);
      `);
    },

    // v75 : Index sur travaux(channel_id) — getTravaux(channelId) et les
    // requetes du TeacherProjectHome filtrent sur channel_id sans index
    // (full scan sur plusieurs centaines de travaux par promo).
    (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_travaux_channel ON travaux(channel_id);
      `);
    },

    // v76 : backfill requires_submission = 0 pour les types CCTL / soutenance /
    // etude_de_cas. Ce sont des examens/evaluations en salle, pas des devoirs
    // a rendre. Les anciennes instances creees avant le correctif du NewDevoirModal
    // peuvent avoir requires_submission=1 et apparaitre par erreur dans la
    // liste "A rendre" cote etudiant.
    (db) => {
      db.exec(`
        UPDATE travaux
        SET requires_submission = 0
        WHERE type IN ('cctl', 'soutenance', 'etude_de_cas')
          AND requires_submission != 0;
      `);
    },

    // v77 : Devoirs de groupe — modele "un depot = toute l'equipe".
    // Jusqu'ici chaque membre d'un groupe devait redeposer son propre fichier.
    // Desormais un seul depot represente le groupe : n'importe quel membre
    // peut soumettre ou ecraser. La colonne `group_id` sur depots permet
    // l'upsert par (travail_id, group_id) pour les devoirs de groupe.
    //
    // Backfill : pour les depots existants appartenant a un travail de groupe,
    // on set depots.group_id = travaux.group_id. Si plusieurs membres avaient
    // depose pour un meme travail de groupe, on garde uniquement le depot le
    // plus recent (dedup) pour s'aligner sur le nouveau modele.
    (db) => {
      db.exec(`
        ALTER TABLE depots ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;

        UPDATE depots
        SET group_id = (SELECT t.group_id FROM travaux t WHERE t.id = depots.travail_id)
        WHERE EXISTS (
          SELECT 1 FROM travaux t WHERE t.id = depots.travail_id AND t.group_id IS NOT NULL
        );

        -- Dedup : pour chaque (travail_id, group_id), ne garder que le depot
        -- le plus recent. Les autres depots du groupe sont supprimes
        -- (leur contenu etait redondant dans le modele "un pour tous").
        DELETE FROM depots
        WHERE group_id IS NOT NULL
          AND id NOT IN (
            SELECT MAX(id) FROM depots
            WHERE group_id IS NOT NULL
            GROUP BY travail_id, group_id
          );

        CREATE INDEX IF NOT EXISTS idx_depots_group ON depots(travail_id, group_id)
          WHERE group_id IS NOT NULL;
      `);
    },

    // v78 : Sondages structures dans les messages. Le marqueur poll (definition)
    // vit en debut de messages.content, les votes sont stockes separement dans
    // une colonne dediee pour ne pas polluer les reactions emoji ni le chiffrement
    // DM (les votes ne sont pas sensibles mais on prefere les sortir du contenu).
    // Structure du JSON stocke : { totals: [n,n,...], voters: { "<userKey>": [i,...] } }
    // ou userKey est l'id signe (positif etudiant, negatif enseignant).
    (db) => {
      tryAlter(db, 'ALTER TABLE messages ADD COLUMN poll_votes TEXT DEFAULT NULL');
    },

    // v79 : Signets de messages cote serveur. Auparavant stockes en localStorage
    // (non synchronises entre devices). user_id est l'id signe (positif etudiant,
    // negatif enseignant) pour aligner sur la convention messages.author_id.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS bookmarks (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL,
          user_type  TEXT NOT NULL CHECK(user_type IN ('student','teacher','admin','ta')),
          message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          note       TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(user_id, message_id)
        );
        CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at DESC);
      `);
    },

    // v80 : Messages programmes user-scope. Jusqu'ici reserve aux admins via
    // /api/admin/scheduled (pas d'auteur, channel_id NOT NULL, pas de DM, pas
    // de reply, pas de suivi des echecs). On etend pour exposer la feature a
    // tous les users (profs + etudiants) avec :
    //   - author_id (id signe pour ownership)
    //   - dm_student_id / dm_peer_id (DMs programmes)
    //   - reply_to_id / reply_to_author / reply_to_preview (citation)
    //   - attachments_json (pieces jointes programmees)
    //   - failed_at / error (crash-safe : le worker marque l'echec au lieu
    //     de perdre le message dans un log obscur)
    // channel_id devient NULLABLE (DM = channel_id NULL). SQLite force la
    // recreation de la table pour passer NOT NULL -> NULLABLE.
    (db) => {
      db.exec(`
        CREATE TABLE scheduled_messages_v80 (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          channel_id        INTEGER REFERENCES channels(id) ON DELETE CASCADE,
          dm_student_id     INTEGER REFERENCES students(id) ON DELETE CASCADE,
          dm_peer_id        INTEGER,
          author_id         INTEGER,
          author_name       TEXT NOT NULL,
          author_type       TEXT NOT NULL DEFAULT 'teacher',
          content           TEXT NOT NULL,
          reply_to_id       INTEGER,
          reply_to_author   TEXT,
          reply_to_preview  TEXT,
          attachments_json  TEXT,
          send_at           TEXT NOT NULL,
          sent              INTEGER NOT NULL DEFAULT 0,
          failed_at         TEXT,
          error             TEXT,
          created_at        TEXT NOT NULL DEFAULT (datetime('now')),
          CHECK(
            (channel_id IS NULL AND dm_student_id IS NOT NULL) OR
            (channel_id IS NOT NULL AND dm_student_id IS NULL)
          )
        );
        INSERT INTO scheduled_messages_v80
          (id, channel_id, author_name, author_type, content, send_at, sent, created_at)
          SELECT id, channel_id, author_name, author_type, content, send_at, sent, created_at
            FROM scheduled_messages;
        DROP TABLE scheduled_messages;
        ALTER TABLE scheduled_messages_v80 RENAME TO scheduled_messages;
        CREATE INDEX IF NOT EXISTS idx_scheduled_send   ON scheduled_messages(send_at, sent);
        CREATE INDEX IF NOT EXISTS idx_scheduled_author ON scheduled_messages(author_id, sent);
      `);
    },

    // v81 : Statuts personnalises utilisateurs. Table 1:1 user_id -> status
    // (emoji + texte court + expiration optionnelle). Diffusee via socket
    // dans presence:update et status:change. user_id est l'id signe
    // (positif etudiant, negatif enseignant) — pas de FK pour rester
    // compatible avec les deux tables students/teachers.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_statuses (
          user_id    INTEGER PRIMARY KEY,
          user_type  TEXT NOT NULL CHECK(user_type IN ('student','teacher','admin','ta')),
          emoji      TEXT,
          text       TEXT,
          expires_at TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_user_statuses_expires ON user_statuses(expires_at) WHERE expires_at IS NOT NULL;
      `);
    },

    // v82 : Cache des previews de liens (OpenGraph). url_hash = sha256 de
    // l'URL normalisee, partage entre tous les messages qui referencent la
    // meme URL. TTL par defaut 24h (expires_at). `status` stocke le HTTP
    // status ou 0 si erreur de fetch — evite de re-fetcher en boucle les
    // liens morts.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS link_previews (
          url_hash    TEXT PRIMARY KEY,
          url         TEXT NOT NULL,
          title       TEXT,
          description TEXT,
          image       TEXT,
          site_name   TEXT,
          status      INTEGER,
          fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_link_previews_expires ON link_previews(expires_at);
      `);
    },

    // v83 : Booking — lien public ouvert (style Calendly classique).
    // Quand is_public = 1, l'event-type est accessible via /book/e/:slug
    // sans token nominatif. Les reservations publiques utilisent
    // student_id = 0 comme sentinelle (pas de FK explicite sur students).
    (db) => {
      tryAlter(db, "ALTER TABLE booking_event_types ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
    },

    // v84 : Booking — Jitsi Meet en alternative libre a Teams.
    // Quand use_jitsi = 1, le backend genere un lien Jitsi Meet unique
    // (slug aleatoire 16 chars hex) pour chaque reservation, en priorite
    // sur la creation Teams via Microsoft Graph. Permet aux profs sans
    // tenant Microsoft d'avoir une visio integree out-of-the-box.
    (db) => {
      tryAlter(db, "ALTER TABLE booking_event_types ADD COLUMN use_jitsi INTEGER NOT NULL DEFAULT 0");
    },

    // v85 : Booking — campagnes de RDV (visites tripartites).
    // Une campagne = periode bornee + regle hebdo de creneaux + promo cible.
    // A la creation, on genere une `booking_campaign_invites` par etudiant
    // (avec un token unique) et on envoie un mail. Chaque etudiant prend
    // 1 RDV max via `/book/c/:token`. Tripartite = etudiant + tuteur entreprise
    // saisi a la reservation + prof (notify_email). Tous recoivent un .ics.
    (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS booking_campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          event_type_id INTEGER REFERENCES booking_event_types(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT,
          duration_minutes INTEGER NOT NULL DEFAULT 30,
          buffer_minutes INTEGER NOT NULL DEFAULT 0,
          color TEXT NOT NULL DEFAULT '#6366f1',
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          hebdo_rules TEXT NOT NULL DEFAULT '[]',
          excluded_dates TEXT NOT NULL DEFAULT '[]',
          promo_id INTEGER,
          with_tutor INTEGER NOT NULL DEFAULT 1,
          notify_email TEXT,
          use_jitsi INTEGER NOT NULL DEFAULT 1,
          fallback_visio_url TEXT,
          timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
          launched_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_booking_campaigns_teacher ON booking_campaigns(teacher_id, status);

        CREATE TABLE IF NOT EXISTS booking_campaign_invites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL REFERENCES booking_campaigns(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          invited_at TEXT,
          last_reminded_at TEXT,
          booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(campaign_id, student_id)
        );
        CREATE INDEX IF NOT EXISTS idx_booking_campaign_invites_token ON booking_campaign_invites(token);
        CREATE INDEX IF NOT EXISTS idx_booking_campaign_invites_campaign ON booking_campaign_invites(campaign_id);
      `);
      // Lien optionnel d'une reservation vers une campagne (NULL pour les RDV
      // hors campagne, qui restent valides comme avant).
      tryAlter(db, "ALTER TABLE bookings ADD COLUMN campaign_id INTEGER REFERENCES booking_campaigns(id) ON DELETE SET NULL");
    },

    // v86 : FTS5 sur les messages de canaux (recherche plein-texte rapide).
    //
    // Avant : `searchMessages` faisait `WHERE content LIKE '%q%'` -> O(n)
    // sur toute la table. Inutilisable au-dela de ~100k messages.
    // Apres : index inverse FTS5 + ranking BM25, requetes en O(log n).
    //
    // Tokenize unicode61 + remove_diacritics 2 : matche les accents francais
    // (regle == regle, ecole == ecole). Cf. lumen_chapter_fts (v59) qui
    // utilise le meme tokenizer.
    //
    // IMPORTANT : on indexe UNIQUEMENT les messages de CANAUX (dm_student_id
    // IS NULL). Les DMs sont chiffres en DB ; les indexer en clair dans FTS
    // casserait la confidentialite. La recherche DM reste sur le path
    // dechiffrement-en-memoire-puis-filtre (cf. searchDmMessages).
    //
    // Backfill initial : un INSERT massif des messages existants. Pour les
    // grosses bases (millions de rows), peut prendre quelques secondes au
    // 1er boot post-migration mais c'est one-shot.
    (db) => {
      db.exec(`
        -- Table virtuelle FTS5 standalone : pas de "external content" car
        -- ca complique les triggers (la cmd 'delete' magique exige que le
        -- contenu soit toujours sync avec messages, et casse l'index si
        -- on essaie de supprimer un row deja absent). Stockage duplique
        -- mais robustesse maximale.
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          content,
          tokenize='unicode61 remove_diacritics 2'
        );

        -- Backfill : on indexe tous les messages existants non-DM, non-deleted.
        INSERT INTO messages_fts(rowid, content)
        SELECT id, content FROM messages
        WHERE dm_student_id IS NULL AND deleted_at IS NULL;

        -- Triggers de synchronisation. Avec un FTS5 standalone, on peut
        -- DELETE/INSERT directement sans cmd magique. Les WHEN filtrent
        -- pour ne traiter que les messages de canal non-deleted.

        -- INSERT : ajouter au FTS si nouveau message de canal valide
        CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages
        WHEN new.dm_student_id IS NULL AND new.deleted_at IS NULL
        BEGIN
          INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
        END;

        -- DELETE : retirer du FTS si etait indexe (etait un msg canal non-deleted)
        CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages
        WHEN old.dm_student_id IS NULL AND old.deleted_at IS NULL
        BEGIN
          DELETE FROM messages_fts WHERE rowid = old.id;
        END;

        -- UPDATE : trigger unique qui DELETE puis INSERT conditionnellement.
        -- Plus simple que 2 triggers separes (et plus sur — pas de fenetre
        -- entre-deux qui pourrait creer une contrainte). DELETE est idempotent
        -- (no-op si rowid absent) ; INSERT n'a lieu que si la nouvelle ligne
        -- est indexable (canal non-deleted). Couvre les 4 cas :
        --   was_indexed=Y new_indexable=Y : edit content -> DEL + INS
        --   was_indexed=Y new_indexable=N : soft-delete  -> DEL seul
        --   was_indexed=N new_indexable=Y : undelete    -> INS seul
        --   was_indexed=N new_indexable=N : rien (DEL no-op + INSERT skipped)
        CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE ON messages
        BEGIN
          DELETE FROM messages_fts WHERE rowid = old.id;
          INSERT INTO messages_fts(rowid, content)
          SELECT new.id, new.content
          WHERE new.dm_student_id IS NULL AND new.deleted_at IS NULL;
        END;
      `);
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
