/**
 * StagingValidator - Staging Data Integrity & Invariant Validation Engine
 * Validates SKU code formatting, debit/credit ledger balance invariants, and party code mappings.
 */

import type {
  StagedDataSet,
  StagedRecord,
  RawAccountRecord,
  RawInventoryRecord,
  RawMainAcRecord,
  RawCashBookRecord
} from '../extractors/accdb_extractor.ts';

export interface ValidationError {
  table: string;
  legacyId: string | number;
  code: 'MISSING_SKU' | 'UNBALANCED_TRANSACTION' | 'MISSING_PARTY_CODE' | 'INVALID_AMOUNT' | 'DUPLICATE_KEY';
  message: string;
  details?: Record<string, any>;
}

export interface ValidationWarning {
  table: string;
  legacyId: string | number;
  code: 'SKU_AUTO_GENERATED' | 'MISSING_OPTIONAL_FIELD' | 'PARTY_NAME_NORMALIZED';
  message: string;
  suggestedValue?: string | number;
}

export interface ValidationSummary {
  isValid: boolean;
  totalRecordsAnalyzed: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: {
    validInventoryCount: number;
    missingSkuCount: number;
    unbalancedVouchersCount: number;
    validPartyCount: number;
    missingPartyCodeCount: number;
    totalDebit: number;
    totalCredit: number;
  };
}

export class StagingValidator {
  /**
   * Validate SKU Code Formatting in Inventory
   */
  public validateSkuFormatting(inventory: StagedRecord<RawInventoryRecord>[]): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    validCount: number;
    missingSkuCount: number;
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let validCount = 0;
    let missingSkuCount = 0;

    for (const item of inventory) {
      const skuCode = item['Item Code'] ? String(item['Item Code']).trim() : '';

      if (!skuCode) {
        missingSkuCount++;
        errors.push({
          table: 'Inventory',
          legacyId: item._legacy_id,
          code: 'MISSING_SKU',
          message: `Inventory item '${item['Item Name']}' is missing an SKU code (Item Code).`,
          details: { itemName: item['Item Name'] }
        });
        warnings.push({
          table: 'Inventory',
          legacyId: item._legacy_id,
          code: 'SKU_AUTO_GENERATED',
          message: `Generated fallback SKU 'SKU-${item._legacy_id}' for '${item['Item Name']}'.`,
          suggestedValue: `SKU-${item._legacy_id}`
        });
      } else {
        validCount++;
      }
    }

    return { errors, warnings, validCount, missingSkuCount };
  }

  /**
   * Validate Financial Ledger Debit/Credit Balance Invariants
   */
  public validateLedgerBalanceInvariants(
    mainAc: StagedRecord<RawMainAcRecord>[],
    cashBook: StagedRecord<RawCashBookRecord>[]
  ): {
    errors: ValidationError[];
    totalDebit: number;
    totalCredit: number;
    unbalancedVouchersCount: number;
  } {
    const errors: ValidationError[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    // 1. Calculate overall totals
    const allLedger = [...mainAc, ...cashBook];
    for (const entry of allLedger) {
      const debit = Number(entry.Debit) || 0;
      const credit = Number(entry.Credit) || 0;
      totalDebit += debit;
      totalCredit += credit;
    }

    // 2. Group by Voucher No to test per-transaction double-entry balance
    const voucherGroups = new Map<string, { debit: number; credit: number; entries: StagedRecord<RawMainAcRecord | RawCashBookRecord>[] }>();

    for (const entry of allLedger) {
      const voucherNo = entry['Voucher No'] ? String(entry['Voucher No']).trim() : `UNGROUPED-${entry._legacy_id}`;
      if (!voucherGroups.has(voucherNo)) {
        voucherGroups.set(voucherNo, { debit: 0, credit: 0, entries: [] });
      }
      const group = voucherGroups.get(voucherNo)!;
      group.debit += Number(entry.Debit) || 0;
      group.credit += Number(entry.Credit) || 0;
      group.entries.push(entry);
    }

    let unbalancedVouchersCount = 0;
    for (const [voucherNo, group] of voucherGroups.entries()) {
      // Round to 2 decimal places to avoid floating point precision artifacts
      const roundDebit = Math.round(group.debit * 100) / 100;
      const roundCredit = Math.round(group.credit * 100) / 100;

      if (roundDebit !== roundCredit) {
        unbalancedVouchersCount++;
        const firstEntry = group.entries[0];
        errors.push({
          table: firstEntry._legacy_table,
          legacyId: firstEntry._legacy_id,
          code: 'UNBALANCED_TRANSACTION',
          message: `Voucher '${voucherNo}' is unbalanced: Total Debit (Rs ${roundDebit}) != Total Credit (Rs ${roundCredit}). Difference: Rs ${Math.abs(roundDebit - roundCredit)}.`,
          details: { voucherNo, totalDebit: roundDebit, totalCredit: roundCredit }
        });
      }
    }

    return {
      errors,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      unbalancedVouchersCount
    };
  }

  /**
   * Validate Party Code Mappings
   */
  public validatePartyCodeMappings(accounts: StagedRecord<RawAccountRecord>[]): {
    errors: ValidationError[];
    validCount: number;
    missingPartyCodeCount: number;
  } {
    const errors: ValidationError[] = [];
    let validCount = 0;
    let missingPartyCodeCount = 0;

    for (const acc of accounts) {
      const accType = acc['Account Type'] ? String(acc['Account Type']).trim() : '';
      if (accType === 'Party' || accType === 'Customer') {
        const partyCode = acc['Account No'] ? String(acc['Account No']).trim() : '';
        if (!partyCode) {
          missingPartyCodeCount++;
          errors.push({
            table: 'Accounts',
            legacyId: acc._legacy_id,
            code: 'MISSING_PARTY_CODE',
            message: `Party Account '${acc['Account Name']}' is missing an Account No / Party Code mapping.`,
            details: { accountName: acc['Account Name'] }
          });
        } else {
          validCount++;
        }
      }
    }

    return { errors, validCount, missingPartyCodeCount };
  }

  /**
   * Run Comprehensive Validation on full staged dataset
   */
  public validate(dataset: StagedDataSet): ValidationSummary {
    const skuResult = this.validateSkuFormatting(dataset.inventory);
    const ledgerResult = this.validateLedgerBalanceInvariants(dataset.mainAc, dataset.cashBook);
    const partyResult = this.validatePartyCodeMappings(dataset.accounts);

    const allErrors = [...skuResult.errors, ...ledgerResult.errors, ...partyResult.errors];
    const allWarnings = [...skuResult.warnings];

    const totalRecordsAnalyzed =
      dataset.accounts.length +
      dataset.inventory.length +
      dataset.invextra.length +
      dataset.mainpro.length +
      dataset.mainAc.length +
      dataset.cashBook.length +
      dataset.appointments.length;

    return {
      isValid: allErrors.length === 0,
      totalRecordsAnalyzed,
      errors: allErrors,
      warnings: allWarnings,
      metrics: {
        validInventoryCount: skuResult.validCount,
        missingSkuCount: skuResult.missingSkuCount,
        unbalancedVouchersCount: ledgerResult.unbalancedVouchersCount,
        validPartyCount: partyResult.validCount,
        missingPartyCodeCount: partyResult.missingPartyCodeCount,
        totalDebit: ledgerResult.totalDebit,
        totalCredit: ledgerResult.totalCredit
      }
    };
  }
}
