import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';

import {
    getDatabase,
} from '../database/database';

const PAIR_CODE_KEY =
  'r58_pair_code';

const PAIR_EXPIRY_KEY =
  'r58_pair_expiry';

const PAIR_DURATION_MS =
  5 * 60 * 1000;

export interface TrustedDevice {
  device_id: string;
  device_name: string;
  paired_at: string;
  last_seen_at: string | null;
  last_sync_at: string | null;
}

async function ensurePairingTable() {
  const db =
    await getDatabase();

  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS trusted_devices (
    device_id TEXT
      PRIMARY KEY NOT NULL,

    device_name TEXT
      NOT NULL,

    shared_secret TEXT
      NOT NULL,

    paired_at TEXT
      NOT NULL,

    last_seen_at TEXT,

    last_sync_at TEXT
  );
`);
try {
  await db.execAsync(`
    ALTER TABLE trusted_devices
    ADD COLUMN last_sync_at TEXT;
  `);
} catch {
  // Column already exists.
}
}

export async function createPairingCode() {
  await ensurePairingTable();

  const uuid =
    Crypto.randomUUID()
      .replace(/-/g, '');

  const randomNumber =
    parseInt(
      uuid.slice(0, 8),
      16
    );

  const code =
    String(
      100000 +
      (
        randomNumber %
        900000
      )
    );

  const expiresAt =
    new Date(
      Date.now() +
      PAIR_DURATION_MS
    ).toISOString();

  await Storage.setItem(
    PAIR_CODE_KEY,
    code
  );

  await Storage.setItem(
    PAIR_EXPIRY_KEY,
    expiresAt
  );

  return {
    code,
    expiresAt,
  };
}

export async function getActivePairingCode() {
  const code =
    await Storage.getItem(
      PAIR_CODE_KEY
    );

  const expiresAt =
    await Storage.getItem(
      PAIR_EXPIRY_KEY
    );

  if (
    !code ||
    !expiresAt
  ) {
    return null;
  }

  if (
    new Date(
      expiresAt
    ).getTime() <=
    Date.now()
  ) {
    await clearPairingCode();

    return null;
  }

  return {
    code,
    expiresAt,
  };
}

export async function clearPairingCode() {
  await Storage.removeItem(
    PAIR_CODE_KEY
  );

  await Storage.removeItem(
    PAIR_EXPIRY_KEY
  );
}

export async function validatePairingCode(
  incomingCode: string
) {
  const session =
    await getActivePairingCode();

  if (!session) {
    return false;
  }

  return (
    session.code ===
    incomingCode.trim()
  );
}

export function createSharedSecret() {
  return (
    Crypto.randomUUID()
      .replace(/-/g, '') +
    Crypto.randomUUID()
      .replace(/-/g, '')
  );
}

export async function trustDevice(
  deviceId: string,
  deviceName: string,
  sharedSecret: string
) {
  await ensurePairingTable();

  const db =
    await getDatabase();

  const now =
    new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO trusted_devices (
      device_id,
      device_name,
      shared_secret,
      paired_at,
      last_seen_at
    )

    VALUES (?, ?, ?, ?, ?)

    ON CONFLICT(device_id)

    DO UPDATE SET
      device_name =
        excluded.device_name,

      shared_secret =
        excluded.shared_secret,

      paired_at =
        excluded.paired_at,

      last_seen_at =
        excluded.last_seen_at
    `,
    deviceId,
    deviceName,
    sharedSecret,
    now,
    now
  );
}

export async function getTrustedDevice(
  deviceId: string
) {
  await ensurePairingTable();

  const db =
    await getDatabase();

  return await db.getFirstAsync<{
    device_id: string;
    device_name: string;
    shared_secret: string;
    paired_at: string;
    last_seen_at: string | null;
  }>(
    `
    SELECT *
    FROM trusted_devices
    WHERE device_id = ?
    `,
    deviceId
  );
}

export async function getTrustedDevices():
  Promise<TrustedDevice[]> {

  await ensurePairingTable();

  const db =
    await getDatabase();

  return await db.getAllAsync<TrustedDevice>(`
    SELECT
      device_id,
      device_name,
      paired_at,
      last_seen_at,
      last_sync_at

    FROM trusted_devices

    ORDER BY
      device_name COLLATE NOCASE
  `);
}

export async function removeTrustedDevice(
  deviceId: string
) {
  await ensurePairingTable();

  const db =
    await getDatabase();

  await db.runAsync(
    `
    DELETE FROM trusted_devices
    WHERE device_id = ?
    `,
    deviceId
  );
}

export async function touchTrustedDevice(
  deviceId: string
) {
  await ensurePairingTable();

  const db =
    await getDatabase();

  await db.runAsync(
    `
    UPDATE trusted_devices

    SET last_seen_at = ?

    WHERE device_id = ?
    `,
    new Date().toISOString(),
    deviceId
  );
}

export async function createAuthProof(
  sharedSecret: string,
  packetId: string,
  direction:
    | 'REQUEST'
    | 'RESPONSE'
) {
  const source =
    `${sharedSecret}:${packetId}:${direction}`;

  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    source
  );
}

export async function verifyAuthProof(
  deviceId: string,
  packetId: string,
  direction:
    | 'REQUEST'
    | 'RESPONSE',
  proof: string
) {
  const trusted =
    await getTrustedDevice(
      deviceId
    );

  if (!trusted) {
    return false;
  }

  const expected =
    await createAuthProof(
      trusted.shared_secret,
      packetId,
      direction
    );

  return (
    expected === proof
  );
}
export async function markTrustedDeviceSynced(
  deviceId: string
) {
  await ensurePairingTable();

  const db =
    await getDatabase();

  const now =
    new Date().toISOString();

  await db.runAsync(
    `
    UPDATE trusted_devices

    SET
      last_seen_at = ?,
      last_sync_at = ?

    WHERE device_id = ?
    `,
    now,
    now,
    deviceId
  );
}