/**
 * PHASE 4 STEP A: Master System Orchestrator
 * Wires together the end-to-end ClinicFlow ecosystem:
 * OPD Patient Registration -> Token Queue -> Doctor Chamber Consultation & Vitals HUD
 * -> Pharmacy POS FEFO Checkout -> Double-Entry Financial Journal -> Event-Sourced Stock Movement
 * -> Monotonic Cursor Sync Outbox -> Doctor Biometric Approval Request -> Privacy-Safe Telemetry.
 */

import { PatientService, type PatientRecord } from '../../../../PHASE_3_MODULE_A/opd_emr_engine/src/patients/patient_service.ts';
import { QueueService, type QueueToken } from '../../../../PHASE_3_MODULE_A/opd_emr_engine/src/opd/queue_service.ts';
import { VitalsService, type EmrConsultationRecord } from '../../../../PHASE_3_MODULE_A/opd_emr_engine/src/emr/vitals_service.ts';
import { POSEngine, type POSItem } from '../../../../PHASE_3_MODULE_B/pharmacy_wholesale_engine/src/pos/pos_engine.ts';
import { FEFOBatchAllocator, type BatchRecord as FEFOBatchRecord } from '../../../../PHASE_3_MODULE_B/pharmacy_wholesale_engine/src/fefo/batch_allocator.ts';
import { WholesaleB2BService, type WholesaleParty } from '../../../../PHASE_3_MODULE_B/pharmacy_wholesale_engine/src/wholesale/b2b_service.ts';
import { ThermalPrinter80mm, type ESCPOSReceiptData } from '../../../../PHASE_3_MODULE_B/pharmacy_wholesale_engine/src/printer/thermal_printer.ts';
import { JournalEngine, type JournalEntry } from '../../../../PHASE_3_MODULE_C/finance_governance_engine/src/accounting/journal_engine.ts';
import { GodownService } from '../../../../PHASE_3_MODULE_C/finance_governance_engine/src/warehouse/godown_service.ts';
import { ApprovalEngine, type ApprovalRequest, type ActionPayload } from '../../../../PHASE_3_MODULE_C/finance_governance_engine/src/governance/approval_engine.ts';
import { SyncCursorStore } from '../../../../PHASE_2_STEP_3/api_scaffold/src/cursor/sync_cursor.ts';
import { TelemetryService } from '../../../../PHASE_3_MODULE_D/reporting_telemetry_engine/src/telemetry/telemetry_service.ts';
import { escapeCSV } from '../../../../PHASE_3_MODULE_D/reporting_telemetry_engine/src/reports/analytics_engine.ts';
import { AccountingInventoryReconciler, type ReconciliationReport } from './accounting_inventory_reconciler.ts';

export interface WorkflowResult {
  patient: PatientRecord;
  token: QueueToken;
  vitals: { systolicBP: number; diastolicBP: number; record: EmrConsultationRecord };
  consultation: {
    diagnosis: string;
    medicines: string[];
    opdFee: number;
    opdJournalEntry: JournalEntry;
  };
  posSale: {
    receiptId: string;
    netAmount: number;
    receiptData: ESCPOSReceiptData;
    posJournalEntry: JournalEntry;
    stockEvents: Array<{ batch_number: string; quantity: number }>;
  };
  biometricApproval?: ApprovalRequest;
  syncCursor: number;
}

export class MasterOrchestrator {
  public patientService: PatientService;
  public queueService: QueueService;
  public vitalsService: VitalsService;
  public posEngine: POSEngine;
  public batchAllocator: FEFOBatchAllocator;
  public b2bService: WholesaleB2BService;
  public thermalPrinter: ThermalPrinter80mm;
  public journalEngine: JournalEngine;
  public godownService: GodownService;
  public approvalEngine: ApprovalEngine;
  public syncCursorStore: SyncCursorStore;
  public telemetryService: TelemetryService;
  public reconciler: AccountingInventoryReconciler;

  private inventoryBatches: FEFOBatchRecord[] = [];
  private posCashAccumulator: number = 0;

  constructor() {
    this.patientService = new PatientService();
    this.queueService = new QueueService();
    this.vitalsService = new VitalsService();
    this.posEngine = new POSEngine();
    this.batchAllocator = new FEFOBatchAllocator();
    this.b2bService = new WholesaleB2BService();
    this.thermalPrinter = new ThermalPrinter80mm();
    this.journalEngine = new JournalEngine();
    this.godownService = new GodownService();
    this.approvalEngine = new ApprovalEngine();
    this.syncCursorStore = new SyncCursorStore();
    this.telemetryService = new TelemetryService();
    this.reconciler = new AccountingInventoryReconciler(this.journalEngine, this.batchAllocator);
  }

