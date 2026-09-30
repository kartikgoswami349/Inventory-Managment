import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database/database';

export interface InventoryItem {
  id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;

  minimum_stock: number;
  current_stock: number;

  qr_code: string;

  last_audit_quantity: number | null;
  stock_at_audit: number | null;
  last_audit_variance: number | null;
  last_audit_date: string | null;
  last_audit_remark: string | null;
}
export async function createItem(
  stockId: string,
  itemName: string,
  unit: string,
  minimumStock: number = 0,
  oldItemId?: string
) {
  const db = await getDatabase();

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM items WHERE stock_id = ?`,
    stockId
  );

  if (existing) {
    return existing.id;
  }

  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    id,
    stockId,
    oldItemId ?? null,
    itemName,
    unit,
    minimumStock,
    stockId,
    1,
    now,
    now
  );

  return id;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<InventoryItem>(`
    SELECT
      i.id,
      i.stock_id,
      i.old_item_id,
      i.item_name,
      i.unit,
      i.minimum_stock,
      i.qr_code,

      COALESCE(
        (
          SELECT SUM(t.stock_delta)
          FROM transactions t
          WHERE t.item_id = i.id
        ),
        0
      ) AS current_stock,

      (
        SELECT a.audited_quantity
        FROM audits a
        WHERE a.item_id = i.id
        ORDER BY a.timestamp DESC, a.id DESC
        LIMIT 1
      ) AS last_audit_quantity,

      (
        SELECT a.system_quantity
        FROM audits a
        WHERE a.item_id = i.id
        ORDER BY a.timestamp DESC, a.id DESC
        LIMIT 1
      ) AS stock_at_audit,

      (
        SELECT a.variance
        FROM audits a
        WHERE a.item_id = i.id
        ORDER BY a.timestamp DESC, a.id DESC
        LIMIT 1
      ) AS last_audit_variance,

      (
        SELECT a.timestamp
        FROM audits a
        WHERE a.item_id = i.id
        ORDER BY a.timestamp DESC, a.id DESC
        LIMIT 1
      ) AS last_audit_date,

      (
        SELECT a.remark
        FROM audits a
        WHERE a.item_id = i.id
        ORDER BY a.timestamp DESC, a.id DESC
        LIMIT 1
      ) AS last_audit_remark

    FROM items i
    WHERE i.active = 1

    ORDER BY
      i.item_name COLLATE NOCASE ASC
  `);

  return rows.map((row) => ({
    ...row,

    minimum_stock: Number(row.minimum_stock),

    current_stock: Number(row.current_stock),

    last_audit_quantity:
      row.last_audit_quantity === null
        ? null
        : Number(row.last_audit_quantity),

    stock_at_audit:
      row.stock_at_audit === null
        ? null
        : Number(row.stock_at_audit),

    last_audit_variance:
      row.last_audit_variance === null
        ? null
        : Number(row.last_audit_variance),
  }));
}

export async function getItemByQr(
  qrCode: string
): Promise<InventoryItem | null> {
  const db = await getDatabase();

  const item = await db.getFirstAsync<InventoryItem>(
    `
    SELECT
      i.id,
      i.stock_id,
      i.old_item_id,
      i.item_name,
      i.unit,
      i.minimum_stock,
      i.qr_code,
      COALESCE(SUM(t.stock_delta), 0) AS current_stock
    FROM items i
    LEFT JOIN transactions t
      ON t.item_id = i.id
    WHERE i.qr_code = ?
      AND i.active = 1
    GROUP BY i.id
    `,
    qrCode
  );

  if (!item) {
    return null;
  }

  return {
    ...item,
    minimum_stock: Number(item.minimum_stock),
    current_stock: Number(item.current_stock),
  };
}

export async function getItemById(
  itemId: string
): Promise<InventoryItem | null> {

  console.log(
    'GET ITEM BY ID START:',
    itemId
  );


  console.log(
    'GET ITEM: waiting for database...'
  );


  const db =
    await getDatabase();


  console.log(
    'GET ITEM: database received'
  );


  console.log(
    'GET ITEM: starting SQL query'
  );


  const item =
    await db.getFirstAsync<InventoryItem>(
      `
      SELECT
        i.id,
        i.stock_id,
        i.old_item_id,
        i.item_name,
        i.unit,
        i.minimum_stock,
        i.qr_code,

        COALESCE(
          (
            SELECT
              SUM(t.stock_delta)

            FROM transactions t

            WHERE
              t.item_id = i.id
          ),
          0
        ) AS current_stock

      FROM items i

      WHERE
        i.id = ?
        AND i.active = 1

      LIMIT 1
      `,
      itemId
    );


  console.log(
    'GET ITEM: SQL finished',
    item
  );


  if (!item) {

    console.log(
      'GET ITEM: item not found'
    );

    return null;
  }


  const result = {
    ...item,

    minimum_stock:
      Number(
        item.minimum_stock
      ),

    current_stock:
      Number(
        item.current_stock
      ),
  };


  console.log(
    'GET ITEM BY ID COMPLETE:',
    result.stock_id
  );


  return result;
}
export interface InventorySearchItem {
  id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;
  current_stock: number;
}


export async function searchInventoryItems(
  search: string
): Promise<InventorySearchItem[]> {

  const query =
    search.trim();

  if (!query) {
    return [];
  }

  const db =
    await getDatabase();

  const contains =
    `%${query}%`;

  const startsWith =
    `${query}%`;


  const rows =
    await db.getAllAsync<InventorySearchItem>(
      `
      SELECT
        i.id,
        i.stock_id,
        i.old_item_id,
        i.item_name,
        i.unit,

        COALESCE(
          (
            SELECT
              SUM(t.stock_delta)

            FROM transactions t

            WHERE
              t.item_id = i.id
          ),
          0
        ) AS current_stock

      FROM items i

      WHERE
        i.active = 1

        AND (
          i.item_name
            COLLATE NOCASE
            LIKE ?

          OR i.stock_id
            COLLATE NOCASE
            LIKE ?

          OR COALESCE(
            i.old_item_id,
            ''
          )
            COLLATE NOCASE
            LIKE ?
        )

      ORDER BY
        CASE

          WHEN
            i.stock_id
              COLLATE NOCASE = ?
            THEN 0

          WHEN
            COALESCE(
              i.old_item_id,
              ''
            )
              COLLATE NOCASE = ?
            THEN 1

          WHEN
            i.item_name
              COLLATE NOCASE = ?
            THEN 2

          WHEN
            i.item_name
              COLLATE NOCASE
              LIKE ?
            THEN 3

          ELSE 4

        END,

        i.item_name
          COLLATE NOCASE ASC

      LIMIT 40
      `,
      contains,
      contains,
      contains,
      query,
      query,
      query,
      startsWith
    );


  return rows.map(
    row => ({
      ...row,

      current_stock:
        Number(
          row.current_stock
        ),
    })
  );
}