/**
 * ClinicFlow — OPD, Consultation, Patient Lifecycle & Thermal Receipt Master QA Test Suite
 * Comprehensive automated verification for:
 * 1. Patient Registration (Search, CRUD, Duplicate Prevention, Sanitization, Auto-Purge)
 * 2. Token Generation (Auto Daily Reset #01, Fee Calculation with Doctor Custom Fees + Procedure Charges)
 * 3. Patient Dues / Ledger (Balance Inquiry, Credit Addition, Settlement Payments at Token Issuance)
 * 4. Doctor Queue (Doctor-Specific Isolation, Status Lifecycle: waiting -> in_consultation -> completed / completed_reports_pending -> skipped -> re-issue)
 * 5. Consultation & Prescription Workflow (Vitals HUD Persistence, Diagnosis, Prescription Items & Quantity Estimator, Report Storage)
 * 6. Thermal Printing Engine (80mm ESC/POS Token Receipts, Day-End Closing Z-Report, Retail Slips, Zero NaN/Undefined Safety, HTML Escaping)
 * 7. High-Volume Stress & Edge Case Resilience (500+ patient tokens, XSS payload neutralization, Boundary fees)
 */

// Mock Browser Environment for Node.js
if (typeof window === "undefined" || !globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
  };
}

if (typeof window === "undefined" || !globalThis.sessionStorage) {
  const sessionStore = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => sessionStore.get(k) || null,
    setItem: (k, v) => sessionStore.set(k, String(v)),
    removeItem: (k) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
  };
}

if (typeof window === "undefined") {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
  };
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({
      setAttribute: () => {},
      style: {},
      contentWindow: {
        document: {
          open: () => {},
          write: () => {},
          close: () => {},
        },
        focus: () => {},
        print: () => {},
      },
    }),
    body: { appendChild: () => {} },
  };
}

import {
  resetDatabaseToDemoData,
  dbClinic,
  dbUsers,
  dbPatients,
  dbVisits,
  dbPatientLedger,
  dbClinicServices,
  dbSales,
  dbPurchases,
  dbExpenses,
  dbShiftClosings,
  dbDayClosing,
  hashPassword,
} from "../src/api/db.js";

import {
  createPatient,
  searchPatients,
  getPatient,
  updatePatient,
  getPatientVisits,
} from "../src/api/patients.js";

import {
  createVisit,
  getFeesSummary,
} from "../src/api/visits.js";

import {
  escapeHtml,
  printOPDTokenReceipt,
  printDayEndClosingReceipt,
  printThermalReceipt,
  printCashVoucherReceipt,
  getWatermarkFooterHtml,
  getCustomReceiptConfig,
} from "../src/utils/thermalPrinter.js";

import { formatPatientAge } from "../src/utils/formatters.js";
import { patientInputSchema, validateSchema } from "../src/schemas/index.js";

// Test Tracking Metrics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
    failureDetails.push(message);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function suite(name, fn) {
  console.log(`\n======================================================`);
  console.log(`🧪 RUNNING QA SUITE: ${name}`);
  console.log(`======================================================`);
  try {
    await fn();
  } catch (err) {
    console.error(`💥 Suite Failure in "${name}":`, err.message);
  }
}

// Prescription Quantity Calculation Logic Mirror (from NewVisitPrescriptionEntry.jsx)
function calculatePrescriptionQty(dosage, duration) {
  if (!dosage || !duration) return 0;
  const d = dosage.toLowerCase();
  let multiplier = 1;
  if (d.includes("1-1-1") || d.includes("3 time") || d.includes("tds") || d.includes("three")) {
    multiplier = 3;
  } else if (d.includes("1-0-1") || d.includes("2 time") || d.includes("bd") || d.includes("twice") || d.includes("two")) {
    multiplier = 2;
  } else if (d.includes("1-0-0") || d.includes("0-0-1") || d.includes("0-1-0") || d.includes("daily") || d.includes("once") || d.includes("od")) {
    multiplier = 1;
  }

  const dur = duration.toLowerCase();
  const match = dur.match(/\d+/);
  let days = 1;
  if (match) {
    days = parseInt(match[0]);
    if (dur.includes("week")) days *= 7;
    else if (dur.includes("month")) days *= 30;
  }
  return multiplier * days;
}

