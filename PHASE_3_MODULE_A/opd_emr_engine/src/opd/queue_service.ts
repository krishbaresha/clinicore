export type TokenStatus = 'WAITING' | 'IN_CHAMBER' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'PAID' | 'WAIVED';
export type PaymentMode = 'CASH' | 'CARD' | 'UDHAAR' | 'CHEQUE';

export interface FeeTransaction {
  amount: number;
  discount: number; // Flat discount amount
  netPayable: number;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  receivedAt?: string;
  notes?: string;
}

export interface QueueToken {
  tokenId: string; // e.g. "DOC1-2026-08-30-01"
  tokenNumber: number; // 1, 2, 3...
  formattedToken: string; // "#01", "#02", ...
  mrId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  dateStr: string; // YYYY-MM-DD in PKT (UTC+5)
  status: TokenStatus;
  feeInfo: FeeTransaction;
  createdAt: string;
  calledAt?: string;
  completedAt?: string;
}

export class QueueService {
  // Map of doctorId -> Map of dateStr -> currentTokenCounter
  private doctorDailyCounters: Map<string, Map<string, number>> = new Map();
  
  // Store all queue tokens: tokenId -> QueueToken
  private tokens: Map<string, QueueToken> = new Map();

  /**
   * Helper to get current PKT (UTC+5) date string in format YYYY-MM-DD.
   */
  public static getPKTDateString(date: Date = new Date()): string {
    // PKT is UTC+5
    const pktOffsetMs = 5 * 60 * 60 * 1000;
    const pktDate = new Date(date.getTime() + pktOffsetMs);
    return pktDate.toISOString().split('T')[0];
  }

  /**
   * Automatically handles morning reset by initializing counter per (doctorId, dateStr).
   */
  private getNextTokenNumber(doctorId: string, dateStr: string): number {
    if (!this.doctorDailyCounters.has(doctorId)) {
      this.doctorDailyCounters.set(doctorId, new Map());
    }

    const doctorMap = this.doctorDailyCounters.get(doctorId)!;
    const currentCount = doctorMap.get(dateStr) || 0;
    const nextCount = currentCount + 1;
    doctorMap.set(dateStr, nextCount);

    return nextCount;
  }

  /**
   * Formats token number to 2-digit string prefixed with #, e.g. 1 -> "#01", 12 -> "#12"
   */
  public static formatTokenNumber(num: number): string {
    return `#${String(num).padStart(2, '0')}`;
  }

  /**
   * Issues a new OPD Token for a patient under a specific doctor.
   */
  public issueToken(params: {
    mrId: string;
    patientName: string;
    doctorId: string;
    doctorName: string;
    fee: number;
    discount?: number;
    paymentMode?: PaymentMode;
    paymentStatus?: PaymentStatus;
    customDateStr?: string; // Optional override for testing morning reset
  }): QueueToken {
    const dateStr = params.customDateStr || QueueService.getPKTDateString();
    const tokenNumber = this.getNextTokenNumber(params.doctorId, dateStr);
    const formattedToken = QueueService.formatTokenNumber(tokenNumber);
    const tokenId = `${params.doctorId}-${dateStr}-${String(tokenNumber).padStart(3, '0')}`;

    const discount = Math.max(0, params.discount || 0);
    const fee = Math.max(0, params.fee);
    const netPayable = Math.max(0, fee - discount);
    const now = new Date().toISOString();

    const feeInfo: FeeTransaction = {
      amount: fee,
      discount,
      netPayable,
      paymentMode: params.paymentMode || 'CASH',
      paymentStatus: params.paymentStatus || 'PENDING',
      receivedAt: params.paymentStatus === 'PAID' ? now : undefined
    };

    const token: QueueToken = {
      tokenId,
      tokenNumber,
      formattedToken,
      mrId: params.mrId,
      patientName: params.patientName,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      dateStr,
      status: 'WAITING',
      feeInfo,
      createdAt: now
    };

    this.tokens.set(tokenId, token);
    return token;
  }

  /**
   * Doctor Chamber Status Isolation: Calls patient into chamber for a specific doctor.
   * Auto-completes any patient currently IN_CHAMBER for that specific doctor.
   */
  public callPatientToChamber(tokenId: string): QueueToken {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found.`);
    }

    if (token.status === 'COMPLETED' || token.status === 'CANCELLED') {
      throw new Error(`Cannot call token ${tokenId} because its status is ${token.status}.`);
    }

    const now = new Date().toISOString();

    // Doctor Isolation: Auto-complete active patient in chamber ONLY for this doctorId on this dateStr
    for (const t of this.tokens.values()) {
      if (t.doctorId === token.doctorId && t.dateStr === token.dateStr && t.status === 'IN_CHAMBER' && t.tokenId !== tokenId) {
        t.status = 'COMPLETED';
        t.completedAt = now;
      }
    }

    token.status = 'IN_CHAMBER';
    token.calledAt = now;
    return token;
  }

  /**
   * Completes consultation for a token.
   */
  public completeConsultation(tokenId: string): QueueToken {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found.`);
    }

    token.status = 'COMPLETED';
    token.completedAt = new Date().toISOString();
    return token;
  }

  /**
   * Updates payment status and fee transaction details.
   */
  public recordFeePayment(tokenId: string, paymentMode: PaymentMode, discount: number = 0): QueueToken {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found.`);
    }

    const newDiscount = Math.max(0, discount);
    const netPayable = Math.max(0, token.feeInfo.amount - newDiscount);
    const now = new Date().toISOString();

    token.feeInfo.discount = newDiscount;
    token.feeInfo.netPayable = netPayable;
    token.feeInfo.paymentMode = paymentMode;
    token.feeInfo.paymentStatus = 'PAID';
    token.feeInfo.receivedAt = now;

    return token;
  }

  /**
   * Retrieves active waiting queue for a specific doctor on a given date.
   */
  public getDoctorQueue(doctorId: string, dateStr?: string): QueueToken[] {
    const targetDate = dateStr || QueueService.getPKTDateString();
    return Array.from(this.tokens.values()).filter(
      (t) => t.doctorId === doctorId && t.dateStr === targetDate
    ).sort((a, b) => a.tokenNumber - b.tokenNumber);
  }

  /**
   * Gets current active in-chamber patient for a specific doctor.
   */
  public getActiveChamberPatient(doctorId: string, dateStr?: string): QueueToken | undefined {
    const targetDate = dateStr || QueueService.getPKTDateString();
    return Array.from(this.tokens.values()).find(
      (t) => t.doctorId === doctorId && t.dateStr === targetDate && t.status === 'IN_CHAMBER'
    );
  }

  public getTokenById(tokenId: string): QueueToken | undefined {
    return this.tokens.get(tokenId);
  }
}
