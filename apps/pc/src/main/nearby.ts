import Bonjour from 'bonjour-service';
import net from 'node:net';
import os from 'node:os';
import { getDevice } from './database';
import { startSyncServer } from './sync';

const SERVICE_TYPE = 'r58inventory';
const SERVICE_PROTOCOL = 'tcp';
const SERVICE_PORT = 45858;
const TXT_PROTOCOL_VERSION = '1';

export type NearbyR58Device = {
  deviceId: string;
  deviceName: string;
  serviceName: string;
  address: string;
  addresses: string[];
  port: number;
  lastSeenAt: string;
};

const devices = new Map<string, NearbyR58Device>();

let bonjour: Bonjour | null = null;
let browser: any = null;
let publication: any = null;
let expiryTimer: NodeJS.Timeout | null = null;

let started = false;
let localDeviceId = '';

function txtString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return String(value);
}

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .reduce((value, part) => (value * 256) + Number(part), 0) >>> 0;
}

function isUsableIpv4(address: string): boolean {
  if (net.isIP(address) !== 4) return false;

  if (address === '127.0.0.1') return false;

  if (address.startsWith('169.254.')) return false;

  const parts = address.split('.').map(Number);
  const first = parts[0];
  const second = parts[1];

  // Ignore carrier-grade NAT/shared address space.
  if (first === 100 && second >= 64 && second <= 127) {
    return false;
  }

  return true;
}

function getLocalIpv4Networks(): Array<{
  address: string;
  netmask: string;
}> {
  const networks: Array<{
    address: string;
    netmask: string;
  }> = [];

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (
        entry.family === 'IPv4' &&
        !entry.internal &&
        isUsableIpv4(entry.address)
      ) {
        networks.push({
          address: entry.address,
          netmask: entry.netmask,
        });
      }
    }
  }

  return networks;
}

function sameSubnet(
  a: string,
  b: string,
  netmask: string,
): boolean {
  const address = ipv4ToInt(a);
  const other = ipv4ToInt(b);
  const mask = ipv4ToInt(netmask);

  return (address & mask) === (other & mask);
}

function candidateIpv4s(addresses: unknown): string[] {
  if (!Array.isArray(addresses)) {
    return [];
  }

  const result: string[] = [];

  for (const raw of addresses) {
    let address = String(raw).trim();

    // Convert IPv4-mapped IPv6 addresses.
    const mapped = address.match(
      /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i,
    );

    if (mapped) {
      address = mapped[1];
    }

    if (
      isUsableIpv4(address) &&
      !result.includes(address)
    ) {
      result.push(address);
    }
  }

  return result;
}

