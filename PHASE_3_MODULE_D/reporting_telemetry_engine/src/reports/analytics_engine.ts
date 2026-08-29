/**
 * Phase 3 Module D: Executive Analytics & Reporting Engine
 * Implements financial summary, day closing metrics, inventory valuation, and CWE-1236 CSV injection defense.
 */

export interface FinancialSaleRecord {
  id: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  costOfGoodsSold: number;
  category: 'opd' | 'pharmacy_retail' | 'pharmacy_wholesale';
  timestamp: string;
}

export interface FinancialExpenseRecord {
  id: string;
  category: string;
  amount: number;
  description: string;
  timestamp: string;
}

export interface ExecutiveFinancialSummary {
  grossRevenue: number;
  totalDiscounts: number;
  netRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  netProfitMarginPercentage: number;
  opdRevenue: number;
  pharmacyRetailRevenue: number;
  pharmacyWholesaleRevenue: number;
}

export interface DayClosingTransaction {
  id: string;
  paymentMode: 'cash' | 'card' | 'bank_transfer' | 'party_credit';
  module: 'opd' | 'pharmacy';
  amount: number;
  timestamp: string;
}

export interface DayClosingSummary {
  totalCollection: number;
  cashCollection: number;
  cardCollection: number;
  bankTransferCollection: number;
  partyCreditCollection: number;
  opdCollection: number;
  pharmacyCollection: number;
  transactionCount: number;
}

export interface InventoryItemRecord {
  id: string;
  name: string;
  companyName?: string;
  stockQty: number;
  minStockLevel: number;
  unitCost: number;
  unitPrice: number;
  expiryDate: string; // ISO format or YYYY-MM-DD
}

export interface InventoryAnalytics {
  totalItemTypes: number;
  totalUnitsInStock: number;
  totalValuationCost: number;
  totalValuationRetail: number;
  potentialProfit: number;
  lowStockItemsCount: number;
  nearExpiryItemsCount: number;
  lowStockItems: InventoryItemRecord[];
  nearExpiryItems: InventoryItemRecord[];
}

/**
 * Calculates Executive Financial Summary including Gross/Net profit & margins.
 */
