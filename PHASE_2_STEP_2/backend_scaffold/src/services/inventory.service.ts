export interface StockBatchInput {
  id: string;
  inventoryId: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  isQuarantined: boolean;
}

export class InventoryService {
  /**
   * Sorts medicine batches by FEFO (First Expiry First Out)
   */
  public static sortBatchesFEFO(batches: StockBatchInput[]): StockBatchInput[] {
    const today = new Date().toISOString().split('T')[0];
    return batches
      .filter((b) => !b.isQuarantined && b.quantityAvailable > 0 && b.expiryDate >= today)
      .sort((a, b) => {
        if (a.expiryDate === b.expiryDate) {
          return a.batchNumber.localeCompare(b.batchNumber);
        }
        return a.expiryDate.localeCompare(b.expiryDate);
      });
  }

  /**
   * Computes stock movement delta and resulting total quantity
   */
  public static calculateStockDelta(currentQty: number, movementType: string, deltaQty: number): number {
    const isIncrease = [
      'PURCHASE_RECEIPT',
      'CUSTOMER_RETURN',
      'GODOWN_TRANSFER_IN',
      'STOCK_ADJUSTMENT_ADD',
    ].includes(movementType);

    const isDecrease = [
      'POS_SALE',
      'B2B_SALE',
      'SUPPLIER_RETURN',
      'GODOWN_TRANSFER_OUT',
      'EXPIRED_QUARANTINE',
      'STOCK_ADJUSTMENT_SUB',
    ].includes(movementType);

    if (isIncrease) {
      return Math.round((currentQty + deltaQty) * 1000) / 1000;
    } else if (isDecrease) {
      const result = Math.round((currentQty - deltaQty) * 1000) / 1000;
      if (result < 0) {
        throw new Error(`Insufficient stock: current (${currentQty}) < delta (${deltaQty})`);
      }
      return result;
    }
    return currentQty;
  }
}
