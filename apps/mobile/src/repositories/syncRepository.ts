import {
    getDatabase,
} from '../database/database';

import {
    getDeviceId,
} from '../services/deviceService';


export interface SyncStats {
  items: number;
  departments: number;
  people: number;
  transactions: number;
  audits: number;

  total: number;
}


export async function bootstrapSyncIndex():
  Promise<SyncStats> {

  const db =
    await getDatabase();

  const deviceId =
    await getDeviceId();

  const now =
    new Date().toISOString();


  await db.withTransactionAsync(
    async () => {

      /*
        Existing Items
      */

      await db.runAsync(
        `
        INSERT OR IGNORE INTO
        sync_records (
          entity_type,
          entity_id,
          revision,
          modified_at,
          modified_by_device,
          deleted
        )

        SELECT
          'ITEM',
          id,
          1,

          COALESCE(
            updated_at,
            created_at,
            ?
          ),

          ?,
          0

        FROM items
        `,
        now,
        deviceId
      );


      /*
        Existing Departments
      */

      await db.runAsync(
        `
        INSERT OR IGNORE INTO
        sync_records (
          entity_type,
          entity_id,
          revision,
          modified_at,
          modified_by_device,
          deleted
        )

        SELECT
          'DEPARTMENT',
          id,
          1,
          ?,
          ?,
          0

        FROM departments
        `,
        now,
        deviceId
      );


      /*
        Existing People
      */

      await db.runAsync(
        `
        INSERT OR IGNORE INTO
        sync_records (
          entity_type,
          entity_id,
          revision,
          modified_at,
          modified_by_device,
          deleted
        )

        SELECT
          'PERSON',
          id,
          1,
          ?,
          ?,
          0

        FROM people
        `,
        now,
        deviceId
      );


      /*
        Existing Transactions
      */

      await db.runAsync(
        `
        INSERT OR IGNORE INTO
        sync_records (
          entity_type,
          entity_id,
          revision,
          modified_at,
          modified_by_device,
          deleted
        )

        SELECT
          'TRANSACTION',
          id,
          1,

          COALESCE(
            timestamp,
            ?
          ),

          COALESCE(
            device_id,
            ?
          ),

          0

        FROM transactions
        `,
        now,
        deviceId
      );


      /*
        Existing Audits
      */

      await db.runAsync(
        `
        INSERT OR IGNORE INTO
        sync_records (
          entity_type,
          entity_id,
          revision,
          modified_at,
          modified_by_device,
          deleted
        )

        SELECT
          'AUDIT',
          id,
          1,

          COALESCE(
            timestamp,
            ?
          ),

          COALESCE(
            device_id,
            ?
          ),

          0

        FROM audits
        `,
        now,
        deviceId
      );
    }
  );


  return getSyncStats();
}


export async function getSyncStats():
  Promise<SyncStats> {

  const db =
    await getDatabase();

  const rows =
    await db.getAllAsync<{
      entity_type: string;
      total: number;
    }>(`
      SELECT
        entity_type,
        COUNT(*) AS total

      FROM sync_records

      WHERE deleted = 0

      GROUP BY entity_type
    `);


  const stats: SyncStats = {
    items: 0,
    departments: 0,
    people: 0,
    transactions: 0,
    audits: 0,
    total: 0,
  };


  for (const row of rows) {
    const total =
      Number(row.total);


    switch (
      row.entity_type
    ) {
      case 'ITEM':
        stats.items =
          total;
        break;

      case 'DEPARTMENT':
        stats.departments =
          total;
        break;

      case 'PERSON':
        stats.people =
          total;
        break;

      case 'TRANSACTION':
        stats.transactions =
          total;
        break;

      case 'AUDIT':
        stats.audits =
          total;
        break;
    }


    stats.total += total;
  }


  return stats;
}