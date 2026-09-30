import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database/database';
import {
    getDeviceId,
} from '../services/deviceService';

export interface NewItemInput {
  oldItemId: string;
  itemName: string;
  unit: string;
  minimumStock: number;
  openingQuantity: number;
}

export interface CreatedItemResult {
  id: string;
  stockId: string;
}

export async function getNextStockId(): Promise<string> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{
    max_number: number | null;
  }>(`
    SELECT
      MAX(
        CAST(
          SUBSTR(stock_id, 7)
          AS INTEGER
        )
      ) AS max_number
    FROM items
    WHERE stock_id LIKE 'R58-S-%';
  `);

  const currentMax =
    Number(result?.max_number ?? 0);

  const nextNumber =
    currentMax + 1;

  return `R58-S-${String(
    nextNumber
  ).padStart(4, '0')}`;
}

export async function createNewInventoryItem(
  input: NewItemInput
): Promise<CreatedItemResult> {
  const itemName =
    input.itemName.trim();

  const oldItemId =
    input.oldItemId.trim();

  const unit =
    input.unit.trim();

  if (!itemName) {
    throw new Error(
      'Item name is required.'
    );
  }

  if (!unit) {
    throw new Error(
      'Unit is required.'
    );
  }

  if (
    Number.isNaN(
      input.openingQuantity
    ) ||
    input.openingQuantity < 0
  ) {
    throw new Error(
      'Opening quantity cannot be negative.'
    );
  }

  if (
    Number.isNaN(
      input.minimumStock
    ) ||
    input.minimumStock < 0
  ) {
    throw new Error(
      'Minimum stock cannot be negative.'
    );
  }

  const db =
    await getDatabase();
    const deviceId =
  await getDeviceId();

  let createdItemId = '';
  let generatedStockId = '';

  await db.withTransactionAsync(
    async () => {
      const result =
        await db.getFirstAsync<{
          max_number: number | null;
        }>(`
          SELECT
            MAX(
              CAST(
                SUBSTR(
                  stock_id,
                  7
                )
                AS INTEGER
              )
            ) AS max_number
          FROM items
          WHERE stock_id
            LIKE 'R58-S-%';
        `);

      const currentMax =
        Number(
          result?.max_number ?? 0
        );

      const nextNumber =
        currentMax + 1;

      generatedStockId =
        `R58-S-${String(
          nextNumber
        ).padStart(4, '0')}`;

      createdItemId =
        Crypto.randomUUID();

      const now =
        new Date().toISOString();

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
          ?, 1, ?, ?
        )
        `,
        createdItemId,
        generatedStockId,
        oldItemId || null,
        itemName,
        unit,
        input.minimumStock,
        generatedStockId,
        now,
        now
      );

      if (
        input.openingQuantity > 0
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
            ?, ?,
            'OPENING',
            ?, ?,
            NULL,
            NULL,
            NULL,
            ?,
            ?,
            ?
          )
          `,
          Crypto.randomUUID(),
          createdItemId,
          input.openingQuantity,
          input.openingQuantity,
          'Opening stock for new item',
          now,
          deviceId
        );
      }
    }
  );

  return {
    id: createdItemId,
    stockId:
      generatedStockId,
  };
}
export interface EditableInventoryItem {
  id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;
  minimum_stock: number;
  qr_code: string;
  active: number;
}


export async function getInventoryItemForEdit(
  itemId: string
): Promise<EditableInventoryItem | null> {

  const db =
    await getDatabase();

  return await db.getFirstAsync<EditableInventoryItem>(
    `
    SELECT
      id,
      stock_id,
      old_item_id,
      item_name,
      unit,
      minimum_stock,
      qr_code,
      active

    FROM items

    WHERE id = ?
    LIMIT 1
    `,
    itemId
  );
}


export async function updateInventoryItem(
  itemId: string,
  data: {
    itemName: string;
    oldItemId?: string | null;
    unit: string;
    minimumStock: number;
  }
) {
  const itemName =
    data.itemName.trim();

  const unit =
    data.unit.trim();

  const oldItemId =
    data.oldItemId?.trim() || null;

  const minimumStock =
    Number(
      data.minimumStock
    );


  if (!itemName) {
    throw new Error(
      'Item name is required.'
    );
  }


  if (!unit) {
    throw new Error(
      'Unit is required.'
    );
  }


  if (
    !Number.isFinite(
      minimumStock
    ) ||
    minimumStock < 0
  ) {
    throw new Error(
      'Minimum stock must be 0 or greater.'
    );
  }


  const db =
    await getDatabase();

  const now =
    new Date().toISOString();


  const result =
    await db.runAsync(
      `
      UPDATE items

      SET
        item_name = ?,
        old_item_id = ?,
        unit = ?,
        minimum_stock = ?,
        updated_at = ?

      WHERE
        id = ?
        AND active = 1
      `,
      itemName,
      oldItemId,
      unit,
      minimumStock,
      now,
      itemId
    );


  if (
    result.changes === 0
  ) {
    throw new Error(
      'Item was not found or is already deleted.'
    );
  }
}


export async function deactivateInventoryItem(
  itemId: string
) {
  const db =
    await getDatabase();

  const now =
    new Date().toISOString();


  const result =
    await db.runAsync(
      `
      UPDATE items

      SET
        active = 0,
        updated_at = ?

      WHERE
        id = ?
        AND active = 1
      `,
      now,
      itemId
    );


  if (
    result.changes === 0
  ) {
    throw new Error(
      'Item was not found or is already deleted.'
    );
  }
}
export interface ManageInventoryItem {
  id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;
  minimum_stock: number;
  current_quantity: number;
}


export async function getManageInventoryItems(
  search = ''
): Promise<ManageInventoryItem[]> {

  const db =
    await getDatabase();

  const cleanSearch =
    search.trim();

  const likeSearch =
    `%${cleanSearch}%`;

  return await db.getAllAsync<ManageInventoryItem>(
    `
    SELECT
      i.id,
      i.stock_id,
      i.old_item_id,
      i.item_name,
      i.unit,
      i.minimum_stock,

      COALESCE(
        SUM(t.stock_delta),
        0
      ) AS current_quantity

    FROM items i

    LEFT JOIN transactions t
      ON t.item_id = i.id

    WHERE
      i.active = 1

      AND (
        ? = ''

        OR i.item_name
          LIKE ?

        OR i.stock_id
          LIKE ?

        OR COALESCE(
          i.old_item_id,
          ''
        ) LIKE ?
      )

    GROUP BY
      i.id,
      i.stock_id,
      i.old_item_id,
      i.item_name,
      i.unit,
      i.minimum_stock

    ORDER BY
      CAST(
        SUBSTR(
          i.stock_id,
          7
        )
        AS INTEGER
      ) ASC
    `,
    cleanSearch,
    likeSearch,
    likeSearch,
    likeSearch
  );
}