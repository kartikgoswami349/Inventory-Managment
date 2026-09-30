import crypto from 'node:crypto';
import net from 'node:net';
import {
  getDb,
  getDevice,
  getTrustedDevice,
  saveTrustedDevice,
  markTrustedSeen,
  markTrustedSynced,
  type TrustedDevice,
} from './database';

const PORT = 45858;
const PAIR_DURATION_MS = 5 * 60 * 1000;

let pairCode: string | null = null;
let pairExpiry = 0;
let server: net.Server | null = null;
let serverStartPromise: Promise<void> | null = null;
let syncQueue: Promise<unknown> = Promise.resolve();

export type SyncMeta = {
  entityType: 'ITEM' | 'DEPARTMENT' | 'PERSON' | 'TRANSACTION' | 'AUDIT';
  entityId: string;
  revision: number;
  modifiedAt: string;
  modifiedByDevice: string;
  deleted: number;
};

export type SyncEntry<T> = { data: T; sync: SyncMeta };

export type SyncPacket = {
  format: 'R58_SYNC_PACKET';
  version: 1;
  packetId: string;
  generatedAt: string;
  sourceDevice: { id: string; name: string };
  records: {
    items: SyncEntry<Record<string, unknown>>[];
    departments: SyncEntry<Record<string, unknown>>[];
    people: SyncEntry<Record<string, unknown>>[];
    transactions: SyncEntry<Record<string, unknown>>[];
    audits: SyncEntry<Record<string, unknown>>[];
  };
};

export type SyncResult = {
  remoteDeviceId: string;
  remoteDeviceName: string;
  sent: { applied: number; skipped: number };
  received: { applied: number; skipped: number; items: number; departments: number; people: number; transactions: number; audits: number };
};