export function getExecutiveFinancialSummary(
  sales: FinancialSaleRecord[],
  expenses: FinancialExpenseRecord[]
): ExecutiveFinancialSummary {
  let grossRevenue = 0;
  let totalDiscounts = 0;
  let netRevenue = 0;
  let costOfGoodsSold = 0;
  let opdRevenue = 0;
  let pharmacyRetailRevenue = 0;
  let pharmacyWholesaleRevenue = 0;

  for (const sale of sales) {
    const gross = Math.max(0, Number(sale.grossAmount) || 0);
    const disc = Math.max(0, Number(sale.discountAmount) || 0);
    const net = sale.netAmount !== undefined ? Math.max(0, Number(sale.netAmount)) : Math.max(0, gross - disc);
    const cogs = Math.max(0, Number(sale.costOfGoodsSold) || 0);

    grossRevenue += gross;
    totalDiscounts += disc;
    netRevenue += net;
    costOfGoodsSold += cogs;

    if (sale.category === 'opd') opdRevenue += net;
    else if (sale.category === 'pharmacy_retail') pharmacyRetailRevenue += net;
    else if (sale.category === 'pharmacy_wholesale') pharmacyWholesaleRevenue += net;
  }

  let totalExpenses = 0;
  for (const exp of expenses) {
    totalExpenses += Math.max(0, Number(exp.amount) || 0);
  }

  const grossProfit = netRevenue - costOfGoodsSold;
  const netProfit = grossProfit - totalExpenses;
  const netProfitMarginPercentage = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    totalDiscounts: Math.round(totalDiscounts * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    costOfGoodsSold: Math.round(costOfGoodsSold * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    netProfitMarginPercentage: Math.round(netProfitMarginPercentage * 100) / 100,
    opdRevenue: Math.round(opdRevenue * 100) / 100,
    pharmacyRetailRevenue: Math.round(pharmacyRetailRevenue * 100) / 100,
    pharmacyWholesaleRevenue: Math.round(pharmacyWholesaleRevenue * 100) / 100,
  };
}

/**
 * Computes Day Closing Summary aggregated by payment modes and operational modules.
 */
export function getDayClosingSummary(transactions: DayClosingTransaction[]): DayClosingSummary {
  let totalCollection = 0;
  let cashCollection = 0;
  let cardCollection = 0;
  let bankTransferCollection = 0;
  let partyCreditCollection = 0;
  let opdCollection = 0;
  let pharmacyCollection = 0;

  for (const tx of transactions) {
    const amt = Math.max(0, Number(tx.amount) || 0);
    totalCollection += amt;

    switch (tx.paymentMode) {
      case 'cash':
        cashCollection += amt;
        break;
      case 'card':
        cardCollection += amt;
        break;
      case 'bank_transfer':
        bankTransferCollection += amt;
        break;
      case 'party_credit':
        partyCreditCollection += amt;
        break;
    }

    if (tx.module === 'opd') opdCollection += amt;
    else if (tx.module === 'pharmacy') pharmacyCollection += amt;
  }

  return {
    totalCollection: Math.round(totalCollection * 100) / 100,
    cashCollection: Math.round(cashCollection * 100) / 100,
    cardCollection: Math.round(cardCollection * 100) / 100,
    bankTransferCollection: Math.round(bankTransferCollection * 100) / 100,
    partyCreditCollection: Math.round(partyCreditCollection * 100) / 100,
    opdCollection: Math.round(opdCollection * 100) / 100,
    pharmacyCollection: Math.round(pharmacyCollection * 100) / 100,
    transactionCount: transactions.length,
  };
}

/**
 * Calculates stock valuation, low stock triggers, and near expiry warnings (within 30 days threshold).
 */
export function getInventoryAnalytics(items: InventoryItemRecord[], daysToExpiryThreshold = 30): InventoryAnalytics {
  let totalItemTypes = items.length;
  let totalUnitsInStock = 0;
  let totalValuationCost = 0;
  let totalValuationRetail = 0;

  const lowStockItems: InventoryItemRecord[] = [];
  const nearExpiryItems: InventoryItemRecord[] = [];

  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysToExpiryThreshold * 24 * 60 * 60 * 1000);

  for (const item of items) {
    const qty = Math.max(0, Number(item.stockQty) || 0);
    const minQty = Math.max(0, Number(item.minStockLevel) || 0);
    const cost = Math.max(0, Number(item.unitCost) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);

    totalUnitsInStock += qty;
    totalValuationCost += qty * cost;
    totalValuationRetail += qty * price;

    if (qty <= minQty) {
      lowStockItems.push(item);
    }

    if (item.expiryDate) {
      const expDate = new Date(item.expiryDate);
      if (!isNaN(expDate.getTime()) && expDate <= thresholdDate) {
        nearExpiryItems.push(item);
      }
    }
  }

  const potentialProfit = totalValuationRetail - totalValuationCost;

  return {
    totalItemTypes,
    totalUnitsInStock,
    totalValuationCost: Math.round(totalValuationCost * 100) / 100,
    totalValuationRetail: Math.round(totalValuationRetail * 100) / 100,
    potentialProfit: Math.round(potentialProfit * 100) / 100,
    lowStockItemsCount: lowStockItems.length,
    nearExpiryItemsCount: nearExpiryItems.length,
    lowStockItems,
    nearExpiryItems,
  };
}

/**
 * Defense against CWE-1236: CSV Formula Injection.
 * Escapes characters =, +, -, @, \t, \r at start of cell value by prefixing with a single quote (').
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Check if string starts with formula trigger characters: '=', '+', '-', '@', '\t', '\r'
  const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
  if (str.length > 0 && formulaTriggers.includes(str.charAt(0))) {
    str = "'" + str;
  }

  // Escape internal double quotes by doubling them
  const escapedQuotes = str.replace(/"/g, '""');

  // Wrap in double quotes if it contains quotes, commas, newlines, or single quote prefix
  if (escapedQuotes.includes(',') || escapedQuotes.includes('\n') || escapedQuotes.includes('\r') || escapedQuotes.includes('"') || escapedQuotes.startsWith("'")) {
    return `"${escapedQuotes}"`;
  }

  return escapedQuotes;
}
