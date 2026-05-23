import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';

let server;
let mainWindow;

async function startLocalServer() {
  process.env.STREAMVAULT_DOWNLOADS_DIR = path.join(app.getPath('downloads'), 'StreamVault');

  const { createApp } = await import('../app.js');
  const expressApp = createApp();

  return await new Promise((resolve, reject) => {
    const listener = expressApp.listen(0, '127.0.0.1');

    listener.once('error', reject);
    listener.once('listening', () => {
      server = listener;
      const { port } = listener.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function createWindow() {
  const appUrl = await startLocalServer();

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 840,
    minHeight: 620,
    title: 'StreamVault',
    backgroundColor: '#101214',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(appUrl);
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  server?.close();
});
