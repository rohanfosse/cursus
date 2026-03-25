const { getDb } = require('../connection');

function createSignatureRequest(messageId, dmStudentId, fileUrl, fileName) {
  return getDb().prepare(`
    INSERT INTO signature_requests (message_id, dm_student_id, file_url, file_name)
    VALUES (?, ?, ?, ?)
  `).run(messageId, dmStudentId, fileUrl, fileName);
}

function getSignatureRequests({ status, studentId } = {}) {
  let sql = `
    SELECT sr.*, s.name AS student_name
    FROM signature_requests sr
    LEFT JOIN students s ON s.id = sr.dm_student_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND sr.status = ?'; params.push(status); }
  if (studentId) { sql += ' AND sr.dm_student_id = ?'; params.push(studentId); }
  sql += ' ORDER BY sr.created_at DESC, sr.id DESC LIMIT 100';
  return getDb().prepare(sql).all(...params);
}

function getSignatureById(id) {
  return getDb().prepare(`
    SELECT sr.*, s.name AS student_name
    FROM signature_requests sr
    LEFT JOIN students s ON s.id = sr.dm_student_id
    WHERE sr.id = ?
  `).get(id);
}

function getSignatureByMessageId(messageId) {
  return getDb().prepare('SELECT * FROM signature_requests WHERE message_id = ?').get(messageId);
}

function getPendingCount() {
  return getDb().prepare("SELECT COUNT(*) AS count FROM signature_requests WHERE status = 'pending'").get().count;
}

function signDocument(id, signerName, signedFileUrl) {
  return getDb().prepare(`
    UPDATE signature_requests
    SET status = 'signed', signer_name = ?, signed_file_url = ?, signed_at = datetime('now')
    WHERE id = ?
  `).run(signerName, signedFileUrl, id);
}

function rejectDocument(id, reason) {
  return getDb().prepare(`
    UPDATE signature_requests
    SET status = 'rejected', rejection_reason = ?
    WHERE id = ?
  `).run(reason, id);
}

module.exports = {
  createSignatureRequest,
  getSignatureRequests,
  getSignatureById,
  getSignatureByMessageId,
  getPendingCount,
  signDocument,
  rejectDocument,
};