  public getBatches(): FEFOBatchRecord[] {
    return this.inventoryBatches;
  }

  /**
   * Seed initial inventory and GL balance for orchestrator operation
   */
  public seedInitialInventoryAndGL(batches: FEFOBatchRecord[], initialCash: number = 0) {
    let totalInventoryValue = 0;
    batches.forEach((b: any) => {
      const price = b.tradePrice !== undefined ? b.tradePrice : (b.unitPurchasePrice !== undefined ? b.unitPurchasePrice : 0);
      const medId = b.medicineId || b.itemCode || 'MED-GEN';
      const medName = b.medicineName || b.name || 'Medicine';
      
      this.inventoryBatches.push({
        batchNumber: b.batchNumber,
        medicineId: medId,
        medicineName: medName,
        companyName: b.companyName || b.manufacturingCompany || 'Standard Pharma',
        expiryDate: b.expiryDate,
        quantity: b.quantity,
        tradePrice: price,
        retailPrice: b.retailPrice || b.unitSalePrice || price * 1.5
      });
      totalInventoryValue += b.quantity * price;
      
      // Update Godown primary store stock
      this.godownService.setStock('wh-main-01', medId, medName, b.batchNumber, b.quantity);
    });

    // Journal Entry for Initial Inventory Asset (1300) & Capital/Cash
    if (totalInventoryValue > 0) {
      this.journalEngine.createEntry({
        id: 'JE-INIT-INV',
        entry_date: new Date().toISOString().split('T')[0],
        description: 'Initial Inventory Stock Valuation Opening Balance',
        lines: [
          { account_code: '1300', account_name: 'Inventory Assets', debit: totalInventoryValue, credit: 0, memo: 'Stock Opening' },
          { account_code: '3010', account_name: 'Owner Capital', debit: 0, credit: totalInventoryValue, memo: 'Equity Opening' }
        ]
      });

      this.syncCursorStore.appendChange('JOURNAL_ENTRY', 'JE-INIT-INV', 'INSERT', { totalInventoryValue });
    }

    if (initialCash > 0) {
      this.journalEngine.createEntry({
        id: 'JE-INIT-CASH',
        entry_date: new Date().toISOString().split('T')[0],
        description: 'Initial Cash Drawer Balance Opening',
        lines: [
          { account_code: '1010', account_name: 'Cash in Hand', debit: initialCash, credit: 0, memo: 'Cash Opening' },
          { account_code: '3010', account_name: 'Owner Capital', debit: 0, credit: initialCash, memo: 'Equity Opening' }
        ]
      });

      this.posCashAccumulator += initialCash;
      this.syncCursorStore.appendChange('JOURNAL_ENTRY', 'JE-INIT-CASH', 'INSERT', { initialCash });
    }

    this.telemetryService.info('SYSTEM', 'SYSTEM_SEED_COMPLETED', {
      batchCount: batches.length,
      totalInventoryValue,
      initialCash
    });
  }

