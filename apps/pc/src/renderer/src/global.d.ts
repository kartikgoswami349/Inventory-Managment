export {};


declare global {
  interface Window {
    r58: {
      getDevice(): Promise<{ id: string; name: string }>;
      getDashboard(): Promise<any>;
      getInventory(search: string): Promise<any[]>;
      getTransactions(limit?: number): Promise<any[]>;
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
    };
  }
}
declare module '*.css';