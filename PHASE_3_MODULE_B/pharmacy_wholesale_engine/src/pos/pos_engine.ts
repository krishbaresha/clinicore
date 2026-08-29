/**
 * Pure keyboard-driven POS control deck engine
 * Handles F1-F11 hotkey actions, 2D navigation grid state, cart math, and cash/credit checkouts.
 */

export interface POSItem {
  id: string;
  code: string;
  name: string;
  companyName: string;
  batchNumber: string;
  expiryDate: string;
  unitPrice: number;
  tradePrice: number;
  stockQty: number;
}

export interface CartLineItem {
  item: POSItem;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CartSummary {
  subtotal: number;
  itemDiscountsTotal: number;
  billDiscountPercent: number;
  billDiscountAmount: number;
  totalTax: number;
  netTotal: number;
  itemCount: number;
  totalQuantity: number;
}

export interface CheckoutResult {
  success: boolean;
  invoiceId: string;
  paymentMode: 'CASH' | 'CREDIT' | 'CHEQUE';
  cartSummary: CartSummary;
  amountTendered: number;
  changeDue: number;
  partyCode?: string;
  partyName?: string;
  salesman?: string;
  errorMessage?: string;
  timestamp: string;
}

export type POSHotkey =
  | 'F1'  // New Sale
  | 'F2'  // Search Product
  | 'F3'  // Batch Select
  | 'F4'  // Party Code Auto-Fill
  | 'F5'  // Apply Trade Discount
  | 'F6'  // Switch Payment Mode
  | 'F7'  // Hold Cart
  | 'F8'  // Recall Cart
  | 'F9'  // Quantity Multiplier
  | 'F10' // Checkout & Print
  | 'F11';// Cancel Sale

export const HOTKEY_DEFINITIONS: Record<POSHotkey, string> = {
  F1: 'New Sale / Clear Grid',
  F2: 'Search Medicine / Product',
  F3: 'Select FEFO Batch',
  F4: 'Party Code Auto-Fill (Wholesale)',
  F5: 'Apply Line / Bill Trade Discount',
  F6: 'Switch Payment Mode (Cash / Credit / Cheque)',
  F7: 'Hold Current Cart State',
  F8: 'Recall Held Cart',
  F9: 'Quantity Multiplier Focus',
  F10: 'Execute Checkout & Generate Receipt',
  F11: 'Cancel Sale / Void Session',
};

export class NavigationGrid2D {
  private rows: number;
  private cols: number;
  private activeRow: number = 0;
  private activeCol: number = 0;

  constructor(rows: number, cols: number) {
    this.rows = Math.max(1, rows);
    this.cols = Math.max(1, cols);
  }

  public setDimensions(rows: number, cols: number): void {
    this.rows = Math.max(1, rows);
    this.cols = Math.max(1, cols);
    if (this.activeRow >= this.rows) this.activeRow = this.rows - 1;
    if (this.activeCol >= this.cols) this.activeCol = this.cols - 1;
  }

  public moveUp(): void {
    this.activeRow = (this.activeRow - 1 + this.rows) % this.rows;
  }

  public moveDown(): void {
    this.activeRow = (this.activeRow + 1) % this.rows;
  }

  public moveLeft(): void {
    this.activeCol = (this.activeCol - 1 + this.cols) % this.cols;
  }

  public moveRight(): void {
    this.activeCol = (this.activeCol + 1) % this.cols;
  }

  public getActivePosition(): { row: number; col: number; flatIndex: number } {
    return {
      row: this.activeRow,
      col: this.activeCol,
      flatIndex: this.activeRow * this.cols + this.activeCol,
    };
  }

  public jumpTo(row: number, col: number): void {
    if (row >= 0 && row < this.rows) this.activeRow = row;
    if (col >= 0 && col < this.cols) this.activeCol = col;
  }
}

export class POSEngine {
  private cart: CartLineItem[] = [];
  private heldCarts: Map<string, CartLineItem[]> = new Map();
  private billDiscountPercent: number = 0;
  private billDiscountFlatRs: number = 0;
  private activePaymentMode: 'CASH' | 'CREDIT' | 'CHEQUE' = 'CASH';
  private grid: NavigationGrid2D = new NavigationGrid2D(1, 1);

