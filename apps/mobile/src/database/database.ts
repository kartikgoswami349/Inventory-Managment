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