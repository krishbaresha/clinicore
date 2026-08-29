/**
 * ClinicFlow Multi-Warehouse & Godown Management Service
 * Handles multi-location inventory scoping, transfer dispatching, and RBAC validation.
 */

export type WarehouseType = 'PRIMARY_STORE' | 'SECONDARY_GODOWN' | 'QUARANTINE_GODOWN';

export type UserRole = 'PHARMACIST' | 'STORE_MANAGER' | 'ADMIN' | 'DOCTOR' | 'DISPENSER';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  location: string;
  is_active: boolean;
}

export interface StockLevel {
  warehouse_id: string;
  medicine_id: string;
  medicine_name: string;
  batch_number: string;
  quantity: number;
}

export interface StockTransferRequest {
  id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  medicine_id: string;
  medicine_name: string;
  batch_number: string;
  quantity: number;
  initiated_by_user_id: string;
  user_role: UserRole;
  notes?: string;
}

export interface StockTransferResult {
  transfer_id: string;
  status: 'COMPLETED' | 'FAILED';
  out_record: {
    event_type: 'GODOWN_TRANSFER_OUT';
    warehouse_id: string;
    previous_qty: number;
    new_qty: number;
  };
  in_record: {
    event_type: 'GODOWN_TRANSFER_IN';
    warehouse_id: string;
    previous_qty: number;
    new_qty: number;
  };
  transferred_qty: number;
  timestamp: string;
}

export class GodownService {
  private warehouses: Map<string, Warehouse> = new Map();
  // Key format: `${warehouse_id}:${medicine_id}:${batch_number}`
  private stockMap: Map<string, StockLevel> = new Map();
  private transferHistory: StockTransferResult[] = [];

  constructor() {
    // Initialize default warehouses
    this.registerWarehouse({
      id: 'wh-main-01',
      code: 'MAIN-STORE',
      name: 'Main Pharmacy Retail Dispensing Store',
      type: 'PRIMARY_STORE',
      location: 'Ground Floor, Clinic OPD',
      is_active: true,
    });

    this.registerWarehouse({
      id: 'wh-godown-01',
      code: 'GODOWN-HYD-1',
      name: 'Interior Sindh Wholesale Godown 1',
      type: 'SECONDARY_GODOWN',
      location: 'Basement Storage Unit A',
      is_active: true,
    });
  }

  /**
   * Register a new warehouse location
   */
  public registerWarehouse(wh: Warehouse): void {
    this.warehouses.set(wh.id, wh);
  }

  /**
   * Retrieves warehouse by ID
   */
  public getWarehouse(id: string): Warehouse | undefined {
    return this.warehouses.get(id);
  }

  /**
   * Validates if a user role has RBAC permissions to transfer or manage stock in a given warehouse location
   */
  public validateWarehouseAccess(role: UserRole, warehouseId: string, action: 'READ' | 'WRITE' | 'TRANSFER'): boolean {
    const wh = this.warehouses.get(warehouseId);
    if (!wh || !wh.is_active) {
      throw new Error(`[GODOWN_RBAC_ERROR] Inactive or invalid warehouse ID '${warehouseId}'`);
    }

    // Role-based permissions matrix
    switch (role) {
      case 'ADMIN':
      case 'DOCTOR':
        return true; // Full access across primary and secondary godowns

      case 'STORE_MANAGER':
        // Full read/write/transfer across all godowns
        return true;

      case 'PHARMACIST':
        // Pharmacist can read/write Primary Store and initiate transfers, but cannot write directly to secondary godowns without approval
        if (wh.type === 'PRIMARY_STORE') return true;
        if (action === 'READ' || action === 'TRANSFER') return true;
        return false;

      case 'DISPENSER':
        // Dispenser can only read stock and transfer into Primary Store
        if (action === 'READ') return true;
        if (action === 'TRANSFER' && wh.type === 'PRIMARY_STORE') return true;
        return false;

      default:
        return false;
    }
  }

  /**
   * Key generator helper
   */
  private buildStockKey(warehouseId: string, medicineId: string, batchNumber: string): string {
    return `${warehouseId}:${medicineId}:${batchNumber}`;
  }

