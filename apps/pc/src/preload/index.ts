import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('r58', {
  getDevice: () => ipcRenderer.invoke('device:get'),
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  getInventory: (search: string) => ipcRenderer.invoke('inventory:get', search),
  getTransactions: (limit = 300) => ipcRenderer.invoke('transactions:get', limit),
  getTrusted: () => ipcRenderer.invoke('trusted:get'),
  getTrustedDevices: () => ipcRenderer.invoke('trusted:get-all'),
  removeTrustedDevice: (deviceId: string) => ipcRenderer.invoke('trusted:remove', deviceId),
  getNearbyDevices: () => ipcRenderer.invoke('nearby:get'),
  refreshNearbyDevices: () => ipcRenderer.invoke('nearby:refresh'),
  getAutoSyncStatus: () => ipcRenderer.invoke('autosync:status'),
  generatePairingCode: () => ipcRenderer.invoke('pairing:generate'),
  getActivePairingCode: () => ipcRenderer.invoke('pairing:active'),
  pairWithDevice: (host: string, code: string) => ipcRenderer.invoke('pairing:pair', host, code),
  syncWithDevice: (host?: string) => ipcRenderer.invoke('sync:run', host),
  syncWithTrustedDevice: (host: string, remoteDeviceId: string) => ipcRenderer.invoke('sync:run-device', host, remoteDeviceId),
});
