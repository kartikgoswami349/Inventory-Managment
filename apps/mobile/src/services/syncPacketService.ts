import * as Crypto from 'expo-crypto';

import {
    File,
    Paths,
} from 'expo-file-system';

import * as Sharing from 'expo-sharing';

import {
    getDatabase,
} from '../database/database';

import {
    getDeviceId,
    getR58Device,
} from './deviceService';

import {
    bootstrapSyncIndex,
} from '../repositories/syncRepository';


type EntityType =
  | 'ITEM'
  | 'DEPARTMENT'
  | 'PERSON'
  | 'TRANSACTION'
  | 'AUDIT';


interface SyncMeta {
  entityType: EntityType;
  entityId: string;

  revision: number;

  modifiedAt: string;
  modifiedByDevice: string;

  deleted: number;
}


interface SyncEntry<T> {
  data: T;
  sync: SyncMeta;
}


interface ItemRow {
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
}


interface DepartmentRow {
  id: string;
  name: string;
  active: number;
}


interface PersonRow {
  id: string;
  department_id: string | null;
  name: string;
  active: number;
}


interface TransactionRow {
  id: string;
  item_id: string;
  transaction_type: string;

  quantity: number;
  stock_delta: number;

  department_id: string | null;
  person_id: string | null;

  other_name: string | null;
  other_department_name:
    string | null;

  remark: string | null;

  timestamp: string;
  device_id: string;
}


interface AuditRow {
  id: string;
  item_id: string;

  system_quantity: number;
  audited_quantity: number;
  variance: number;

  remark: string | null;

  timestamp: string;
  device_id: string;
}


export interface SyncPacket {
  format: 'R58_SYNC_PACKET';

  version: 1;

  packetId: string;

  generatedAt: string;

  sourceDevice: {
    id: string;
    name: string;
  };

  records: {
    items:
      SyncEntry<ItemRow>[];

    departments:
      SyncEntry<DepartmentRow>[];

    people:
      SyncEntry<PersonRow>[];

    transactions:
      SyncEntry<TransactionRow>[];

    audits:
      SyncEntry<AuditRow>[];
  };
}


export interface SyncPacketResult {
  items: number;
  departments: number;
  people: number;
  transactions: number;
  audits: number;

  total: number;
}


export interface SyncImportResult {
  applied: number;
  skipped: number;

  items: number;
  departments: number;
  people: number;
  transactions: number;
  audits: number;

  sourceDeviceName: string;
  sourceDeviceId: string;
}


