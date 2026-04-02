const { getDb } = require('../connection');
const { ConflictError } = require('../../utils/errors');

function createSignatureRequest(messageId, dmStudentId, fileUrl, fileName, fileHash, createdBy, createdIp) {
  return getDb().prepare(`
    INSERT INTO signature_requests (message_id, dm_student_id, file_url, file_name, file_hash, created_by, created_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(messageId, dmStudentId, fileUrl, fileName, fileHash || null, createdBy || null, createdIp || null);
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

function signDocument(id, signerName, signedFileUrl, signerId, signerIp) {
  const result = getDb().prepare(`
    UPDATE signature_requests
    SET status = 'signed', signer_name = ?, signed_file_url = ?, signed_at = datetime('now'),
        signer_id = ?, signer_ip = ?
    WHERE id = ? AND status = 'pending'
  `).run(signerName, signedFileUrl, signerId || null, signerIp || null, id);
  if (result.changes === 0) throw new ConflictError('Document introuvable ou déjà traité.');
  return result;
}

function rejectDocument(id, reason, signerId, signerIp) {
  const result = getDb().prepare(`
    UPDATE signature_requests
    SET status = 'rejected', rejection_reason = ?, signer_id = ?, signer_ip = ?
    WHERE id = ? AND status = 'pending'
  `).run(reason, signerId || null, signerIp || null, id);
  if (result.changes === 0) throw new ConflictError('Document introuvable ou déjà traité.');
  return result;
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
