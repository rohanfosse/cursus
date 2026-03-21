// @deprecated — Ce fichier est l'ancien point d'entrée Electron (v1).
// L'application utilise désormais src/main/index.ts compilé vers out/main/index.js.
// Ce fichier est conservé uniquement pour référence et sera supprimé dans une version future.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const db   = require('./src/db/index');
const ipc  = require('./src/ipc');

function createWindow() {
  const win = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth:  960,
    minHeight: 640,
    title: 'CESI Cours',
    backgroundColor: '#111214',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color:       '#111214',
      symbolColor: '#9aa0a6',
      height:      32,
    },
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  db.init();
  ipc.register();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
