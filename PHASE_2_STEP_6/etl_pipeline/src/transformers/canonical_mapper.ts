/**
 * CanonicalMapper - Legacy Staging to Canonical PostgreSQL Schema Transformer
 * Maps validated raw MS Access staging records to canonical PostgreSQL table schemas while
 * guaranteeing 100% _legacy_id, _legacy_table, and _legacy_source provenance metadata lineage.
 */

import type {
  StagedDataSet,
  StagedRecord,
  RawAccountRecord,
  RawInventoryRecord,
  RawInvextraRecord,
  RawMainproRecord,
  RawMainAcRecord,
  RawCashBookRecord,
  RawAppointmentRecord
} from '../extractors/accdb_extractor.ts';

export interface CanonicalBaseProvenance {
  _legacy_id: string | number;
  _legacy_table: string;
  _legacy_source: string;
  _transformed_at: string;
}

export interface CanonicalParty extends CanonicalBaseProvenance {
  id: string;
  party_code: string;
  name: string;
  account_type: string;
  narration?: string;
}

export interface CanonicalSupplier extends CanonicalBaseProvenance {
  id: string;
  supplier_code: string;
  name: string;
  account_type: string;
}

export interface CanonicalInventoryItem extends CanonicalBaseProvenance {
  id: string;
  sku_code: string;
  name: string;
  purchase_price_unit: number;
  retail_price_unit: number;
  min_reorder_qty: number;
  narration?: string;
}

export interface CanonicalB2BSale extends CanonicalBaseProvenance {
  id: string;
  invoice_number: string;
  party_name: string;
  salesman?: string;
  gross_amount: number;
  cash_paid: number;
  term?: string;
  sale_date: string;
}

export interface CanonicalPurchase extends CanonicalBaseProvenance {
  id: string;
  invoice_number: string;
  supplier_name: string;
  total_amount: number;
  purchase_date: string;
}

export interface CanonicalStockMovement extends CanonicalBaseProvenance {
  id: string;
  voucher_no: string;
  item_name: string;
  movement_type: 'PURCHASE_RECEIPT' | 'POS_SALE' | 'B2B_SALE' | 'ADJUSTMENT';
  qty_in: number;
  qty_out: number;
  rate: number;
  gross_amount: number;
  discount_percent: number;
  net_amount: number;
  movement_date: string;
}

export interface CanonicalCashbookEntry extends CanonicalBaseProvenance {
  id: string;
  voucher_no: string;
  account_name: string;
  description?: string;
  transaction_type?: string;
  debit: number;
  credit: number;
  entry_date: string;
}

export interface CanonicalAppointment extends CanonicalBaseProvenance {
  id: string;
  patient_name: string;
  phone: string;
  appointment_date: string;
  doctor_name: string;
  status: string;
  notes?: string;
}

export interface CanonicalBundle {
  parties: CanonicalParty[];
  suppliers: CanonicalSupplier[];
  inventory: CanonicalInventoryItem[];
  b2bSales: CanonicalB2BSale[];
  purchases: CanonicalPurchase[];
  stockMovements: CanonicalStockMovement[];
  cashbook: CanonicalCashbookEntry[];
  appointments: CanonicalAppointment[];
}

export class CanonicalMapper {
  private generateUuid(prefix: string, legacyId: string | number): string {
    return `${prefix}-LEGACY-${legacyId}`;
  }

