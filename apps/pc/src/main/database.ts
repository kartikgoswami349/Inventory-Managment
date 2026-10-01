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

export type NewInventoryItemInput = {
  oldItemId: string;
  itemName: string;
  unit: string;
  minimumStock: number;
  openingQuantity: number;
};

export type UpdateInventoryItemInput = {
  itemId: string;
  oldItemId: string;
  itemName: string;
  unit: string;
  minimumStock: number;
};

export type InventoryTransactionInput = {
  type: 'ISSUED' | 'RECEIVED';
  items: Array<{ itemId: string; quantity: number }>;
  departmentId: string;
  personId: string | null;
  otherName: string | null;
  remark: string;
};

export type InventoryAuditInput = {
  itemId: string;
  auditedQuantity: number;
  remark: string;
  adjustStock: boolean;
};

export type InventoryAuditResult = {
  auditId: string;
  systemQuantity: number;
  auditedQuantity: number;
  variance: number;
  adjusted: boolean;
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

export function getNextStockId(): string {
  const result = getDb().prepare(`
    SELECT MAX(CAST(SUBSTR(stock_id, 7) AS INTEGER)) AS max_number
    FROM items
    WHERE stock_id LIKE 'R58-S-%'
  `).get() as { max_number: number | null };

  return `R58-S-${String(Number(result.max_number ?? 0) + 1).padStart(4, '0')}`;
}

export function createInventoryItem(input: NewInventoryItemInput): { id: string; stockId: string } {
  const itemName = input.itemName.trim();
  const oldItemId = input.oldItemId.trim();
  const unit = input.unit.trim();
  if (!itemName) throw new Error('Item name is required.');
  if (!unit) throw new Error('Unit is required.');
  if (!Number.isFinite(input.openingQuantity) || input.openingQuantity < 0) {
    throw new Error('Opening quantity must be zero or greater.');
  }
  if (!Number.isFinite(input.minimumStock) || input.minimumStock < 0) {
    throw new Error('Minimum stock must be zero or greater.');
  }

  const database = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const deviceId = getDevice().id;
  const create = database.transaction(() => {
    const stockId = getNextStockId();
    const existing = database.prepare('SELECT id FROM items WHERE stock_id = ?').get(stockId);
    if (existing) throw new Error(`Stock ID ${stockId} is already in use. Refresh and try again.`);

    database.prepare(`
      INSERT INTO items (
        id, stock_id, old_item_id, item_name, unit, minimum_stock, qr_code, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, stockId, oldItemId || null, itemName, unit, input.minimumStock, stockId, now, now);

    if (input.openingQuantity > 0) {
      database.prepare(`
        INSERT INTO transactions (
          id, item_id, transaction_type, quantity, stock_delta, department_id, person_id,
          other_name, other_department_name, remark, timestamp, device_id
        ) VALUES (?, ?, 'OPENING', ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)
      `).run(crypto.randomUUID(), id, input.openingQuantity, input.openingQuantity, 'Opening stock for new item', now, deviceId);
    }

    return { id, stockId };
  });

  return create();
}

export function updateInventoryItem(input: UpdateInventoryItemInput) {
  const oldItemId = input.oldItemId.trim();
  const itemName = input.itemName.trim();
  const unit = input.unit.trim();
  if (!input.itemId.trim()) throw new Error('Select an inventory item to update.');
  if (!itemName) throw new Error('Item name is required.');
  if (!unit) throw new Error('Unit is required.');
  if (!Number.isFinite(input.minimumStock) || input.minimumStock < 0) {
    throw new Error('Minimum stock must be zero or greater.');
  }

  const database = getDb();
  const modifiedAt = new Date().toISOString();
  const deviceId = getDevice().id;
  const update = database.transaction(() => {
    const item = database.prepare('SELECT id FROM items WHERE id = ? AND active = 1').get(input.itemId);
    if (!item) throw new Error('The selected inventory item is no longer active.');
    database.prepare(`
      UPDATE items
      SET old_item_id = ?, item_name = ?, unit = ?, minimum_stock = ?, updated_at = ?
      WHERE id = ?
    `).run(oldItemId || null, itemName, unit, input.minimumStock, modifiedAt, input.itemId);
    updateLocalSyncMetadata('ITEM', input.itemId, modifiedAt, deviceId);
    return { id: input.itemId, itemName };
  });
  return update();
}

export function getDepartments(): Array<{ id: string; name: string }> {
  return getDb().prepare(`
    SELECT id, name FROM departments WHERE active = 1 ORDER BY name COLLATE NOCASE
  `).all() as Array<{ id: string; name: string }>;
}

export function getPeopleByDepartment(departmentId: string): Array<{ id: string; department_id: string; name: string }> {
  return getDb().prepare(`
    SELECT id, department_id, name
    FROM people
    WHERE department_id = ? AND active = 1
    ORDER BY name COLLATE NOCASE
  `).all(departmentId) as Array<{ id: string; department_id: string; name: string }>;
}

function updateLocalSyncMetadata(entityType: 'ITEM' | 'DEPARTMENT' | 'PERSON', entityId: string, modifiedAt: string, deviceId: string) {
  getDb().prepare(`
    INSERT INTO sync_records (entity_type, entity_id, revision, modified_at, modified_by_device, deleted)
    VALUES (?, ?, 1, ?, ?, 0)
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      revision = sync_records.revision + 1,
      modified_at = excluded.modified_at,
      modified_by_device = excluded.modified_by_device,
      deleted = 0
  `).run(entityType, entityId, modifiedAt, deviceId);
}

export function deactivateInventoryItem(itemId: string) {
  if (!itemId.trim()) throw new Error('Select an inventory item to delete.');
  const database = getDb();
  const modifiedAt = new Date().toISOString();
  const deviceId = getDevice().id;
  const deactivate = database.transaction(() => {
    const item = database.prepare('SELECT id FROM items WHERE id = ? AND active = 1').get(itemId);
    if (!item) throw new Error('The selected inventory item is no longer active.');
    database.prepare('UPDATE items SET active = 0, updated_at = ? WHERE id = ?').run(modifiedAt, itemId);
    updateLocalSyncMetadata('ITEM', itemId, modifiedAt, deviceId);
  });
  deactivate();
}

export function createDepartment(name: string) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Department name is required.');
  const database = getDb();
  const id = crypto.randomUUID();
  const modifiedAt = new Date().toISOString();
  const deviceId = getDevice().id;
  const create = database.transaction(() => {
    const existing = database.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?)').get(cleanName);
    if (existing) throw new Error('This department already exists.');
    database.prepare('INSERT INTO departments (id, name, active) VALUES (?, ?, 1)').run(id, cleanName);
    updateLocalSyncMetadata('DEPARTMENT', id, modifiedAt, deviceId);
  });
  create();
  return { id, name: cleanName };
}

export function createPerson(departmentId: string, name: string) {
  const cleanName = name.trim();
  if (!departmentId) throw new Error('Select a department first.');
  if (!cleanName) throw new Error('Person name is required.');
  const database = getDb();
  const create = database.transaction(() => {
    const department = database.prepare('SELECT id FROM departments WHERE id = ? AND active = 1').get(departmentId);
    if (!department) throw new Error('Select an active department.');
    const existing = database.prepare(`
      SELECT id FROM people
      WHERE department_id = ? AND LOWER(name) = LOWER(?)
    `).get(departmentId, cleanName);
    if (existing) throw new Error('This person already exists in this department.');

    const id = crypto.randomUUID();
    const modifiedAt = new Date().toISOString();
    const deviceId = getDevice().id;
    database.prepare('INSERT INTO people (id, department_id, name, active) VALUES (?, ?, ?, 1)')
      .run(id, departmentId, cleanName);
    updateLocalSyncMetadata('PERSON', id, modifiedAt, deviceId);
    return { id, department_id: departmentId, name: cleanName };
  });
  return create();
}

export function deactivateDepartment(departmentId: string) {
  if (!departmentId.trim()) throw new Error('Select a department to deactivate.');
  const database = getDb();
  const modifiedAt = new Date().toISOString();
  const deviceId = getDevice().id;
  const deactivate = database.transaction(() => {
    const department = database.prepare('SELECT id FROM departments WHERE id = ? AND active = 1').get(departmentId);
    if (!department) throw new Error('The selected department is no longer active.');
    const people = database.prepare('SELECT id FROM people WHERE department_id = ? AND active = 1')
      .all(departmentId) as Array<{ id: string }>;
    database.prepare('UPDATE people SET active = 0 WHERE department_id = ? AND active = 1').run(departmentId);
    database.prepare('UPDATE departments SET active = 0 WHERE id = ?').run(departmentId);
    for (const person of people) updateLocalSyncMetadata('PERSON', person.id, modifiedAt, deviceId);
    updateLocalSyncMetadata('DEPARTMENT', departmentId, modifiedAt, deviceId);
  });
  deactivate();
}

export function deactivatePerson(personId: string) {
  if (!personId.trim()) throw new Error('Select a person to deactivate.');
  const database = getDb();
  const modifiedAt = new Date().toISOString();
  const deviceId = getDevice().id;
  const deactivate = database.transaction(() => {
    const person = database.prepare('SELECT id FROM people WHERE id = ? AND active = 1').get(personId);
    if (!person) throw new Error('The selected person is no longer active.');
    database.prepare('UPDATE people SET active = 0 WHERE id = ?').run(personId);
    updateLocalSyncMetadata('PERSON', personId, modifiedAt, deviceId);
  });
  deactivate();
}

export function createInventoryTransactions(input: InventoryTransactionInput): { count: number } {
  if (input.type !== 'ISSUED' && input.type !== 'RECEIVED') {
    throw new Error('Transaction type must be Issue or Receive.');
  }
  if (!input.items.length) throw new Error('Add at least one item to the transaction.');
  if (!input.departmentId.trim()) throw new Error('Department is required.');

  const otherName = input.otherName?.trim() ?? '';
  if (input.personId === null && !otherName) throw new Error('Person name is required.');

  const database = getDb();
  const deviceId = getDevice().id;
  const timestamp = new Date().toISOString();
  const save = database.transaction(() => {
    const department = database.prepare(`
      SELECT id FROM departments WHERE id = ? AND active = 1
    `).get(input.departmentId);
    if (!department) throw new Error('Select an active department.');

    if (input.personId) {
      const person = database.prepare(`
        SELECT id FROM people WHERE id = ? AND department_id = ? AND active = 1
      `).get(input.personId, input.departmentId);
      if (!person) throw new Error('Select an active person from the chosen department.');
    }

    const seenItems = new Set<string>();
    const insert = database.prepare(`
      INSERT INTO transactions (
        id, item_id, transaction_type, quantity, stock_delta, department_id, person_id,
        other_name, other_department_name, remark, timestamp, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `);

    for (const item of input.items) {
      if (!item.itemId || seenItems.has(item.itemId)) {
        throw new Error('Each item may appear only once in a transaction.');
      }
      seenItems.add(item.itemId);
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error('Item quantities must be greater than zero.');
      }

      const current = database.prepare(`
        SELECT i.id, COALESCE(SUM(t.stock_delta), 0) AS stock
        FROM items i
        LEFT JOIN transactions t ON t.item_id = i.id
        WHERE i.id = ? AND i.active = 1
        GROUP BY i.id
      `).get(item.itemId) as { id: string; stock: number } | undefined;
      if (!current) throw new Error('An item in this transaction is no longer active.');
      if (input.type === 'ISSUED' && item.quantity > Number(current.stock)) {
        throw new Error(`Insufficient stock. Available: ${Number(current.stock)}`);
      }

      const stockDelta = input.type === 'ISSUED' ? -item.quantity : item.quantity;
      insert.run(
        crypto.randomUUID(),
        item.itemId,
        input.type,
        item.quantity,
        stockDelta,
        input.departmentId,
        input.personId,
        input.personId ? null : otherName,
        input.remark.trim() || null,
        timestamp,
        deviceId,
      );
    }

    return { count: input.items.length };
  });

  return save();
}

export function createInventoryAudit(input: InventoryAuditInput): InventoryAuditResult {
  if (!input.itemId.trim()) throw new Error('Select an item to audit.');
  if (!Number.isFinite(input.auditedQuantity) || input.auditedQuantity < 0) {
    throw new Error('Audited quantity must be zero or greater.');
  }

  const database = getDb();
  const auditId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const deviceId = getDevice().id;
  const save = database.transaction(() => {
    const item = database.prepare(`
      SELECT i.id, COALESCE(SUM(t.stock_delta), 0) AS system_quantity
      FROM items i
      LEFT JOIN transactions t ON t.item_id = i.id
      WHERE i.id = ? AND i.active = 1
      GROUP BY i.id
    `).get(input.itemId) as { id: string; system_quantity: number } | undefined;
    if (!item) throw new Error('The selected item is no longer active.');

    const systemQuantity = Number(item.system_quantity);
    const variance = input.auditedQuantity - systemQuantity;
    const remark = input.remark.trim();

    database.prepare(`
      INSERT INTO audits (
        id, item_id, system_quantity, audited_quantity, variance, remark, timestamp, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      input.itemId,
      systemQuantity,
      input.auditedQuantity,
      variance,
      remark || null,
      timestamp,
      deviceId,
    );

    const adjusted = input.adjustStock && variance !== 0;
    if (adjusted) {
      database.prepare(`
        INSERT INTO transactions (
          id, item_id, transaction_type, quantity, stock_delta, department_id, person_id,
          other_name, other_department_name, remark, timestamp, device_id
        ) VALUES (?, ?, 'AUDIT_ADJUSTMENT', ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        input.itemId,
        Math.abs(variance),
        variance,
        remark ? `Audit adjustment: ${remark}` : 'Audit stock adjustment',
        timestamp,
        deviceId,
      );
    }

    return {
      auditId,
      systemQuantity,
      auditedQuantity: input.auditedQuantity,
      variance,
      adjusted,
    };
  });

  return save();
}

export function getInventoryAudits(limit = 300): Array<Record<string, unknown>> {
  return getDb().prepare(`
    SELECT
      a.id,
      a.item_id,
      i.stock_id,
      i.item_name,
      i.unit,
      a.system_quantity,
      a.audited_quantity,
      a.variance,
      a.remark,
      a.timestamp,
      a.device_id
    FROM audits a
    LEFT JOIN items i ON i.id = a.item_id
    ORDER BY a.timestamp DESC, a.id DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
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
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const stockStats = database.prepare(`
    WITH stock_summary AS (
      SELECT
        i.id,
        i.minimum_stock,
        COALESCE(SUM(t.stock_delta), 0) AS current_stock
      FROM items i
      LEFT JOIN transactions t ON t.item_id = i.id
      WHERE i.active = 1
      GROUP BY i.id, i.minimum_stock
    )
    SELECT
      COUNT(*) AS total_items,
      SUM(CASE WHEN current_stock > minimum_stock THEN 1 ELSE 0 END) AS in_stock,
      SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock THEN 1 ELSE 0 END) AS low_stock,
      SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
      COALESCE(SUM(current_stock), 0) AS total_stock
    FROM stock_summary
  `).get() as {
    total_items: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
    total_stock: number;
  };
  const transactions = database.prepare(`SELECT COUNT(*) AS count FROM transactions`).get() as { count: number };
  const audits = database.prepare(`SELECT COUNT(*) AS count FROM audits`).get() as { count: number };
  const transactionStats = database.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN transaction_type = 'ISSUED' THEN 1 ELSE 0 END) AS issued,
      SUM(CASE WHEN transaction_type = 'RECEIVED' THEN 1 ELSE 0 END) AS received
    FROM transactions
    WHERE timestamp >= ? AND timestamp < ?
  `).get(startISO, endISO) as { total: number; issued: number | null; received: number | null };
  const auditStats = database.prepare(`
    SELECT COUNT(*) AS total
    FROM audits
    WHERE timestamp >= ? AND timestamp < ?
  `).get(startISO, endISO) as { total: number };
  const departments = database.prepare(`SELECT COUNT(*) AS count FROM departments WHERE active = 1`).get() as { count: number };
  const people = database.prepare(`SELECT COUNT(*) AS count FROM people WHERE active = 1`).get() as { count: number };
  return {
    activeItems: Number(stockStats.total_items ?? 0),
    transactions: Number(transactions.count),
    audits: Number(audits.count),
    departments: Number(departments.count),
    people: Number(people.count),
    totalStock: Number(stockStats.total_stock ?? 0),
    totalItems: Number(stockStats.total_items ?? 0),
    inStock: Number(stockStats.in_stock ?? 0),
    lowStock: Number(stockStats.low_stock ?? 0),
    outOfStock: Number(stockStats.out_of_stock ?? 0),
    transactionsToday: Number(transactionStats.total ?? 0),
    issuedToday: Number(transactionStats.issued ?? 0),
    receivedToday: Number(transactionStats.received ?? 0),
    auditsToday: Number(auditStats.total ?? 0),
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
      ledger.id,
      ledger.item_id,
      i.stock_id,
      i.item_name,
      i.unit,
      ledger.transaction_type,
      ledger.quantity,
      ledger.stock_delta,
      ledger.stock_after,
      ledger.department_id,
      d.name AS department_name,
      ledger.person_id,
      p.name AS person_name,
      ledger.other_name,
      ledger.remark,
      ledger.timestamp,
      ledger.device_id
    FROM (
      SELECT
        t.*,
        SUM(t.stock_delta) OVER (
          PARTITION BY t.item_id
          ORDER BY t.timestamp, t.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS stock_after
      FROM transactions t
    ) ledger
    LEFT JOIN items i ON i.id = ledger.item_id
    LEFT JOIN departments d ON d.id = ledger.department_id
    LEFT JOIN people p ON p.id = ledger.person_id
    ORDER BY ledger.timestamp DESC, ledger.id DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
}
