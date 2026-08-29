/**
 * Wholesale B2B Distribution Service
 * Handles Party Code Auto-Fill (001, PTY-108), Salesman Tracking, Bilty Transport Metadata,
 * Bill-Level Trade Discounts, and Real-Time Credit Limit Checkers.
 */

export interface WholesaleParty {
  partyCode: string; // e.g. "001", "PTY-108", "Muslim"
  partyName: string;
  city: string;
  phone: string;
  address: string;
  assignedSalesman: string;
  creditLimit: number;
  currentCreditBalance: number;
  status: 'ACTIVE' | 'BLOCKED' | 'SUSPENDED';
}

export interface BiltyTransportMetadata {
  transportCompany: string; // e.g., "Al-Habib Goods Transport Hyderabad"
  biltyNumber: string;       // e.g., "HYD-BLT-9921"
  cartonsCount: number;      // e.g., 5
  destinationCity: string;   // e.g., "Sukkur"
  dispatchDate: string;
  driverPhone?: string;
}

export interface WholesaleInvoiceRequest {
  partyCode: string;
  items: Array<{
    medicineId: string;
    medicineName: string;
    batchNumber: string;
    quantity: number;
    tradePrice: number;
    discountPercent?: number;
  }>;
  overallTradeDiscountPercent?: number;
  overallTradeDiscountFlatRs?: number;
  paymentMode: 'CREDIT' | 'CASH' | 'CHEQUE';
  chequeDetails?: {
    chequeNumber: string;
    bankName: string;
    clearanceDate: string;
    amount: number;
  };
  biltyInfo?: BiltyTransportMetadata;
  overrideSalesman?: string;
}

export interface CreditValidationResult {
  isApproved: boolean;
  partyCode: string;
  partyName: string;
  creditLimit: number;
  currentBalance: number;
  newInvoiceTotal: number;
  projectedBalance: number;
  availableCredit: number;
  breachAmount: number;
  rejectionReason?: string;
}

export interface WholesaleInvoiceSummary {
  invoiceNumber: string;
  party: WholesaleParty;
  salesman: string;
  itemsTotal: number;
  itemDiscountsTotal: number;
  billDiscountTotal: number;
  netInvoiceAmount: number;
  paymentMode: 'CREDIT' | 'CASH' | 'CHEQUE';
  chequeDetails?: WholesaleInvoiceRequest['chequeDetails'];
  biltyInfo?: BiltyTransportMetadata;
  timestamp: string;
}

export class WholesaleB2BService {
  private partiesMap: Map<string, WholesaleParty> = new Map();

  constructor(initialParties: WholesaleParty[] = []) {
    for (const p of initialParties) {
      this.registerParty(p);
    }
  }

  public registerParty(party: WholesaleParty): void {
    // Index by both exact code and lowercased normalized code
    this.partiesMap.set(party.partyCode.trim().toUpperCase(), party);
  }

  /**
   * Wholesale Party Code Auto-Fill
   * Typing or choosing Party Code ('001', 'PTY-108', 'Muslim') instantly resolves full record.
   */
  public autoFillPartyCode(inputCode: string): WholesaleParty | null {
    if (!inputCode) return null;
    const key = inputCode.trim().toUpperCase();

    // 1. Direct key match
    if (this.partiesMap.has(key)) {
      return { ...this.partiesMap.get(key)! };
    }

    // 2. Loose partial match by code or name
    for (const party of this.partiesMap.values()) {
      if (
        party.partyCode.toUpperCase().includes(key) ||
        party.partyName.toUpperCase().includes(key)
      ) {
        return { ...party };
      }
    }

    return null;
  }

