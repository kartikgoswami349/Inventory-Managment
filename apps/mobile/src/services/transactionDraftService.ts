import { TransactionType } from '../types';


export interface TransactionDraftItem {
  itemId: string;

  stockId: string;
  oldItemId: string | null;

  itemName: string;
  unit: string;

  currentStock: number;

  count: number;
}


export interface TransactionDraft {
  type: TransactionType;

  departmentId: string;
  departmentName: string;

  personId: string;
  personName: string;

  otherName: string;

  remark: string;

  items: TransactionDraftItem[];
}


let currentDraft:
  TransactionDraft |
  null =
  null;


export function startTransactionDraft(
  draft: Omit<
    TransactionDraft,
    'items'
  >
) {

  currentDraft = {
    ...draft,
    items: [],
  };
}


export function getTransactionDraft():
  TransactionDraft |
  null {

  if (!currentDraft) {
    return null;
  }

  return {
    ...currentDraft,

    items:
      currentDraft.items.map(
        item => ({
          ...item,
        })
      ),
  };
}


export function addScannedItemToDraft(
  item: {
    itemId: string;

    stockId: string;
    oldItemId: string | null;

    itemName: string;
    unit: string;

    currentStock: number;
  }
) {

  if (!currentDraft) {

    return {
      success: false as const,
      reason: 'NO_DRAFT' as const,
    };
  }


  const existing =
    currentDraft.items.find(
      row =>
        row.itemId ===
        item.itemId
    );


  const nextCount =
    existing
      ? existing.count + 1
      : 1;


  /*
    For ISSUE:

    Do not allow the operator
    to scan more physical items
    than the currently available
    quantity.
  */

  if (
    currentDraft.type ===
      'ISSUED' &&
    nextCount >
      item.currentStock
  ) {

    return {
      success: false as const,
      reason:
        'INSUFFICIENT_STOCK' as const,

      available:
        item.currentStock,

      alreadyScanned:
        existing?.count ?? 0,
    };
  }


  if (existing) {

    existing.count =
      nextCount;

    /*
      Refresh the stock value
      using the newest QR lookup.
    */

    existing.currentStock =
      item.currentStock;


    return {
      success: true as const,
      count: existing.count,
    };
  }


  currentDraft.items.push({

    itemId:
      item.itemId,

    stockId:
      item.stockId,

    oldItemId:
      item.oldItemId,

    itemName:
      item.itemName,

    unit:
      item.unit,

    currentStock:
      item.currentStock,

    count: 1,
  });


  return {
    success: true as const,
    count: 1,
  };
}


export function removeOneFromDraft(
  itemId: string
) {

  if (!currentDraft) {
    return;
  }


  const index =
    currentDraft.items.findIndex(
      item =>
        item.itemId ===
        itemId
    );


  if (index === -1) {
    return;
  }


  const item =
    currentDraft.items[index];


  if (item.count > 1) {

    item.count -= 1;

    return;
  }


  /*
    count = 1

    Remove the item completely.
  */

  currentDraft.items.splice(
    index,
    1
  );
}


export function clearTransactionDraft() {

  currentDraft =
    null;
}


export function getTotalScannedCount() {

  if (!currentDraft) {
    return 0;
  }


  return currentDraft.items.reduce(
    (total, item) =>
      total + item.count,
    0
  );
}