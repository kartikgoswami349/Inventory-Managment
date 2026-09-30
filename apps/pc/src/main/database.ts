import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';

export type DeviceInfo = {
  id: string;
  name: string;
};

export type TrustedDevice = {
  device_id: string;
  device_name: string;
  shared_secret: string;
  paired_at: string;
  last_seen_at: string | null;
  last_sync_at: string | null;
  last_host: string | null;
};

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.join(app.getPath('userData'));
  db = new Database(path.join(dir, 'r58_inventory.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY NOT NULL,
      stock_id TEXT NOT NULL,
      old_item_id TEXT,
      item_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      minimum_stock REAL NOT NULL DEFAULT 0,
      qr_code TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY NOT NULL,
      department_id TEXT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      stock_delta REAL NOT NULL,
      department_id TEXT,
      person_id TEXT,
      other_name TEXT,
      other_department_name TEXT,
      remark TEXT,
      timestamp TEXT NOT NULL,
      device_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL,
      system_quantity REAL NOT NULL,
      audited_quantity REAL NOT NULL,
      variance REAL NOT NULL,
      remark TEXT,
      timestamp TEXT NOT NULL,
      device_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_records (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      modified_at TEXT NOT NULL,
      modified_by_device TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (entity_type, entity_id)
    );

    CREATE TABLE IF NOT EXISTS sync_peers (
      device_id TEXT PRIMARY KEY NOT NULL,
      device_name TEXT NOT NULL,
      last_seen_at TEXT,
      last_sync_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_device (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trusted_devices (
      device_id TEXT PRIMARY KEY NOT NULL,
      device_name TEXT NOT NULL,
      shared_secret TEXT NOT NULL,
      paired_at TEXT NOT NULL,
      last_seen_at TEXT,
      last_sync_at TEXT,
      last_host TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_name ON items(item_name);
    CREATE INDEX IF NOT EXISTS idx_items_stock_id ON items(stock_id);
    CREATE INDEX IF NOT EXISTS idx_items_old_id ON items(old_item_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_item ON transactions(item_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
  `);

  const existing = db.prepare('SELECT device_id, device_name FROM local_device WHERE id = 1').get() as DeviceInfo | undefined;
  if (!existing) {
    const info: DeviceInfo = {
      id: crypto.randomUUID(),
      name: `R58 PC - ${os.hostname()}`,
    };
    db.prepare(`INSERT INTO local_device (id, device_id, device_name) VALUES (1, ?, ?)`).run(info.id, info.name);
  }

  return db;
}

export function getDevice(): DeviceInfo {
  const row = getDb().prepare('SELECT device_id AS id, device_name AS name FROM local_device WHERE id = 1').get() as DeviceInfo;
  return row;
}

export function getTrustedDevice(deviceId?: string): TrustedDevice | undefined {
  const database = getDb();
  if (deviceId) {
    return database.prepare('SELECT * FROM trusted_devices WHERE device_id = ?').get(deviceId) as TrustedDevice | undefined;
  }
  return database.prepare('SELECT * FROM trusted_devices ORDER BY paired_at DESC LIMIT 1').get() as TrustedDevice | undefined;
}

export function getTrustedDevices(): TrustedDevice[] {
  return getDb()
    .prepare('SELECT * FROM trusted_devices ORDER BY device_name COLLATE NOCASE')
    .all() as TrustedDevice[];
}

export function removeTrustedDevice(deviceId: string) {
  const database = getDb();
  const transaction = database.transaction(() => {
    database.prepare('DELETE FROM trusted_devices WHERE device_id = ?').run(deviceId);
    database.prepare('DELETE FROM sync_peers WHERE device_id = ?').run(deviceId);
  });
  transaction();
}

export function saveTrustedDevice(device: {
  deviceId: string;
  deviceName: string;
  sharedSecret: string;
  host: string;
}) {
  getDb().prepare(`
    INSERT INTO trusted_devices (
      device_id, device_name, shared_secret, paired_at, last_seen_at, last_sync_at, last_host
    ) VALUES (?, ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      device_name = excluded.device_name,
      shared_secret = excluded.shared_secret,
      paired_at = excluded.paired_at,
      last_seen_at = excluded.last_seen_at,
      last_host = excluded.last_host
  `).run(
    device.deviceId,
    device.deviceName,
    device.sharedSecret,
    new Date().toISOString(),
    new Date().toISOString(),
    device.host,
  );
}

export function markTrustedSeen(deviceId: string, host?: string) {
  getDb().prepare(`
    UPDATE trusted_devices
    SET last_seen_at = ?, last_host = COALESCE(?, last_host)
    WHERE device_id = ?
  `).run(new Date().toISOString(), host ?? null, deviceId);
}

export function markTrustedSynced(deviceId: string, host?: string) {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE trusted_devices
    SET last_seen_at = ?, last_sync_at = ?, last_host = COALESCE(?, last_host)
    WHERE device_id = ?
  `).run(now, now, host ?? null, deviceId);
}

export function getDashboard() {
  const database = getDb();
  const items = database.prepare(`SELECT COUNT(*) AS count FROM items WHERE active = 1`).get() as { count: number };
  const transactions = database.prepare(`SELECT COUNT(*) AS count FROM transactions`).get() as { count: number };
  const audits = database.prepare(`SELECT COUNT(*) AS count FROM audits`).get() as { count: number };
  const departments = database.prepare(`SELECT COUNT(*) AS count FROM departments WHERE active = 1`).get() as { count: number };
  const people = database.prepare(`SELECT COUNT(*) AS count FROM people WHERE active = 1`).get() as { count: number };
  const totalStock = database.prepare(`SELECT COALESCE(SUM(s.stock), 0) AS total FROM (
      SELECT i.id, COALESCE(SUM(t.stock_delta), 0) AS stock
      FROM items i
      LEFT JOIN transactions t ON t.item_id = i.id
      WHERE i.active = 1
      GROUP BY i.id
    ) s`).get() as { total: number };
  return {
    activeItems: Number(items.count),
    transactions: Number(transactions.count),
    audits: Number(audits.count),
    departments: Number(departments.count),
    people: Number(people.count),
    totalStock: Number(totalStock.total),
  };
}

export function getInventory(search = '') {
  const q = search.trim();
  return getDb().prepare(`
    SELECT
      i.id,
      i.stock_id,
      i.old_item_id,
      i.item_name,
      i.unit,
      i.minimum_stock,
      i.qr_code,
      i.active,
      COALESCE(SUM(t.stock_delta), 0) AS current_stock
    FROM items i
    LEFT JOIN transactions t ON t.item_id = i.id
    WHERE i.active = 1
      AND (
        ? = '' OR
        i.item_name LIKE ? OR
        i.stock_id LIKE ? OR
        COALESCE(i.old_item_id, '') LIKE ?
      )
    GROUP BY i.id
    ORDER BY i.stock_id
    LIMIT 300
  `).all(q, `%${q}%`, `%${q}%`, `%${q}%`) as Array<Record<string, unknown>>;
}

export function getTransactions(limit = 300) {
  return getDb().prepare(`
    SELECT
      t.id,
      t.item_id,
      i.stock_id,
      i.item_name,
      i.unit,
      t.transaction_type,
      t.quantity,
      t.stock_delta,
      t.department_id,
      d.name AS department_name,
      t.person_id,
      p.name AS person_name,
      t.other_name,
      t.remark,
      t.timestamp,
      t.device_id
    FROM transactions t
    LEFT JOIN items i ON i.id = t.item_id
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN people p ON p.id = t.person_id
    ORDER BY t.timestamp DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
}