function sha256(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function createAuthProof(sharedSecret: string, packetId: string, direction: 'REQUEST' | 'RESPONSE') {
  return sha256(`${sharedSecret}:${packetId}:${direction}`);
}

function validatePacket(packet: unknown): asserts packet is SyncPacket {
  const data = packet as Partial<SyncPacket> | null;
  if (!data || data.format !== 'R58_SYNC_PACKET') throw new Error('This is not an R58 sync packet.');
  if (data.version !== 1) throw new Error(`Unsupported sync packet version: ${String(data.version)}`);
  if (!data.sourceDevice?.id || !data.records) throw new Error('The sync packet is incomplete.');
  for (const key of ['items', 'departments', 'people', 'transactions', 'audits'] as const) {
    if (!Array.isArray(data.records[key])) throw new Error(`Invalid sync packet section: ${key}`);
  }
}

function normaliseTime(value: string) {
  if (!value) return 0;
  let clean = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:/.test(clean)) clean = clean.replace(' ', 'T') + 'Z';
  const t = new Date(clean).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function shouldApplyMutable(entityType: SyncMeta['entityType'], entityId: string, incoming: SyncMeta) {
  const local = getDb().prepare(`
    SELECT revision, modified_at, modified_by_device
    FROM sync_records
    WHERE entity_type = ? AND entity_id = ?
  `).get(entityType, entityId) as { revision: number; modified_at: string; modified_by_device: string } | undefined;

  if (!local) return true;
  if (incoming.revision > Number(local.revision)) return true;
  if (incoming.revision < Number(local.revision)) return false;
  const incomingTime = normaliseTime(incoming.modifiedAt);
  const localTime = normaliseTime(local.modified_at);
  if (incomingTime > localTime) return true;
  if (incomingTime < localTime) return false;
  return incoming.modifiedByDevice > local.modified_by_device;
}

function ensureLocalMeta() {
  const database = getDb();
  const device = getDevice();
  const now = new Date().toISOString();
  const ensure = database.prepare(`
    INSERT INTO sync_records (entity_type, entity_id, revision, modified_at, modified_by_device, deleted)
    VALUES (?, ?, 1, ?, ?, 0)
    ON CONFLICT(entity_type, entity_id) DO NOTHING
  `);
  const transaction = database.transaction(() => {
    const tables: Array<[string, SyncMeta['entityType'], string]> = [
      ['items', 'ITEM', 'id'],
      ['departments', 'DEPARTMENT', 'id'],
      ['people', 'PERSON', 'id'],
      ['transactions', 'TRANSACTION', 'id'],
      ['audits', 'AUDIT', 'id'],
    ];
    for (const [table, type, idColumn] of tables) {
      const rows = database.prepare(`SELECT ${idColumn} AS id FROM ${table}`).all() as Array<{ id: string }>;
      for (const row of rows) ensure.run(type, row.id, now, device.id);
    }
  });
  transaction();
}

function readEntries(table: string, entityType: SyncMeta['entityType']) {
  const database = getDb();
  return database.prepare(`
    SELECT
      x.*,
      s.revision AS __revision,
      s.modified_at AS __modified_at,
      s.modified_by_device AS __modified_by_device,
      s.deleted AS __deleted
    FROM ${table} x
    JOIN sync_records s
      ON s.entity_id = x.id
     AND s.entity_type = ?
    ORDER BY x.id
  `).all(entityType).map((row: Record<string, unknown>) => {
    const { __revision, __modified_at, __modified_by_device, __deleted, ...data } = row;
    return {
      data,
      sync: {
        entityType,
        entityId: String((data as { id: unknown }).id),
        revision: Number(__revision),
        modifiedAt: String(__modified_at),
        modifiedByDevice: String(__modified_by_device),
        deleted: Number(__deleted),
      },
    } as SyncEntry<Record<string, unknown>>;
  });
}

export function buildSyncPacket(): SyncPacket {
  ensureLocalMeta();
  const device = getDevice();
  return {
    format: 'R58_SYNC_PACKET',
    version: 1,
    packetId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    sourceDevice: device,
    records: {
      items: readEntries('items', 'ITEM'),
      departments: readEntries('departments', 'DEPARTMENT'),
      people: readEntries('people', 'PERSON'),
      transactions: readEntries('transactions', 'TRANSACTION'),
      audits: readEntries('audits', 'AUDIT'),
    },
  };
}

function writeMeta(meta: SyncMeta) {
  getDb().prepare(`
    INSERT INTO sync_records (entity_type, entity_id, revision, modified_at, modified_by_device, deleted)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      revision = excluded.revision,
      modified_at = excluded.modified_at,
      modified_by_device = excluded.modified_by_device,
      deleted = excluded.deleted
  `).run(meta.entityType, meta.entityId, meta.revision, meta.modifiedAt, meta.modifiedByDevice, meta.deleted);
}

function applyPacket(packet: SyncPacket) {
  validatePacket(packet);
  const database = getDb();
  let applied = 0;
  let skipped = 0;
  let items = 0;
  let departments = 0;
  let people = 0;
  let transactions = 0;
  let audits = 0;

  const tx = database.transaction(() => {
    for (const entry of packet.records.departments) {
      if (!shouldApplyMutable('DEPARTMENT', String(entry.data.id), entry.sync)) { skipped++; continue; }
      database.prepare(`
        INSERT INTO departments (id, name, active) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, active = excluded.active
      `).run(entry.data.id, entry.data.name, entry.data.active);
      writeMeta(entry.sync); applied++; departments++;
    }

    for (const entry of packet.records.people) {
      if (!shouldApplyMutable('PERSON', String(entry.data.id), entry.sync)) { skipped++; continue; }
      database.prepare(`
        INSERT INTO people (id, department_id, name, active) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET department_id = excluded.department_id, name = excluded.name, active = excluded.active
      `).run(entry.data.id, entry.data.department_id, entry.data.name, entry.data.active);
      writeMeta(entry.sync); applied++; people++;
    }

    for (const entry of packet.records.items) {
      if (!shouldApplyMutable('ITEM', String(entry.data.id), entry.sync)) { skipped++; continue; }
      database.prepare(`
        INSERT INTO items (
          id, stock_id, old_item_id, item_name, unit, minimum_stock, qr_code, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          stock_id = excluded.stock_id,
          old_item_id = excluded.old_item_id,
          item_name = excluded.item_name,
          unit = excluded.unit,
          minimum_stock = excluded.minimum_stock,
          qr_code = excluded.qr_code,
          active = excluded.active,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `).run(
        entry.data.id, entry.data.stock_id, entry.data.old_item_id, entry.data.item_name,
        entry.data.unit, entry.data.minimum_stock, entry.data.qr_code, entry.data.active,
        entry.data.created_at, entry.data.updated_at,
      );
      writeMeta(entry.sync); applied++; items++;
    }

    for (const entry of packet.records.transactions) {
      const exists = database.prepare(`SELECT id FROM transactions WHERE id = ?`).get(entry.data.id);
      if (exists) { skipped++; continue; }
      database.prepare(`
        INSERT INTO transactions (
          id, item_id, transaction_type, quantity, stock_delta, department_id, person_id,
          other_name, other_department_name, remark, timestamp, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.data.id, entry.data.item_id, entry.data.transaction_type, entry.data.quantity,
        entry.data.stock_delta, entry.data.department_id, entry.data.person_id, entry.data.other_name,
        entry.data.other_department_name, entry.data.remark, entry.data.timestamp, entry.data.device_id,
      );
      writeMeta(entry.sync); applied++; transactions++;
    }

    for (const entry of packet.records.audits) {
      const exists = database.prepare(`SELECT id FROM audits WHERE id = ?`).get(entry.data.id);
      if (exists) { skipped++; continue; }
      database.prepare(`
        INSERT INTO audits (
          id, item_id, system_quantity, audited_quantity, variance, remark, timestamp, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.data.id, entry.data.item_id, entry.data.system_quantity, entry.data.audited_quantity,
        entry.data.variance, entry.data.remark, entry.data.timestamp, entry.data.device_id,
      );
      writeMeta(entry.sync); applied++; audits++;
    }

    const now = new Date().toISOString();
    database.prepare(`
      INSERT INTO sync_peers (device_id, device_name, last_seen_at, last_sync_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        device_name = excluded.device_name,
        last_seen_at = excluded.last_seen_at,
        last_sync_at = excluded.last_sync_at
    `).run(packet.sourceDevice.id, packet.sourceDevice.name, now, now);
  });

  tx();
  return {
    applied,
    skipped,
    items,
    departments,
    people,
    transactions,
    audits,
    sourceDeviceId: packet.sourceDevice.id,
    sourceDeviceName: packet.sourceDevice.name,
  };
}

function connectAndExchange(host: string, request: Record<string, unknown>, timeoutMs = 30000) {
  return new Promise<any>((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = '';
    let settled = false;
    const timeout = setTimeout(() => fail(new Error(`R58 connection timed out after ${timeoutMs / 1000}s.`)), timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      try { socket.destroy(); } catch {}
    }
    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
    function success(value: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }

    socket.setNoDelay(true);
    socket.connect({ host, port: PORT }, () => socket.write(JSON.stringify(request) + '\n'));
    socket.on('data', data => {
      buffer += data.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline).trim();
      if (!line) return;
      try { success(JSON.parse(line)); } catch (error) { fail(new Error(`Invalid JSON response: ${String(error)}`)); }
    });
    socket.on('error', fail);
    socket.on('close', () => { if (!settled) fail(new Error('R58 TCP connection closed before a response was received.')); });
  });
}

export function generatePairingCode() {
  pairCode = String(crypto.randomInt(100000, 1000000));
  pairExpiry = Date.now() + PAIR_DURATION_MS;
  return { code: pairCode, expiresAt: new Date(pairExpiry).toISOString() };
}

export function getPairingCode() {
  if (!pairCode || Date.now() >= pairExpiry) {
    pairCode = null;
    pairExpiry = 0;
    return null;
  }
  return { code: pairCode, expiresAt: new Date(pairExpiry).toISOString() };
}

export function clearPairingCode() {
  pairCode = null;
  pairExpiry = 0;
}

async function handlePairRequest(socket: net.Socket, request: { code: string; sourceDevice: { id: string; name: string } }) {
  const active = getPairingCode();
  if (!active || active.code !== String(request.code).trim()) {
    socket.write(JSON.stringify({ type: 'R58_PAIR_RESULT', success: false, message: 'Incorrect or expired pairing code.' }) + '\n');
    return;
  }
  const local = getDevice();
  if (request.sourceDevice.id === local.id) throw new Error('A device cannot pair with itself.');
  const sharedSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  saveTrustedDevice({ deviceId: request.sourceDevice.id, deviceName: request.sourceDevice.name, sharedSecret, host: '' });
  clearPairingCode();
  socket.write(JSON.stringify({
    type: 'R58_PAIR_RESULT',
    success: true,
    receiverDevice: local,
    sharedSecret,
  }) + '\n');
}

async function handleSyncRequest(socket: net.Socket, request: any) {
  validatePacket(request.packet);
  const local = getDevice();
  const trusted = getTrustedDevice(request.sourceDevice?.id);
  if (request.sourceDevice?.id === local.id) throw new Error('A device cannot sync with itself.');
  if (!trusted) throw new Error('This R58 device is not paired.');
  if (!request.auth?.proof) throw new Error('Missing sync authentication.');
  const expected = createAuthProof(trusted.shared_secret, request.packet.packetId, 'REQUEST');
  if (expected !== request.auth.proof) throw new Error('R58 sync authentication failed.');

  const imported = applyPacket(request.packet);
  const receiverPacket = buildSyncPacket();
  const responseProof = createAuthProof(trusted.shared_secret, request.packet.packetId, 'RESPONSE');
  const remoteAddress = String(socket.remoteAddress ?? '').replace(/^::ffff:/i, '');
  const usableRemoteHost = net.isIP(remoteAddress) === 4 ? remoteAddress : undefined;
  markTrustedSeen(request.sourceDevice.id, usableRemoteHost);
  socket.write(JSON.stringify({
    type: 'R58_SYNC_RESULT',
    success: true,
    receiverDevice: local,
    remoteApplyResult: imported,
    receiverPacket,
    auth: { proof: responseProof },
  }) + '\n');
}

export async function startSyncServer() {
  if (server) return;
  if (serverStartPromise) return serverStartPromise;

  serverStartPromise = new Promise<void>((resolve, reject) => {
    const nextServer = net.createServer(socket => {
      let buffer = '';
      let processing = false;
      socket.on('data', async data => {
        buffer += data.toString('utf8');
        if (processing) return;
        const newline = buffer.indexOf('\n');
        if (newline < 0) return;
        processing = true;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        try {
          const request = JSON.parse(line);
          if (request.type === 'R58_PAIR_REQUEST') await handlePairRequest(socket, request);
          else if (request.type === 'R58_SYNC') await runSyncSerialized(() => handleSyncRequest(socket, request));
          else throw new Error('Invalid R58 sync request.');
        } catch (error) {
          const type = line.includes('R58_PAIR_REQUEST') ? 'R58_PAIR_RESULT' : 'R58_SYNC_RESULT';
          socket.write(JSON.stringify({ type, success: false, message: error instanceof Error ? error.message : String(error) }) + '\n');
        } finally {
          processing = false;
        }
      });
    });

    nextServer.once('error', error => {
      server = null;
      serverStartPromise = null;
      reject(error);
    });
    nextServer.listen({ port: PORT, host: '0.0.0.0', reuseAddress: true }, () => {
      server = nextServer;
      serverStartPromise = null;
      resolve();
    });
  });

  return serverStartPromise;
}

async function runSyncSerialized<T>(task: () => Promise<T> | T): Promise<T> {
  const previous = syncQueue;
  let release!: () => void;
  syncQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await task(); } finally { release(); }
}

