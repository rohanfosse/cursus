const { ipcMain, dialog, shell } = require('electron');
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
  handle('db:getTravailById',    (travailId)  => queries.getTravailById(travailId));
  handle('db:createTravail',     (payload)    => queries.createTravail(payload));
  handle('db:getTravauxSuivi',   (travailId)  => queries.getTravauxSuivi(travailId));

  // Depots
  handle('db:getDepots',         (travailId)  => queries.getDepots(travailId));
  handle('db:addDepot',          (payload)    => queries.addDepot(payload));
  handle('db:setNote',           (payload)    => queries.setNote(payload));
  handle('db:setFeedback',       (payload)    => queries.setFeedback(payload));

  // Groupes
  handle('db:getGroups',         (promoId)    => queries.getGroups(promoId));
  handle('db:createGroup',       (payload)    => queries.createGroup(payload));
  handle('db:deleteGroup',       (groupId)    => queries.deleteGroup(groupId));
  handle('db:getGroupMembers',   (groupId)    => queries.getGroupMembers(groupId));
  handle('db:setGroupMembers',   (payload)    => queries.setGroupMembers(payload));

  // Profil etudiant
  handle('db:getStudentProfile',  (studentId) => queries.getStudentProfile(studentId));
  handle('db:getStudentTravaux',  (studentId) => queries.getStudentTravaux(studentId));

  // Ressources
  handle('db:getRessources',     (travailId)  => queries.getRessources(travailId));
  handle('db:addRessource',      (payload)    => queries.addRessource(payload));
  handle('db:deleteRessource',   (id)         => queries.deleteRessource(id));

  // Groupes par projet
  handle('db:getTravailGroupMembers', (travailId) => queries.getTravailGroupMembers(travailId));
  handle('db:setTravailGroupMember',  (payload)   => queries.setTravailGroupMember(payload));

  // Brouillon / publication
  handle('db:updateTravailPublished', (payload)   => queries.updateTravailPublished(payload));

  // Echéancier prof
  handle('db:getTeacherSchedule',     ()          => queries.getTeacherSchedule());

  // Promotions
  handle('db:createPromotion',   (payload)    => queries.createPromotion(payload));
  handle('db:deletePromotion',   (promoId)    => queries.deletePromotion(promoId));

  // Inscription etudiant
  handle('db:getStudentByEmail', (email)      => queries.getStudentByEmail(email));
  handle('db:registerStudent',   (payload)    => queries.registerStudent(payload));

  // Identite / login
  handle('db:getIdentities',     ()           => queries.getIdentities());

  // Ouverture de fichier / lien externe (pour les ressources)
  ipcMain.handle('shell:openPath', async (_event, filePath) => {
    try {
      const err = await shell.openPath(filePath);
      return err ? { ok: false, error: err } : { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    try {
      if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'URL invalide.' };
      await shell.openExternal(url);
      return { ok: true, data: null };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Dialogue image — photo de profil (retourne base64 data URL)
  ipcMain.handle('dialog:openImage', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      });
      if (result.canceled || !result.filePaths.length) return { ok: true, data: null };
      const buffer  = fs.readFileSync(result.filePaths[0]);
      const ext     = path.extname(result.filePaths[0]).slice(1).toLowerCase();
      const mime    = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      return { ok: true, data: `data:${mime};base64,${buffer.toString('base64')}` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

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