function chooseIpv4(addresses: unknown): string | null {
  const candidates = candidateIpv4s(addresses);

  if (candidates.length === 0) {
    return null;
  }

  const localNetworks = getLocalIpv4Networks();

  const scored = candidates.map((address) => {
    let score = 0;

    // Strong preference for addresses on the same local subnet.
    for (const local of localNetworks) {
      if (
        sameSubnet(
          address,
          local.address,
          local.netmask,
        )
      ) {
        score = Math.max(score, 100);
      }
    }

    const parts = address.split('.').map(Number);

    const isPrivate =
      parts[0] === 10 ||
      (parts[0] === 172 &&
        parts[1] >= 16 &&
        parts[1] <= 31) ||
      (parts[0] === 192 &&
        parts[1] === 168);

    if (isPrivate) {
      score += 20;
    }

    return {
      address,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.address ?? null;
}

/**
 * Creates a safe mDNS service name.
 *
 * Example:
 * R58-PC-Karthik-a1b2c3
 */
function safeServiceName(
  deviceName: unknown,
  deviceId: unknown,
): string {
  const name = String(deviceName ?? 'R58');
  const id = String(deviceId ?? '');

  const safeName =
    name
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .slice(0, 30) || 'R58';

  return `R58-${safeName}-${id.slice(0, 6)}`;
}

/**
 * Remove a device when its mDNS service disappears.
 */
function removeByService(
  serviceName: unknown,
): void {
  const name = String(serviceName ?? '').trim();

  if (!name) {
    return;
  }

  for (const [deviceId, device] of devices.entries()) {
    const storedName = String(
      device.serviceName ?? '',
    );

    const normalizedStoredName =
      storedName.replace(/\.local\.?$/i, '');

    const normalizedName =
      name.replace(/\.local\.?$/i, '');

    if (
      storedName === name ||
      normalizedStoredName === normalizedName
    ) {
      console.log(
        'R58 PC mDNS DEVICE REMOVED:',
        device.deviceName,
        device.address,
      );

      devices.delete(deviceId);
    }
  }
}

/**
 * Called whenever an R58 Android/PC service is discovered.
 */
function handleServiceUp(service: any): void {
  console.log(
    'R58 PC mDNS SERVICE FOUND:',
    {
      name: service?.name,
      fqdn: service?.fqdn,
      host: service?.host,
      port: service?.port,
      addresses: service?.addresses,
      txt: service?.txt,
    },
  );

  try {
    const txt = service?.txt ?? {};

    const deviceId = txtString(txt.deviceId);

    // Ignore our own PC.
    if (!deviceId || deviceId === localDeviceId) {
      return;
    }

    const protocol = txtString(txt.protocol);

    if (
      protocol &&
      protocol !== TXT_PROTOCOL_VERSION
    ) {
      return;
    }

    const rawAddresses = Array.isArray(
      service?.addresses,
    )
      ? service.addresses
      : [];

    console.log(
      'R58 PC mDNS ADDRESSES:',
      rawAddresses,
    );

    const addresses = candidateIpv4s(
      rawAddresses,
    );

    const address = chooseIpv4(addresses);

    // We only want an IPv4 address that the PC
    // can actually use for TCP.
    if (!address) {
      console.log(
        'R58 PC mDNS: no usable IPv4 address',
        deviceId,
      );

      return;
    }

    const deviceName =
      txtString(txt.deviceName) ||
      txtString(service?.name) ||
      'R58 Device';

    const serviceName =
      txtString(service?.name) ||
      txtString(service?.fqdn) ||
      deviceId;

    const port =
      Number(service?.port) ||
      SERVICE_PORT;

    const device: NearbyR58Device = {
      deviceId,
      deviceName,
      serviceName,
      address,
      addresses,
      port,
      lastSeenAt: new Date().toISOString(),
    };

    devices.set(deviceId, device);

    console.log(
      'R58 PC mDNS DEVICE READY:',
      {
        deviceName,
        deviceId,
        address,
        port,
      },
    );
  } catch (error) {
    console.error(
      'R58 PC DISCOVERY RESOLVE ERROR:',
      error,
    );
  }
}

/**
 * Called when another R58 service disappears.
 */
function handleServiceDown(
  service: any,
): void {
  const serviceName =
    txtString(service?.name) ||
    txtString(service?.fqdn) ||
    '';

  if (serviceName) {
    removeByService(serviceName);
  }
}

function createBonjour(): Bonjour {
  if (bonjour) {
    return bonjour;
  }

  bonjour = new Bonjour(
    undefined,
    (error: Error) => {
      console.error(
        'R58 PC mDNS ERROR:',
        error,
      );
    },
  );

  return bonjour;
}

/**
 * Start automatic LAN discovery.
 */
export async function startNearbyDiscovery(): Promise<void> {
  if (started) {
    return;
  }

  // Make sure the TCP sync server is running.
  await startSyncServer();

  const local = getDevice();

  localDeviceId = String(local.id);

  const mdns = createBonjour();

  /**
   * Publish this PC so Android devices can discover it.
   */
  if (!publication) {
    publication = mdns.publish({
      name: safeServiceName(
        local.name,
        local.id,
      ),

      type: SERVICE_TYPE,

      protocol: SERVICE_PROTOCOL,

      port: SERVICE_PORT,

      txt: {
        deviceId: String(local.id),
        deviceName: String(
          local.name ?? 'R58 PC',
        ),
        protocol: TXT_PROTOCOL_VERSION,
      },

      // We are deliberately using IPv4 for
      // the R58 TCP connection.
      disableIPv6: true,
    });

    publication.on?.(
      'error',
      (error: Error) => {
        console.error(
          'R58 PC mDNS PUBLISH ERROR:',
          error,
        );
      },
    );
  }

  /**
   * Discover Android/PC R58 devices.
   */
  if (!browser) {
    browser = mdns.find(
      {
        type: SERVICE_TYPE,
        protocol: SERVICE_PROTOCOL,
      },
      handleServiceUp,
    );

    browser.on?.(
      'down',
      handleServiceDown,
    );

    browser.on?.(
      'error',
      (error: Error) => {
        console.error(
          'R58 PC mDNS BROWSER ERROR:',
          error,
        );
      },
    );
  } else {
    browser.update?.();
  }

  started = true;

  /**
   * Keep Bonjour's service list fresh.
   */
  if (!expiryTimer) {
    expiryTimer = setInterval(() => {
      try {
        browser?.expire?.();
      } catch (error) {
        console.error(
          'R58 PC mDNS EXPIRE ERROR:',
          error,
        );
      }
    }, 10_000);
  }

  console.log(
    'R58 PC NEARBY DISCOVERY STARTED',
  );
}

/**
 * Check whether discovery is active.
 */
export function isNearbyDiscoveryRunning(): boolean {
  return started;
}

/**
 * Get currently discovered R58 devices.
 */
export function getNearbyDevices(): NearbyR58Device[] {
  return Array
    .from(devices.values())
    .sort((a, b) =>
      a.deviceName.localeCompare(
        b.deviceName,
      ),
    );
}

/**
 * Force an mDNS query.
 */
export function refreshNearbyDiscovery(): void {
  if (!browser) {
    void startNearbyDiscovery().catch(
      (error) => {
        console.error(
          'R58 PC DISCOVERY START ERROR:',
          error,
        );
      },
    );

    return;
  }

  try {
    browser.update?.();

    console.log(
      'R58 PC mDNS DISCOVERY REFRESHED',
    );
  } catch (error) {
    console.error(
      'R58 PC DISCOVERY REFRESH ERROR:',
      error,
    );
  }
}

/**
 * Stop discovery cleanly.
 */
export async function stopNearbyDiscovery(): Promise<void> {
  started = false;

  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }

  devices.clear();

  try {
    browser?.stop?.();
  } catch {}

  try {
    publication?.stop?.();
  } catch {}

  browser = null;
  publication = null;

  if (bonjour) {
    try {
      bonjour.destroy();
    } catch {}
  }

  bonjour = null;
  localDeviceId = '';

  console.log(
    'R58 PC NEARBY DISCOVERY STOPPED',
  );
}