function getFileStamp() {
  const now =
    new Date();

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


async function getEntries<T>(
  tableName: string,
  entityType: EntityType
): Promise<SyncEntry<T>[]> {

  const db =
    await getDatabase();

  /*
    tableName comes only from this
    service's internal constants.
  */

  const rows =
    await db.getAllAsync<any>(
      `
      SELECT
        x.*,

        s.revision
          AS __revision,

        s.modified_at
          AS __modified_at,

        s.modified_by_device
          AS __modified_by_device,

        s.deleted
          AS __deleted

      FROM ${tableName} x

      JOIN sync_records s
        ON s.entity_id = x.id
       AND s.entity_type = ?

      ORDER BY x.id
      `,
      entityType
    );


  return rows.map(
    row => {

      const {
        __revision,
        __modified_at,
        __modified_by_device,
        __deleted,
        ...data
      } = row;


      return {
        data: data as T,

        sync: {
          entityType,

          entityId:
            String(data.id),

          revision:
            Number(__revision),

          modifiedAt:
            String(
              __modified_at
            ),

          modifiedByDevice:
            String(
              __modified_by_device
            ),

          deleted:
            Number(
              __deleted
            ),
        },
      };
    }
  );
}

export async function buildSyncPacketData():
  Promise<SyncPacket> {

  await bootstrapSyncIndex();

  const device =
    await getR58Device();

  const [
    items,
    departments,
    people,
    transactions,
    audits,
  ] = await Promise.all([
    getEntries<ItemRow>(
      'items',
      'ITEM'
    ),

    getEntries<DepartmentRow>(
      'departments',
      'DEPARTMENT'
    ),

    getEntries<PersonRow>(
      'people',
      'PERSON'
    ),

    getEntries<TransactionRow>(
      'transactions',
      'TRANSACTION'
    ),

    getEntries<AuditRow>(
      'audits',
      'AUDIT'
    ),
  ]);

  return {
    format:
      'R58_SYNC_PACKET',

    version: 1,

    packetId:
      Crypto.randomUUID(),

    generatedAt:
      new Date().toISOString(),

    sourceDevice: {
      id: device.id,
      name: device.name,
    },

    records: {
      items,
      departments,
      people,
      transactions,
      audits,
    },
  };
}



export async function createSyncPacket():
  Promise<{
    fileName: string;
    uri: string;
    counts: SyncPacketResult;
  }> {

  /*
    Make sure old records also have
    sync metadata before exporting.
  */

  await bootstrapSyncIndex();


  const device =
    await getR58Device();


  const [
    items,
    departments,
    people,
    transactions,
    audits,
  ] = await Promise.all([

    getEntries<ItemRow>(
      'items',
      'ITEM'
    ),

    getEntries<DepartmentRow>(
      'departments',
      'DEPARTMENT'
    ),

    getEntries<PersonRow>(
      'people',
      'PERSON'
    ),

    getEntries<TransactionRow>(
      'transactions',
      'TRANSACTION'
    ),

    getEntries<AuditRow>(
      'audits',
      'AUDIT'
    ),
  ]);


  const packet: SyncPacket = {
    format:
      'R58_SYNC_PACKET',

    version: 1,

    packetId:
      Crypto.randomUUID(),

    generatedAt:
      new Date().toISOString(),

    sourceDevice: {
      id: device.id,
      name: device.name,
    },

    records: {
      items,
      departments,
      people,
      transactions,
      audits,
    },
  };


  const counts: SyncPacketResult = {
    items:
      items.length,

    departments:
      departments.length,

    people:
      people.length,

    transactions:
      transactions.length,

    audits:
      audits.length,

    total:
      items.length +
      departments.length +
      people.length +
      transactions.length +
      audits.length,
  };


  const fileName =
    `R58_Sync_${getFileStamp()}.json`;


  const file =
    new File(
      Paths.cache,
      fileName
    );


  file.create({
    overwrite: true,
    intermediates: true,
  });


  file.write(
    JSON.stringify(
      packet,
      null,
      2
    )
  );


  return {
    fileName,
    uri: file.uri,
    counts,
  };
}


export async function exportSyncPacket() {

  const result =
    await createSyncPacket();


  if (
    await Sharing.isAvailableAsync()
  ) {
    await Sharing.shareAsync(
      result.uri,
      {
        mimeType:
          'application/json',

        dialogTitle:
          'Share R58 Sync Packet',
      }
    );
  }


  return result;
}


function validatePacket(
  data: any
): asserts data is SyncPacket {

  if (
    !data ||
    data.format !==
      'R58_SYNC_PACKET'
  ) {
    throw new Error(
      'This is not an R58 sync packet.'
    );
  }


  if (data.version !== 1) {
    throw new Error(
      `Unsupported sync packet version: ${data.version}`
    );
  }


  if (
    !data.sourceDevice?.id ||
    !data.records
  ) {
    throw new Error(
      'The sync packet is incomplete.'
    );
  }


  const requiredArrays = [
    'items',
    'departments',
    'people',
    'transactions',
    'audits',
  ];


  for (
    const key
    of requiredArrays
  ) {
    if (
      !Array.isArray(
        data.records[key]
      )
    ) {
      throw new Error(
        `Invalid sync packet section: ${key}`
      );
    }
  }
}


function normaliseTime(
  value: string
) {

  if (!value) {
    return 0;
  }


  let clean =
    value.trim();


  /*
    SQLite datetime('now')
    returns:

    YYYY-MM-DD HH:mm:ss

    Convert that to explicit UTC.
  */

  if (
    /^\d{4}-\d{2}-\d{2} \d{2}:/.test(
      clean
    )
  ) {
    clean =
      clean.replace(
        ' ',
        'T'
      ) + 'Z';
  }


  const time =
    new Date(
      clean
    ).getTime();


  return Number.isNaN(time)
    ? 0
    : time;
}


async function shouldApplyMutable(
  entityType: EntityType,
  entityId: string,
  incoming: SyncMeta
) {

  const db =
    await getDatabase();


  const local =
    await db.getFirstAsync<{
      revision: number;
      modified_at: string;
      modified_by_device: string;
    }>(
      `
      SELECT
        revision,
        modified_at,
        modified_by_device

      FROM sync_records

      WHERE entity_type = ?
        AND entity_id = ?
      `,
      entityType,
      entityId
    );


  if (!local) {
    return true;
  }


  const localRevision =
    Number(
      local.revision
    );


  if (
    incoming.revision >
    localRevision
  ) {
    return true;
  }


  if (
    incoming.revision <
    localRevision
  ) {
    return false;
  }


  const incomingTime =
    normaliseTime(
      incoming.modifiedAt
    );


  const localTime =
    normaliseTime(
      local.modified_at
    );


  if (
    incomingTime >
    localTime
  ) {
    return true;
  }


  if (
    incomingTime <
    localTime
  ) {
    return false;
  }


  /*
    Deterministic final tie-breaker.
  */

  return (
    incoming.modifiedByDevice >
    local.modified_by_device
  );
}


async function setTriggerDevice(
  deviceId: string
) {

  const db =
    await getDatabase();


  await db.runAsync(
    `
    INSERT INTO local_device (
      id,
      device_id
    )

    VALUES (
      1,
      ?
    )

    ON CONFLICT(id)

    DO UPDATE SET
      device_id =
        excluded.device_id
    `,
    deviceId
  );
}


async function writeSyncMeta(
  meta: SyncMeta
) {

  const db =
    await getDatabase();


  await db.runAsync(
    `
    INSERT INTO sync_records (
      entity_type,
      entity_id,
      revision,
      modified_at,
      modified_by_device,
      deleted
    )

    VALUES (
      ?, ?, ?, ?, ?, ?
    )

    ON CONFLICT(
      entity_type,
      entity_id
    )

    DO UPDATE SET

      revision =
        excluded.revision,

      modified_at =
        excluded.modified_at,

      modified_by_device =
        excluded.modified_by_device,

      deleted =
        excluded.deleted
    `,
    meta.entityType,
    meta.entityId,
    meta.revision,
    meta.modifiedAt,
    meta.modifiedByDevice,
    meta.deleted
  );
}


async function importMutableRecords(
  packet: SyncPacket,
  localDeviceId: string
) {

  const db =
    await getDatabase();

  let applied = 0;
  let skipped = 0;

  let itemCount = 0;
  let departmentCount = 0;
  let peopleCount = 0;


  /*
    DEPARTMENTS FIRST
  */

  for (
    const entry
    of packet.records.departments
  ) {

    const apply =
      await shouldApplyMutable(
        'DEPARTMENT',
        entry.data.id,
        entry.sync
      );


    if (!apply) {
      skipped += 1;
      continue;
    }


    await setTriggerDevice(
      entry.sync.modifiedByDevice
    );


    await db.runAsync(
      `
      INSERT INTO departments (
        id,
        name,
        active
      )

      VALUES (?, ?, ?)

      ON CONFLICT(id)

      DO UPDATE SET

        name =
          excluded.name,

        active =
          excluded.active
      `,
      entry.data.id,
      entry.data.name,
      entry.data.active
    );


    await writeSyncMeta(
      entry.sync
    );


    applied += 1;
    departmentCount += 1;
  }


  /*
    PEOPLE
  */

  for (
    const entry
    of packet.records.people
  ) {

    const apply =
      await shouldApplyMutable(
        'PERSON',
        entry.data.id,
        entry.sync
      );


    if (!apply) {
      skipped += 1;
      continue;
    }


    await setTriggerDevice(
      entry.sync.modifiedByDevice
    );


    await db.runAsync(
      `
      INSERT INTO people (
        id,
        department_id,
        name,
        active
      )

      VALUES (?, ?, ?, ?)

      ON CONFLICT(id)

      DO UPDATE SET

        department_id =
          excluded.department_id,

        name =
          excluded.name,

        active =
          excluded.active
      `,
      entry.data.id,
      entry.data.department_id,
      entry.data.name,
      entry.data.active
    );


    await writeSyncMeta(
      entry.sync
    );


    applied += 1;
    peopleCount += 1;
  }


  /*
    ITEMS
  */

  for (
    const entry
    of packet.records.items
  ) {

    const apply =
      await shouldApplyMutable(
        'ITEM',
        entry.data.id,
        entry.sync
      );


    if (!apply) {
      skipped += 1;
      continue;
    }


    await setTriggerDevice(
      entry.sync.modifiedByDevice
    );


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

      ON CONFLICT(id)

      DO UPDATE SET

        stock_id =
          excluded.stock_id,

        old_item_id =
          excluded.old_item_id,

        item_name =
          excluded.item_name,

        unit =
          excluded.unit,

        minimum_stock =
          excluded.minimum_stock,

        qr_code =
          excluded.qr_code,

        active =
          excluded.active,

        created_at =
          excluded.created_at,

        updated_at =
          excluded.updated_at
      `,
      entry.data.id,
      entry.data.stock_id,
      entry.data.old_item_id,
      entry.data.item_name,
      entry.data.unit,
      entry.data.minimum_stock,
      entry.data.qr_code,
      entry.data.active,
      entry.data.created_at,
      entry.data.updated_at
    );


    await writeSyncMeta(
      entry.sync
    );


    applied += 1;
    itemCount += 1;
  }


  await setTriggerDevice(
    localDeviceId
  );


  return {
    applied,
    skipped,

    itemCount,
    departmentCount,
    peopleCount,
  };
}


async function importImmutableRecords(
  packet: SyncPacket
) {

  const db =
    await getDatabase();

  let applied = 0;
  let skipped = 0;

  let transactionCount = 0;
  let auditCount = 0;


  /*
    TRANSACTIONS
  */

  for (
    const entry
    of packet.records.transactions
  ) {

    const existing =
      await db.getFirstAsync<{
        id: string;
      }>(
        `
        SELECT id
        FROM transactions
        WHERE id = ?
        `,
        entry.data.id
      );


    if (existing) {
      skipped += 1;
      continue;
    }


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
        other_department_name,

        remark,
        timestamp,
        device_id
      )

      VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
      `,
      entry.data.id,
      entry.data.item_id,
      entry.data.transaction_type,
      entry.data.quantity,
      entry.data.stock_delta,

      entry.data.department_id,
      entry.data.person_id,

      entry.data.other_name,
      entry.data.other_department_name,

      entry.data.remark,
      entry.data.timestamp,
      entry.data.device_id
    );


    await writeSyncMeta(
      entry.sync
    );


    applied += 1;
    transactionCount += 1;
  }


  /*
    AUDITS
  */

  for (
    const entry
    of packet.records.audits
  ) {

    const existing =
      await db.getFirstAsync<{
        id: string;
      }>(
        `
        SELECT id
        FROM audits
        WHERE id = ?
        `,
        entry.data.id
      );


    if (existing) {
      skipped += 1;
      continue;
    }


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
      entry.data.id,
      entry.data.item_id,
      entry.data.system_quantity,
      entry.data.audited_quantity,
      entry.data.variance,
      entry.data.remark,
      entry.data.timestamp,
      entry.data.device_id
    );


    await writeSyncMeta(
      entry.sync
    );


    applied += 1;
    auditCount += 1;
  }


  return {
    applied,
    skipped,

    transactionCount,
    auditCount,
  };
}

