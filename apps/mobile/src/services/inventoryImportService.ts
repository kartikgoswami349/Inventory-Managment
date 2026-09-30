import * as Crypto from 'expo-crypto';

import { getDatabase } from '../database/database';
import { INVENTORY_SEED } from '../data/inventorySeed';

export interface InventoryImportResult {
  totalRows: number;
  importedItems: number;
  skippedItems: number;
  openingTransactions: number;
}

export async function importRealInventory(): Promise<InventoryImportResult> {
  const db = await getDatabase();

  let importedItems = 0;
  let skippedItems = 0;
  let openingTransactions = 0;

  await db.withTransactionAsync(async () => {
    for (const seed of INVENTORY_SEED) {
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM items WHERE stock_id = ?`,
        seed.stockId
      );

      // Makes the import safe to run again:
      // an already-imported Stock ID is skipped completely.
      if (existing) {
        skippedItems += 1;
        continue;
      }

      const itemId = Crypto.randomUUID();
      const timestamp = new Date().toISOString();

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
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `,
        itemId,
        seed.stockId,
        seed.oldItemId,
        seed.itemName,
        seed.unit,
        seed.minimumStock,
        seed.stockId,
        timestamp,
        timestamp
      );

      importedItems += 1;

      // A zero opening balance does not need a ledger transaction.
      if (seed.openingQuantity > 0) {
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
          VALUES (?, ?, 'OPENING', ?, ?, NULL, NULL, NULL, ?, ?, ?)
          `,
          Crypto.randomUUID(),
          itemId,
          seed.openingQuantity,
          seed.openingQuantity,
          'Opening stock imported from Book1.xlsx',
          timestamp,
          'IMPORT'
        );

        openingTransactions += 1;
      }
    }
  });

  return {
    totalRows: INVENTORY_SEED.length,
    importedItems,
    skippedItems,
    openingTransactions,
  };
}

export async function removeTestInventoryData(): Promise<boolean> {
  const db = await getDatabase();

  const testItem = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM items WHERE stock_id = ?`,
    'TEST-001'
  );

  if (!testItem) {
    return false;
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM audits WHERE item_id = ?`,
      testItem.id
    );

    await db.runAsync(
      `DELETE FROM transactions WHERE item_id = ?`,
      testItem.id
    );

    await db.runAsync(
      `DELETE FROM items WHERE id = ?`,
      testItem.id
    );
  });

  return true;
}