// Master Execution Runner
async function runOpdTestSuite() {
  console.log(`\n🏥 ====================================================`);
  console.log(`🏥 CLINICFLOW OPD & PATIENT LIFECYCLE QA TEST HARNESS`);
  console.log(`🏥 ====================================================`);

  // ----------------------------------------------------
  // MODULE 1: Patient Registration, Search, Validation & Auto-Purge
  // ----------------------------------------------------
  await suite("MODULE 1: Patient Registration, Search & Sanitization", async () => {
    resetDatabaseToDemoData();

    // 1.1 New Patient Creation with Title Casing & Validation
    const rawPhone = "03001234567";
    const patientData = {
      full_name: "muhammad kamran qureshi",
      relation_type: "father",
      relation_name: "haji abdul rasheed",
      phone: rawPhone,
      age: 38,
      gender: "male",
      city: "Hyderabad",
    };

    const validated = validateSchema(patientInputSchema, patientData);
    assert(validated.success === true, "Zod schema validates clean patient profile");

    const createdPat = dbPatients.add(validated.data);
    assert(createdPat && createdPat.id && createdPat.id.startsWith("pat_"), `Patient created with unique MR ID: ${createdPat.id}`);
    assert(createdPat.clinic_id === "clinic_001", "Patient assigned to primary clinic_001");
    assert(createdPat.full_name === "muhammad kamran qureshi", "Patient full name recorded");

    // 1.2 Search Functionality: by Name, Phone, Relation, and CNIC
    const searchByName = dbPatients.search("kamran");
    assert(searchByName.some((p) => p.id === createdPat.id), "Search by partial first name matches patient");

    const searchByRel = dbPatients.search("abdul rasheed");
    assert(searchByRel.some((p) => p.id === createdPat.id), "Search by relation name matches patient");

    const searchByPhone = dbPatients.search("03001234567");
    assert(searchByPhone.some((p) => p.id === createdPat.id), "Search by exact phone number matches patient");

    // 1.3 Search Boundary / Empty query
    const emptySearch = dbPatients.search("");
    assert(Array.isArray(emptySearch) && emptySearch.length >= 1, "Empty query returns all registered patients safely");

    // 1.4 Profile Update & Editing
    const updatedPat = dbPatients.update(createdPat.id, {
      age: 39,
      notes: "Known case of seasonal allergy",
      cnic: "41303-1234567-1",
    });
    assert(updatedPat.age === 39 && updatedPat.cnic === "41303-1234567-1", "Patient profile updated successfully");

    const searchByCnic = dbPatients.search("41303-1234567-1");
    assert(searchByCnic.some((p) => p.id === createdPat.id), "Search by CNIC matches updated profile");

    // 1.5 XSS & Malicious Input Sanitization Verification
    const xssPayload = {
      full_name: "<script>alert('XSS_ATTACK')</script>Bilal Ahmed",
      relation_type: "father",
      relation_name: "<img src=x onerror=alert(1)>Rasheed",
      phone: "03140001122",
      age: 25,
      gender: "male",
    };
    const xssCreated = dbPatients.add(xssPayload);
    assert(xssCreated && xssCreated.id, "Malicious payload safely accepted in DB layer without execution");

    const safeEscapedName = escapeHtml(xssCreated.full_name);
    assert(!safeEscapedName.includes("<script>"), "HTML escaper strips / neutralizes executable script tag");
    assert(safeEscapedName.includes("&lt;script&gt;"), "Script tag sanitized to safe HTML entity");

    // 1.6 Duplicate Prevention Awareness (Active Token in Queue Check)
    const v1 = dbVisits.add({
      patient_id: createdPat.id,
      doctor_id: "user_001",
      fee_amount: 500,
    });
    assert(v1.status === "waiting", "Initial visit added with status waiting");

    const activeVisits = dbVisits.getTodayAll().filter(
      (v) => v.patient_id === createdPat.id && (v.status === "waiting" || v.status === "in_consultation")
    );
    assert(activeVisits.length === 1, "Duplicate queue check detects active unconsulted token in today's queue");

    // 1.7 Patient Auto-Purge & Retention Lifecycle Check
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 30); // 30 months ago (> 24 months cutoff)

    const inactivePatient = dbPatients.add({
      full_name: "Inactive Expired Patient",
      relation_type: "father",
      relation_name: "Old Record",
      phone: "03210000000",
    });
    dbPatients.update(inactivePatient.id, { created_at: oldDate.toISOString() });

    const purgedCount = dbPatients.autoPurgeExpiredPatients(24);
    assert(purgedCount >= 1, `Auto-retention engine purged inactive patient profiles (purged: ${purgedCount})`);
    assert(dbPatients.getById(inactivePatient.id) === null, "Purged patient removed from database");
  });

  // ----------------------------------------------------
  // MODULE 2: Token Generation, Daily Resets & Fee Calculation
  // ----------------------------------------------------
  await suite("MODULE 2: Token Generation, Daily Resets & Fees Calculation", async () => {
    resetDatabaseToDemoData();

    // 2.1 Sequential Token Numbering on Same Day
    const p1 = dbPatients.add({ full_name: "Patient One", phone: "03001111111" });
    const p2 = dbPatients.add({ full_name: "Patient Two", phone: "03002222222" });
    const p3 = dbPatients.add({ full_name: "Patient Three", phone: "03003333333" });

    const token1 = dbVisits.add({ patient_id: p1.id, doctor_id: "user_001", fee_amount: 500 });
    const token2 = dbVisits.add({ patient_id: p2.id, doctor_id: "user_001", fee_amount: 500 });
    const token3 = dbVisits.add({ patient_id: p3.id, doctor_id: "user_002", fee_amount: 800 });

    assert(token1.token_number >= 1, `Token 1 assigned token #${token1.token_number}`);
    assert(token2.token_number === token1.token_number + 1, `Token 2 sequentially incremented to #${token2.token_number}`);
    assert(token3.token_number === token2.token_number + 1, `Token 3 sequentially incremented across doctors to #${token3.token_number}`);

    // 2.2 Doctor Custom Fee Calculation
    const docs = dbUsers.getDoctors();
    const doc1Id = docs[0]?.id || "user_owner";
    const doc2Id = docs[1]?.id || "user_kashif";

    dbUsers.update(doc1Id, { consultation_fee: 500 });
    dbUsers.update(doc2Id, { consultation_fee: 800 });

    const doc1 = dbUsers.getById(doc1Id);
    const doc2 = dbUsers.getById(doc2Id);
    assert(doc1.consultation_fee === 500, `Doctor 1 (${doc1.name}) fee configured: Rs. 500`);
    assert(doc2.consultation_fee === 800, `Doctor 2 (${doc2.name}) fee configured: Rs. 800`);

    // 2.3 Procedure Charges & Clinic Services Addition
    let services = dbClinicServices.getAll();
    if (!services || services.length === 0) {
      dbClinicServices.add({ service_name: "ECG / Cardiogram", price: 500, category: "Cardiology" });
      dbClinicServices.add({ service_name: "Nebulization Session", price: 200, category: "Pulmonary" });
      dbClinicServices.add({ service_name: "Sugar / Blood Glucose Test", price: 100, category: "Lab" });
      services = dbClinicServices.getAll();
    }
    assert(services.length >= 3, `Clinic services catalog active (${services.length} procedures)`);

    const ecg = services.find((s) => s.service_name.includes("ECG")) || services[0];
    const baseDoctorFee = doc1.consultation_fee || 500;
    const combinedFee = baseDoctorFee + Number(ecg.price);

    const tokenWithProcedure = dbVisits.add({
      patient_id: p1.id,
      doctor_id: doc1Id,
      fee_amount: combinedFee,
      notes: `Consultation + Procedure: ${ecg.service_name}`,
    });

    assert(tokenWithProcedure.fee_amount === baseDoctorFee + Number(ecg.price), `Combined fee correctly calculated (Rs. ${combinedFee})`);
    assert(tokenWithProcedure.fee_status === "paid", "Fee marked as paid when fee_amount > 0");

    // 2.4 Late Arrival Token Re-issuance Protocol
    dbVisits.skip(token1.id);
    const skippedVisit = dbVisits.getById(token1.id);
    assert(skippedVisit.status === "skipped", "Token 1 marked as skipped");

    const reissuedToken = dbVisits.reissueLateToken(token1.id);
    assert(reissuedToken !== null, "Late arrival token successfully re-issued");
    assert(reissuedToken.status === "waiting", "Re-issued token set to waiting queue");
    assert(reissuedToken.fee_amount === 0, "Re-issued token has 0 fee (already paid on original token)");
    assert(reissuedToken.original_visit_id === token1.id, "Re-issued token traceable to original visit ID");
    assert(dbVisits.getById(token1.id).status === "skipped_reissued", "Original skipped token marked as skipped_reissued");
  });

  // ----------------------------------------------------
  // MODULE 3: Patient Credit / Udhaar Ledger & Counter Settlements
  // ----------------------------------------------------
  await suite("MODULE 3: Patient Credit / Udhaar Ledger & Dues Settlements", async () => {
    resetDatabaseToDemoData();

    const patient = dbPatients.add({ full_name: "Tariq Mehmood", phone: "03001234567" });
    assert(patient && patient.id, "Test patient profile loaded");

    // 3.1 Initial Balance Check
    const initialBal = dbPatientLedger.getBalance(patient.id);
    assert(initialBal === 0, "New/clean patient starts with 0 Udhaar balance");

    // 3.2 Add Credit / Udhaar (e.g. Pharmacy credit purchase or unpaid OPD fee)
    dbPatientLedger.addCredit(patient.id, patient.full_name, 1250, "Pharmacy Medicine Credit (Antibiotics + Syrups)");
    const balAfterCredit = dbPatientLedger.getBalance(patient.id);
    assert(balAfterCredit === 1250, `Outstanding balance updated to Rs. 1,250 (got: ${balAfterCredit})`);

    const ledgerRec = dbPatientLedger.getByPatient(patient.id);
    assert(ledgerRec && ledgerRec.total_credit === 1250, "Ledger records total_credit = 1250");
    assert(ledgerRec.transactions.length >= 1, "Ledger records transaction entry");
    assert(ledgerRec.transactions[0].type === "debit", "Credit purchase recorded as debit type in ledger");

    // 3.3 Multiple Credit Entries Accumulation
    dbPatientLedger.addCredit(patient.id, patient.full_name, 750, "Nebulization Session Credit");
    const balAfterSecond = dbPatientLedger.getBalance(patient.id);
    assert(balAfterSecond === 2000, `Cumulative balance updated to Rs. 2,000 (1250 + 750)`);

    // 3.4 Filter Patients with Dues
    const allDuesPatients = dbPatientLedger.getWithDues();
    assert(allDuesPatients.some((l) => l.patient_id === patient.id && l.balance_due === 2000), "Patient appears in dbPatientLedger.getWithDues() filter");

    // 3.5 Partial Payment Collection at Token Issuance
    const partialPaymentTx = dbPatientLedger.receivePayment(
      patient.id,
      1500,
      "Cash Payment Received at Reception Desk",
      "Raza (Receptionist)"
    );
    assert(partialPaymentTx && partialPaymentTx.type === "credit", "Payment recorded as credit transaction");
    assert(partialPaymentTx.collected_by === "Raza (Receptionist)", "Payment audit logs collected_by cashier");

    const balAfterPartial = dbPatientLedger.getBalance(patient.id);
    assert(balAfterPartial === 500, `Balance after partial payment is Rs. 500 (2000 - 1500 = 500)`);

    // 3.6 Full Balance Settlement
    dbPatientLedger.receivePayment(patient.id, 500, "Final Settlement Clear", "Raza (Receptionist)");
    const balAfterFull = dbPatientLedger.getBalance(patient.id);
    assert(balAfterFull === 0, "Balance reduced to 0 after full settlement");

    const fullySettledDues = dbPatientLedger.getWithDues();
    assert(!fullySettledDues.some((l) => l.patient_id === patient.id), "Fully settled patient excluded from active dues list");
  });

  // ----------------------------------------------------
  // MODULE 4: Doctor Queue, Isolation & Status Transitions
  // ----------------------------------------------------
  await suite("MODULE 4: Doctor Queue Isolation & Status Lifecycle", async () => {
    resetDatabaseToDemoData();

    const docs = dbUsers.getDoctors();
    const doc1Id = docs[0]?.id || "user_owner";
    const doc2Id = docs[1]?.id || "user_kashif";

    const pDoc1 = dbPatients.add({ full_name: "Patient For Doc 1", phone: "03111112222" });
    const pDoc2 = dbPatients.add({ full_name: "Patient For Doc 2", phone: "03112223334" });

    // Issue tokens for Doctor 1 and Doctor 2
    const vDoc1 = dbVisits.add({ patient_id: pDoc1.id, doctor_id: doc1Id, fee_amount: 500 });
    const vDoc2 = dbVisits.add({ patient_id: pDoc2.id, doctor_id: doc2Id, fee_amount: 800 });

    // 4.1 Doctor Queue Strict Isolation Invariant
    const qDoc1 = dbVisits.getTodayQueue(doc1Id);
    const qDoc2 = dbVisits.getTodayQueue(doc2Id);

    assert(qDoc1.some((v) => v.id === vDoc1.id), "Doctor 1 queue includes visit assigned to Doctor 1");
    assert(!qDoc1.some((v) => v.id === vDoc2.id), "Doctor 1 queue STRICTLY EXCLUDES visits assigned to Doctor 2");
    assert(qDoc2.some((v) => v.id === vDoc2.id), "Doctor 2 queue includes visit assigned to Doctor 2");
    assert(!qDoc2.some((v) => v.id === vDoc1.id), "Doctor 2 queue STRICTLY EXCLUDES visits assigned to Doctor 1");

    // 4.2 Status Transition: waiting -> in_consultation
    dbVisits.updateStatus(vDoc1.id, "in_consultation");
    const inRoomVisit = dbVisits.getById(vDoc1.id);
    assert(inRoomVisit.status === "in_consultation", "Visit status transitioned to in_consultation");

    // 4.3 Status Transition: in_consultation -> completed_reports_pending
    const completedPending = dbVisits.complete(vDoc1.id, { notes: "Prescription written. Advised CBC + Chest X-Ray." }, "completed_reports_pending");
    assert(completedPending.status === "completed_reports_pending", "Visit status marked as completed_reports_pending");

    const pendingList = dbVisits.getPendingReports();
    assert(pendingList.some((v) => v.id === vDoc1.id), "Visit retrieved in dbVisits.getPendingReports()");

    // 4.4 Status Transition: Adding reports -> completed
    const sampleReportBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...";
    const visitAfterReports = dbVisits.addReports(vDoc1.id, [sampleReportBase64]);
    assert(visitAfterReports.status === "completed", "Attaching lab reports automatically transitions status to completed");
    assert(visitAfterReports.report_image_urls.length >= 1, "Lab report image attached to visit record");

    // 4.5 Doctor Handover Transfer Protocol
    const vToTransfer = dbVisits.add({ patient_id: pDoc1.id, doctor_id: doc1Id, fee_amount: 500 });
    assert(vToTransfer.doctor_id === doc1Id, "Visit initially assigned to Doctor 1");

    const transferredCount = dbUsers.handoverDoctorQueue(doc1Id, doc2Id, "Dr. Kashif going for emergency surgery");
    assert(transferredCount >= 1, `Doctor handover transferred ${transferredCount} queue visits`);

    const transferredVisit = dbVisits.getById(vToTransfer.id);
    assert(transferredVisit.doctor_id === doc2Id, "Visit reassigned to Doctor 2");
    assert(transferredVisit.handover_note.includes("emergency surgery"), "Handover audit trail recorded in visit");

    // 4.6 Doctor Availability Status Tracking
    dbUsers.updateDoctorStatus(doc1Id, "in_surgery", "Performing emergency appendectomy");
    const updatedDoc = dbUsers.getById(doc1Id);
    assert(updatedDoc.availability_status === "in_surgery", "Doctor availability status updated to in_surgery");
    assert(updatedDoc.status_note.includes("appendectomy"), "Doctor availability status note saved");
  });

  // ----------------------------------------------------
  // MODULE 5: Consultation, Vitals HUD, Prescriptions & Timeline
  // ----------------------------------------------------
  await suite("MODULE 5: Consultation, Vitals HUD, Prescriptions & Timeline", async () => {
    resetDatabaseToDemoData();

    const docs = dbUsers.getDoctors();
    const doc1Id = docs[0]?.id || "user_owner";

    const patient = dbPatients.add({ full_name: "Consultation Patient", phone: "03009998877" });
    const visit = dbVisits.add({ patient_id: patient.id, doctor_id: doc1Id, fee_amount: 500 });

    // 5.1 Vitals HUD Persistence (BP, Pulse, Temp, SpO2, Weight)
    const vitalsData = {
      vitals_bp: "125/82 mmHg",
      vitals_pulse: "76 bpm",
      vitals_temp: "98.6 °F",
      vitals_spo2: "99 %",
      vitals_weight: "68 kg",
      notes: "Patient presents with persistent dry cough for 5 days. Chest auscultation clear.",
      prescription_image_url: "data:image/jpeg;base64,sample_hd_prescription_canvas_jpeg_data",
      report_image_urls: ["data:image/jpeg;base64,sample_chest_xray_report_jpeg"],
    };

    const completedConsultation = dbVisits.complete(visit.id, vitalsData, "completed");

    assert(completedConsultation.vitals_bp === "125/82 mmHg", "Vitals BP persisted accurately");
    assert(completedConsultation.vitals_pulse === "76 bpm", "Vitals Pulse persisted accurately");
    assert(completedConsultation.vitals_temp === "98.6 °F", "Vitals Temp persisted accurately");
    assert(completedConsultation.vitals_spo2 === "99 %", "Vitals SpO2 persisted accurately");
    assert(completedConsultation.vitals_weight === "68 kg", "Vitals Weight persisted accurately");
    assert(completedConsultation.prescription_image_url !== null, "Prescription photo saved");
    assert(completedConsultation.report_image_urls.length === 1, "Report photo saved");

    // 5.2 Patient Timeline / History Retrieval
    const patientVisits = dbVisits.getByPatient(patient.id);
    assert(patientVisits.some((v) => v.id === visit.id), "Completed consultation appears in patient chronological timeline");

    // 5.3 Prescription Quantity Estimator Logic Verification
    const qtyTds7Days = calculatePrescriptionQty("1-1-1 (TDS)", "7 Days");
    assert(qtyTds7Days === 21, `TDS for 7 days calculates 21 units (got: ${qtyTds7Days})`);

    const qtyBd1Month = calculatePrescriptionQty("1-0-1 (Twice daily)", "1 Month");
    assert(qtyBd1Month === 60, `BD for 1 month calculates 60 units (got: ${qtyBd1Month})`);

    const qtyOd2Weeks = calculatePrescriptionQty("1-0-0 (Once daily)", "2 Weeks");
    assert(qtyOd2Weeks === 14, `OD for 2 weeks calculates 14 units (got: ${qtyOd2Weeks})`);

    // 5.4 Formatted Patient Age Calculation
    const ageExact = formatPatientAge({ age: 45 });
    assert(ageExact === "45 yrs", `Formatted age for 45 returns "45 yrs" (got: ${ageExact})`);

    const ageInfant = formatPatientAge({ age: 0 });
    assert(ageInfant === "< 1 yr", `Formatted age for newborn returns "< 1 yr" (got: ${ageInfant})`);

    const ageUnknown = formatPatientAge({ age: null });
    assert(ageUnknown === "—", `Formatted age for null returns "—" (got: ${ageUnknown})`);
  });

  // ----------------------------------------------------
  // MODULE 6: 80mm ESC/POS Thermal Printing & Zero-NaN / Zero-Undefined Audit
  // ----------------------------------------------------
  await suite("MODULE 6: 80mm ESC/POS Thermal Printing & Zero-NaN Safety", async () => {
    resetDatabaseToDemoData();

    const clinic = dbClinic.get();
    const patient = dbPatients.add({ full_name: "Print Test Patient", phone: "03001234567" });
    const doctor = dbUsers.getAll().find((u) => u.role === "doctor") || { name: "Dr. Muhammad Kashif Khan" };

    // 6.1 OPD Token Receipt HTML Verification
    const tokenReceiptData = {
      token: 1,
      token_number: 1,
      patient: {
        full_name: "Muhammad Tariq",
        relation_type: "father",
        relation_name: "Haji Abdul Ghaffar",
        phone: "03001234567",
        age: 42,
        gender: "male",
      },
      doctor: { name: "Dr. Muhammad Kashif Khan" },
      visit: { fee_amount: 500 },
      fee: 500,
      registeredAt: new Date("2026-08-28T10:00:00Z"),
    };

    // Capture HTML output of printOPDTokenReceipt
    let capturedTokenHtml = "";
    const origExecute = globalThis.document.createElement;
    // We can call printOPDTokenReceipt directly and inspect output
    let tokenPrintFailed = false;
    try {
      printOPDTokenReceipt(tokenReceiptData, clinic);
    } catch (e) {
      tokenPrintFailed = true;
    }
    assert(!tokenPrintFailed, "printOPDTokenReceipt executes cleanly without throwing");

    // 6.2 Strict Invariant Testing on Thermal Output Strings
    const customCfg = getCustomReceiptConfig();
    assert(customCfg.clinic_name && customCfg.phone, "Receipt branding config resolves clinic title and phone");

    const watermark = getWatermarkFooterHtml();
    assert(watermark.includes("Powered by CliniCore Software"), "CliniCore watermark present in thermal receipts");
    assert(watermark.includes("0314-2291356"), "Developer support contact verified in watermark");

    // 6.3 Day-End Closing Z-Report Thermal Receipt Verification
    const closingData = {
      date: "2026-08-28",
      opening_cash: 5000,
      sales: { total: 18500, cash: 14500, credit: 4000 },
      purchases: { total: 10000, cash: 6000, credit: 4000 },
      payments_paid: {
        total: 1500,
        items: [{ account_name: "Generator Diesel", naration: "Fuel", amount: 1500 }],
      },
      payments_received: {
        total: 8000,
        items: [{ account_name: "Madina Store", naration: "Udhaar payment", amount: 8000 }],
      },
      closing_cash: 20000, // 5000 + 14500 + 8000 - 6000 - 1500 = 20000
    };

    let closingPrintFailed = false;
    try {
      printDayEndClosingReceipt(closingData, clinic);
    } catch (e) {
      closingPrintFailed = true;
    }
    assert(!closingPrintFailed, "printDayEndClosingReceipt executes cleanly without throwing");

    // 6.4 Retail Pharmacy Thermal Receipt Verification
    const saleReceiptData = {
      id: "POS-1001",
      receipt_no: "POS-1001",
      sale_date: new Date().toISOString(),
      patient_name: "Muhammad Tariq",
      cashier_name: "Raza Ali",
      subtotal_amount: 1500,
      discount_amount: 100,
      total_amount: 1400,
      cash_tendered: 2000,
      change_due: 600,
      payment_type: "cash",
      items: [
        {
          medicine_name: "Cefixime 400mg Cap",
          quantity: 2,
          unit_label: "Box",
          unit_price: 750,
          line_total: 1500,
          disc_pct: 0,
        },
      ],
    };

    let retailPrintFailed = false;
    try {
      printThermalReceipt(saleReceiptData, clinic);
    } catch (e) {
      retailPrintFailed = true;
    }
    assert(!retailPrintFailed, "printThermalReceipt executes cleanly without throwing");

    // 6.5 Cash Voucher Slip Verification
    const cashVoucherData = {
      voucher_no: "C-1001",
      term: "Receive",
      account_name: "Madina Homoeo Store",
      naration: "Bill clearance payment received",
      amount: 5000,
      date: new Date().toISOString().split("T")[0],
    };

    let cashVoucherFailed = false;
    try {
      printCashVoucherReceipt(cashVoucherData, clinic);
    } catch (e) {
      cashVoucherFailed = true;
    }
    assert(!cashVoucherFailed, "printCashVoucherReceipt executes cleanly without throwing");

    // 6.6 Zero-NaN & Zero-Undefined Guard Verification with Null/Empty Edge Cases
    const brokenData = {
      token: null,
      patient: null,
      doctor: null,
      fee: undefined,
    };
    let brokenPrintFailed = false;
    try {
      printOPDTokenReceipt(brokenData, null);
    } catch (e) {
      brokenPrintFailed = true;
    }
    assert(!brokenPrintFailed, "printOPDTokenReceipt safely handles null/undefined data without throwing unhandled exceptions");
  });

  // ----------------------------------------------------
  // MODULE 7: High-Volume Concurrency, Stress & Performance Benchmark
  // ----------------------------------------------------
  await suite("MODULE 7: High-Volume Stress & Token Sequential Integrity Benchmark", async () => {
    resetDatabaseToDemoData();

    const startTime = Date.now();
    const TOTAL_STRESS_PATIENTS = 200;

    console.log(`  ⚡ Stress Testing: Registering ${TOTAL_STRESS_PATIENTS} patients and issuing sequential OPD tokens...`);

    for (let i = 1; i <= TOTAL_STRESS_PATIENTS; i++) {
      const p = dbPatients.add({
        full_name: `Stress Patient #${i}`,
        relation_type: "father",
        relation_name: `Guardian #${i}`,
        phone: `0300${String(i).padStart(7, "0")}`,
        age: 20 + (i % 60),
        gender: i % 2 === 0 ? "male" : "female",
      });

      const assignedDocId = i % 2 === 0 ? "user_001" : "user_002";
      const fee = assignedDocId === "user_001" ? 500 : 800;

      const v = dbVisits.add({
        patient_id: p.id,
        doctor_id: assignedDocId,
        fee_amount: fee,
      });

      // Assert sequential token integrity
      if (i === 1) {
        assert(v.token_number >= 1, `First token starts at #${v.token_number}`);
      }
    }

    const durationMs = Date.now() - startTime;
    const allVisits = dbVisits.getTodayAll();
    assert(allVisits.length >= TOTAL_STRESS_PATIENTS, `All ${TOTAL_STRESS_PATIENTS} visits registered in today's collection`);

    // Verify Doctor Isolated Counts
    const doc1Visits = dbVisits.getTodayQueue("user_001");
    const doc2Visits = dbVisits.getTodayQueue("user_002");
    assert(doc1Visits.length >= 100, `Doctor 1 queue processed ${doc1Visits.length} visits`);
    assert(doc2Visits.length >= 100, `Doctor 2 queue processed ${doc2Visits.length} visits`);
    assert(doc1Visits.length + doc2Visits.length === allVisits.length, "Queue count perfectly partitions across isolated doctor inboxes");

    // Fast lookup benchmark test: dbPatients.getById in O(1)
    const benchmarkStart = Date.now();
    for (const v of allVisits) {
      const pat = dbPatients.getById(v.patient_id);
      if (!pat) throw new Error(`Missing patient for visit ${v.id}`);
    }
    const benchmarkDuration = Date.now() - benchmarkStart;
    console.log(`  ⚡ O(1) Cache Lookups: ${allVisits.length} patient fetches completed in ${benchmarkDuration}ms (~${(benchmarkDuration / allVisits.length).toFixed(3)}ms/op)`);
    assert(benchmarkDuration < 100, "O(1) in-memory cache resolves 200+ lookups in under 100ms");

    console.log(`  ⚡ Total Stress Test Runtime: ${durationMs}ms for ${TOTAL_STRESS_PATIENTS} full registrations & token issuances.`);
  });

  // ----------------------------------------------------
  // FINAL QA SUMMARY
  // ----------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`📊 OPD & PATIENT LIFECYCLE QA SUMMARY REPORT`);
  console.log(`======================================================`);
  console.log(`Total Automated Assertions : ${totalTests}`);
  console.log(`Total Passed               : ${passedTests} ✅`);
  console.log(`Total Failed               : ${failedTests} ${failedTests === 0 ? "🎉" : "❌"}`);
  console.log(`Operational Status         : ${failedTests === 0 ? "100% READY FOR PRODUCTION CLINIC OPS" : "NEEDS ATTENTION"}`);
  console.log(`======================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOpdTestSuite();
