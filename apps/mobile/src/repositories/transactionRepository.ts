import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database/database';
import { getCurrentStock } from '../services/stockService';
import { TransactionType } from '../types';

export async function createTransaction(
  itemId: string,
  type: TransactionType,
  quantity: number,
  deviceId: string,
  remark?: string,
  departmentId?: string | null,
  personId?: string | null,
  otherName?: string | null
) {
  if (quantity <= 0) {
    throw new Error(
      'Quantity must be greater than zero.'
    );
  }

  const db = await getDatabase();

  let stockDelta = quantity;

  if (type === 'ISSUED') {
    const currentStock =
      await getCurrentStock(itemId);

    if (quantity > currentStock) {
      throw new Error(
        `Insufficient stock. Available: ${currentStock}`
      );
    }

    stockDelta = -quantity;
  }

  const id = Crypto.randomUUID();
  const timestamp = new Date().toISOString();

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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    id,
    itemId,
    type,
    quantity,
    stockDelta,
    departmentId ?? null,
    personId ?? null,
    otherName ?? null,
    remark ?? null,
    timestamp,
    deviceId
  );

  return id;
}

export interface BatchTransactionItem {
  itemId: string;
  quantity: number;
}


export interface BatchTransactionResult {
  transactionId: string;

  itemId: string;

  quantity: number;

  stockBefore: number;
  stockAfter: number;
}


export async function createTransactionBatch(
  items: BatchTransactionItem[],

  type: TransactionType,

  deviceId: string,

  remark?: string,

  departmentId?: string | null,

  personId?: string | null,

  otherName?: string | null
): Promise<BatchTransactionResult[]> {

  if (items.length === 0) {
    throw new Error(
      'No items were provided.'
    );
  }


  const db =
    await getDatabase();


  const results:
    BatchTransactionResult[] =
    [];


  const timestamp =
    new Date().toISOString();


  await db.withTransactionAsync(
    async () => {

      for (
        const item
        of items
      ) {

        if (
          item.quantity <= 0
        ) {

          throw new Error(
            'Quantity must be greater than zero.'
          );
        }


        /*
          Read LIVE stock while we are
          inside the database transaction.
        */

        const stockRow =
          await db.getFirstAsync<{
            current_stock:
              number;
          }>(
            `
            SELECT
              COALESCE(
                SUM(stock_delta),
                0
              ) AS current_stock

            FROM transactions

            WHERE item_id = ?
            `,
            item.itemId
          );


        const stockBefore =
          Number(
            stockRow?.current_stock ??
              0
          );


        if (
          type === 'ISSUED' &&
          item.quantity >
            stockBefore
        ) {

          throw new Error(
            `Insufficient stock. Available: ${stockBefore}`
          );
        }


        const stockDelta =
          type === 'ISSUED'
            ? -item.quantity
            : item.quantity;


        const stockAfter =
          stockBefore +
          stockDelta;


        const id =
          Crypto.randomUUID();


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
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?
          )
          `,

          id,

          item.itemId,

          type,

          item.quantity,

          stockDelta,

          departmentId ?? null,

          personId ?? null,

          otherName ?? null,

          remark ?? null,

          timestamp,

          deviceId
        );


        results.push({

          transactionId:
            id,

          itemId:
            item.itemId,

          quantity:
            item.quantity,

          stockBefore,

          stockAfter,
        });
      }

    }
  );


  return results;
}
export interface TransactionDetail {
  id: string;
  timestamp: string;

  item_id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;

  transaction_type: string;
  quantity: number;
  stock_delta: number;

  stock_before: number;
  stock_after: number;

  department_name: string | null;
  person_name: string | null;
  other_name: string | null;

  remark: string | null;
  device_id: string;
}

export async function getTransactionDetails():
  Promise<TransactionDetail[]> {

  const db = await getDatabase();

  const rows =
    await db.getAllAsync<TransactionDetail>(`
      WITH transaction_history AS (
        SELECT
          t.id,
          t.timestamp,

          t.item_id,
          i.stock_id,
          i.old_item_id,
          i.item_name,
          i.unit,

          t.transaction_type,
          t.quantity,
          t.stock_delta,

          d.name AS department_name,
          p.name AS person_name,
          t.other_name,

          t.remark,
          t.device_id,

          SUM(t.stock_delta) OVER (
            PARTITION BY t.item_id
            ORDER BY t.timestamp ASC, t.id ASC
            ROWS BETWEEN
              UNBOUNDED PRECEDING
              AND CURRENT ROW
          ) AS stock_after

        FROM transactions t

        INNER JOIN items i
          ON i.id = t.item_id

        LEFT JOIN departments d
          ON d.id = t.department_id

        LEFT JOIN people p
          ON p.id = t.person_id
      )

      SELECT
        *,
        stock_after - stock_delta
          AS stock_before

      FROM transaction_history

      ORDER BY timestamp DESC;
    `);

  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    stock_delta: Number(row.stock_delta),
    stock_before: Number(row.stock_before),
    stock_after: Number(row.stock_after),
  }));
}