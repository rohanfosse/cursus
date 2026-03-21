const { getDb } = require('../connection');

function getGroups(promoId) {
  return getDb().prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS members_count,
      ch.id AS channel_id
    FROM groups g
    LEFT JOIN channels ch ON ch.group_id = g.id
    WHERE g.promo_id = ?
    ORDER BY g.name
  `).all(promoId);
}

function createGroup({ promoId, name }) {
  const db = getDb();
  return db.transaction(() => {
    // Créer le groupe
    const groupResult = db.prepare(
      'INSERT INTO groups (promo_id, name) VALUES (?, ?)'
    ).run(promoId, name);
    const groupId = groupResult.lastInsertRowid;

    // Créer le canal privé associé
    db.prepare(
      'INSERT INTO channels (promo_id, name, description, type, is_private, group_id) VALUES (?, ?, ?, ?, 1, ?)'
    ).run(promoId, `🔒 ${name}`, `Canal privé — groupe ${name}`, 'chat', groupId);

    return groupResult;
  })();
}

function deleteGroup(groupId) {
  const db = getDb();
  return db.transaction(() => {
    db.prepare('DELETE FROM channels WHERE group_id = ?').run(groupId);
    return db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
  })();
}

function getGroupMembers(groupId) {
  return getDb().prepare(`
    SELECT s.id, s.name, s.avatar_initials
    FROM group_members gm JOIN students s ON gm.student_id = s.id
    WHERE gm.group_id = ?
    ORDER BY s.name
  `).all(groupId);
}

function setGroupMembers({ groupId, studentIds }) {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    const ins = db.prepare('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)');
    for (const sid of studentIds) ins.run(groupId, sid);
    // Synchronise les membres du canal privé associé
    const membersJson = studentIds.length ? JSON.stringify(studentIds) : null;
    db.prepare('UPDATE channels SET members = ? WHERE group_id = ?').run(membersJson, groupId);
  })();
}

module.exports = { getGroups, createGroup, deleteGroup, getGroupMembers, setGroupMembers };
