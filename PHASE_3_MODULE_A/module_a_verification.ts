import assert from 'node:assert/strict';
import { PatientService } from './opd_emr_engine/src/patients/patient_service.ts';
import { QueueService } from './opd_emr_engine/src/opd/queue_service.ts';
import { VitalsService } from './opd_emr_engine/src/emr/vitals_service.ts';

console.log('================================================================');
console.log('  CLINICFLOW PHASE 3 MODULE A: VERIFICATION TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName: string, testFn: () => void) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } catch (err: any) {
    console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

// ------------------------------------------------------------------
// SUITE 1: PATIENT LIFECYCLE, SEQUENTIAL MR ID & DUPLICATE DETECTOR
// ------------------------------------------------------------------
console.log('--- Suite 1: Patient Lifecycle & Duplicate Detection ---');

runTest('Phone Normalization handles various Pakistani formats correctly', () => {
  assert.equal(PatientService.normalizePhone('03001234567'), '+923001234567');
  assert.equal(PatientService.normalizePhone('923001234567'), '+923001234567');
  assert.equal(PatientService.normalizePhone('+923001234567'), '+923001234567');
  assert.equal(PatientService.normalizePhone('3001234567'), '+923001234567');
  assert.equal(PatientService.normalizePhone('0300-1234567'), '+923001234567');
});

runTest('Sequential MR ID generation (MR-00001, MR-00002)', () => {
  const patientService = new PatientService();
  const p1 = patientService.registerPatient({
    fullName: 'Muhammad Ali',
    phone: '03001112233',
    gender: 'MALE',
    cnic: '42201-1234567-1'
  });
  assert.equal(p1.mrId, 'MR-00001');

  const p2 = patientService.registerPatient({
    fullName: 'Fatima Bibi',
    phone: '03019998877',
    gender: 'FEMALE',
    cnic: '42201-9876543-2'
  });
  assert.equal(p2.mrId, 'MR-00002');
});

runTest('Duplicate Patient Detector prevents registration on CNIC conflict', () => {
  const patientService = new PatientService();
  patientService.registerPatient({
    fullName: 'Tariq Mahmood',
    phone: '03021234567',
    gender: 'MALE',
    cnic: '42201-5555555-5'
  });

  const duplicateAttempt = () => {
    patientService.registerPatient({
      fullName: 'Tariq M.',
      phone: '03029999999',
      gender: 'MALE',
      cnic: '42201-5555555-5'
    });
  };

  assert.throws(duplicateAttempt, /Duplicate Patient Detected: Patient with CNIC/);
});

runTest('Multi-identifier search finds patient by MR, Phone, Name, or CNIC', () => {
  const patientService = new PatientService();
  patientService.registerPatient({
    fullName: 'Zubair Ahmed',
    phone: '03335554433',
    gender: 'MALE',
    cnic: '41302-1231231-1'
  });

  // Search by MR
  const byMr = patientService.searchPatients('MR-00001');
  assert.equal(byMr.length, 1);
  assert.equal(byMr[0].fullName, 'Zubair Ahmed');

  // Search by Phone
  const byPhone = patientService.searchPatients('03335554433');
  assert.equal(byPhone.length, 1);

  // Search by Name substring
  const byName = patientService.searchPatients('zubair');
  assert.equal(byName.length, 1);

  // Search by CNIC digits
  const byCnic = patientService.searchPatients('4130212312311');
  assert.equal(byCnic.length, 1);
});

// ------------------------------------------------------------------
// SUITE 2: OPD QUEUE TOKEN MANAGER & DOCTOR CHAMBER ISOLATION
// ------------------------------------------------------------------
console.log('\n--- Suite 2: Queue Management & Doctor Isolation ---');

runTest('Tokens reset to #01 on a new calendar date (Morning Reset)', () => {
  const queueService = new QueueService();
  
  // Day 1
  const t1 = queueService.issueToken({
    mrId: 'MR-00001',
    patientName: 'Patient A',
    doctorId: 'DOC-101',
    doctorName: 'Dr. Kashif Khan',
    fee: 1500,
    customDateStr: '2026-08-30'
  });
  assert.equal(t1.formattedToken, '#01');

  const t2 = queueService.issueToken({
    mrId: 'MR-00002',
    patientName: 'Patient B',
    doctorId: 'DOC-101',
    doctorName: 'Dr. Kashif Khan',
    fee: 1500,
    customDateStr: '2026-08-30'
  });
  assert.equal(t2.formattedToken, '#02');

  // Day 2 (Morning Reset)
  const t3 = queueService.issueToken({
    mrId: 'MR-00003',
    patientName: 'Patient C',
    doctorId: 'DOC-101',
    doctorName: 'Dr. Kashif Khan',
    fee: 1500,
    customDateStr: '2026-08-31'
  });
  assert.equal(t3.formattedToken, '#01');
});

runTest('Doctor Chamber Isolation: Doctor A and Doctor B maintain separate active chamber states', () => {
  const queueService = new QueueService();
  const dateStr = '2026-08-30';

  const tokenDocA_1 = queueService.issueToken({
    mrId: 'MR-00001',
    patientName: 'Doc A Patient 1',
    doctorId: 'DOC-A',
    doctorName: 'Dr. A',
    fee: 1000,
    customDateStr: dateStr
  });

  const tokenDocB_1 = queueService.issueToken({
    mrId: 'MR-00002',
    patientName: 'Doc B Patient 1',
    doctorId: 'DOC-B',
    doctorName: 'Dr. B',
    fee: 1200,
    customDateStr: dateStr
  });

  // Call Doc A Patient 1 to chamber
  queueService.callPatientToChamber(tokenDocA_1.tokenId);
  assert.equal(queueService.getActiveChamberPatient('DOC-A', dateStr)?.mrId, 'MR-00001');
  assert.equal(queueService.getActiveChamberPatient('DOC-B', dateStr), undefined);

  // Call Doc B Patient 1 to chamber
  queueService.callPatientToChamber(tokenDocB_1.tokenId);
  assert.equal(queueService.getActiveChamberPatient('DOC-B', dateStr)?.mrId, 'MR-00002');
  // Doc A's patient remains unaffected IN_CHAMBER
  assert.equal(queueService.getActiveChamberPatient('DOC-A', dateStr)?.mrId, 'MR-00001');

  // Issue & Call Doc A Patient 2 -> Auto-completes Doc A Patient 1 without touching Doc B
  const tokenDocA_2 = queueService.issueToken({
    mrId: 'MR-00003',
    patientName: 'Doc A Patient 2',
    doctorId: 'DOC-A',
    doctorName: 'Dr. A',
    fee: 1000,
    customDateStr: dateStr
  });
  queueService.callPatientToChamber(tokenDocA_2.tokenId);

  assert.equal(queueService.getActiveChamberPatient('DOC-A', dateStr)?.mrId, 'MR-00003');
  assert.equal(tokenDocA_1.status, 'COMPLETED');
  assert.equal(queueService.getActiveChamberPatient('DOC-B', dateStr)?.mrId, 'MR-00002'); // Doc B still in chamber
});

runTest('Consultation fee handler computes discounts and payment modes correctly', () => {
  const queueService = new QueueService();
  const token = queueService.issueToken({
    mrId: 'MR-00001',
    patientName: 'Usman Ali',
    doctorId: 'DOC-101',
    doctorName: 'Dr. Kashif',
    fee: 2000,
    discount: 500,
    paymentMode: 'CASH',
    paymentStatus: 'PAID'
  });

  assert.equal(token.feeInfo.amount, 2000);
  assert.equal(token.feeInfo.discount, 500);
  assert.equal(token.feeInfo.netPayable, 1500);
  assert.equal(token.feeInfo.paymentStatus, 'PAID');
});

// ------------------------------------------------------------------
// SUITE 3: CLINICAL VITALS VALIDATION & EMR AUDIT TRAIL
// ------------------------------------------------------------------
console.log('\n--- Suite 3: Clinical Vitals & EMR Audit History ---');

runTest('Vitals Service rejects physiologically impossible BP 300/200', () => {
  assert.throws(() => {
    VitalsService.validateBloodPressure('300/200');
  }, /Systolic BP \(300 mmHg\) is out of valid clinical range/);
});

runTest('Vitals Service rejects invalid BP with diastolic >= systolic (e.g. 80/120)', () => {
  assert.throws(() => {
    VitalsService.validateBloodPressure('80/120');
  }, /Diastolic BP \(120\) must be strictly less than Systolic BP \(80\)/);
});

runTest('Vitals Service rejects malformed BP string "invalid_bp"', () => {
  assert.throws(() => {
    VitalsService.validateBloodPressure('invalid_bp');
  }, /Expected format "systolic\/diastolic"/);
});

runTest('Vitals Service validates valid vitals and detects clinical alerts (e.g. Stage 2 Hypertension)', () => {
  const vitalsService = new VitalsService();
  const analyses = vitalsService.validateVitals({
    bp: '145/95',
    pulse: 88,
    temperature: 98.6,
    spO2: 97,
    weight: 75,
    bloodSugar: 110
  });

  const bpAnalysis = analyses.find((a) => a.parameter === 'Blood Pressure');
  assert.equal(bpAnalysis?.severity, 'HIGH');
  assert.equal(bpAnalysis?.message, 'Stage 2 Hypertension detected.');
});

runTest('EMR Non-Destructive Amendment Audit Trail maintains full historical versioning', () => {
  const vitalsService = new VitalsService();

  // Create initial consultation
  const initial = vitalsService.createEmrRecord({
    mrId: 'MR-00001',
    tokenId: 'DOC1-2026-08-30-001',
    doctorId: 'DOC-101',
    vitals: { bp: '120/80', pulse: 72, temperature: 98.4 },
    notes: {
      chiefComplaint: 'Mild headache for 2 days',
      diagnosis: 'Tension Headache',
      treatmentPlan: 'Tab Paracetamol 500mg TDS for 3 days'
    }
  });

  assert.equal(initial.version, 1);
  assert.equal(initial.auditTrail.length, 0);

  // Amend record (v1 -> v2)
  const amended = vitalsService.amendEmrRecord({
    emrId: initial.emrId,
    amendedBy: 'DOC-101',
    reason: 'Updated diagnosis after lab test review',
    newVitals: { bp: '130/85', pulse: 78 },
    newNotes: {
      diagnosis: 'Mild Hypertension & Migraine',
      treatmentPlan: 'Tab Beta Blocker 25mg OD + Paracetamol SOS'
    }
  });

  assert.equal(amended.version, 2);
  assert.equal(amended.currentVitals.bp, '130/85');
  assert.equal(amended.currentNotes.diagnosis, 'Mild Hypertension & Migraine');

  // Verify Audit Trail retains exact v1 historical data
  assert.equal(amended.auditTrail.length, 1);
  const auditV1 = amended.auditTrail[0];
  assert.equal(auditV1.version, 1);
  assert.equal(auditV1.reason, 'Updated diagnosis after lab test review');
  assert.equal(auditV1.previousVitals.bp, '120/80');
  assert.equal(auditV1.previousNotes.diagnosis, 'Tension Headache');
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================\n');
