export {};


declare global {
  interface Window {
    r58: {
      getDevice(): Promise<{ id: string; name: string }>;
      getDashboard(): Promise<any>;
      getInventory(search: string): Promise<any[]>;
      getNextStockId(): Promise<string>;
      createInventoryItem(input: {
        oldItemId: string;
        itemName: string;
        unit: string;
        minimumStock: number;
        openingQuantity: number;
      }): Promise<{ id: string; stockId: string }>;
      deactivateInventoryItem(itemId: string): Promise<{ success: boolean }>;
      updateInventoryItem(input: {
        itemId: string;
        oldItemId: string;
        itemName: string;
        unit: string;
        minimumStock: number;
      }): Promise<{ id: string; itemName: string }>;
      getDepartments(): Promise<Array<{ id: string; name: string }>>;
      createDepartment(name: string): Promise<{ id: string; name: string }>;
      deactivateDepartment(departmentId: string): Promise<{ success: boolean }>;
      createPerson(departmentId: string, name: string): Promise<{ id: string; department_id: string; name: string }>;
      deactivatePerson(personId: string): Promise<{ success: boolean }>;
      getPeopleByDepartment(departmentId: string): Promise<Array<{ id: string; department_id: string; name: string }>>;
      createInventoryTransactions(input: {
        type: 'ISSUED' | 'RECEIVED';
        items: Array<{ itemId: string; quantity: number }>;
        departmentId: string;
        personId: string | null;
        otherName: string | null;
        remark: string;
      }): Promise<{ count: number }>;
      getTransactions(limit?: number): Promise<any[]>;
      getAudits(limit?: number): Promise<any[]>;
      createAudit(input: {
        itemId: string;
        auditedQuantity: number;
        remark: string;
        adjustStock: boolean;
      }): Promise<{
        auditId: string;
        systemQuantity: number;
        auditedQuantity: number;
        variance: number;
        adjusted: boolean;
      }>;
      createDatabaseBackup(): Promise<{
        canceled: boolean;
        filePath?: string;
        fileName?: string;
        sizeBytes?: number;
        createdAt?: string;
      }>;
      inspectSqliteFile(): Promise<{
        canceled: boolean;
        filePath?: string;
        fileName?: string;
        counts?: { items: number; transactions: number; audits: number; departments: number; people: number };
      }>;
      restoreSqliteFile(filePath: string): Promise<{
        counts: { items: number; transactions: number; audits: number; departments: number; people: number };
        recoveryFileName: string;
      }>;
      mergeSqliteFile(filePath: string): Promise<{
        counts: { items: number; transactions: number; audits: number; departments: number; people: number };
        result: { applied: number; skipped: number; items: number; departments: number; people: number; transactions: number; audits: number; sourceDeviceName: string };
      }>;
      exportExcel(): Promise<{
        canceled: boolean;
        filePath?: string;
        counts?: { inventory: number; transactions: number; audits: number };
      }>;
      exportManualJson(): Promise<{
        canceled: boolean;
        filePath?: string;
        counts?: { items: number; departments: number; people: number; transactions: number; audits: number };
      }>;
      importManualJson(): Promise<{
        canceled: boolean;
        fileName?: string;
        applied?: number;
        skipped?: number;
        items?: number;
        departments?: number;
        people?: number;
        transactions?: number;
        audits?: number;
        sourceDeviceName?: string;
      }>;
      getTrusted(): Promise<any | null>;
      getTrustedDevices(): Promise<any[]>;
      removeTrustedDevice(deviceId: string): Promise<{ success: boolean }>;
      getNearbyDevices(): Promise<any[]>;
      refreshNearbyDevices(): Promise<void>;
      getAutoSyncStatus(): Promise<any>;
      generatePairingCode(): Promise<{ code: string; expiresAt: string }>;
      getActivePairingCode(): Promise<{ code: string; expiresAt: string } | null>;
      pairWithDevice(host: string, code: string): Promise<any>;
      syncWithDevice(host?: string): Promise<any>;
      syncWithTrustedDevice(host: string, remoteDeviceId: string): Promise<any>;
      getUpdateStatus(): Promise<{ state: string; message: string; percent?: number; version?: string }>;
      checkForUpdates(): Promise<{ state: string; message: string; percent?: number; version?: string }>;
      installUpdate(): Promise<{ success: boolean }>;
      openLogs(): Promise<{ success: boolean }>;
      reportRendererError(details: { type: string; message: string; stack?: string; source?: string; line?: number; column?: number }): void;
      onUpdateStatus(callback: (status: { state: string; message: string; percent?: number; version?: string }) => void): () => void;
    };
  }
}
declare module '*.css';