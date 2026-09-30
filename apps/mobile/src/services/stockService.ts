import { getDatabase } from '../database/database';

export async function getCurrentStock(
  itemId: string
): Promise<number> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number }>(
    `
    SELECT COALESCE(SUM(stock_delta), 0) AS total
    FROM transactions
    WHERE item_id = ?
    `,
    [itemId]
  );

  return Number(result?.total ?? 0);
}