import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { getDb, getDevice } from './database';
import { applyManualSyncPacket, buildSyncPacket, type SyncEntry, type SyncMeta, type SyncPacket } from './sync';

const REQUIRED_TABLES = ['items', 'departments', 'people', 'transactions', 'audits'];

type SqliteCounts = {
  items: number;
  transactions: number;
  audits: number;
  departments: number;
  people: number;
};

function getStamp() {
  const now = new Date();
  const two = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}_${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
}

function getCounts(database: Database.Database): SqliteCounts {
  return {
    items: Number((database.prepare('SELECT COUNT(*) AS count FROM items').get() as { count: number }).count),
    transactions: Number((database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count),
    audits: Number((database.prepare('SELECT COUNT(*) AS count FROM audits').get() as { count: number }).count),
    departments: Number((database.prepare('SELECT COUNT(*) AS count FROM departments').get() as { count: number }).count),
    people: Number((database.prepare('SELECT COUNT(*) AS count FROM people').get() as { count: number }).count),
  };
}

function inspectDatabase(database: Database.Database): SqliteCounts {
  const integrity = database.pragma('quick_check') as Array<{ quick_check: string }>;
  if (integrity[0]?.quick_check !== 'ok') throw new Error('The selected SQLite database failed its integrity check.');

  const tables = new Set((database.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table'
  `).all() as Array<{ name: string }>).map(row => row.name));
  for (const table of REQUIRED_TABLES) {
    if (!tables.has(table)) throw new Error(`This is not an R58 database. Required table missing: ${table}.`);
  }

  const requiredColumns: Record<string, string[]> = {
    items: ['id', 'stock_id', 'item_name', 'unit', 'minimum_stock', 'qr_code', 'active', 'created_at', 'updated_at'],
    departments: ['id', 'name', 'active'],
    people: ['id', 'department_id', 'name', 'active'],
    transactions: ['id', 'item_id', 'transaction_type', 'quantity', 'stock_delta', 'department_id', 'person_id', 'other_name', 'remark', 'timestamp', 'device_id'],
    audits: ['id', 'item_id', 'system_quantity', 'audited_quantity', 'variance', 'remark', 'timestamp', 'device_id'],
  };
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const existing = new Set((database.pragma(`table_info(${table})`) as Array<{ name: string }>).map(column => column.name));
    for (const column of columns) {
      if (!existing.has(column)) throw new Error(`This is not a compatible R58 database. Missing column: ${table}.${column}.`);
    }
  }

  return getCounts(database);
}

export async function inspectSqliteFile(filePath: string) {
  const database = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    return inspectDatabase(database);
  } finally {
    database.close();
  }
}

export async function createDatabaseBackup(filePath: string) {
  const database = getDb();
  await database.backup(filePath);
  const stat = await fs.stat(filePath);
  return { filePath, fileName: path.basename(filePath), sizeBytes: stat.size, createdAt: new Date().toISOString() };
}

function readTable(database: Database.Database, table: string, columns: string[]) {
  const tableExists = database.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?
  `).get(table);
  if (!tableExists) return [];
  const existing = new Set((database.pragma(`table_info(${table})`) as Array<{ name: string }>).map(column => column.name));
  const selected = columns.filter(column => existing.has(column));
  return database.prepare(`SELECT ${selected.map(column => `"${column}"`).join(', ')} FROM "${table}"`).all() as Array<Record<string, unknown>>;
}

function normaliseSyncTime(value: unknown) {
  if (!value) return 0;
  let clean = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:/.test(clean)) clean = clean.replace(' ', 'T') + 'Z';
  const timestamp = new Date(clean).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function deduplicateSyncRecords(rows: Array<Record<string, unknown>>) {
  const unique = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = JSON.stringify([row.entity_type, row.entity_id]);
    const existing = unique.get(key);
    const incomingRevision = Number(row.revision ?? 1);
    const existingRevision = Number(existing?.revision ?? 1);
    const incomingTime = normaliseSyncTime(row.modified_at);
    const existingTime = normaliseSyncTime(existing?.modified_at);
    if (
      !existing ||
      incomingRevision > existingRevision ||
      (incomingRevision === existingRevision && (
        incomingTime > existingTime ||
        (incomingTime === existingTime && String(row.modified_by_device ?? '') > String(existing.modified_by_device ?? ''))
      ))
    ) {
      unique.set(key, row);
    }
  }
  return [...unique.values()];
}

function rowsToEntries(
  database: Database.Database,
  table: string,
  entityType: SyncMeta['entityType'],
  columns: string[],
  fallbackModifiedAt: (row: Record<string, unknown>) => string,
  fallbackDeviceId: string,
): SyncEntry<Record<string, unknown>>[] {
  const records = readTable(database, table, columns);
  const metadataTableExists = (database.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sync_records'
  `).get() as object | undefined) !== undefined;
  const metadata = metadataTableExists
    ? database.prepare('SELECT revision, modified_at, modified_by_device, deleted FROM sync_records WHERE entity_type = ? AND entity_id = ?')
    : null;

  return records.map(data => {
    const entityId = String(data.id);
    const sync = metadata?.get(entityType, entityId) as {
      revision: number;
      modified_at: string;
      modified_by_device: string;
      deleted: number;
    } | undefined;
    return {
      data,
      sync: {
        entityType,
        entityId,
        revision: Number(sync?.revision ?? 1),
        modifiedAt: String(sync?.modified_at ?? fallbackModifiedAt(data)),
        modifiedByDevice: String(sync?.modified_by_device ?? fallbackDeviceId),
        deleted: Number(sync?.deleted ?? 0),
      },
    };
  });
}

function readPacketFromSqlite(database: Database.Database): SyncPacket {
  const hasLocalDevice = (database.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'local_device'
  `).get() as object | undefined) !== undefined;
  const deviceRow = hasLocalDevice
    ? (database.prepare('SELECT * FROM local_device WHERE id = 1').get() as Record<string, unknown> | undefined) ?? {}
    : {};
  const sourceId = String(deviceRow.device_id ?? crypto.randomUUID());
  const sourceName = String(deviceRow.device_name ?? 'Imported R58 database');
  const modifiedAt = (row: Record<string, unknown>) => String(row.updated_at ?? row.created_at ?? row.timestamp ?? new Date(0).toISOString());
  return {
    format: 'R58_SYNC_PACKET',
    version: 1,
    packetId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    sourceDevice: { id: sourceId, name: sourceName },
    records: {
      departments: rowsToEntries(database, 'departments', 'DEPARTMENT', ['id', 'name', 'active'], modifiedAt, sourceId),
      people: rowsToEntries(database, 'people', 'PERSON', ['id', 'department_id', 'name', 'active'], modifiedAt, sourceId),
      items: rowsToEntries(database, 'items', 'ITEM', ['id', 'stock_id', 'old_item_id', 'item_name', 'unit', 'minimum_stock', 'qr_code', 'active', 'created_at', 'updated_at'], modifiedAt, sourceId),
      transactions: rowsToEntries(database, 'transactions', 'TRANSACTION', ['id', 'item_id', 'transaction_type', 'quantity', 'stock_delta', 'department_id', 'person_id', 'other_name', 'other_department_name', 'remark', 'timestamp', 'device_id'], modifiedAt, sourceId),
      audits: rowsToEntries(database, 'audits', 'AUDIT', ['id', 'item_id', 'system_quantity', 'audited_quantity', 'variance', 'remark', 'timestamp', 'device_id'], modifiedAt, sourceId),
    },
  };
}