  public triggerHotkey(hotkey: POSHotkey): { action: string; description: string } {
    const description = HOTKEY_DEFINITIONS[hotkey];
    if (!description) {
      throw new Error(`Invalid POS Hotkey: ${hotkey}`);
    }
    return { action: hotkey, description };
  }

  public getNavigationGrid(): NavigationGrid2D {
    return this.grid;
  }

  public addItemToCart(item: POSItem, quantity: number = 1, customUnitPrice?: number, discountPercent: number = 0, taxPercent: number = 0): CartLineItem {
    if (quantity <= 0) throw new Error('Quantity must be greater than zero');
    if (item.stockQty < quantity) {
      throw new Error(`Insufficient stock for ${item.name} (${item.batchNumber}). Available: ${item.stockQty}`);
    }

    const price = customUnitPrice !== undefined ? customUnitPrice : item.unitPrice;
    const existingIndex = this.cart.findIndex(
      (c) => c.item.id === item.id && c.item.batchNumber === item.batchNumber
    );

    if (existingIndex >= 0) {
      const existing = this.cart[existingIndex];
      const newQty = existing.quantity + quantity;
      if (item.stockQty < newQty) {
        throw new Error(`Insufficient stock on cumulative qty. Max available: ${item.stockQty}`);
      }
      return this.updateCartLine(existingIndex, newQty, existing.discountPercent, existing.taxPercent);
    }

    const baseSubtotal = price * quantity;
    const discountAmount = Math.max(0, (baseSubtotal * discountPercent) / 100);
    const taxableAmount = Math.max(0, baseSubtotal - discountAmount);
    const taxAmount = (taxableAmount * taxPercent) / 100;
    const lineTotal = taxableAmount + taxAmount;

    const lineItem: CartLineItem = {
      item,
      quantity,
      unitPrice: price,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      lineTotal,
    };

    this.cart.push(lineItem);
    this.grid.setDimensions(this.cart.length, 4);
    return lineItem;
  }

  public updateCartLine(index: number, quantity: number, discountPercent: number = 0, taxPercent: number = 0): CartLineItem {
    if (index < 0 || index >= this.cart.length) {
      throw new Error(`Invalid cart item index: ${index}`);
    }

    const line = this.cart[index];
    if (quantity <= 0) {
      this.cart.splice(index, 1);
      this.grid.setDimensions(Math.max(1, this.cart.length), 4);
      return line;
    }

    if (line.item.stockQty < quantity) {
      throw new Error(`Quantity ${quantity} exceeds stock ${line.item.stockQty}`);
    }

    const baseSubtotal = line.unitPrice * quantity;
    const discountAmount = Math.max(0, (baseSubtotal * discountPercent) / 100);
    const taxableAmount = Math.max(0, baseSubtotal - discountAmount);
    const taxAmount = (taxableAmount * taxPercent) / 100;
    const lineTotal = taxableAmount + taxAmount;

    line.quantity = quantity;
    line.discountPercent = discountPercent;
    line.discountAmount = discountAmount;
    line.taxPercent = taxPercent;
    line.taxAmount = taxAmount;
    line.lineTotal = lineTotal;

    return line;
  }

  public removeCartLine(index: number): void {
    if (index >= 0 && index < this.cart.length) {
      this.cart.splice(index, 1);
      this.grid.setDimensions(Math.max(1, this.cart.length), 4);
    }
  }

  public setBillTradeDiscount(percent: number = 0, flatRs: number = 0): void {
    this.billDiscountPercent = Math.max(0, Math.min(100, percent));
    this.billDiscountFlatRs = Math.max(0, flatRs);
  }

  public setPaymentMode(mode: 'CASH' | 'CREDIT' | 'CHEQUE'): void {
    this.activePaymentMode = mode;
  }

