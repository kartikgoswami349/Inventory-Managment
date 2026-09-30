import * as Crypto from 'expo-crypto';

import { getDatabase } from '../database/database';
import { getCurrentStock } from '../services/stockService';

export interface AuditResult {
  auditId: string;
  systemQuantity: number;
  auditedQuantity: number;
  variance: number;
  adjusted: boolean;
}

export async function saveAudit(
  itemId: string,
  auditedQuantity: number,
  remark: string,
  deviceId: string,
  adjustStock: boolean
): Promise<AuditResult> {
  if (
    Number.isNaN(auditedQuantity) ||
    auditedQuantity < 0
  ) {
    throw new Error(
      'Audited quantity cannot be negative.'
    );
  }

  const db = await getDatabase();

  const systemQuantity =
    await getCurrentStock(itemId);

  const variance =
    auditedQuantity - systemQuantity;

  const auditId =
    Crypto.randomUUID();

  const timestamp =
    new Date().toISOString();

  await db.withTransactionAsync(
    async () => {
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        auditId,
        itemId,
        systemQuantity,
        auditedQuantity,
        variance,
        remark || null,
        timestamp,
        deviceId
      );

      if (
        adjustStock &&
        variance !== 0
      ) {
        const transactionId =
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
            ?, ?, ?, ?, ?, NULL,
            NULL, NULL, ?, ?, ?
          )
          `,
          transactionId,
          itemId,
          'AUDIT_ADJUSTMENT',
          Math.abs(variance),
          variance,
          remark
            ? `Audit adjustment: ${remark}`
            : 'Audit stock adjustment',
          timestamp,
          deviceId
        );
      }
    }
  );

  return {
    auditId,
    systemQuantity,
    auditedQuantity,
    variance,
    adjusted:
      adjustStock && variance !== 0,
  };
}