/*
  ============================================================
  R58 SYNC DATABASE TRANSACTION QUEUE
  ============================================================

  Multiple phones may request synchronization at the same time.

  SQLite cannot start another transaction while a previous
  synchronization transaction is still active on this
  connection.

  Therefore every sync import transaction waits its turn.

  IMPORTANT:
  This does NOT change:
  - sync packet format
  - inventory calculations
  - pairing
  - authentication
  - conflict resolution
  - transaction IDs
  - audit logic
*/

let syncTransactionQueue:
  Promise<void> =
  Promise.resolve();


async function runSyncTransactionSerially<T>(
  task: () => Promise<T>
): Promise<T> {

  const previous =
    syncTransactionQueue;


  let release:
    () => void =
    () => {};


  syncTransactionQueue =
    new Promise<void>(
      resolve => {

        release =
          resolve;
      }
    );


  /*
    Wait for the previous sync
    database transaction to finish.
  */

  await previous;


  try {

    return await task();

  } finally {

    /*
      ALWAYS release the next sync,
      even if this one failed.
    */

    release( );
  }
}

export async function applySyncPacketData(
  packet: SyncPacket
): Promise<SyncImportResult> {

  validatePacket(packet);

  const localDeviceId =
    await getDeviceId();

  const db =
    await getDatabase();

  let mutableResult:
    Awaited<
      ReturnType<
        typeof importMutableRecords
      >
    >;

  let immutableResult:
    Awaited<
      ReturnType<
        typeof importImmutableRecords
      >
    >;

  await runSyncTransactionSerially(
  async () => {

    await db.withTransactionAsync(
      async () => {

        mutableResult =
          await importMutableRecords(
            packet,
            localDeviceId
          );


        immutableResult =
          await importImmutableRecords(
            packet
          );


        await setTriggerDevice(
          localDeviceId
        );


        /*
          Don't register this phone
          as its own peer during
          loopback testing.
        */

        if (
          packet.sourceDevice.id !==
          localDeviceId
        ) {

          const now =
            new Date()
              .toISOString();


          await db.runAsync(
            `
              INSERT INTO sync_peers (
                device_id,
                device_name,
                last_seen_at,
                last_sync_at
              )

              VALUES (?, ?, ?, ?)

              ON CONFLICT(device_id)

              DO UPDATE SET

                device_name =
                  excluded.device_name,

                last_seen_at =
                  excluded.last_seen_at,

                last_sync_at =
                  excluded.last_sync_at
            `,
            packet.sourceDevice.id,
            packet.sourceDevice.name,
            now,
            now
          );
        }
      }
    );
  }
);

  const resultA =
    mutableResult!;

  const resultB =
    immutableResult!;

  return {
    applied:
      resultA.applied +
      resultB.applied,

    skipped:
      resultA.skipped +
      resultB.skipped,

    items:
      resultA.itemCount,

    departments:
      resultA.departmentCount,

    people:
      resultA.peopleCount,

    transactions:
      resultB.transactionCount,

    audits:
      resultB.auditCount,

    sourceDeviceName:
      packet.sourceDevice.name,

    sourceDeviceId:
      packet.sourceDevice.id,
  };
}

