const { getDb } = require('../connection');

function getGroups(promoId) {
  return getDb().prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS members_count
    FROM groups g
    WHERE g.promo_id = ?
    ORDER BY g.name
  `).all(promoId);
}

function createGroup({ promoId, name }) {
  return getDb().prepare(
    'INSERT INTO groups (promo_id, name) VALUES (?, ?)'
  ).run(promoId, name);
}

function deleteGroup(groupId) {
  return getDb().prepare('DELETE FROM groups WHERE id = ?').run(groupId);
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
  })();
}

module.exports = { getGroups, createGroup, deleteGroup, getGroupMembers, setGroupMembers };
