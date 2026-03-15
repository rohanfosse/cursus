console.log('[DEBUG] process.type:', process.type);
console.log('[DEBUG] process.versions.electron:', process.versions.electron);
console.log('[DEBUG] Module cache for electron:', require.cache['electron'] ? 'cached' : 'not cached');

// In Electron, the built-in 'electron' module should be accessible.
// If node_modules/electron/index.js is being loaded instead, we bypass it.
const Module = require('module');
const _resolveFilename = Module._resolveFilename.bind(Module);
console.log('[DEBUG] Module._resolveFilename for electron:', _resolveFilename('electron', module));

const electron = require('electron');
console.log('[DEBUG] typeof electron:', typeof electron);
console.log('[DEBUG] electron value (first 100):', String(electron).slice(0, 100));
const { app, BrowserWindow } = electron;
const path    = require('path');
const queries = require('./src/db/queries');
const ipc     = require('./src/ipc');

function createWindow() {
  const win = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth:  960,
    minHeight: 640,
    title: 'CESI Classroom',
    backgroundColor: '#111214',
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
  queries.initSchema();
  queries.seedIfEmpty();
  ipc.register();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
