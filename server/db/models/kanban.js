/** Kanban de projet — cartes de suivi par travail/groupe. */
const { getDb } = require('../connection');

function getKanbanCards(travailId, groupId) {
  return getDb().prepare(
    'SELECT * FROM kanban_cards WHERE travail_id = ? AND group_id = ? ORDER BY status, position ASC'
  ).all(travailId, groupId);
}

function createKanbanCard({ travailId, groupId, title, description = '', createdBy = '' }) {
  const db = getDb();
  return db.transaction(() => {
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as m FROM kanban_cards WHERE travail_id = ? AND group_id = ? AND status = \'todo\''
    ).get(travailId, groupId)?.m ?? -1;
    const res = db.prepare(
      'INSERT INTO kanban_cards (travail_id, group_id, title, description, created_by, position) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(travailId, groupId, title, description, createdBy, maxPos + 1);
    return db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(res.lastInsertRowid);
  })();
}

function updateKanbanCard(id, { title, description, position }) {
  const db = getDb();
  const allowed = [];
  const vals = [];
  if (title       !== undefined) { allowed.push('title = ?');       vals.push(title); }
  if (description !== undefined) { allowed.push('description = ?'); vals.push(description); }
  if (position    !== undefined) { allowed.push('position = ?');    vals.push(position); }
  if (allowed.length === 0) return db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(id);
  vals.push(id);
  db.prepare(`UPDATE kanban_cards SET ${allowed.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(id);
}

function moveKanbanCard(id, status, position) {
  const db = getDb();
  db.prepare('UPDATE kanban_cards SET status = ?, position = ? WHERE id = ?').run(status, position, id);
  return db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(id);
}

function deleteKanbanCard(id) {
  return getDb().prepare('DELETE FROM kanban_cards WHERE id = ?').run(id);
}

module.exports = {
  getKanbanCards,
  createKanbanCard,
  updateKanbanCard,
  moveKanbanCard,
  deleteKanbanCard,
};
