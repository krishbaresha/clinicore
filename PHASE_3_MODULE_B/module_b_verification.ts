/**
 * Verification test suite for Phase 3 Module B:
 * - POS Keyboard Hotkey mapping & Cart math
 * - FEFO Batch sorting & near-expiry classification
 * - Wholesale B2B party code auto-fill & credit limit validation
 * - 80mm ESC/POS thermal print formatting
 */

import { POSEngine, type POSItem } from './pharmacy_wholesale_engine/src/pos/pos_engine.ts';
import { FEFOBatchAllocator, type BatchRecord } from './pharmacy_wholesale_engine/src/fefo/batch_allocator.ts';
import { WholesaleB2BService, type WholesaleParty } from './pharmacy_wholesale_engine/src/wholesale/b2b_service.ts';
import { ThermalPrinter80mm, type ESCPOSReceiptData } from './pharmacy_wholesale_engine/src/printer/thermal_printer.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runModuleBVerification() {
  console.log('================================================================');
  console.log('  CLINICFLOW PHASE 3 MODULE B: VERIFICATION TEST SUITE          ');
  console.log('================================================================\n');

  const startTime = Date.now();

  // ---------------------------------------------------------------------------
  // TEST 1: POS Keyboard Hotkey Mapping, 2D Grid & Cart Math
  // ---------------------------------------------------------------------------
  console.log('▶ [TEST 1] POS Engine: Hotkeys, 2D Navigation Grid & Cart Math');
  const pos = new POSEngine();

  // Check F1-F11 Hotkey mapping
  const h1 = pos.triggerHotkey('F1');
  assert(h1.description.includes('New Sale'), 'F1 hotkey description mismatch');
  const h4 = pos.triggerHotkey('F4');
  assert(h4.description.includes('Party Code Auto-Fill'), 'F4 hotkey description mismatch');
  const h10 = pos.triggerHotkey('F10');
  assert(h10.description.includes('Checkout'), 'F10 hotkey description mismatch');

  // Test 2D Navigation Grid
  const grid = pos.getNavigationGrid();
  grid.setDimensions(3, 3);
  grid.jumpTo(0, 0);
  grid.moveDown();
  assert(grid.getActivePosition().row === 1, '2D Grid moveDown failed');
  grid.moveRight();
  assert(grid.getActivePosition().col === 1, '2D Grid moveRight failed');
  grid.moveUp();
  assert(grid.getActivePosition().row === 0, '2D Grid moveUp failed');

  // Cart Math Test
  const sampleItem1: POSItem = {
    id: 'MED-001',
    code: 'PAN-500',
    name: 'Panadol 500mg (GSK)',
    companyName: 'GSK Pakistan',
    batchNumber: 'BCH-8821',
    expiryDate: '2027-12-31',
    unitPrice: 30,
    tradePrice: 25,
    stockQty: 100,
  };

  const sampleItem2: POSItem = {
    id: 'MED-002',
    code: 'AUG-625',
    name: 'Augmentin 625mg (GSK)',
    companyName: 'GSK Pakistan',
    batchNumber: 'BCH-9912',
    expiryDate: '2026-10-15',
    unitPrice: 250,
    tradePrice: 210,
    stockQty: 50,
  };

  pos.addItemToCart(sampleItem1, 2, 30, 10, 0); // 2 * 30 = 60, 10% disc = 6, net line = 54
  pos.addItemToCart(sampleItem2, 1, 250, 0, 0); // 1 * 250 = 250, net line = 250

  let summary = pos.getCartSummary();
  assert(summary.subtotal === 310, `Subtotal expected 310, got ${summary.subtotal}`);
  assert(summary.itemDiscountsTotal === 6, `Item discounts expected 6, got ${summary.itemDiscountsTotal}`);
  assert(summary.netTotal === 304, `Net total expected 304, got ${summary.netTotal}`);

  // Apply Bill Level Trade Discount (5% bill discount)
  pos.setBillTradeDiscount(5, 0);
  summary = pos.getCartSummary();
  // 310 - 6 = 304. 5% of 304 = 15.2. Net = 304 - 15.2 = 288.8
  assert(summary.billDiscountAmount === 15.2, `Bill discount amount expected 15.2, got ${summary.billDiscountAmount}`);
  assert(summary.netTotal === 288.8, `Net total after bill discount expected 288.8, got ${summary.netTotal}`);

  // Process Cash Checkout
  const cashResult = pos.processCheckout(300);
  assert(cashResult.success === true, 'Cash checkout failed');
  assert(cashResult.changeDue === 11.2, `Change due expected 11.2, got ${cashResult.changeDue}`);
  assert(pos.getCartItems().length === 0, 'Cart should be empty after checkout');
  console.log('  ✔ POS Engine hotkeys, 2D grid, cart math & cash checkout passed cleanly.');

  // ---------------------------------------------------------------------------
  // TEST 2: FEFO Batch Allocation Engine & Risk Stratification
  // ---------------------------------------------------------------------------
  console.log('\n▶ [TEST 2] FEFO Engine: Expiry Sorting, 30/60/90 Stratification & Dual-PIN Quarantine');
  const fefo = new FEFOBatchAllocator();
  const refDate = new Date('2026-08-30');

  const testBatches: BatchRecord[] = [
    {
      batchNumber: 'B-STABLE',
      medicineId: 'MED-100',
      medicineName: 'Amoxil 250mg',
      companyName: 'GSK',
      expiryDate: '2027-08-30', // > 360 days
      quantity: 50,
      tradePrice: 100,
      retailPrice: 120,
    },
    {
      batchNumber: 'B-CRITICAL',
      medicineId: 'MED-100',
      medicineName: 'Amoxil 250mg',
      companyName: 'GSK',
      expiryDate: '2026-09-15', // 16 days remaining (<=30)
      quantity: 20,
      tradePrice: 100,
      retailPrice: 120,
    },
    {
      batchNumber: 'B-NEAR60',
      medicineId: 'MED-100',
      medicineName: 'Amoxil 250mg',
      companyName: 'GSK',
      expiryDate: '2026-10-15', // 46 days remaining (31-60)
      quantity: 30,
      tradePrice: 100,
      retailPrice: 120,
    },
    {
      batchNumber: 'B-WARN90',
      medicineId: 'MED-100',
      medicineName: 'Amoxil 250mg',
      companyName: 'GSK',
      expiryDate: '2026-11-15', // 77 days remaining (61-90)
      quantity: 40,
      tradePrice: 100,
      retailPrice: 120,
    },
  ];

  // FEFO Sorting check (Ascending Expiry)
  const sorted = fefo.sortBatchesFEFO(testBatches);
  assert(sorted[0].batchNumber === 'B-CRITICAL', 'FEFO first batch must be B-CRITICAL');
  assert(sorted[1].batchNumber === 'B-NEAR60', 'FEFO second batch must be B-NEAR60');
  assert(sorted[2].batchNumber === 'B-WARN90', 'FEFO third batch must be B-WARN90');

  // Tiered Risk Stratification check
  const alerts = fefo.getTieredExpiryAlerts(testBatches, refDate);
  assert(alerts.find((a) => a.batch.batchNumber === 'B-CRITICAL')?.tier === 'CRITICAL_30', 'Critical 30 tier classification failed');
  assert(alerts.find((a) => a.batch.batchNumber === 'B-NEAR60')?.tier === 'NEAR_60', 'Near 60 tier classification failed');
  assert(alerts.find((a) => a.batch.batchNumber === 'B-WARN90')?.tier === 'WARNING_90', 'Warning 90 tier classification failed');
  assert(alerts.find((a) => a.batch.batchNumber === 'B-STABLE')?.tier === 'STABLE', 'Stable tier classification failed');

  // FEFO Order Allocation check (Request 35 units -> 20 from B-CRITICAL, 15 from B-NEAR60)
  const plan = fefo.allocateStock('MED-100', 35, testBatches, refDate);
  assert(plan.fulfilledQty === 35, 'Allocation fulfilledQty mismatch');
  assert(plan.allocatedBatches.length === 2, 'Should allocate across 2 batches');
  assert(plan.allocatedBatches[0].batchNumber === 'B-CRITICAL' && plan.allocatedBatches[0].allocatedQty === 20, 'Batch 1 allocation mismatch');
  assert(plan.allocatedBatches[1].batchNumber === 'B-NEAR60' && plan.allocatedBatches[1].allocatedQty === 15, 'Batch 2 allocation mismatch');

  // Dual-PIN Quarantine & Write-off test
  const quarantineTarget = { ...testBatches[1] }; // B-CRITICAL with 20 qty
  const quarantineResult = fefo.quarantineBatchWithDualPin(
    quarantineTarget,
    20,
    'Damaged packaging near expiry',
    { pharmacistPin: '1234', supervisorPin: '9999' }
  );
  assert(quarantineResult.success === true, 'Quarantine should succeed with valid PINs');
  assert(quarantineTarget.isQuarantined === true, 'Batch should be marked as quarantined');
  assert(quarantineTarget.quantity === 0, 'Quarantined stock quantity should be zero');

  // Invalid PIN check
  try {
    fefo.quarantineBatchWithDualPin(
      { ...testBatches[0] },
      5,
      'Test invalid pin',
      { pharmacistPin: '0000', supervisorPin: '9999' }
    );
    assert(false, 'Should have thrown error on invalid pharmacist PIN');
  } catch (err: any) {
    assert(err.message.includes('Invalid Pharmacist PIN'), 'Invalid PIN error message mismatch');
  }
  console.log('  ✔ FEFO sorting, tiered risk alerts, stock allocation & dual-PIN quarantine passed cleanly.');

  // ---------------------------------------------------------------------------
  // TEST 3: Wholesale B2B Distribution & Real-Time Credit Checker
  // ---------------------------------------------------------------------------
  console.log('\n▶ [TEST 3] Wholesale B2B: Party Code Auto-Fill & Real-Time Credit Checker');
  const wholesaleParties: WholesaleParty[] = [
    {
      partyCode: '001',
      partyName: 'Al-Madina Medical Store',
      city: 'Hyderabad',
      phone: '0300-1234567',
      address: 'Station Road, Hyderabad',
      assignedSalesman: 'Muhammad Kashif',
      creditLimit: 100000,
      currentCreditBalance: 40000,
      status: 'ACTIVE',
    },
    {
      partyCode: 'PTY-108',
      partyName: 'Sindh Wholesale Pharma',
      city: 'Sukkur',
      phone: '0312-9876543',
      address: 'Minara Road, Sukkur',
      assignedSalesman: 'Tariq Mahmood',
      creditLimit: 50000,
      currentCreditBalance: 45000,
      status: 'ACTIVE',
    },
  ];

  const b2b = new WholesaleB2BService(wholesaleParties);

  // Auto-Fill test by party code ('001' and 'PTY-108')
  const p1 = b2b.autoFillPartyCode('001');
  assert(p1 !== null && p1.partyName === 'Al-Madina Medical Store', 'Party code 001 auto-fill failed');

  const p2 = b2b.autoFillPartyCode('PTY-108');
  assert(p2 !== null && p2.partyName === 'Sindh Wholesale Pharma', 'Party code PTY-108 auto-fill failed');

  // Loose search auto-fill
  const p3 = b2b.autoFillPartyCode('madina');
  assert(p3 !== null && p3.partyCode === '001', 'Loose name search auto-fill failed');

  // Real-time credit limit checker (Pass scenario)
  const creditPass = b2b.validateCreditLimit('001', 30000);
  assert(creditPass.isApproved === true, 'Credit check should pass (40k + 30k <= 100k)');
  assert(creditPass.availableCredit === 60000, `Available credit expected 60000, got ${creditPass.availableCredit}`);

  // Real-time credit limit checker (Breach scenario)
  const creditBreach = b2b.validateCreditLimit('PTY-108', 10000); // 45k + 10k = 55k > 50k limit
  assert(creditBreach.isApproved === false, 'Credit check should fail on breach');
  assert(creditBreach.breachAmount === 5000, `Breach amount expected 5000, got ${creditBreach.breachAmount}`);

  // Process Wholesale Invoice with Bilty Transport Metadata & Bill-Level Discount
  const wholesaleInv = b2b.createWholesaleInvoice({
    partyCode: '001',
    items: [
      { medicineId: 'MED-1', medicineName: 'Panadol 500mg', batchNumber: 'B1', quantity: 100, tradePrice: 25, discountPercent: 4 },
    ],
    overallTradeDiscountPercent: 2,
    paymentMode: 'CREDIT',
    biltyInfo: {
      transportCompany: 'Al-Habib Goods Transport',
      biltyNumber: 'HYD-BLT-8891',
      cartonsCount: 4,
      destinationCity: 'Hyderabad',
      dispatchDate: '2026-08-30',
    },
  });

  // Math check:
  // Base item total: 100 * 25 = 2500
  // Item discount 4%: 100
  // Net after item disc: 2400
  // Overall bill discount 2%: 48
  // Net invoice amount: 2352
  assert(wholesaleInv.itemsTotal === 2500, `Wholesale itemsTotal expected 2500, got ${wholesaleInv.itemsTotal}`);
  assert(wholesaleInv.itemDiscountsTotal === 100, `Wholesale itemDiscountsTotal expected 100, got ${wholesaleInv.itemDiscountsTotal}`);
  assert(wholesaleInv.billDiscountTotal === 48, `Wholesale billDiscountTotal expected 48, got ${wholesaleInv.billDiscountTotal}`);
  assert(wholesaleInv.netInvoiceAmount === 2352, `Wholesale netInvoiceAmount expected 2352, got ${wholesaleInv.netInvoiceAmount}`);
  assert(wholesaleInv.biltyInfo?.biltyNumber === 'HYD-BLT-8891', 'Bilty transport info missing/mismatched');

  // Verify updated balance on Party '001' (40000 + 2352 = 42352)
  const updatedParty001 = b2b.autoFillPartyCode('001');
  assert(updatedParty001?.currentCreditBalance === 42352, `Updated credit balance expected 42352, got ${updatedParty001?.currentCreditBalance}`);
  console.log('  ✔ Wholesale B2B party auto-fill, salesman tracking, bilty metadata & credit checker passed cleanly.');

  // ---------------------------------------------------------------------------
  // TEST 4: 80mm ESC/POS Thermal Receipt Formatting Engine
  // ---------------------------------------------------------------------------
  console.log('\n▶ [TEST 4] 80mm Thermal Printer: Plaintext Formatting, ESC/POS Bytes & Sanitized Preview');
  const printer = new ThermalPrinter80mm();

  const receiptData: ESCPOSReceiptData = {
    clinicHeader: {
      title: 'Dr. Muhammad Kashif Khan Clinic & Wholesale',
      doctorName: 'Dr. Muhammad Kashif Khan (MBBS, FCPS)',
      address: 'Station Road, Hyderabad, Interior Sindh',
      phone: '0300-9988776',
    },
    invoiceNo: 'WHL-INV-20260830-01',
    date: '2026-08-30 00:38',
    customerOrParty: 'Al-Madina Medical Store (001)',
    salesman: 'Muhammad Kashif',
    paymentMode: 'CREDIT',
    biltyNo: 'HYD-BLT-8891',
    transportCo: 'Al-Habib Goods Transport',
    items: [
      { name: 'Panadol 500mg Tab', batch: 'BCH-8821', qty: 100, rate: 25, amount: 2400 },
      { name: 'Augmentin 625mg', batch: 'BCH-9912', qty: 10, rate: 210, amount: 2100 },
    ],
    subtotal: 4600,
    discount: 148,
    tax: 0,
    netTotal: 4452,
    versionWatermark: 'CLINICFLOW-POS-v3.0.4',
  };

  // Generate plain text receipt
  const plainText = printer.generatePlainTextReceipt(receiptData);
  assert(plainText.toLowerCase().includes('dr. muhammad kashif khan clinic'), 'Plaintext receipt missing title');
  assert(plainText.includes('WHL-INV-20260830-01'), 'Plaintext receipt missing invoice number');
  assert(plainText.includes('HYD-BLT-8891'), 'Plaintext receipt missing bilty number');
  assert(plainText.includes('CLINICFLOW-POS-v3.0.4'), 'Plaintext receipt missing watermark');

  // Generate ESC/POS Binary Buffer
  const escposBuffer = printer.generateESCPOSBuffer(receiptData);
  assert(escposBuffer instanceof Uint8Array, 'ESC/POS buffer must be Uint8Array');
  assert(escposBuffer.length > 200, 'ESC/POS buffer size too small');
  assert(escposBuffer[0] === 0x1b && escposBuffer[1] === 0x40, 'ESC/POS buffer missing ESC @ init header');

  // Generate Sanitized HTML DOM Preview
  const htmlPreview = printer.generateSanitizedHTMLPreview(receiptData);
  assert(htmlPreview.includes('Al-Madina Medical Store'), 'HTML preview missing party name');
  assert(!htmlPreview.includes('<script>'), 'HTML preview failed sanitization safety');
  assert(htmlPreview.includes('CLINICFLOW-POS-v3.0.4'), 'HTML preview missing watermark');

  console.log('  ✔ 80mm ESC/POS thermal formatting, byte buffer & sanitized HTML preview passed cleanly.');

  const duration = Date.now() - startTime;
  console.log('\n================================================================');
  console.log(`🎉 ALL 4 PHASE 3 MODULE B TEST SUITES PASSED CLEANLY IN ${duration}ms!`);
  console.log('================================================================');
}

runModuleBVerification().catch((err) => {
  console.error('❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