export async function pairWithDevice(host: string, code: string) {
  await startSyncServer();
  const local = getDevice();
  const response = await connectAndExchange(host, {
    type: 'R58_PAIR_REQUEST',
    code: code.trim(),
    sourceDevice: local,
  }, 15000);
  if (response.type !== 'R58_PAIR_RESULT') throw new Error('Invalid pairing response.');
  if (!response.success) throw new Error(response.message || 'Pairing failed.');
  if (!response.receiverDevice?.id || !response.receiverDevice?.name || !response.sharedSecret) throw new Error('Pairing response is incomplete.');
  saveTrustedDevice({
    deviceId: response.receiverDevice.id,
    deviceName: response.receiverDevice.name,
    sharedSecret: response.sharedSecret,
    host,
  });
  return { deviceId: response.receiverDevice.id, deviceName: response.receiverDevice.name, host };
}

async function syncWithTrustedDeviceInternal(host: string, remoteDeviceId: string): Promise<SyncResult> {
  await startSyncServer();

  const trusted = getTrustedDevice(remoteDeviceId);
  if (!trusted) throw new Error('This R58 device is not paired.');

  const targetHost = host.trim();
  if (!targetHost) throw new Error('Enter the R58 device IP address first.');

  const packet = buildSyncPacket();
  const proof = createAuthProof(trusted.shared_secret, packet.packetId, 'REQUEST');
  const response = await connectAndExchange(targetHost, {
    type: 'R58_SYNC',
    sourceDevice: getDevice(),
    packet,
    auth: { proof },
  });

  if (response.type !== 'R58_SYNC_RESULT') throw new Error('Invalid R58 sync response type.');
  if (!response.success) throw new Error(response.message || 'Remote synchronization failed.');
  if (!response.receiverDevice || !response.receiverPacket || !response.remoteApplyResult) throw new Error('Remote R58 response is incomplete.');
  if (response.receiverDevice.id !== trusted.device_id) throw new Error('The responding device does not match the paired R58 device.');
  if (!response.auth?.proof) throw new Error('Remote R58 device did not authenticate its response.');

  const expected = createAuthProof(trusted.shared_secret, packet.packetId, 'RESPONSE');
  if (expected !== response.auth.proof) throw new Error('Remote R58 device authentication failed.');

  const localApply = applyPacket(response.receiverPacket);
  markTrustedSynced(trusted.device_id, targetHost);

  return {
    remoteDeviceId: response.receiverDevice.id,
    remoteDeviceName: response.receiverDevice.name,
    sent: {
      applied: Number(response.remoteApplyResult.applied),
      skipped: Number(response.remoteApplyResult.skipped),
    },
    received: {
      applied: Number(localApply.applied),
      skipped: Number(localApply.skipped),
      items: Number(localApply.items),
      departments: Number(localApply.departments),
      people: Number(localApply.people),
      transactions: Number(localApply.transactions),
      audits: Number(localApply.audits),
    },
  };
}

export async function syncWithTrustedDevice(host: string, remoteDeviceId: string): Promise<SyncResult> {
  return runSyncSerialized(() => syncWithTrustedDeviceInternal(host, remoteDeviceId));
}

export async function syncWithDevice(host?: string): Promise<SyncResult> {
  return runSyncSerialized(async () => {
    const trusted = getTrustedDevice();
    if (!trusted) throw new Error('This PC is not paired with an Android R58 device.');

    const targetHost = host?.trim() || trusted.last_host;
    if (!targetHost) throw new Error('Enter the Android device IP address first.');

    return syncWithTrustedDeviceInternal(targetHost, trusted.device_id);
  });
}