  /**
   * Sets or updates current stock for a warehouse batch
   */
  public setStock(warehouseId: string, medicineId: string, medicineName: string, batchNumber: string, quantity: number): void {
    if (quantity < 0) {
      throw new Error('[GODOWN_ERROR] Stock quantity cannot be negative');
    }
    const key = this.buildStockKey(warehouseId, medicineId, batchNumber);
    this.stockMap.set(key, {
      warehouse_id: warehouseId,
      medicine_id: medicineId,
      medicine_name: medicineName,
      batch_number: batchNumber,
      quantity,
    });
  }

  /**
   * Gets stock level for a specific warehouse batch
   */
  public getStock(warehouseId: string, medicineId: string, batchNumber: string): number {
    const key = this.buildStockKey(warehouseId, medicineId, batchNumber);
    return this.stockMap.get(key)?.quantity || 0;
  }

  /**
   * Gets total stock for a medicine across ALL godowns or filtered by location type
   */
  public getScopedStock(medicineId: string, warehouseType?: WarehouseType): number {
    let total = 0;
    for (const stock of this.stockMap.values()) {
      if (stock.medicine_id !== medicineId) continue;
      if (warehouseType) {
        const wh = this.warehouses.get(stock.warehouse_id);
        if (!wh || wh.type !== warehouseType) continue;
      }
      total += stock.quantity;
    }
    return total;
  }

  /**
   * Dispatches inter-godown stock transfer (GODOWN_TRANSFER_OUT / GODOWN_TRANSFER_IN)
   */
  public dispatchStockTransfer(req: StockTransferRequest): StockTransferResult {
    // 1. RBAC Check on Source and Destination
    const sourceAllowed = this.validateWarehouseAccess(req.user_role, req.from_warehouse_id, 'TRANSFER');
    const destAllowed = this.validateWarehouseAccess(req.user_role, req.to_warehouse_id, 'TRANSFER');

    if (!sourceAllowed || !destAllowed) {
      throw new Error(`[GODOWN_RBAC_ERROR] Role '${req.user_role}' is unauthorized to perform stock transfer between requested locations`);
    }

    if (req.from_warehouse_id === req.to_warehouse_id) {
      throw new Error('[GODOWN_TRANSFER_ERROR] Source and destination warehouses must be different');
    }

    if (req.quantity <= 0) {
      throw new Error('[GODOWN_TRANSFER_ERROR] Transfer quantity must be greater than zero');
    }

    const sourceKey = this.buildStockKey(req.from_warehouse_id, req.medicine_id, req.batch_number);
    const destKey = this.buildStockKey(req.to_warehouse_id, req.medicine_id, req.batch_number);

    const sourceStock = this.stockMap.get(sourceKey);
    const currentSourceQty = sourceStock ? sourceStock.quantity : 0;

    // 2. Insufficient stock guard
    if (currentSourceQty < req.quantity) {
      throw new Error(
        `[GODOWN_TRANSFER_ERROR] Insufficient stock in source warehouse '${req.from_warehouse_id}'. Available: ${currentSourceQty}, Requested: ${req.quantity}`
      );
    }

    const destStock = this.stockMap.get(destKey);
    const currentDestQty = destStock ? destStock.quantity : 0;

    // 3. Perform Delta Math
    const newSourceQty = currentSourceQty - req.quantity;
    const newDestQty = currentDestQty + req.quantity;

    // 4. Update Stock map atomically
    this.stockMap.set(sourceKey, {
      warehouse_id: req.from_warehouse_id,
      medicine_id: req.medicine_id,
      medicine_name: req.medicine_name,
      batch_number: req.batch_number,
      quantity: newSourceQty,
    });

    this.stockMap.set(destKey, {
      warehouse_id: req.to_warehouse_id,
      medicine_id: req.medicine_id,
      medicine_name: req.medicine_name,
      batch_number: req.batch_number,
      quantity: newDestQty,
    });

    const result: StockTransferResult = {
      transfer_id: req.id,
      status: 'COMPLETED',
      out_record: {
        event_type: 'GODOWN_TRANSFER_OUT',
        warehouse_id: req.from_warehouse_id,
        previous_qty: currentSourceQty,
        new_qty: newSourceQty,
      },
      in_record: {
        event_type: 'GODOWN_TRANSFER_IN',
        warehouse_id: req.to_warehouse_id,
        previous_qty: currentDestQty,
        new_qty: newDestQty,
      },
      transferred_qty: req.quantity,
      timestamp: new Date().toISOString(),
    };

    this.transferHistory.push(result);
    return result;
  }

  /**
   * Returns transfer log history
   */
  public getTransferHistory(): StockTransferResult[] {
    return [...this.transferHistory];
  }
}