export async function mergeSqliteFile(filePath: string) {
  const source = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const counts = inspectDatabase(source);
    const packet = readPacketFromSqlite(source);
    const result = await applyManualSyncPacket(packet);
    return { counts, result };
  } finally {
    source.close();
  }
}

export async function restoreSqliteFile(filePath: string, recoveryPath: string) {
  const source = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const counts = inspectDatabase(source);
    const sourceRecords = {
      departments: readTable(source, 'departments', ['id', 'name', 'active']),
      people: readTable(source, 'people', ['id', 'department_id', 'name', 'active']),
      items: readTable(source, 'items', ['id', 'stock_id', 'old_item_id', 'item_name', 'unit', 'minimum_stock', 'qr_code', 'active', 'created_at', 'updated_at']),
      transactions: readTable(source, 'transactions', ['id', 'item_id', 'transaction_type', 'quantity', 'stock_delta', 'department_id', 'person_id', 'other_name', 'other_department_name', 'remark', 'timestamp', 'device_id']),
      audits: readTable(source, 'audits', ['id', 'item_id', 'system_quantity', 'audited_quantity', 'variance', 'remark', 'timestamp', 'device_id']),
      syncRecords: deduplicateSyncRecords(readTable(source, 'sync_records', ['entity_type', 'entity_id', 'revision', 'modified_at', 'modified_by_device', 'deleted'])),
    };

    const database = getDb();
    await database.backup(recoveryPath);
    const restore = database.transaction(() => {
      database.prepare('DELETE FROM audits').run();
      database.prepare('DELETE FROM transactions').run();
      database.prepare('DELETE FROM people').run();
      database.prepare('DELETE FROM departments').run();
      database.prepare('DELETE FROM items').run();
      database.prepare('DELETE FROM sync_records').run();

      const insertRows = (table: string, columns: string[], rows: Array<Record<string, unknown>>) => {
        const sql = `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        const insert = database.prepare(sql);
        for (const row of rows) insert.run(...columns.map(column => row[column] ?? null));
      };
      const upsertSyncRecords = (rows: Array<Record<string, unknown>>) => {
        const upsert = database.prepare(`
          INSERT INTO sync_records (entity_type, entity_id, revision, modified_at, modified_by_device, deleted)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(entity_type, entity_id) DO UPDATE SET
            revision = excluded.revision,
            modified_at = excluded.modified_at,
            modified_by_device = excluded.modified_by_device,
            deleted = excluded.deleted
        `);
        for (const row of rows) {
          upsert.run(row.entity_type, row.entity_id, row.revision, row.modified_at, row.modified_by_device, row.deleted);
        }
      };
      insertRows('departments', ['id', 'name', 'active'], sourceRecords.departments);
      insertRows('people', ['id', 'department_id', 'name', 'active'], sourceRecords.people);
      insertRows('items', ['id', 'stock_id', 'old_item_id', 'item_name', 'unit', 'minimum_stock', 'qr_code', 'active', 'created_at', 'updated_at'], sourceRecords.items);
      insertRows('transactions', ['id', 'item_id', 'transaction_type', 'quantity', 'stock_delta', 'department_id', 'person_id', 'other_name', 'other_department_name', 'remark', 'timestamp', 'device_id'], sourceRecords.transactions);
      insertRows('audits', ['id', 'item_id', 'system_quantity', 'audited_quantity', 'variance', 'remark', 'timestamp', 'device_id'], sourceRecords.audits);

      if (sourceRecords.syncRecords.length) {
        upsertSyncRecords(sourceRecords.syncRecords);
      } else {
        const localDeviceId = getDevice().id;
        const now = new Date().toISOString();
        const entityTables: Array<[string, string]> = [
          ['items', 'ITEM'], ['departments', 'DEPARTMENT'], ['people', 'PERSON'],
          ['transactions', 'TRANSACTION'], ['audits', 'AUDIT'],
        ];
        const insertMeta = database.prepare(`
          INSERT INTO sync_records (entity_type, entity_id, revision, modified_at, modified_by_device, deleted)
          VALUES (?, ?, 1, ?, ?, 0)
          ON CONFLICT(entity_type, entity_id) DO UPDATE SET
            revision = excluded.revision,
            modified_at = excluded.modified_at,
            modified_by_device = excluded.modified_by_device,
            deleted = excluded.deleted
        `);
        for (const [table, type] of entityTables) {
          const rows = database.prepare(`SELECT id FROM "${table}"`).all() as Array<{ id: string }>;
          for (const row of rows) insertMeta.run(type, row.id, now, localDeviceId);
        }
      }
    });
    restore();
    return { counts, recoveryPath, recoveryFileName: path.basename(recoveryPath) };
  } finally {
    source.close();
  }
}

function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]!);
}

function excelColumn(index: number) {
  let value = index + 1;
  let column = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function worksheetXml(rows: Array<Record<string, unknown>>, headers: string[]) {
  const sheetRows = [headers, ...rows.map(row => headers.map(header => row[header]))];
  const rowXml = sheetRows.map((row, rowIndex) => {
    const cells = row.map((raw, columnIndex) => {
      const reference = `${excelColumn(columnIndex)}${rowIndex + 1}`;
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return `<c r="${reference}" t="n"><v>${raw}</v></c>`;
      }
      const text = raw === null || raw === undefined ? '' : String(raw);
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

export async function exportExcel(filePath: string) {
  const database = getDb();
  const inventory = database.prepare(`
    SELECT
      i.stock_id AS "Stock ID",
      COALESCE(i.old_item_id, '') AS "Item ID",
      i.item_name AS "Item Name",
      i.unit AS "Unit",
      COALESCE(SUM(t.stock_delta), 0) AS "Current Quantity",
      i.minimum_stock AS "Minimum Stock",
      CASE
        WHEN COALESCE(SUM(t.stock_delta), 0) <= 0 THEN 'Out of Stock'
        WHEN COALESCE(SUM(t.stock_delta), 0) <= i.minimum_stock THEN 'Low Stock'
        ELSE 'In Stock'
      END AS "Stock Status",
      COALESCE(last_audit.timestamp, 'Not Audited') AS "Last Audit Date",
      COALESCE(last_audit.system_quantity, '') AS "Stock at Audit",
      COALESCE(last_audit.audited_quantity, '') AS "Last Audited Quantity",
      COALESCE(last_audit.variance, '') AS "Audit Variance",
      COALESCE(last_audit.remark, '') AS "Audit Remark"
    FROM items i
    LEFT JOIN transactions t ON t.item_id = i.id
    LEFT JOIN audits last_audit ON last_audit.id = (
      SELECT a.id FROM audits a WHERE a.item_id = i.id ORDER BY a.timestamp DESC, a.id DESC LIMIT 1
    )
    WHERE i.active = 1
    GROUP BY i.id
    ORDER BY i.item_name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;
  const transactions = database.prepare(`
    WITH history AS (
      SELECT
        t.id AS "Record ID",
        t.timestamp AS "Date & Time",
        i.stock_id AS "Stock ID",
        COALESCE(i.old_item_id, '') AS "Item ID",
        i.item_name AS "Item Name",
        i.unit AS "Unit",
        t.transaction_type AS "Transaction Type",
        t.quantity AS "Quantity",
        t.stock_delta AS "Stock Change",
        SUM(t.stock_delta) OVER (PARTITION BY t.item_id ORDER BY t.timestamp, t.id ROWS UNBOUNDED PRECEDING) AS "Stock After",
        d.name AS "Department",
        COALESCE(p.name, '') AS "Person Name",
        COALESCE(t.other_name, '') AS "Other Name",
        COALESCE(t.remark, '') AS "Remark",
        t.device_id AS "Device"
      FROM transactions t
      LEFT JOIN items i ON i.id = t.item_id
      LEFT JOIN departments d ON d.id = t.department_id
      LEFT JOIN people p ON p.id = t.person_id
    )
    SELECT *, "Stock After" - "Stock Change" AS "Stock Before"
    FROM history
    ORDER BY "Date & Time" DESC, "Record ID" DESC
  `).all() as Array<Record<string, unknown>>;
  const audits = database.prepare(`
    SELECT
      a.id AS "Audit ID",
      a.timestamp AS "Date & Time",
      i.stock_id AS "Stock ID",
      i.item_name AS "Item Name",
      i.unit AS "Unit",
      a.system_quantity AS "System Quantity",
      a.audited_quantity AS "Physical Quantity",
      a.variance AS "Variance",
      COALESCE(a.remark, '') AS "Remark",
      a.device_id AS "Device"
    FROM audits a LEFT JOIN items i ON i.id = a.item_id
    ORDER BY a.timestamp DESC, a.id DESC
  `).all() as Array<Record<string, unknown>>;

  const sheets = [
    {
      name: 'Inventory',
      rows: inventory,
      headers: ['Stock ID', 'Item ID', 'Item Name', 'Unit', 'Current Quantity', 'Minimum Stock', 'Stock Status', 'Last Audit Date', 'Stock at Audit', 'Last Audited Quantity', 'Audit Variance', 'Audit Remark'],
    },
    {
      name: 'Transactions',
      rows: transactions,
      headers: ['Record ID', 'Date & Time', 'Stock ID', 'Item ID', 'Item Name', 'Unit', 'Transaction Type', 'Quantity', 'Stock Change', 'Stock After', 'Department', 'Person Name', 'Other Name', 'Remark', 'Device', 'Stock Before'],
    },
    {
      name: 'Audits',
      rows: audits,
      headers: ['Audit ID', 'Date & Time', 'Stock ID', 'Item Name', 'Unit', 'System Quantity', 'Physical Quantity', 'Variance', 'Remark', 'Device'],
    },
  ];
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`,
    ),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet.rows, sheet.headers));
  });
  await fs.writeFile(filePath, zipSync(files, { level: 6 }));
  return { filePath, counts: { inventory: inventory.length, transactions: transactions.length, audits: audits.length } };
}

export async function writeManualPacket(filePath: string) {
  const packet = buildSyncPacket();
  await fs.writeFile(filePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  return {
    filePath,
    counts: {
      items: packet.records.items.length,
      departments: packet.records.departments.length,
      people: packet.records.people.length,
      transactions: packet.records.transactions.length,
      audits: packet.records.audits.length,
    },
  };
}

export async function readManualPacket(filePath: string) {
  let packet: unknown;
  try {
    packet = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('The selected file is not valid JSON.');
    throw error;
  }
  const result = await applyManualSyncPacket(packet);
  return { fileName: path.basename(filePath), ...result };
}