  /**
   * Map Accounts table to Parties & Suppliers
   */
  public mapAccounts(accounts: StagedRecord<RawAccountRecord>[]): {
    parties: CanonicalParty[];
    suppliers: CanonicalSupplier[];
  } {
    const parties: CanonicalParty[] = [];
    const suppliers: CanonicalSupplier[] = [];
    const transformedAt = new Date().toISOString();

    for (const acc of accounts) {
      const type = (acc['Account Type'] || '').trim().toLowerCase();

      if (type === 'party' || type === 'customer') {
        parties.push({
          id: this.generateUuid('PTY', acc._legacy_id),
          party_code: acc['Account No'] ? String(acc['Account No']).trim() : `PTY-${acc._legacy_id}`,
          name: acc['Account Name'],
          account_type: acc['Account Type'],
          narration: acc.Naration,
          _legacy_id: acc._legacy_id,
          _legacy_table: acc._legacy_table,
          _legacy_source: acc._legacy_source,
          _transformed_at: transformedAt
        });
      } else if (type === 'supplier' || type === 'company') {
        suppliers.push({
          id: this.generateUuid('SUP', acc._legacy_id),
          supplier_code: acc['Account No'] ? String(acc['Account No']).trim() : `SUP-${acc._legacy_id}`,
          name: acc['Account Name'],
          account_type: acc['Account Type'],
          _legacy_id: acc._legacy_id,
          _legacy_table: acc._legacy_table,
          _legacy_source: acc._legacy_source,
          _transformed_at: transformedAt
        });
      }
    }

    return { parties, suppliers };
  }

  /**
   * Map Inventory table to Canonical Inventory Items
   */
  public mapInventory(inventory: StagedRecord<RawInventoryRecord>[]): CanonicalInventoryItem[] {
    const transformedAt = new Date().toISOString();
    return inventory.map((item) => {
      const rawCode = item['Item Code'] ? String(item['Item Code']).trim() : '';
      const skuCode = rawCode || `SKU-${item._legacy_id}`;

      return {
        id: this.generateUuid('INV', item._legacy_id),
        sku_code: skuCode,
        name: item['Item Name'],
        purchase_price_unit: Number(item['Purchase Price']) || 0,
        retail_price_unit: Number(item['Sale Price']) || 0,
        min_reorder_qty: Number(item['Minimum Level']) || 0,
        narration: item.Naration,
        _legacy_id: item._legacy_id,
        _legacy_table: item._legacy_table,
        _legacy_source: item._legacy_source,
        _transformed_at: transformedAt
      };
    });
  }

  /**
   * Map Invextra table to B2B Sales & Purchases headers
   */
  public mapInvextra(invextra: StagedRecord<RawInvextraRecord>[]): {
    b2bSales: CanonicalB2BSale[];
    purchases: CanonicalPurchase[];
  } {
    const b2bSales: CanonicalB2BSale[] = [];
    const purchases: CanonicalPurchase[] = [];
    const transformedAt = new Date().toISOString();

    for (const inv of invextra) {
      const type = (inv.Type || '').trim().toLowerCase();

      if (type === 'sale') {
        b2bSales.push({
          id: this.generateUuid('SALE', inv._legacy_id),
          invoice_number: inv['Voucher No'],
          party_name: inv['Account Name'] || 'Cash Customer',
          salesman: inv.SalesMan,
          gross_amount: Number(inv['Net Amount']) || 0,
          cash_paid: Number(inv['Cash Received']) || 0,
          term: inv.Term,
          sale_date: inv.Date || new Date().toISOString().split('T')[0],
          _legacy_id: inv._legacy_id,
          _legacy_table: inv._legacy_table,
          _legacy_source: inv._legacy_source,
          _transformed_at: transformedAt
        });
      } else if (type === 'purchase') {
        purchases.push({
          id: this.generateUuid('PURCH', inv._legacy_id),
          invoice_number: inv['Voucher No'],
          supplier_name: inv['Account Name'] || 'Default Supplier',
          total_amount: Number(inv['Net Amount']) || 0,
          purchase_date: inv.Date || new Date().toISOString().split('T')[0],
          _legacy_id: inv._legacy_id,
          _legacy_table: inv._legacy_table,
          _legacy_source: inv._legacy_source,
          _transformed_at: transformedAt
        });
      }
    }

    return { b2bSales, purchases };
  }

