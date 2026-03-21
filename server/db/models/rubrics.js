const { getDb } = require('../connection');

// ─── Rubric (grille d'évaluation) ─────────────────────────────────────────────

/** Récupère la grille + ses critères pour un travail donné. Renvoie null si inexistante. */
function getRubric(travailId) {
  const db     = getDb();
  const rubric = db.prepare('SELECT * FROM rubrics WHERE travail_id = ?').get(travailId);
  if (!rubric) return null;
  const criteria = db.prepare(
    'SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY position ASC'
  ).all(rubric.id);
  return { ...rubric, criteria };
}

/** Crée ou met à jour la grille et ses critères (remplace complètement les critères). */
function upsertRubric({ travailId, title, criteria }) {
  const db = getDb();
  return db.transaction(() => {
    let rubric = db.prepare('SELECT id FROM rubrics WHERE travail_id = ?').get(travailId);
    if (!rubric) {
      const res = db.prepare(
        "INSERT INTO rubrics (travail_id, title) VALUES (?, ?)"
      ).run(travailId, title ?? "Grille d'évaluation");
      rubric = { id: res.lastInsertRowid };
    } else {
      db.prepare('UPDATE rubrics SET title = ? WHERE id = ?')
        .run(title ?? "Grille d'évaluation", rubric.id);
    }
    // Remplacement complet des critères
    db.prepare('DELETE FROM rubric_criteria WHERE rubric_id = ?').run(rubric.id);
    const ins = db.prepare(
      'INSERT INTO rubric_criteria (rubric_id, label, max_pts, weight, position) VALUES (?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < (criteria ?? []).length; i++) {
      const c = criteria[i];
      ins.run(rubric.id, c.label, c.max_pts ?? 4, c.weight ?? 1.0, i);
    }
    return rubric.id;
  })();
}

function deleteRubric(travailId) {
  return getDb().prepare('DELETE FROM rubrics WHERE travail_id = ?').run(travailId);
}

// ─── Scores par dépôt ─────────────────────────────────────────────────────────

/** Récupère les scores d'un dépôt enrichis des métadonnées du critère. */
function getDepotScores(depotId) {
  return getDb().prepare(`
    SELECT rs.*, rc.label, rc.max_pts, rc.weight, rc.position
    FROM rubric_scores rs
    JOIN rubric_criteria rc ON rs.criterion_id = rc.id
    WHERE rs.depot_id = ?
    ORDER BY rc.position ASC
  `).all(depotId);
}

/** Upsert des scores pour un dépôt. scores = [{ criterion_id, points }] */
function setDepotScores({ depotId, scores }) {
  const db = getDb();
  db.transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO rubric_scores (depot_id, criterion_id, points) VALUES (?, ?, ?)
      ON CONFLICT(depot_id, criterion_id) DO UPDATE SET points = excluded.points
    `);
    for (const s of scores ?? []) {
      upsert.run(depotId, s.criterion_id, s.points ?? 0);
    }
  })();
}

module.exports = { getRubric, upsertRubric, deleteRubric, getDepotScores, setDepotScores };
