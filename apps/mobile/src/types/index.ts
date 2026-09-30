export type TransactionType =
  | 'OPENING'
  | 'RECEIVED'
  | 'ISSUED'
  | 'AUDIT_ADJUSTMENT';

export interface Item {
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