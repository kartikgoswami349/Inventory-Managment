import { app, BrowserWindow, dialog, ipcMain as electronIpcMain, shell } from 'electron';
import log from 'electron-log/main';
import electronUpdater from 'electron-updater';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createInventoryItem,
  createInventoryAudit,
  createInventoryTransactions,
  createDepartment,
  createPerson,
  deactivateDepartment,
  deactivatePerson,
  getDb,
  getDashboard,
  getDepartments,
  getDevice,
  getInventoryAudits,
  getInventory,
  getNextStockId,
  getPeopleByDepartment,
  getTransactions,
  getTrustedDevice,
  getTrustedDevices,
  removeTrustedDevice,
} from './database';
import { generatePairingCode, getPairingCode, pairWithDevice, startSyncServer, syncWithDevice, syncWithTrustedDevice } from './sync';
import {
  getNearbyDevices,
  refreshNearbyDiscovery,
  startNearbyDiscovery,
} from './nearby';
import { getAutoSyncStatus, requestImmediateSync, startAutoSync, stopAutoSync } from './autoSync';
import {
  createDatabaseBackup,
  exportExcel,
  inspectSqliteFile,
  mergeSqliteFile,
  readManualPacket,
  restoreSqliteFile,
  writeManualPacket,
} from './dataTools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const { autoUpdater } = electronUpdater;
type UpdateStatus = { state: string; message: string; percent?: number; version?: string };
let updateStatus: UpdateStatus = { state: 'idle', message: 'Update check has not run yet.' };
declare const __R58_AUTO_UPDATE__: boolean;

log.initialize();
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024;
log.transports.console.level = false;
console.log = (...args) => log.info(...args);
console.info = (...args) => log.info(...args);
console.warn = (...args) => log.warn(...args);
console.error = (...args) => log.error(...args);
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function publishUpdateStatus(status: UpdateStatus) {
  updateStatus = status;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('updates:status', status);
  }
}

function setupAutoUpdates() {
  autoUpdater.on('checking-for-update', () => publishUpdateStatus({ state: 'checking', message: 'Checking for updates…' }));
  autoUpdater.on('update-available', info => publishUpdateStatus({
    state: 'available',
    message: `Version ${info.version} is available. Downloading in the background…`,
    version: info.version,
  }));
  autoUpdater.on('update-not-available', info => publishUpdateStatus({
    state: 'up-to-date',
    message: `R58 Inventory is up to date${info.version ? ` (v${info.version})` : ''}.`,
    version: info.version,
  }));
  autoUpdater.on('download-progress', progress => publishUpdateStatus({
    state: 'downloading',
    message: `Downloading update: ${Math.round(progress.percent)}%`,
    percent: progress.percent,
  }));
  autoUpdater.on('update-downloaded', info => publishUpdateStatus({
    state: 'downloaded',
    message: `Version ${info.version} is ready to install. Restart the app to apply it.`,
    version: info.version,
  }));
  autoUpdater.on('error', error => {
    log.error('R58 PC AUTO UPDATE ERROR:', error);
    publishUpdateStatus({ state: 'error', message: `Update check failed: ${error.message}` });
  });
  if (app.isPackaged && __R58_AUTO_UPDATE__) {
    const check = () => {
      void autoUpdater.checkForUpdates().catch(error => {
        log.error('R58 PC AUTO UPDATE CHECK ERROR:', error);
        publishUpdateStatus({ state: 'error', message: `Update check failed: ${String(error)}` });
      });
    };
    const firstCheck = setTimeout(check, 12000);
    const periodicCheck = setInterval(check, 6 * 60 * 60 * 1000);
    firstCheck.unref();
    periodicCheck.unref();
  } else if (!app.isPackaged) {
    publishUpdateStatus({ state: 'development', message: 'Automatic updates are available in the installed app.' });
  } else {
    publishUpdateStatus({ state: 'manual', message: 'This MSI installation receives updates through a newer MSI installer.' });
  }
}

