import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('r58', {
  getDevice: () => ipcRenderer.invoke('device:get'),
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  getInventory: (search: string) => ipcRenderer.invoke('inventory:get', search),
  getNextStockId: () => ipcRenderer.invoke('inventory:next-stock-id'),
  createInventoryItem: (input: {
    oldItemId: string;
    itemName: string;
    unit: string;
    minimumStock: number;
    openingQuantity: number;
  }) => ipcRenderer.invoke('inventory:create', input),
  deactivateInventoryItem: (itemId: string) => ipcRenderer.invoke('inventory:deactivate', itemId),
  updateInventoryItem: (input: {
    itemId: string;
    oldItemId: string;
    itemName: string;
    unit: string;
    minimumStock: number;
  }) => ipcRenderer.invoke('inventory:update', input),
  getDepartments: () => ipcRenderer.invoke('departments:get'),
  createDepartment: (name: string) => ipcRenderer.invoke('departments:create', name),
  deactivateDepartment: (departmentId: string) => ipcRenderer.invoke('departments:deactivate', departmentId),
  createPerson: (departmentId: string, name: string) => ipcRenderer.invoke('people:create', departmentId, name),
  deactivatePerson: (personId: string) => ipcRenderer.invoke('people:deactivate', personId),
  getPeopleByDepartment: (departmentId: string) => ipcRenderer.invoke('people:get-by-department', departmentId),
  createInventoryTransactions: (input: {
    type: 'ISSUED' | 'RECEIVED';
    items: Array<{ itemId: string; quantity: number }>;
    departmentId: string;
    personId: string | null;
    otherName: string | null;
    remark: string;
  }) => ipcRenderer.invoke('transactions:create', input),
  getTransactions: (limit = 300) => ipcRenderer.invoke('transactions:get', limit),
  getAudits: (limit = 300) => ipcRenderer.invoke('audits:get', limit),
  createAudit: (input: {
    itemId: string;
    auditedQuantity: number;
    remark: string;
    adjustStock: boolean;
  }) => ipcRenderer.invoke('audits:create', input),
  createDatabaseBackup: () => ipcRenderer.invoke('data:backup:create'),
  inspectSqliteFile: () => ipcRenderer.invoke('data:sqlite:inspect'),
  restoreSqliteFile: (filePath: string) => ipcRenderer.invoke('data:sqlite:restore', filePath),
  mergeSqliteFile: (filePath: string) => ipcRenderer.invoke('data:sqlite:merge', filePath),
  exportExcel: () => ipcRenderer.invoke('data:excel:export'),
  exportManualJson: () => ipcRenderer.invoke('data:json:export'),
  importManualJson: () => ipcRenderer.invoke('data:json:import'),
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
  getUpdateStatus: () => ipcRenderer.invoke('updates:status'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  openLogs: () => ipcRenderer.invoke('logs:open'),
  reportRendererError: (details: { type: string; message: string; stack?: string; source?: string; line?: number; column?: number }) => {
    ipcRenderer.send('logs:renderer-error', details);
  },
  onUpdateStatus: (callback: (status: { state: string; message: string; percent?: number; version?: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: { state: string; message: string; percent?: number; version?: string }) => callback(status);
    ipcRenderer.on('updates:status', listener);
    return () => ipcRenderer.removeListener('updates:status', listener);
  },
});
