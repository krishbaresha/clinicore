export interface JournalLineInput {
  accountId: string;
  partyId?: string;
  supplierId?: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface CreateJournalEntryInput {
  clinicId: string;
  entryNumber: string;
  entryDate: string;
  voucherNumber?: string;
  description: string;
  createdBy: string;
  lines: JournalLineInput[];
}

export class AccountingService {
  /**
   * Enforces double-entry invariant: Sum(Debits) == Sum(Credits)
   */
  public static validateDoubleEntryBalance(lines: JournalLineInput[]): {
    isValid: boolean;
    totalDebit: number;
    totalCredit: number;
    variance: number;
  } {
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error('Debit and Credit amounts cannot be negative');
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new Error('A journal line cannot contain both Debit and Credit amounts');
      }
      totalDebit = Math.round((totalDebit + line.debit) * 100) / 100;
      totalCredit = Math.round((totalCredit + line.credit) * 100) / 100;
    }

    const variance = Math.abs(Math.round((totalDebit - totalCredit) * 100) / 100);
    return {
      isValid: variance === 0,
      totalDebit,
      totalCredit,
      variance,
    };
  }
}
