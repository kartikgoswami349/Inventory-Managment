import * as SQLite from 'expo-sqlite';

import {
    CREATE_TABLES_SQL,
} from './schema';

let database:
  SQLite.SQLiteDatabase | null =
  null;

let openingDatabase:
  Promise<SQLite.SQLiteDatabase> | null =
  null;

async function openR58Database() {
  console.log(
    'Opening R58 database...'
  );

  /*
    IMPORTANT:

    useNewConnection prevents Expo Go
    from giving us a stale native SQLite
    connection after Fast Refresh /
    runtime reloads on Android.
  */
  const db =
    await SQLite.openDatabaseAsync(
      'r58_inventory.db',
      {
        useNewConnection: true,
      }
    );

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  await db.execAsync(
    CREATE_TABLES_SQL
  );

  /*
    Migration:
    Other Department field.

    This may already exist, so the
    duplicate-column error is ignored.
  */
  try {
    await db.execAsync(`
      ALTER TABLE transactions
      ADD COLUMN
      other_department_name TEXT;
    `);
  } catch {
    // Column already exists.
  }

  for (const statement of [
    `ALTER TABLE transactions ADD COLUMN area_id TEXT REFERENCES areas(id);`,
    `CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT UNIQUE NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_area ON transactions(area_id);`,
  ]) {
    try {
      await db.execAsync(statement);
    } catch {
      // Additive migration already applied.
    }
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('area_required', '0')`
  );

  /*
    Simple connection test.
  */
  await db.getFirstAsync(
    'SELECT 1 AS ok'
  );

  console.log(
    'R58 database ready'
  );

  return db;
}

export async function getDatabase():
  Promise<SQLite.SQLiteDatabase> {

  if (database) {
    return database;
  }

  /*
    Prevent two screens from opening
    two connections at the same time.
  */
  if (openingDatabase) {
    return openingDatabase;
  }

  openingDatabase =
    openR58Database();

  try {
    database =
      await openingDatabase;

    return database;
  } finally {
    openingDatabase = null;
  }
}