  /**
   * Map Mainpro stock table to Canonical Stock Movements
   */
  public mapMainpro(mainpro: StagedRecord<RawMainproRecord>[]): CanonicalStockMovement[] {
    const transformedAt = new Date().toISOString();
    return mainpro.map((mp) => {
      const qtyIn = Number(mp.In) || 0;
      const qtyOut = Number(mp.Out) || 0;
      const txType = (mp['Transaction Type'] || '').trim().toUpperCase();

      let movementType: CanonicalStockMovement['movement_type'] = 'ADJUSTMENT';
      if (qtyIn > 0 || txType.includes('PURCHASE')) {
        movementType = 'PURCHASE_RECEIPT';
      } else if (qtyOut > 0 || txType.includes('SALE')) {
        movementType = 'B2B_SALE';
      }

      return {
        id: this.generateUuid('STK', mp._legacy_id),
        voucher_no: mp['Voucher No'],
        item_name: mp['Item name'],
        movement_type: movementType,
        qty_in: qtyIn,
        qty_out: qtyOut,
        rate: Number(mp.Rate) || 0,
        gross_amount: Number(mp.Gross) || 0,
        discount_percent: Number(mp['Disc%']) || 0,
        net_amount: Number(mp.Net) || 0,
        movement_date: mp.Date || new Date().toISOString().split('T')[0],
        _legacy_id: mp._legacy_id,
        _legacy_table: mp._legacy_table,
        _legacy_source: mp._legacy_source,
        _transformed_at: transformedAt
      };
    });
  }

  /**
   * Map MainAc & CashBook financial entries to Canonical Cashbook/Ledger entries
   */
  public mapLedgerEntries(
    mainAc: StagedRecord<RawMainAcRecord>[],
    cashBook: StagedRecord<RawCashBookRecord>[]
  ): CanonicalCashbookEntry[] {
    const transformedAt = new Date().toISOString();
    const entries: CanonicalCashbookEntry[] = [];

    for (const mac of mainAc) {
      entries.push({
        id: this.generateUuid('MAC', mac._legacy_id),
        voucher_no: mac['Voucher No'],
        account_name: mac['Account Name'],
        description: mac.Description,
        transaction_type: mac['Transaction Type'],
        debit: Number(mac.Debit) || 0,
        credit: Number(mac.Credit) || 0,
        entry_date: mac.Date || new Date().toISOString().split('T')[0],
        _legacy_id: mac._legacy_id,
        _legacy_table: mac._legacy_table,
        _legacy_source: mac._legacy_source,
        _transformed_at: transformedAt
      });
    }

    for (const cb of cashBook) {
      entries.push({
        id: this.generateUuid('CB', cb._legacy_id),
        voucher_no: cb['Voucher No'],
        account_name: cb['Account Name'],
        description: cb.Description,
        debit: Number(cb.Debit) || 0,
        credit: Number(cb.Credit) || 0,
        entry_date: cb.Date || new Date().toISOString().split('T')[0],
        _legacy_id: cb._legacy_id,
        _legacy_table: cb._legacy_table,
        _legacy_source: cb._legacy_source,
        _transformed_at: transformedAt
      });
    }

    return entries;
  }

  /**
   * Map Appointment table to Canonical Appointments
   */
  public mapAppointments(appointments: StagedRecord<RawAppointmentRecord>[]): CanonicalAppointment[] {
    const transformedAt = new Date().toISOString();
    return appointments.map((apt) => ({
      id: this.generateUuid('APT', apt._legacy_id),
      patient_name: apt['Patient Name'],
      phone: apt.Phone || '',
      appointment_date: apt['Appointment Date'],
      doctor_name: apt.Doctor || 'H/Dr. Asif Ashraf Khan',
      status: apt.Status || 'SCHEDULED',
      notes: apt.Notes,
      _legacy_id: apt._legacy_id,
      _legacy_table: apt._legacy_table,
      _legacy_source: apt._legacy_source,
      _transformed_at: transformedAt
    }));
  }

  /**
   * Transform entire staged dataset to Canonical Bundle
   */
  public transform(dataset: StagedDataSet): CanonicalBundle {
    const { parties, suppliers } = this.mapAccounts(dataset.accounts);
    const inventory = this.mapInventory(dataset.inventory);
    const { b2bSales, purchases } = this.mapInvextra(dataset.invextra);
    const stockMovements = this.mapMainpro(dataset.mainpro);
    const cashbook = this.mapLedgerEntries(dataset.mainAc, dataset.cashBook);
    const appointments = this.mapAppointments(dataset.appointments);

    return {
      parties,
      suppliers,
      inventory,
      b2bSales,
      purchases,
      stockMovements,
      cashbook,
      appointments
    };
  }
}
