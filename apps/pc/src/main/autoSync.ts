import { getTrustedDevices, type TrustedDevice } from './database';
import { getNearbyDevices, startNearbyDiscovery, stopNearbyDiscovery } from './nearby';
import { syncWithTrustedDevice } from './sync';

export const AUTO_SYNC_INTERVAL_MS = 30_000;
const AUTO_SYNC_COOLDOWN_MS = 20_000;
const INITIAL_SYNC_DELAY_MS = 5_000;

export type AutoSyncStatus = {
  running: boolean;
  syncing: boolean;
  intervalMs: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

let running = false;
let syncing = false;
let intervalTimer: NodeJS.Timeout | null = null;
let initialTimer: NodeJS.Timeout | null = null;
let runPromise: Promise<void> | null = null;
const lastSyncAttemptByDevice = new Map<string, number>();
let lastAttemptAt: string | null = null;
let lastSuccessAt: string | null = null;
let lastError: string | null = null;

function getHostCandidatesForTrustedDevice(
  trusted: TrustedDevice,
  nearbyById: Map<string, ReturnType<typeof getNearbyDevices>[number]>,
) {
  const nearby = nearbyById.get(trusted.device_id);
  const candidates = [
    nearby?.address ?? '',
    ...(nearby?.addresses ?? []),
    trusted.last_host ?? '',
  ];
  return Array.from(new Set(candidates.map(value => value.trim()).filter(Boolean)));
}

async function runAutoSyncInternal(reason: 'initial' | 'interval' | 'immediate') {
  if (!running || syncing) return;

  syncing = true;
  lastAttemptAt = new Date().toISOString();

  try {
    try {
      await startNearbyDiscovery();
    } catch (error) {
      console.error('R58 PC AUTO SYNC DISCOVERY ERROR:', error);
    }

    const trustedDevices = getTrustedDevices();
    if (!trustedDevices.length) return;

    const nearbyById = new Map(getNearbyDevices().map(device => [device.deviceId, device]));

    for (const trusted of trustedDevices) {
      if (!running) break;

      const hosts = getHostCandidatesForTrustedDevice(trusted, nearbyById);
      if (!hosts.length) continue;

      const now = Date.now();
      const lastAttempt = lastSyncAttemptByDevice.get(trusted.device_id) ?? 0;
      if (reason !== 'immediate' && now - lastAttempt < AUTO_SYNC_COOLDOWN_MS) continue;
      lastSyncAttemptByDevice.set(trusted.device_id, now);

      let synced = false;
      for (const host of hosts) {
        if (!running) break;
        try {
          await syncWithTrustedDevice(host, trusted.device_id);
          lastSuccessAt = new Date().toISOString();
          lastError = null;
          synced = true;
          break;
        } catch (error) {
          lastError = `${trusted.device_name} @ ${host}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`R58 PC AUTO SYNC ERROR (${trusted.device_name} @ ${host}):`, error);
        }
      }
      if (!synced) {
        console.error(`R58 PC AUTO SYNC: all known addresses failed for ${trusted.device_name}.`);
      }
    }
  } finally {
    syncing = false;
  }
}

export function requestImmediateSync() {
  if (!running) return;
  void runAutoSyncInternal('immediate').catch(error => console.error('R58 PC AUTO SYNC IMMEDIATE ERROR:', error));
}

export async function startAutoSync() {
  if (running) return;
  running = true;

  try {
    await startNearbyDiscovery();
  } catch (error) {
    console.error('R58 PC DISCOVERY START ERROR:', error);
  }

  initialTimer = setTimeout(() => {
    initialTimer = null;
    runPromise = runAutoSyncInternal('initial').finally(() => { runPromise = null; });
  }, INITIAL_SYNC_DELAY_MS);

  intervalTimer = setInterval(() => {
    runPromise = runAutoSyncInternal('interval').finally(() => { runPromise = null; });
  }, AUTO_SYNC_INTERVAL_MS);
}

export async function stopAutoSync() {
  running = false;

  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  if (runPromise) {
    try { await runPromise; } catch {}
    runPromise = null;
  }

  try { await stopNearbyDiscovery(); } catch (error) { console.error('R58 PC DISCOVERY STOP ERROR:', error); }
  syncing = false;
}

export function getAutoSyncStatus(): AutoSyncStatus {
  return { running, syncing, intervalMs: AUTO_SYNC_INTERVAL_MS, lastAttemptAt, lastSuccessAt, lastError };
}
