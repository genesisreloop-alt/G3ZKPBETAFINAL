import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let mainWindow: BrowserWindow | null = null;
let updateAvailable = false;
let updateInfo: any = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#010401',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../../assets/icon.png'),
    show: false
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5001');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Check for updates after window is ready
  setTimeout(() => {
    checkForUpdates();
  }, 3000);
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
  mainWindow?.webContents.send('update-status', { status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  updateAvailable = true;
  updateInfo = info;
  
  mainWindow?.webContents.send('update-available', {
    version: info.version,
    releaseNotes: info.releaseNotes,
    releaseDate: info.releaseDate,
    size: info.files[0]?.size || 0
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('No updates available');
  mainWindow?.webContents.send('update-status', { status: 'up-to-date', info });
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('download-progress', {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond
  });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded');
  mainWindow?.webContents.send('update-downloaded', {
    version: info.version
  });
});

autoUpdater.on('error', (error) => {
  console.error('Auto-updater error:', error);
  mainWindow?.webContents.send('update-error', {
    message: error.message
  });
});

function checkForUpdates() {
  if (!app.isPackaged) {
    console.log('Updates disabled in development');
    return;
  }
  autoUpdater.checkForUpdates();
}

// IPC handlers
ipcMain.handle('check-for-updates', async () => {
  checkForUpdates();
  return { checking: true };
});

ipcMain.handle('download-update', async () => {
  if (updateAvailable) {
    await autoUpdater.downloadUpdate();
    return { downloading: true };
  }
  return { downloading: false, error: 'No update available' };
});

ipcMain.handle('install-update', async () => {
  if (updateAvailable) {
    autoUpdater.quitAndInstall(false, true);
    return { installing: true };
  }
  return { installing: false, error: 'No update downloaded' };
});

ipcMain.handle('skip-update', async () => {
  updateAvailable = false;
  updateInfo = null;
  return { skipped: true };
});

// Feedback system
ipcMain.handle('submit-feedback', async (event, feedback) => {
  try {
    const feedbackDir = path.join(app.getPath('userData'), 'feedback');
    if (!fs.existsSync(feedbackDir)) {
      fs.mkdirSync(feedbackDir, { recursive: true });
    }

    const feedbackFile = path.join(
      feedbackDir,
      `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`
    );

    const feedbackData = {
      ...feedback,
      timestamp: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch
    };

    fs.writeFileSync(feedbackFile, JSON.stringify(feedbackData, null, 2));

    // In production, send to server
    if (app.isPackaged) {
      // TODO: Send to feedback endpoint
      // await fetch('https://feedback.g3zkp.com/api/submit', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(feedbackData)
      // });
    }

    return { success: true, id: path.basename(feedbackFile) };
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    return { success: false, error: error.message };
  }
});

// System info
ipcMain.handle('get-system-info', async () => {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData')
  };
});

// File operations
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
      { name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { path: result.filePaths[0] };
  }
  return { path: null };
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
  return { opened: true };
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Only allow navigation to localhost in development
    if (!app.isPackaged && parsedUrl.origin !== 'http://localhost:5001') {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