export async function importSyncPacket():

  Promise<SyncImportResult | null> {

  const picked =
    await File.pickFileAsync({
      multipleFiles: false,

      mimeTypes: [
        'application/json',
        'text/plain',
        '*/*',
      ],
    });


  if (picked.canceled) {
    return null;
  }


  const file =
    picked.result;


  const raw =
    await file.text();


  let packet: any;


  try {
    packet =
      JSON.parse(raw);
  } catch {
    throw new Error(
      'The selected file is not valid JSON.'
    );
  }


  validatePacket(packet);


  const localDeviceId =
    await getDeviceId();


  const db =
    await getDatabase();


  let mutableResult:
    Awaited<
      ReturnType<
        typeof importMutableRecords
      >
    >;


  let immutableResult:
    Awaited<
      ReturnType<
        typeof importImmutableRecords
      >
    >;


  /*
    Entire packet import is atomic.

    Either everything succeeds,
    or SQLite rolls it all back.
  */

 await runSyncTransactionSerially(
  async () => {

    await db.withTransactionAsync(
      async () => {

        mutableResult =
          await importMutableRecords(
            packet,
            localDeviceId
          );


        immutableResult =
          await importImmutableRecords(
            packet
          );


        /*
          Restore this installation's
          own device identity.
        */

        await setTriggerDevice(
          localDeviceId
        );


        /*
          Remember peer.
        */

        await db.runAsync(
          `
            INSERT INTO sync_peers (
              device_id,
              device_name,
              last_seen_at,
              last_sync_at
            )

            VALUES (
              ?, ?, ?, ?
            )

            ON CONFLICT(device_id)

            DO UPDATE SET

              device_name =
                excluded.device_name,

              last_seen_at =
                excluded.last_seen_at,

              last_sync_at =
                excluded.last_sync_at
          `,
          packet.sourceDevice.id,
          packet.sourceDevice.name,
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    );
  }
);


  const resultA =
    mutableResult!;

  const resultB =
    immutableResult!;


  return {
    applied:
      resultA.applied +
      resultB.applied,

    skipped:
      resultA.skipped +
      resultB.skipped,

    items:
      resultA.itemCount,

    departments:
      resultA.departmentCount,

    people:
      resultA.peopleCount,

    transactions:
      resultB.transactionCount,

    audits:
      resultB.auditCount,

    sourceDeviceName:
      packet.sourceDevice.name,

    sourceDeviceId:
      packet.sourceDevice.id,
  };
}
