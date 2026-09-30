import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, getDashboard, getDevice, getInventory, getTransactions, getTrustedDevice, getTrustedDevices, removeTrustedDevice } from './database';
import { generatePairingCode, getPairingCode, pairWithDevice, startSyncServer, syncWithDevice, syncWithTrustedDevice } from './sync';
import {
  getNearbyDevices,
  refreshNearbyDiscovery,
  startNearbyDiscovery,
} from './nearby';
import { getAutoSyncStatus, requestImmediateSync, startAutoSync, stopAutoSync } from './autoSync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  getDb();
  try {
    await startSyncServer();
  } catch (error) {
    console.error('R58 PC TCP SERVER ERROR:', error);
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

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc() {
  ipcMain.handle('device:get', () => getDevice());
  ipcMain.handle('dashboard:get', () => getDashboard());
  ipcMain.handle('inventory:get', (_event, search: string) => getInventory(search || ''));
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
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();

  try {
    await startNearbyDiscovery();
    console.log('R58 PC nearby discovery started');
  } catch (error) {
    console.error('R58 PC NEARBY DISCOVERY START ERROR:', error);
  }

  void startAutoSync().catch(error =>
    console.error('R58 PC AUTO SYNC START ERROR:', error)
  );

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();

      try {
        await startNearbyDiscovery();
      } catch (error) {
        console.error('R58 PC DISCOVERY RESTART ERROR:', error);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void stopAutoSync();
});
