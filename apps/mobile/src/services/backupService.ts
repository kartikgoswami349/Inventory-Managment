import * as SQLite from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

import {
    Directory,
    File,
    Paths,
} from 'expo-file-system';

import * as Sharing from 'expo-sharing';


import { getDatabase } from '../database/database';

const LAST_BACKUP_KEY =
  'r58_last_backup';

const LAST_RESTORE_KEY =
  'r58_last_restore';

type ItemRow = {
  id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;
  minimum_stock: number;
  qr_code: string;
  active: number;
  created_at: string;
  updated_at: string;
};

type DepartmentRow = {
  id: string;
  name: string;
  active: number;
};

type PersonRow = {
  id: string;
  department_id: string | null;
  name: string;
  active: number;
};

type TransactionRow = {
  id: string;
  item_id: string;
  transaction_type: string;
  quantity: number;
  stock_delta: number;
  department_id: string | null;
  person_id: string | null;
  other_name: string | null;
  remark: string | null;
  timestamp: string;
  device_id: string;
};

type AuditRow = {
  id: string;
  item_id: string;
  system_quantity: number;
  audited_quantity: number;
  variance: number;
  remark: string | null;
  timestamp: string;
  device_id: string;
};

export interface BackupCounts {
  items: number;
  transactions: number;
  audits: number;
  departments: number;
  people: number;
}

export interface BackupInfo {
  uri: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

function getFileStamp() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      now.getDate()
    ).padStart(2, '0');

  const hour =
    String(
      now.getHours()
    ).padStart(2, '0');

  const minute =
    String(
      now.getMinutes()
    ).padStart(2, '0');

  const second =
    String(
      now.getSeconds()
    ).padStart(2, '0');

  return (
    `${year}${month}${day}_` +
    `${hour}${minute}${second}`
  );
}

function getBackupDirectory() {
  const directory =
    new Directory(
      Paths.document,
      'R58Backups'
    );

  if (!directory.exists) {
    directory.create({
      intermediates: true,
      idempotent: true,
    });
  }

  return directory;
}

async function writeSnapshot(
  prefix: string
): Promise<BackupInfo> {
  const db =
    await getDatabase();

  // Push WAL changes into the database
  // before generating the snapshot.
  let bytes: Uint8Array;

try {
  // Move all committed WAL changes
  // into the main database first.
  await db.execAsync(
    'PRAGMA wal_checkpoint(FULL);'
  );

  /*
    Temporarily change the database
    to normal rollback-journal mode.

    This produces a portable backup
    that can later be deserialized
    without WAL problems.
  */
  await db.getFirstAsync(
    'PRAGMA journal_mode=DELETE;'
  );

  bytes =
    await db.serializeAsync();

} finally {
  /*
    R58 normally uses WAL mode for
    day-to-day operation, so turn it
    back on after the snapshot.
  */
  await db.getFirstAsync(
    'PRAGMA journal_mode=WAL;'
  );
}

  const createdAt =
    new Date().toISOString();

  const fileName =
    `${prefix}_${getFileStamp()}.db`;

  const directory =
    getBackupDirectory();

  const file =
    new File(
      directory,
      fileName
    );

  file.create({
    overwrite: true,
    intermediates: true,
  });

  file.write(bytes);

  return {
    uri: file.uri,
    fileName,
    sizeBytes: bytes.length,
    createdAt,
  };
}

export async function createDatabaseBackup() {
  const backup =
    await writeSnapshot(
      'R58_Backup'
    );

  await Storage.setItem(
    LAST_BACKUP_KEY,
    backup.createdAt
  );

  if (
    await Sharing.isAvailableAsync()
  ) {
    await Sharing.shareAsync(
      backup.uri,
      {
        mimeType:
          'application/octet-stream',

        dialogTitle:
          'Save R58 Inventory Backup',
      }
    );
  }

  return backup;
}

export async function pickBackupFile() {
  const result =
    await File.pickFileAsync({
      multipleFiles: false,
      mimeTypes: '*/*',
    });

  if (result.canceled) {
    return null;
  }

  const selectedFile =
    result.result;

  const originalName =
    selectedFile.name ||
    'R58_Backup.db';

  /*
    IMPORTANT:
    Android may return a content:// URI.

    We immediately copy the selected
    file into R58's own cache directory.

    After that, R58 has normal READ
    access and restore does not depend
    on Android's temporary permission.
  */

  const localFile =
    new File(
      Paths.cache,
      `R58_Restore_${Date.now()}.db`
    );

  await selectedFile.copy(
    localFile,
    {
      overwrite: true,
    }
  );

  return {
    uri: localFile.uri,
    name: originalName,
  };
}