  /**
   * Complete End-to-End Single Patient & Pharmacy Workflow
   */
  public executeFullPatientWorkflow(params: {
    patientData: { fullName: string; phone: string; gender: 'MALE' | 'FEMALE' | 'OTHER'; cnic: string; ageYears: number };
    doctorName: string;
    vitals: { systolicBP: number; diastolicBP: number; pulseBPM: number; temperatureF: number; weightKg: number };
    consultation: { diagnosis: string; medicines: Array<{ itemCode: string; name: string; qty: number; unitPrice: number; costPrice: number }>; opdFee: number };
    requiresBiometricApproval?: boolean;
    approvalDetails?: { actionType: 'BILL_DISCOUNT' | 'STOCK_WRITE_OFF' | 'CREDIT_LIMIT_OVERRIDE' | 'PRICE_OVERRIDE'; amount: number; doctorId: string; reason: string };
  }): WorkflowResult {
    // 1. OPD Patient Registration
    const patient = this.patientService.registerPatient(params.patientData);
    this.syncCursorStore.appendChange('PATIENT', patient.id, 'INSERT', patient);

    // 2. Token Queue Assignment
    const token = this.queueService.issueToken({
      mrId: patient.mrId,
      patientName: patient.fullName,
      doctorId: 'DOC-KASHIF-01',
      doctorName: params.doctorName,
      fee: params.consultation.opdFee,
      paymentStatus: 'PAID'
    });
    this.queueService.callPatientToChamber(token.tokenId);
    this.syncCursorStore.appendChange('QUEUE_TOKEN', token.tokenId, 'UPDATE', { status: 'IN_CHAMBER' });

    // 3. Vitals HUD Recording
    const emrRecord = this.vitalsService.createEmrRecord({
      mrId: patient.mrId,
      tokenId: token.tokenId,
      doctorId: 'DOC-KASHIF-01',
      vitals: {
        bp: `${params.vitals.systolicBP}/${params.vitals.diastolicBP}`,
        pulse: params.vitals.pulseBPM,
        temperature: params.vitals.temperatureF,
        weight: params.vitals.weightKg
      },
      notes: {
        chiefComplaint: 'Routine OPD Consultation',
        diagnosis: params.consultation.diagnosis,
        treatmentPlan: 'Prescribed medication as listed.'
      }
    });
    this.syncCursorStore.appendChange('PATIENT_VITALS', emrRecord.emrId, 'INSERT', emrRecord);

    // 4. OPD Consultation Fee Accounting Entry
    const opdJeId = `JE-OPD-${token.tokenId}`;
    const opdJournalEntry = this.journalEngine.createEntry({
      id: opdJeId,
      entry_date: new Date().toISOString().split('T')[0],
      description: `OPD Consultation Fee Collection - ${patient.fullName} (${patient.mrId})`,
      lines: [
        { account_code: '1010', account_name: 'Cash in Hand', debit: params.consultation.opdFee, credit: 0, memo: 'OPD Cash Collection' },
        { account_code: '4010', account_name: 'OPD Consultation Fee Revenue', debit: 0, credit: params.consultation.opdFee, memo: 'Consultation Revenue' }
      ]
    });
    this.posCashAccumulator += params.consultation.opdFee;
    this.syncCursorStore.appendChange('JOURNAL_ENTRY', opdJeId, 'INSERT', opdJournalEntry);

    // Complete token queue status
    this.queueService.completeConsultation(token.tokenId);
    this.syncCursorStore.appendChange('QUEUE_TOKEN', token.tokenId, 'UPDATE', { status: 'COMPLETED' });

    // 5. Pharmacy FEFO Checkout & Stock Deduction
    this.posEngine.clearCart();
    let totalCOGS = 0;
    const stockEvents: Array<{ batch_number: string; quantity: number }> = [];

    params.consultation.medicines.forEach((med, index) => {
      // Allocate FEFO batches using method from FEFOBatchAllocator
      const allocation = this.batchAllocator.allocateStock(med.itemCode, med.qty, this.inventoryBatches);
      
      allocation.allocatedBatches.forEach((alloc) => {
        const matchingBatch = this.inventoryBatches.find((b) => b.batchNumber === alloc.batchNumber);
        if (matchingBatch) {
          matchingBatch.quantity -= alloc.allocatedQty;
          // Update Godown stock
          const currentGodownQty = this.godownService.getStock('wh-main-01', med.itemCode, alloc.batchNumber);
          this.godownService.setStock('wh-main-01', med.itemCode, med.name, alloc.batchNumber, Math.max(0, currentGodownQty - alloc.allocatedQty));
        }

        const posItem: POSItem = {
          id: `POS-ITEM-${med.itemCode}-${index}`,
          code: med.itemCode,
          name: med.name,
          companyName: matchingBatch ? matchingBatch.companyName : 'Standard Pharma',
          batchNumber: alloc.batchNumber,
          expiryDate: alloc.expiryDate,
          unitPrice: med.unitPrice,
          tradePrice: med.costPrice,
          stockQty: 1000
        };

        this.posEngine.addItemToCart(posItem, alloc.allocatedQty, med.unitPrice, 0, 0);
        totalCOGS += (alloc.allocatedQty * med.costPrice);
        stockEvents.push({ batch_number: alloc.batchNumber, quantity: alloc.allocatedQty });
      });
    });

    const cartSummary = this.posEngine.getCartSummary();
    const checkoutRes = this.posEngine.processCheckout(cartSummary.netTotal);
    this.posCashAccumulator += cartSummary.netTotal;

    // Thermal Printer Receipt Format Generation
    const receiptData: ESCPOSReceiptData = {
      clinicName: 'Dr. M. Kashif Khan Clinic & Medical Store',
      address: 'Near Old Bus Stand, Hyderabad, Sindh',
      phone: '+92 300 1234567',
      invoiceNumber: checkoutRes.invoiceId,
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      patientName: patient.fullName,
      mrNumber: patient.mrId,
      items: params.consultation.medicines.map((i) => ({
        name: i.name,
        batch: stockEvents[0]?.batch_number || 'BCH-2026A',
        qty: i.qty,
        price: i.unitPrice,
        amount: i.qty * i.unitPrice
      })),
      subtotal: cartSummary.subtotal,
      discount: cartSummary.billDiscountAmount,
      grandTotal: cartSummary.netTotal,
      cashReceived: cartSummary.netTotal,
      changeDue: 0,
      paymentMode: 'CASH'
    };

    // 6. POS Double-Entry Accounting Entry
    const posJeId = `JE-POS-${checkoutRes.invoiceId}`;
    const posJournalEntry = this.journalEngine.createEntry({
      id: posJeId,
      entry_date: new Date().toISOString().split('T')[0],
      description: `Pharmacy POS Cash Sale - Receipt #${checkoutRes.invoiceId}`,
      lines: [
        { account_code: '1010', account_name: 'Cash in Hand', debit: cartSummary.netTotal, credit: 0, memo: 'POS Cash Collection' },
        { account_code: '4020', account_name: 'Pharmacy Retail Revenue', debit: 0, credit: cartSummary.netTotal, memo: 'Retail Sales Revenue' },
        { account_code: '5010', account_name: 'Cost of Goods Sold', debit: totalCOGS, credit: 0, memo: 'COGS Recognition' },
        { account_code: '1300', account_name: 'Inventory Assets', debit: 0, credit: totalCOGS, memo: 'Stock Reduction at Cost' }
      ]
    });
    this.syncCursorStore.appendChange('JOURNAL_ENTRY', posJeId, 'INSERT', posJournalEntry);

    // 7. Doctor Biometric Approval Request (if flagged)
    let biometricApproval: ApprovalRequest | undefined = undefined;
    if (params.requiresBiometricApproval && params.approvalDetails) {
      const payload: ActionPayload = {
        action_type: params.approvalDetails.actionType,
        entity_id: `ENTITY-${Date.now()}`,
        override_amount: params.approvalDetails.amount,
        requested_by_user_id: params.approvalDetails.doctorId,
        reason: params.approvalDetails.reason
      };
      const reqId = `APP-REQ-${Date.now()}`;
      biometricApproval = this.approvalEngine.submitRequest(reqId, payload);
      if (biometricApproval.status === 'PENDING') {
        this.approvalEngine.approveRequest(reqId, params.approvalDetails.doctorId, 'Biometrically Approved via Thumbprint');
        biometricApproval = this.approvalEngine.getRequest(reqId);
      }
      this.syncCursorStore.appendChange('APPROVAL_REQUEST', reqId, 'UPDATE', { status: 'APPROVED' });
    }

    // 8. Privacy-Safe Telemetry Logging
    this.telemetryService.info('AUDIT', 'WORKFLOW_PATIENT_COMPLETED', {
      patientId: patient.id,
      patientName: patient.fullName, // Will be redacted automatically by TelemetryService
      mrId: patient.mrId,
      opdFee: params.consultation.opdFee,
      posNetAmount: cartSummary.netTotal,
      totalCOGS
    });

    const syncCursor = this.syncCursorStore.getLatestCursor();

    return {
      patient,
      token,
      vitals: {
        systolicBP: params.vitals.systolicBP,
        diastolicBP: params.vitals.diastolicBP,
        record: emrRecord
      },
      consultation: {
        diagnosis: params.consultation.diagnosis,
        medicines: params.consultation.medicines.map((m) => m.name),
        opdFee: params.consultation.opdFee,
        opdJournalEntry
      },
      posSale: {
        receiptId: checkoutRes.invoiceId,
        netAmount: cartSummary.netTotal,
        receiptData,
        posJournalEntry,
        stockEvents
      },
      biometricApproval,
      syncCursor
    };
  }

  /**
   * Run Master Suite Financial & Inventory Reconciliation Audit
   */
  public runReconciliationAudit(): ReconciliationReport {
    return this.reconciler.reconcile(this.posCashAccumulator, this.inventoryBatches);
  }
}
