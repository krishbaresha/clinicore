/**
 * AccdbExtractor - Legacy MS Access Extractor for AshrafKhan.accdb
 * Extracts raw records from legacy tables (Accounts, Inventory, Invextra, Mainpro, MainAc, CashBook, Appointment)
 * and attaches staging lineage metadata.
 */

export interface ProvenanceMetadata {
  _legacy_source: string;
  _legacy_table: string;
  _legacy_id: string | number;
  _extracted_at: string;
}

export interface RawAccountRecord {
  ID: number | string;
  'Account Name': string;
  'Account No'?: string;
  Naration?: string;
  'Account Type': 'Party' | 'Customer' | 'Supplier' | 'Company' | 'Expense' | 'Cash' | string;
}

export interface RawInventoryRecord {
  ID: number | string;
  'Item Name': string;
  'Item Code'?: string;
  Naration?: string;
  'Minimum Level'?: number;
  'Sale Price'?: number;
  'Purchase Price'?: number;
}

export interface RawInvextraRecord {
  ID: number | string;
  Date?: string;
  'Voucher No': string;
  Type: 'Sale' | 'Purchase' | string;
  'Account Name'?: string;
  Term?: string;
  SalesMan?: string;
  'Net Amount': number;
  'Cash Received'?: number;
}

export interface RawMainproRecord {
  ID: number | string;
  Date?: string;
  'Voucher No': string;
  'Transaction Type': string;
  'Item name': string;
  In?: number;
  Out?: number;
  Rate?: number;
  Gross?: number;
  'Disc%'?: number;
  Net?: number;
}

export interface RawMainAcRecord {
  ID: number | string;
  Date?: string;
  'Voucher No': string;
  'Account Name': string;
  'Transaction Type'?: string;
  Description?: string;
  Debit: number;
  Credit: number;
}

export interface RawCashBookRecord {
  ID: number | string;
  Date?: string;
  'Voucher No': string;
  'Account Name': string;
  Description?: string;
  Debit: number;
  Credit: number;
}

export interface RawAppointmentRecord {
  ID: number | string;
  'Patient Name': string;
  Phone?: string;
  'Appointment Date': string;
  Doctor?: string;
  Status?: string;
  Notes?: string;
}

export type StagedRecord<T> = T & ProvenanceMetadata;

export interface StagedDataSet {
  accounts: StagedRecord<RawAccountRecord>[];
  inventory: StagedRecord<RawInventoryRecord>[];
  invextra: StagedRecord<RawInvextraRecord>[];
  mainpro: StagedRecord<RawMainproRecord>[];
  mainAc: StagedRecord<RawMainAcRecord>[];
  cashBook: StagedRecord<RawCashBookRecord>[];
  appointments: StagedRecord<RawAppointmentRecord>[];
}

export class AccdbExtractor {
  private readonly sourceName: string;

  constructor(sourceName: string = 'AshrafKhan.accdb') {
    this.sourceName = sourceName;
  }

  /**
   * Wrap raw record with provenance lineage metadata
   */
  public attachProvenance<T extends { ID: number | string }>(
    tableName: string,
    record: T
  ): StagedRecord<T> {
    return {
      ...record,
      _legacy_source: this.sourceName,
      _legacy_table: tableName,
      _legacy_id: record.ID,
      _extracted_at: new Date().toISOString()
    };
  }

  /**
   * Extract raw tables into staged memory dataset
   */
  public extractAll(rawTables: {
    Accounts?: RawAccountRecord[];
    Inventory?: RawInventoryRecord[];
    Invextra?: RawInvextraRecord[];
    Mainpro?: RawMainproRecord[];
    MainAc?: RawMainAcRecord[];
    CashBook?: RawCashBookRecord[];
    Appointment?: RawAppointmentRecord[];
  }): StagedDataSet {
    return {
      accounts: (rawTables.Accounts || []).map((r) => this.attachProvenance('Accounts', r)),
      inventory: (rawTables.Inventory || []).map((r) => this.attachProvenance('Inventory', r)),
      invextra: (rawTables.Invextra || []).map((r) => this.attachProvenance('Invextra', r)),
      mainpro: (rawTables.Mainpro || []).map((r) => this.attachProvenance('Mainpro', r)),
      mainAc: (rawTables.MainAc || []).map((r) => this.attachProvenance('MainAc', r)),
      cashBook: (rawTables.CashBook || []).map((r) => this.attachProvenance('CashBook', r)),
      appointments: (rawTables.Appointment || []).map((r) => this.attachProvenance('Appointment', r))
    };
  }
}
