/**
 * FEFO (First-Expired, First-Out) Batch Allocation Engine
 * Supports ascending expiry sorting, 30/60/90-day tiered risk stratification, and dual-PIN quarantine write-off protocol.
 */

export interface BatchRecord {
  batchNumber: string;
  medicineId: string;
  medicineName: string;
  companyName: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  tradePrice: number;
  retailPrice: number;
  isQuarantined?: boolean;
}

export type ExpiryTier = 'CRITICAL_30' | 'NEAR_60' | 'WARNING_90' | 'STABLE';

export interface BatchExpiryAlert {
  batch: BatchRecord;
  daysRemaining: number;
  tier: ExpiryTier;
  actionRequired: string;
}

export interface AllocationPlan {
  medicineId: string;
  requestedQty: number;
  fulfilledQty: number;
  unfulfilledQty: number;
  allocatedBatches: Array<{
    batchNumber: string;
    expiryDate: string;
    allocatedQty: number;
    daysRemaining: number;
    tier: ExpiryTier;
  }>;
}

export interface DualPinAuthorization {
  pharmacistPin: string;
  supervisorPin: string;
}

export interface QuarantineResult {
  success: boolean;
  batchNumber: string;
  quarantinedQty: number;
  reason: string;
  authorizedBy: {
    pharmacist: string;
    supervisor: string;
  };
  timestamp: string;
}

export class FEFOBatchAllocator {
  /**
   * Sort batches strictly by expiry_date ASC (FEFO protocol).
   * Ignores quarantined batches or batches with zero stock.
   */
  public sortBatchesFEFO(batches: BatchRecord[]): BatchRecord[] {
    return [...batches]
      .filter((b) => !b.isQuarantined && b.quantity > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  /**
   * Calculate remaining days relative to current date (or reference date).
   */
  public calculateDaysRemaining(expiryDateStr: string, referenceDate: Date = new Date()): number {
    const expiry = new Date(expiryDateStr);
    const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const exp = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const diffTime = exp.getTime() - ref.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Stratify batch risk into 30/60/90-day tiered alert bands.
   */
  public classifyExpiryTier(daysRemaining: number): ExpiryTier {
    if (daysRemaining <= 30) return 'CRITICAL_30';
    if (daysRemaining <= 60) return 'NEAR_60';
    if (daysRemaining <= 90) return 'WARNING_90';
    return 'STABLE';
  }

  /**
   * Evaluate tiered alerts across stock inventory.
   */
  public getTieredExpiryAlerts(batches: BatchRecord[], referenceDate: Date = new Date()): BatchExpiryAlert[] {
    const alerts: BatchExpiryAlert[] = [];

    for (const batch of batches) {
      if (batch.isQuarantined) continue;
      const days = this.calculateDaysRemaining(batch.expiryDate, referenceDate);
      const tier = this.classifyExpiryTier(days);

      let actionRequired = 'Normal Stock - No immediate action required';
      if (tier === 'CRITICAL_30') {
        actionRequired = 'URGENT: Return to vendor or apply 50% discount clearance';
      } else if (tier === 'NEAR_60') {
        actionRequired = 'HIGH ALERT: Prioritize FEFO dispatch for wholesale sales';
      } else if (tier === 'WARNING_90') {
        actionRequired = 'WARNING: Flag for rapid stock turnover';
      }

      alerts.push({
        batch,
        daysRemaining: days,
        tier,
        actionRequired,
      });
    }

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /**
   * Allocate requested quantity across available batches adhering to FEFO rules.
   */
  public allocateStock(
    medicineId: string,
    requestedQty: number,
    availableBatches: BatchRecord[],
    referenceDate: Date = new Date()
  ): AllocationPlan {
    if (requestedQty <= 0) throw new Error('Requested quantity must be greater than zero');

    const fefoSorted = this.sortBatchesFEFO(
      availableBatches.filter((b) => b.medicineId === medicineId)
    );

    let remainingNeeded = requestedQty;
    const allocatedBatches: AllocationPlan['allocatedBatches'] = [];

    for (const batch of fefoSorted) {
      if (remainingNeeded <= 0) break;

      const allocateFromThis = Math.min(batch.quantity, remainingNeeded);
      const daysRemaining = this.calculateDaysRemaining(batch.expiryDate, referenceDate);
      const tier = this.classifyExpiryTier(daysRemaining);

      allocatedBatches.push({
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        allocatedQty: allocateFromThis,
        daysRemaining,
        tier,
      });

      remainingNeeded -= allocateFromThis;
    }

    const fulfilledQty = requestedQty - remainingNeeded;

    return {
      medicineId,
      requestedQty,
      fulfilledQty,
      unfulfilledQty: remainingNeeded,
      allocatedBatches,
    };
  }

  /**
   * Dual-PIN Quarantine & Write-off protocol.
   * Requires Pharmacist PIN (e.g. '1234') and Supervisor PIN (e.g. '9999').
   */
  public quarantineBatchWithDualPin(
    batch: BatchRecord,
    writeOffQty: number,
    reason: string,
    pins: DualPinAuthorization,
    validPins: { pharmacist: string; supervisor: string } = { pharmacist: '1234', supervisor: '9999' }
  ): QuarantineResult {
    if (pins.pharmacistPin !== validPins.pharmacist) {
      throw new Error('Invalid Pharmacist PIN. Quarantine authorization denied.');
    }
    if (pins.supervisorPin !== validPins.supervisor) {
      throw new Error('Invalid Supervisor PIN. Quarantine authorization denied.');
    }
    if (writeOffQty <= 0 || writeOffQty > batch.quantity) {
      throw new Error(`Invalid write-off quantity: ${writeOffQty}. Available stock: ${batch.quantity}`);
    }

    batch.quantity -= writeOffQty;
    if (batch.quantity === 0) {
      batch.isQuarantined = true;
    }

    return {
      success: true,
      batchNumber: batch.batchNumber,
      quarantinedQty: writeOffQty,
      reason,
      authorizedBy: {
        pharmacist: 'PHARMACIST_OK',
        supervisor: 'SUPERVISOR_OK',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