async function createWindow() {
  getDb();
  try {
    await startSyncServer();
  } catch (error) {
    log.error('R58 PC TCP SERVER ERROR:', error);
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#F5F7FB',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('R58 PC RENDERER PROCESS EXITED:', details);
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error('R58 PC RENDERER LOAD FAILED:', { errorCode, errorDescription, validatedURL });
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc() {
  electronIpcMain.on('logs:renderer-error', (_event, details: unknown) => {
    log.error('R58 PC RENDERER ERROR:', details);
  });
  const ipcMain = {
    handle(channel: string, listener: Parameters<typeof electronIpcMain.handle>[1]) {
      return electronIpcMain.handle(channel, async (event, ...args) => {
        try {
          return await listener(event, ...args);
        } catch (error) {
          log.error(`R58 PC IPC handler failed (${channel}):`, error);
          throw error;
        }
      });
    },
  };
  ipcMain.handle('device:get', () => getDevice());
  ipcMain.handle('dashboard:get', () => getDashboard());
  ipcMain.handle('inventory:get', (_event, search: string) => getInventory(search || ''));
  ipcMain.handle('inventory:next-stock-id', () => getNextStockId());
  ipcMain.handle('inventory:create', (_event, input) => {
    const result = createInventoryItem(input);
    requestImmediateSync();
    return result;
  });
  ipcMain.handle('departments:get', () => getDepartments());
  ipcMain.handle('departments:create', (_event, name: string) => {
    const result = createDepartment(String(name ?? ''));
    requestImmediateSync();
    return result;
  });
  ipcMain.handle('departments:deactivate', (_event, departmentId: string) => {
    deactivateDepartment(String(departmentId ?? ''));
    requestImmediateSync();
    return { success: true };
  });
  ipcMain.handle('people:create', (_event, departmentId: string, name: string) => {
    const result = createPerson(String(departmentId ?? ''), String(name ?? ''));
    requestImmediateSync();
    return result;
  });
  ipcMain.handle('people:deactivate', (_event, personId: string) => {
    deactivatePerson(String(personId ?? ''));
    requestImmediateSync();
    return { success: true };
  });
  ipcMain.handle('people:get-by-department', (_event, departmentId: string) => {
    if (!String(departmentId).trim()) throw new Error('Department ID is required.');
    return getPeopleByDepartment(String(departmentId));
  });
  ipcMain.handle('transactions:create', (_event, input) => {
    const result = createInventoryTransactions(input);
    requestImmediateSync();
    return result;
  });
  ipcMain.handle('audits:get', (_event, limit: number) => getInventoryAudits(Number(limit) || 300));
  ipcMain.handle('audits:create', (_event, input) => {
    const result = createInventoryAudit(input);
    requestImmediateSync();
    return result;
  });
  ipcMain.handle('data:backup:create', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Back Up R58 Inventory',
      defaultPath: path.join(app.getPath('documents'), `R58_Backup_${date}.db`),
      filters: [{ name: 'SQLite database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    return { canceled: false, ...(await createDatabaseBackup(result.filePath)) };
  });
  ipcMain.handle('data:sqlite:inspect', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select an R58 SQLite database',
      properties: ['openFile'],
      filters: [{ name: 'SQLite database', extensions: ['db', 'sqlite', 'sqlite3'] }, { name: 'All files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const filePath = result.filePaths[0];
    const counts = await inspectSqliteFile(filePath);
    return { canceled: false, filePath, fileName: path.basename(filePath), counts };
  });
  ipcMain.handle('data:sqlite:restore', async (_event, filePath: string) => {
    if (!filePath) throw new Error('Select a SQLite database to restore.');
    const counts = await inspectSqliteFile(filePath);
    const recoveryPath = path.join(
      app.getPath('userData'),
      `R58_PreRestore_${new Date().toISOString().replace(/[:.]/g, '-')}.db`,
    );
    const restored = await restoreSqliteFile(filePath, recoveryPath);
    requestImmediateSync();
    return { ...restored, counts };
  });
  ipcMain.handle('data:sqlite:merge', async (_event, filePath: string) => {
    if (!filePath) throw new Error('Select a SQLite database to import.');
    const result = await mergeSqliteFile(filePath);
    requestImmediateSync();
    return result;
  });
  ipcMain.handle('data:excel:export', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export R58 Data to Excel',
      defaultPath: path.join(app.getPath('documents'), `R58_Export_${date}.xlsx`),
      filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    return { canceled: false, ...exportExcel(result.filePath) };
  });
  ipcMain.handle('data:json:export', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Manual R58 JSON Transfer',
      defaultPath: path.join(app.getPath('documents'), `R58_Sync_${date}.json`),
      filters: [{ name: 'JSON files', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    return { canceled: false, ...(await writeManualPacket(result.filePath)) };
  });
  ipcMain.handle('data:json:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Manual R58 JSON Transfer',
      properties: ['openFile'],
      filters: [{ name: 'JSON files', extensions: ['json'] }, { name: 'All files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const imported = await readManualPacket(result.filePaths[0]);
    requestImmediateSync();
    return { canceled: false, ...imported };
  });
  ipcMain.handle('transactions:get', (_event, limit: number) => getTransactions(Number(limit) || 300));
  ipcMain.handle('trusted:get', () => getTrustedDevice() ?? null);
  ipcMain.handle('trusted:get-all', () => getTrustedDevices());
  ipcMain.handle('trusted:remove', (_event, deviceId: string) => {
    if (!String(deviceId).trim()) throw new Error('Trusted device ID is required.');
    removeTrustedDevice(String(deviceId));
    return { success: true };
  });
  ipcMain.handle('nearby:get', () => getNearbyDevices());
  ipcMain.handle('nearby:refresh', () => refreshNearbyDiscovery());
  ipcMain.handle('autosync:status', () => getAutoSyncStatus());
  ipcMain.handle('pairing:generate', () => generatePairingCode());
  ipcMain.handle('pairing:active', () => getPairingCode());
  ipcMain.handle('pairing:pair', async (_event, host: string, code: string) => {
    const result = await pairWithDevice(host, code);
    requestImmediateSync();
    return result;
  });
  ipcMain.handle('sync:run', (_event, host?: string) => syncWithDevice(host));
  ipcMain.handle('sync:run-device', (_event, host: string, remoteDeviceId: string) => syncWithTrustedDevice(host, remoteDeviceId));
  ipcMain.handle('updates:status', () => updateStatus);
  ipcMain.handle('updates:check', async () => {
    if (!app.isPackaged || !__R58_AUTO_UPDATE__) {
      publishUpdateStatus({
        state: app.isPackaged ? 'manual' : 'development',
        message: app.isPackaged
          ? 'This MSI installation receives updates through a newer MSI installer.'
          : 'Automatic updates are available in the installed app.',
      });
      return updateStatus;
    }
    try {
      await autoUpdater.checkForUpdates();
      return updateStatus;
    } catch (error) {
      log.error('R58 PC MANUAL UPDATE CHECK ERROR:', error);
      publishUpdateStatus({ state: 'error', message: `Update check failed: ${String(error)}` });
      throw error;
    }
  });
  ipcMain.handle('updates:install', () => {
    if (updateStatus.state !== 'downloaded') throw new Error('There is no downloaded update to install.');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  });
  ipcMain.handle('logs:open', async () => {
    const error = await shell.openPath(app.getPath('logs'));
    if (error) throw new Error(`Could not open the log folder: ${error}`);
    return { success: true };
  });
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  setupAutoUpdates();
  log.info('R58 Inventory started', { version: app.getVersion(), packaged: app.isPackaged });

  try {
    await startNearbyDiscovery();
    console.log('R58 PC nearby discovery started');
  } catch (error) {
    log.error('R58 PC NEARBY DISCOVERY START ERROR:', error);
  }

  void startAutoSync().catch(error =>
    log.error('R58 PC AUTO SYNC START ERROR:', error)
  );

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();

      try {
        await startNearbyDiscovery();
      } catch (error) {
        log.error('R58 PC DISCOVERY RESTART ERROR:', error);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void stopAutoSync();
  log.info('R58 Inventory shutting down');
});

process.on('uncaughtException', error => {
  log.error('R58 PC UNCAUGHT EXCEPTION:', error);
  app.exit(1);
});

process.on('unhandledRejection', reason => {
  log.error('R58 PC UNHANDLED REJECTION:', reason);
});
