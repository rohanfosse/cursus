const { ipcMain, dialog } = require('electron');
const fs      = require('fs');
const path    = require('path');
const queries = require('./db/queries');

// Wrapper uniforme : toutes les reponses ont la forme { ok, data } ou { ok: false, error }
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: fn(...args) };
    } catch (err) {
      console.error(`[IPC ${channel}]`, err.message);
      return { ok: false, error: err.message };
    }
  });
}

function register() {
  // Promotions & structure
  handle('db:getPromotions',     ()           => queries.getPromotions());
  handle('db:getChannels',       (promoId)    => queries.getChannels(promoId));
  handle('db:getStudents',       (promoId)    => queries.getStudents(promoId));
  handle('db:getAllStudents',    ()           => queries.getAllStudents());

  // Messages
  handle('db:getChannelMessages',(channelId)  => queries.getChannelMessages(channelId));
  handle('db:getDmMessages',     (studentId)  => queries.getDmMessages(studentId));
  handle('db:searchMessages',    (channelId, query) => queries.searchMessages(channelId, query));
  handle('db:sendMessage',       (payload)    => queries.sendMessage(payload));

  // Travaux
  handle('db:getTravaux',        (channelId)  => queries.getTravaux(channelId));
  handle('db:createTravail',     (payload)    => queries.createTravail(payload));
  handle('db:getTravauxSuivi',   (travailId)  => queries.getTravauxSuivi(travailId));

  // Depots
  handle('db:getDepots',         (travailId)  => queries.getDepots(travailId));
  handle('db:addDepot',          (payload)    => queries.addDepot(payload));
  handle('db:setNote',           (payload)    => queries.setNote(payload));
  handle('db:setFeedback',       (payload)    => queries.setFeedback(payload));

  // Profil etudiant
  handle('db:getStudentProfile', (studentId)  => queries.getStudentProfile(studentId));

  // Dialogue fichier — ouverture
  ipcMain.handle('dialog:openFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Tous les fichiers', extensions: ['*'] },
          { name: 'PDF',               extensions: ['pdf'] },
          { name: 'Documents',         extensions: ['doc', 'docx', 'odt'] },
          { name: 'Archives',          extensions: ['zip', 'tar', 'gz'] },
          { name: 'Code source',       extensions: ['py', 'js', 'ts', 'java', 'c', 'cpp', 'pkt'] },
        ],
      });
      if (result.canceled || !result.filePaths.length) return { ok: true, data: null };
      return { ok: true, data: result.filePaths[0] };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Export CSV des notes d'un travail
  ipcMain.handle('export:csv', async (_event, travailId) => {
    try {
      const travail = queries.getTravailById(travailId);
      const rows    = queries.getTravauxSuivi(travailId);

      const safeName = (travail?.title ?? 'export')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .slice(0, 60);

      const { canceled, filePath } = await dialog.showSaveDialog({
        title:       'Exporter les notes',
        defaultPath: `notes_${safeName}.csv`,
        filters:     [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (canceled || !filePath) return { ok: true, data: null };

      const headers = ['Etudiant', 'Fichier depose', 'Date de depot', 'Note /20', 'Commentaire'];

      const lines = rows.map(r => [
        r.student_name,
        r.file_name     ?? '',
        r.submitted_at  ?? '',
        r.note != null  ? String(r.note) : '',
        r.feedback      ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

      // BOM UTF-8 pour Excel
      const csv = '\uFEFF' + [headers.join(';'), ...lines].join('\r\n');
      fs.writeFileSync(filePath, csv, 'utf8');

      return { ok: true, data: path.basename(filePath) };
    } catch (err) {
      console.error('[IPC export:csv]', err.message);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { register };