  public getPaymentMode(): 'CASH' | 'CREDIT' | 'CHEQUE' {
    return this.activePaymentMode;
  }

  public getCartItems(): CartLineItem[] {
    return [...this.cart];
  }

  public getCartSummary(): CartSummary {
    let subtotal = 0;
    let itemDiscountsTotal = 0;
    let totalTax = 0;
    let totalQuantity = 0;

    for (const item of this.cart) {
      subtotal += item.unitPrice * item.quantity;
      itemDiscountsTotal += item.discountAmount;
      totalTax += item.taxAmount;
      totalQuantity += item.quantity;
    }

    const afterItemDiscounts = Math.max(0, subtotal - itemDiscountsTotal);
    let billDiscountAmount = (afterItemDiscounts * this.billDiscountPercent) / 100;
    billDiscountAmount += this.billDiscountFlatRs;
    billDiscountAmount = Math.min(afterItemDiscounts, billDiscountAmount);

    const netTotal = Math.max(0, afterItemDiscounts - billDiscountAmount + totalTax);

    return {
      subtotal,
      itemDiscountsTotal,
      billDiscountPercent: this.billDiscountPercent,
      billDiscountAmount,
      totalTax,
      netTotal: Math.round(netTotal * 100) / 100,
      itemCount: this.cart.length,
      totalQuantity,
    };
  }

  public holdCart(holdId: string): void {
    if (this.cart.length === 0) throw new Error('Cannot hold an empty cart');
    this.heldCarts.set(holdId, [...this.cart]);
    this.cart = [];
    this.grid.setDimensions(1, 1);
  }

  public recallCart(holdId: string): void {
    const held = this.heldCarts.get(holdId);
    if (!held) throw new Error(`No held cart found with ID: ${holdId}`);
    this.cart = [...held];
    this.heldCarts.delete(holdId);
    this.grid.setDimensions(Math.max(1, this.cart.length), 4);
  }

  public clearCart(): void {
    this.cart = [];
    this.billDiscountPercent = 0;
    this.billDiscountFlatRs = 0;
    this.grid.setDimensions(1, 1);
  }

  public processCheckout(
    amountTendered: number,
    wholesaleOptions?: { partyCode?: string; partyName?: string; salesman?: string; partyCreditLimit?: number; partyCurrentBalance?: number }
  ): CheckoutResult {
    const summary = this.getCartSummary();
    if (summary.itemCount === 0) {
      throw new Error('Cannot checkout an empty cart');
    }

    if (this.activePaymentMode === 'CASH') {
      if (amountTendered < summary.netTotal) {
        throw new Error(`Insufficient cash tendered. Total: Rs. ${summary.netTotal}, Tendered: Rs. ${amountTendered}`);
      }
    } else if (this.activePaymentMode === 'CREDIT') {
      if (!wholesaleOptions?.partyCode) {
        throw new Error('Party code is mandatory for CREDIT sales');
      }
      if (wholesaleOptions.partyCreditLimit !== undefined && wholesaleOptions.partyCurrentBalance !== undefined) {
        const potentialBalance = wholesaleOptions.partyCurrentBalance + summary.netTotal;
        if (potentialBalance > wholesaleOptions.partyCreditLimit) {
          throw new Error(
            `Credit limit exceeded for Party ${wholesaleOptions.partyCode}. Max limit: Rs. ${wholesaleOptions.partyCreditLimit}, Attempted balance: Rs. ${potentialBalance}`
          );
        }
      }
    }

    const changeDue = Math.max(0, amountTendered - summary.netTotal);
    const invoiceId = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const result: CheckoutResult = {
      success: true,
      invoiceId,
      paymentMode: this.activePaymentMode,
      cartSummary: summary,
      amountTendered,
      changeDue: Math.round(changeDue * 100) / 100,
      partyCode: wholesaleOptions?.partyCode,
      partyName: wholesaleOptions?.partyName,
      salesman: wholesaleOptions?.salesman,
      timestamp: new Date().toISOString(),
    };

    this.clearCart();
    return result;
  }
}
