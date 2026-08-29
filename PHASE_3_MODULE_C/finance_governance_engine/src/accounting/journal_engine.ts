/**
 * ClinicFlow Financial Accounting Journal Engine
 * Enforces double-entry bookkeeping rules:
 * 1. total_debit === total_credit (balanced entry rule)
 * 2. Closed period protection (is_period_closed guard)
 * 3. Non-destructive compensating reversals (REVERSAL entry type)
 * 4. Trial balance reconciler
 */

export interface JournalLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  entry_date: string; // ISO format YYYY-MM-DD
  description: string;
  lines: JournalLine[];
  entry_type: 'STANDARD' | 'REVERSAL' | 'ADJUSTMENT';
  reference_id?: string; // Links to reversed entry or invoice
  created_at: string;
  is_posted: boolean;
}

export interface TrialBalanceItem {
  account_code: string;
  account_name: string;
  total_debit: number;
  total_credit: number;
  net_balance: number; // positive = debit balance, negative = credit balance
}

export interface TrialBalanceReport {
  items: TrialBalanceItem[];
  grand_total_debit: number;
  grand_total_credit: number;
  is_balanced: boolean;
  variance: number;
}

export class JournalEngine {
  private entries: Map<string, JournalEntry> = new Map();
  private closedPeriods: Set<string> = new Set(); // Stores closed YYYY-MM period strings

  /**
   * Closes an accounting period (e.g. '2026-08')
   */
  public closePeriod(period: string): void {
    this.closedPeriods.add(period);
  }

  /**
   * Reopens an accounting period
   */
  public reopenPeriod(period: string): void {
    this.closedPeriods.delete(period);
  }

  /**
   * Checks if an entry's date falls within a closed period
   */
  public isPeriodClosed(dateString: string): boolean {
    const period = dateString.substring(0, 7); // Extract YYYY-MM
    return this.closedPeriods.has(period);
  }

  /**
   * Creates and posts a double-entry journal record
   */
  public createEntry(params: {
    id: string;
    entry_date: string;
    description: string;
    lines: JournalLine[];
    entry_type?: 'STANDARD' | 'REVERSAL' | 'ADJUSTMENT';
    reference_id?: string;
  }): JournalEntry {
    const { id, entry_date, description, lines, entry_type = 'STANDARD', reference_id } = params;

    // Guard 1: Closed period verification
    if (this.isPeriodClosed(entry_date)) {
      throw new Error(`[JOURNAL_ERROR] Cannot record entry for closed period '${entry_date.substring(0, 7)}'`);
    }

    // Guard 2: Minimum line requirement
    if (!lines || lines.length < 2) {
      throw new Error('[JOURNAL_ERROR] Journal entry must contain at least 2 line items');
    }

    // Guard 3: Calculate sum of debits and credits
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error(`[JOURNAL_ERROR] Line values must be non-negative. Received debit: ${line.debit}, credit: ${line.credit}`);
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new Error(`[JOURNAL_ERROR] Line cannot contain both debit and credit amounts simultaneously`);
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    // Rounding safety check for floating point precision
    const debitRounded = Math.round(totalDebit * 100) / 100;
    const creditRounded = Math.round(totalCredit * 100) / 100;

    if (debitRounded <= 0 || creditRounded <= 0) {
      throw new Error('[JOURNAL_ERROR] Journal entry total monetary value must be greater than zero');
    }

    // Guard 4: Total debit MUST equal total credit
    if (Math.abs(debitRounded - creditRounded) > 0.001) {
      throw new Error(
        `[JOURNAL_ERROR] Unbalanced journal entry! Total debit (Rs. ${debitRounded}) does not equal total credit (Rs. ${creditRounded})`
      );
    }

    // Duplicate ID guard
    if (this.entries.has(id)) {
      throw new Error(`[JOURNAL_ERROR] Entry ID '${id}' already exists`);
    }

    const entry: JournalEntry = {
      id,
      entry_date,
      description,
      lines: lines.map((l) => ({ ...l })),
      entry_type,
      reference_id,
      created_at: new Date().toISOString(),
      is_posted: true,
    };

    this.entries.set(id, entry);
    return entry;
  }

  /**
   * Creates a non-destructive compensating reversal for an existing journal entry
   */
  public reverseEntry(originalEntryId: string, reversalId: string, reversalDate: string, reason: string): JournalEntry {
    const original = this.entries.get(originalEntryId);
    if (!original) {
      throw new Error(`[JOURNAL_ERROR] Original entry '${originalEntryId}' not found for reversal`);
    }

    if (this.isPeriodClosed(reversalDate)) {
      throw new Error(`[JOURNAL_ERROR] Cannot post reversal entry into closed period '${reversalDate.substring(0, 7)}'`);
    }

    // Create opposing lines: original debits become credits, original credits become debits
    const reversedLines: JournalLine[] = original.lines.map((line) => ({
      account_code: line.account_code,
      account_name: line.account_name,
      debit: line.credit, // SWAP DEBIT & CREDIT
      credit: line.debit,
      memo: `Reversal of ${line.account_code} - ${reason}`,
    }));

    return this.createEntry({
      id: reversalId,
      entry_date: reversalDate,
      description: `[COMPENSATING REVERSAL] ${original.description} | Reason: ${reason}`,
      lines: reversedLines,
      entry_type: 'REVERSAL',
      reference_id: originalEntryId,
    });
  }

  /**
   * Generates a reconciled Trial Balance across all posted journal entries
   */
  public getTrialBalance(): TrialBalanceReport {
    const accountMap = new Map<string, { account_name: string; total_debit: number; total_credit: number }>();

    for (const entry of this.entries.values()) {
      if (!entry.is_posted) continue;

      for (const line of entry.lines) {
        const existing = accountMap.get(line.account_code) || {
          account_name: line.account_name,
          total_debit: 0,
          total_credit: 0,
        };

        existing.total_debit += line.debit;
        existing.total_credit += line.credit;
        accountMap.set(line.account_code, existing);
      }
    }

    const items: TrialBalanceItem[] = [];
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    for (const [code, acc] of accountMap.entries()) {
      const debitRounded = Math.round(acc.total_debit * 100) / 100;
      const creditRounded = Math.round(acc.total_credit * 100) / 100;
      const net = Math.round((debitRounded - creditRounded) * 100) / 100;

      items.push({
        account_code: code,
        account_name: acc.account_name,
        total_debit: debitRounded,
        total_credit: creditRounded,
        net_balance: net,
      });

      grandTotalDebit += debitRounded;
      grandTotalCredit += creditRounded;
    }

    grandTotalDebit = Math.round(grandTotalDebit * 100) / 100;
    grandTotalCredit = Math.round(grandTotalCredit * 100) / 100;

    const variance = Math.round((grandTotalDebit - grandTotalCredit) * 100) / 100;

    return {
      items: items.sort((a, b) => a.account_code.localeCompare(b.account_code)),
      grand_total_debit: grandTotalDebit,
      grand_total_credit: grandTotalCredit,
      is_balanced: Math.abs(variance) < 0.001,
      variance,
    };
  }

  /**
   * Retrieves an entry by ID
   */
  public getEntry(id: string): JournalEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Returns all posted journal entries
   */
  public getAllEntries(): JournalEntry[] {
    return Array.from(this.entries.values());
  }
}
