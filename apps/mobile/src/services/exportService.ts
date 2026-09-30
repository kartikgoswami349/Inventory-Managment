import * as XLSX from 'xlsx';
import { InventoryItem } from '../repositories/itemRepository';

import {
    File,
    Paths,
} from 'expo-file-system';

import * as Sharing from 'expo-sharing';

import {
    TransactionDetail,
} from '../repositories/transactionRepository';

export async function exportTransactionsToExcel(
  transactions: TransactionDetail[]
) {
  if (transactions.length === 0) {
    throw new Error(
      'There are no transactions to export.'
    );
  }

  const exportRows = transactions.map(
    (transaction) => ({
      'Record ID':
        transaction.id,

      'Date & Time':
        new Date(
          transaction.timestamp
        ).toLocaleString(),

      'Stock ID':
        transaction.stock_id,

      'Item ID':
        transaction.old_item_id ?? '',

      'Item Name':
        transaction.item_name,

      'Unit':
        transaction.unit,

      'Transaction Type':
        transaction.transaction_type,

      'Quantity':
        transaction.quantity,

      'Stock Before':
        transaction.stock_before,

      'Stock After':
        transaction.stock_after,

      'Department':
        transaction.department_name ?? '',

      'Person Name':
        transaction.person_name ?? '',

      'Other Name':
        transaction.other_name ?? '',

      'Remark':
        transaction.remark ?? '',

      'Device':
        transaction.device_id,
    })
  );

  const worksheet =
    XLSX.utils.json_to_sheet(exportRows);

  worksheet['!cols'] = [
    { wch: 38 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 35 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 25 },
    { wch: 25 },
    { wch: 35 },
    { wch: 18 },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Transactions'
  );

  const workbookData =
    XLSX.write(workbook, {
      type: 'array',
      bookType: 'xlsx',
    });

  const bytes =
    new Uint8Array(workbookData);

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  const filename =
    `R58_Transactions_${date}.xlsx`;

  const file =
    new File(Paths.cache, filename);

  file.create({
    overwrite: true,
  });

  file.write(bytes);

  const sharingAvailable =
    await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    throw new Error(
      'File sharing is not available on this device.'
    );
  }

  await Sharing.shareAsync(
    file.uri,
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      dialogTitle:
        'Export R58 Transactions',
    }
  );

  return file.uri;
}
export async function exportInventoryToExcel(
  items: InventoryItem[]
) {
  if (items.length === 0) {
    throw new Error(
      'There are no inventory items to export.'
    );
  }

  const inventoryRows = items.map((item) => {
    let stockStatus = 'In Stock';

    if (item.current_stock <= 0) {
      stockStatus = 'Out of Stock';
    } else if (
      item.current_stock <= item.minimum_stock
    ) {
      stockStatus = 'Low Stock';
    }

    return {
      'Stock ID':
        item.stock_id,

      'Item ID':
        item.old_item_id ?? '',

      'Item Name':
        item.item_name,

      'Unit':
        item.unit,

      'Current Quantity':
        item.current_stock,

      'Minimum Stock':
        item.minimum_stock,

      'Stock Status':
        stockStatus,

      'Last Audit Date':
        item.last_audit_date
          ? new Date(
              item.last_audit_date
            ).toLocaleString()
          : 'Not Audited',

      'Stock at Audit':
        item.stock_at_audit ?? '',

      'Last Audited Quantity':
        item.last_audit_quantity ?? '',

      'Audit Variance':
        item.last_audit_variance ?? '',

      'Audit Remark':
        item.last_audit_remark ?? '',
    };
  });

  const worksheet =
    XLSX.utils.json_to_sheet(
      inventoryRows
    );

  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 38 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 17 },
    { wch: 24 },
    { wch: 17 },
    { wch: 22 },
    { wch: 17 },
    { wch: 35 },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Inventory Summary'
  );

  const workbookData =
    XLSX.write(workbook, {
      type: 'array',
      bookType: 'xlsx',
    });

  const bytes =
    new Uint8Array(workbookData);

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  const filename =
    `R58_Inventory_${date}.xlsx`;

  const file =
    new File(
      Paths.cache,
      filename
    );

  file.create({
    overwrite: true,
  });

  file.write(bytes);

  const sharingAvailable =
    await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    throw new Error(
      'File sharing is not available.'
    );
  }

  await Sharing.shareAsync(
    file.uri,
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      dialogTitle:
        'Export R58 Inventory',
    }
  );
}