async function openBackupDatabase(
  uri: string
) {
  const file =
    new File(uri);

  const originalBytes =
    await file.bytes();

  /*
    SQLite deserialize cannot directly use
    a database image that is marked as WAL.

    Byte positions 18 and 19 in the SQLite
    database header store the read/write
    format versions.

    Setting them to 1 changes the serialized
    image to rollback-journal format so the
    in-memory database can be opened.
  */

  const bytes =
    new Uint8Array(originalBytes);

  if (bytes.length < 100) {
    throw new Error(
      'Backup file is too small to be a valid SQLite database.'
    );
  }

  const sqliteHeader =
    String.fromCharCode(
      ...bytes.slice(0, 15)
    );

  if (
    sqliteHeader !==
    'SQLite format 3'
  ) {
    throw new Error(
      'This is not a valid R58 SQLite backup.'
    );
  }

  bytes[18] = 1;
  bytes[19] = 1;

  const backupDb =
    await SQLite.deserializeDatabaseAsync(
      bytes
    );

  return backupDb;
}

async function validateBackup(
  backupDb: SQLite.SQLiteDatabase
) {
  const integrity =
    await backupDb.getFirstAsync<{
      quick_check: string;
    }>(
      'PRAGMA quick_check;'
    );

  if (
    !integrity ||
    integrity.quick_check !== 'ok'
  ) {
    throw new Error(
      'The selected backup database is damaged.'
    );
  }

  const requiredTables = [
    'items',
    'departments',
    'people',
    'transactions',
    'audits',
  ];

  const tables =
    await backupDb.getAllAsync<{
      name: string;
    }>(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table';
    `);

  const existing =
    new Set(
      tables.map(
        row => row.name
      )
    );

  for (
    const table
    of requiredTables
  ) {
    if (
      !existing.has(table)
    ) {
      throw new Error(
        `Invalid R58 backup. Missing table: ${table}`
      );
    }
  }
}

async function getCounts(
  db: SQLite.SQLiteDatabase
): Promise<BackupCounts> {
  const items =
    await db.getFirstAsync<{
      total: number;
    }>(
      'SELECT COUNT(*) AS total FROM items'
    );

  const transactions =
    await db.getFirstAsync<{
      total: number;
    }>(
      'SELECT COUNT(*) AS total FROM transactions'
    );

  const audits =
    await db.getFirstAsync<{
      total: number;
    }>(
      'SELECT COUNT(*) AS total FROM audits'
    );

  const departments =
    await db.getFirstAsync<{
      total: number;
    }>(
      'SELECT COUNT(*) AS total FROM departments'
    );

  const people =
    await db.getFirstAsync<{
      total: number;
    }>(
      'SELECT COUNT(*) AS total FROM people'
    );

  return {
    items:
      Number(
        items?.total ?? 0
      ),

    transactions:
      Number(
        transactions?.total ?? 0
      ),

    audits:
      Number(
        audits?.total ?? 0
      ),

    departments:
      Number(
        departments?.total ?? 0
      ),

    people:
      Number(
        people?.total ?? 0
      ),
  };
}

export async function inspectBackup(
  uri: string
): Promise<BackupCounts> {
  const backupDb =
    await openBackupDatabase(uri);

  try {
    await validateBackup(
      backupDb
    );

    return await getCounts(
      backupDb
    );
  } finally {
    await backupDb.closeAsync();
  }
}

export async function restoreDatabaseBackup(
  uri: string
) {
  const backupDb =
    await openBackupDatabase(uri);

  try {
    await validateBackup(
      backupDb
    );

    const items =
      await backupDb.getAllAsync<ItemRow>(
        `
        SELECT *
        FROM items
        `
      );

    const departments =
      await backupDb.getAllAsync<DepartmentRow>(
        `
        SELECT *
        FROM departments
        `
      );

    const people =
      await backupDb.getAllAsync<PersonRow>(
        `
        SELECT *
        FROM people
        `
      );

    const transactions =
      await backupDb.getAllAsync<TransactionRow>(
        `
        SELECT *
        FROM transactions
        `
      );

    const audits =
      await backupDb.getAllAsync<AuditRow>(
        `
        SELECT *
        FROM audits
        `
      );

    /*
      IMPORTANT:
      Before replacing anything,
      automatically save the current
      database as a recovery snapshot.
    */

    const recovery =
      await writeSnapshot(
        'R58_PreRestore'
      );

    const db =
      await getDatabase();

    await db.withTransactionAsync(
      async () => {

        /*
          DELETE CHILD TABLES FIRST
        */


          await db.runAsync(
  'DELETE FROM sync_records'
);

await db.runAsync(
  'DELETE FROM sync_peers'
);

        await db.runAsync(
          'DELETE FROM audits'
        );

        await db.runAsync(
          'DELETE FROM transactions'
        );

        await db.runAsync(
          'DELETE FROM people'
        );

        await db.runAsync(
          'DELETE FROM departments'
        );

        await db.runAsync(
          'DELETE FROM items'
        );

        /*
          RESTORE DEPARTMENTS
        */

        for (
          const row
          of departments
        ) {
          await db.runAsync(
            `
            INSERT INTO departments (
              id,
              name,
              active
            )
            VALUES (?, ?, ?)
            `,
            row.id,
            row.name,
            row.active
          );
        }

        /*
          RESTORE PEOPLE
        */

        for (
          const row
          of people
        ) {
          await db.runAsync(
            `
            INSERT INTO people (
              id,
              department_id,
              name,
              active
            )
            VALUES (?, ?, ?, ?)
            `,
            row.id,
            row.department_id,
            row.name,
            row.active
          );
        }

        /*
          RESTORE ITEMS
        */

        for (
          const row
          of items
        ) {
          await db.runAsync(
            `
            INSERT INTO items (
              id,
              stock_id,
              old_item_id,
              item_name,
              unit,
              minimum_stock,
              qr_code,
              active,
              created_at,
              updated_at
            )
            VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?
            )
            `,
            row.id,
            row.stock_id,
            row.old_item_id,
            row.item_name,
            row.unit,
            row.minimum_stock,
            row.qr_code,
            row.active,
            row.created_at,
            row.updated_at
          );
        }

        /*
          RESTORE TRANSACTIONS
        */

        for (
          const row
          of transactions
        ) {
          await db.runAsync(
            `
            INSERT INTO transactions (
              id,
              item_id,
              transaction_type,
              quantity,
              stock_delta,
              department_id,
              person_id,
              other_name,
              remark,
              timestamp,
              device_id
            )
            VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?
            )
            `,
            row.id,
            row.item_id,
            row.transaction_type,
            row.quantity,
            row.stock_delta,
            row.department_id,
            row.person_id,
            row.other_name,
            row.remark,
            row.timestamp,
            row.device_id
          );
        }

        /*
          RESTORE AUDITS
        */

        for (
          const row
          of audits
        ) {
          await db.runAsync(
            `
            INSERT INTO audits (
              id,
              item_id,
              system_quantity,
              audited_quantity,
              variance,
              remark,
              timestamp,
              device_id
            )
            VALUES (
              ?, ?, ?, ?, ?,
              ?, ?, ?
            )
            `,
            row.id,
            row.item_id,
            row.system_quantity,
            row.audited_quantity,
            row.variance,
            row.remark,
            row.timestamp,
            row.device_id
          );
        }
      }
    );

    const restoredAt =
      new Date().toISOString();

    await Storage.setItem(
      LAST_RESTORE_KEY,
      restoredAt
    );

    return {
      counts: {
        items:
          items.length,

        transactions:
          transactions.length,

        audits:
          audits.length,

        departments:
          departments.length,

        people:
          people.length,
      },

      recoveryFileName:
        recovery.fileName,
    };
  } finally {
    await backupDb.closeAsync();
  }
}

export async function getBackupMetadata() {
  const lastBackup =
    await Storage.getItem(
      LAST_BACKUP_KEY
    );

  const lastRestore =
    await Storage.getItem(
      LAST_RESTORE_KEY
    );

  return {
    lastBackup,
    lastRestore,
  };
}