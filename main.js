const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./db');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'CESI Classroom',
    backgroundColor: '#1a1d23',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

// ─── Wrapper de gestion d'erreurs ──────────────────────────────────────────
// Chaque handler renvoie { ok, data } ou { ok: false, error }
// pour que le renderer puisse afficher un message explicite.

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = fn(...args);
      return { ok: true, data };
    } catch (err) {
      console.error(`[IPC ${channel}]`, err.message);
      return { ok: false, error: err.message };
    }
  });
}

// ─── Handlers IPC ──────────────────────────────────────────────────────────

handle('db:getPromotions',      ()           => db.getPromotions());
handle('db:getChannels',        (promoId)    => db.getChannels(promoId));
handle('db:getStudents',        (promoId)    => db.getStudents(promoId));
handle('db:getAllStudents',     ()           => db.getAllStudents());

handle('db:getChannelMessages', (channelId)  => db.getChannelMessages(channelId));
handle('db:getDmMessages',      (studentId)  => db.getDmMessages(studentId));
handle('db:sendMessage',        (payload)    => db.sendMessage(payload));

handle('db:getTravaux',         (channelId)  => db.getTravaux(channelId));
handle('db:createTravail',      (payload)    => db.createTravail(payload));

handle('db:getDepots',          (travailId)  => db.getDepots(travailId));
handle('db:addDepot',           (payload)    => db.addDepot(payload));
handle('db:setNote',            (payload)    => db.setNote(payload));

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
    if (result.canceled || result.filePaths.length === 0) return { ok: true, data: null };
    return { ok: true, data: result.filePaths[0] };
  } catch (err) {
    console.error('[IPC dialog:openFile]', err.message);
    return { ok: false, error: err.message };
  }
});

// ─── Cycle de vie ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
