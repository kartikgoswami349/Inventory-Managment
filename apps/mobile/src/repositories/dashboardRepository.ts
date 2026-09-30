import { getDatabase } from '../database/database';

export interface DashboardStats {
  totalItems: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;

  transactionsToday: number;
  issuedToday: number;
  receivedToday: number;
  auditsToday: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDatabase();

  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );

  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const stockStats = await db.getFirstAsync<{
    total_items: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
  }>(`
    WITH stock_summary AS (
      SELECT
        i.id,
        i.minimum_stock,

        COALESCE(
          SUM(t.stock_delta),
          0
        ) AS current_stock

      FROM items i

      LEFT JOIN transactions t
        ON t.item_id = i.id

      WHERE i.active = 1

      GROUP BY
        i.id,
        i.minimum_stock
    )

    SELECT
      COUNT(*) AS total_items,

      SUM(
        CASE
          WHEN current_stock > minimum_stock
          THEN 1
          ELSE 0
        END
      ) AS in_stock,

      SUM(
        CASE
          WHEN current_stock > 0
            AND current_stock <= minimum_stock
          THEN 1
          ELSE 0
        END
      ) AS low_stock,

      SUM(
        CASE
          WHEN current_stock <= 0
          THEN 1
          ELSE 0
        END
      ) AS out_of_stock

    FROM stock_summary;
  `);

  const transactionStats =
    await db.getFirstAsync<{
      total: number;
      issued: number;
      received: number;
    }>(
      `
      SELECT
        COUNT(*) AS total,

        SUM(
          CASE
            WHEN transaction_type = 'ISSUED'
            THEN 1
            ELSE 0
          END
        ) AS issued,

        SUM(
          CASE
            WHEN transaction_type = 'RECEIVED'
            THEN 1
            ELSE 0
          END
        ) AS received

      FROM transactions

      WHERE timestamp >= ?
        AND timestamp < ?;
      `,
      startISO,
      endISO
    );

  const auditStats =
    await db.getFirstAsync<{
      total: number;
    }>(
      `
      SELECT
        COUNT(*) AS total

      FROM audits

      WHERE timestamp >= ?
        AND timestamp < ?;
      `,
      startISO,
      endISO
    );

  return {
    totalItems:
      Number(stockStats?.total_items ?? 0),

    inStock:
      Number(stockStats?.in_stock ?? 0),

    lowStock:
      Number(stockStats?.low_stock ?? 0),

    outOfStock:
      Number(stockStats?.out_of_stock ?? 0),

    transactionsToday:
      Number(transactionStats?.total ?? 0),

    issuedToday:
      Number(transactionStats?.issued ?? 0),

    receivedToday:
      Number(transactionStats?.received ?? 0),

    auditsToday:
      Number(auditStats?.total ?? 0),
  };
}