  /**
   * Real-Time Credit Limit Checker
   */
  public validateCreditLimit(partyCode: string, newInvoiceTotal: number): CreditValidationResult {
    const party = this.autoFillPartyCode(partyCode);
    if (!party) {
      return {
        isApproved: false,
        partyCode,
        partyName: 'UNKNOWN',
        creditLimit: 0,
        currentBalance: 0,
        newInvoiceTotal,
        projectedBalance: newInvoiceTotal,
        availableCredit: 0,
        breachAmount: newInvoiceTotal,
        rejectionReason: `Party code '${partyCode}' not found in wholesale registry`,
      };
    }

    if (party.status !== 'ACTIVE') {
      return {
        isApproved: false,
        partyCode: party.partyCode,
        partyName: party.partyName,
        creditLimit: party.creditLimit,
        currentBalance: party.currentCreditBalance,
        newInvoiceTotal,
        projectedBalance: party.currentCreditBalance + newInvoiceTotal,
        availableCredit: Math.max(0, party.creditLimit - party.currentCreditBalance),
        breachAmount: 0,
        rejectionReason: `Party account status is ${party.status}`,
      };
    }

    const projectedBalance = party.currentCreditBalance + newInvoiceTotal;
    const availableCredit = party.creditLimit - party.currentCreditBalance;
    const breachAmount = projectedBalance > party.creditLimit ? projectedBalance - party.creditLimit : 0;

    if (breachAmount > 0) {
      return {
        isApproved: false,
        partyCode: party.partyCode,
        partyName: party.partyName,
        creditLimit: party.creditLimit,
        currentBalance: party.currentCreditBalance,
        newInvoiceTotal,
        projectedBalance,
        availableCredit: Math.max(0, availableCredit),
        breachAmount,
        rejectionReason: `Credit limit breached by Rs. ${breachAmount}. Limit: Rs. ${party.creditLimit}, Projected: Rs. ${projectedBalance}`,
      };
    }

    return {
      isApproved: true,
      partyCode: party.partyCode,
      partyName: party.partyName,
      creditLimit: party.creditLimit,
      currentBalance: party.currentCreditBalance,
      newInvoiceTotal,
      projectedBalance,
      availableCredit: Math.max(0, availableCredit),
      breachAmount: 0,
    };
  }

  /**
   * Process Wholesale B2B Transaction with Bill-Level Trade Discounts & Bilty Tracking.
   */
  public createWholesaleInvoice(req: WholesaleInvoiceRequest): WholesaleInvoiceSummary {
    const party = this.autoFillPartyCode(req.partyCode);
    if (!party) {
      throw new Error(`Invalid Wholesale Party Code: ${req.partyCode}`);
    }

    let itemsTotal = 0;
    let itemDiscountsTotal = 0;

    for (const item of req.items) {
      const lineBase = item.tradePrice * item.quantity;
      const lineDiscPercent = item.discountPercent || 0;
      const lineDiscAmount = (lineBase * lineDiscPercent) / 100;

      itemsTotal += lineBase;
      itemDiscountsTotal += lineDiscAmount;
    }

    const netAfterItems = Math.max(0, itemsTotal - itemDiscountsTotal);

    // Bill-level Trade Discounts
    let billDiscountTotal = 0;
    if (req.overallTradeDiscountPercent && req.overallTradeDiscountPercent > 0) {
      billDiscountTotal += (netAfterItems * req.overallTradeDiscountPercent) / 100;
    }
    if (req.overallTradeDiscountFlatRs && req.overallTradeDiscountFlatRs > 0) {
      billDiscountTotal += req.overallTradeDiscountFlatRs;
    }

    billDiscountTotal = Math.min(netAfterItems, billDiscountTotal);
    const netInvoiceAmount = Math.round(Math.max(0, netAfterItems - billDiscountTotal) * 100) / 100;

    // Credit Limit check if CREDIT payment mode
    if (req.paymentMode === 'CREDIT') {
      const creditCheck = this.validateCreditLimit(party.partyCode, netInvoiceAmount);
      if (!creditCheck.isApproved) {
        throw new Error(creditCheck.rejectionReason);
      }
      // Deduct balance internally
      party.currentCreditBalance += netInvoiceAmount;
      this.partiesMap.set(party.partyCode.toUpperCase(), party);
    } else if (req.paymentMode === 'CHEQUE') {
      if (!req.chequeDetails || !req.chequeDetails.chequeNumber || !req.chequeDetails.bankName) {
        throw new Error('Cheque payment mode requires Cheque #, Bank Name, and Clearance Date');
      }
    }

    const salesman = req.overrideSalesman || party.assignedSalesman;
    const invoiceNumber = `WHL-INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return {
      invoiceNumber,
      party,
      salesman,
      itemsTotal,
      itemDiscountsTotal,
      billDiscountTotal,
      netInvoiceAmount,
      paymentMode: req.paymentMode,
      chequeDetails: req.chequeDetails,
      biltyInfo: req.biltyInfo,
      timestamp: new Date().toISOString(),
    };
  }
}
