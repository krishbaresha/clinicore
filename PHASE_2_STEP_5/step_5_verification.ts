import assert from 'node:assert';
import {
  ApprovalService,
  type ApprovalRequest,
  type BiometricSignature,
  type ApprovalDecisionPayload
} from './mobile_scaffold/src/services/approval.service.ts';
import {
  QueueMonitorService,
  type QueueItem
} from './mobile_scaffold/src/services/queue_monitor.service.ts';
import {
  PrescriptionCameraService,
  type PrescriptionFile
} from './mobile_scaffold/src/services/prescription_camera.service.ts';

console.log('--- STARTING PHASE 2 STEP 5 VERIFICATION SUITE ---');

// 1. Test Biometric Signature Validation & Approval Decision Creation
console.log('\n[1/4] Testing Doctor Biometric Signature Validation & Approval Payload...');
const approvalService = new ApprovalService();

const validSignature: BiometricSignature = {
  doctorId: 'DOC-KASHIF-01',
  biometricToken: 'BIO_TOKEN_SECRET_987654321_VALID',
  deviceHardwareId: 'HW-ANDROID-PIXEL-7',
  timestamp: new Date().toISOString()
};

const invalidSignature: BiometricSignature = {
  doctorId: '',
  biometricToken: 'short',
  deviceHardwareId: '',
  timestamp: 'invalid-date'
};

assert.strictEqual(
  approvalService.validateBiometricSignature(validSignature),
  true,
  'Valid signature should return true'
);
assert.strictEqual(
  approvalService.validateBiometricSignature(invalidSignature),
  false,
  'Invalid signature should return false'
);

// Test Approval Payload Creation for HIGH_DISCOUNT
const reqHighDiscount: ApprovalRequest = {
  requestId: 'REQ-DISC-101',
  type: 'HIGH_DISCOUNT',
  requestedBy: 'CASHIER-02',
  amount: 2500,
  reason: 'Needy patient requested 30% discount on OPD procedure',
  createdAt: new Date().toISOString()
};

const approvedPayload: ApprovalDecisionPayload = approvalService.processDecision(
  reqHighDiscount,
  validSignature,
  'APPROVED'
);

assert.strictEqual(approvedPayload.requestId, 'REQ-DISC-101');
assert.strictEqual(approvedPayload.type, 'HIGH_DISCOUNT');
assert.strictEqual(approvedPayload.status, 'APPROVED');
assert.strictEqual(approvedPayload.doctorId, 'DOC-KASHIF-01');
assert.ok(approvedPayload.signatureHash.startsWith('BIO-SIG-'), 'Signature hash must start with BIO-SIG-');
console.log('✓ Biometric signature validation & APPROVED decision creation verified successfully.');

// Test Approval Payload Creation for STOCK_WRITE_OFF (REJECTED)
const reqStockWriteOff: ApprovalRequest = {
  requestId: 'REQ-WRITE-202',
  type: 'STOCK_WRITE_OFF',
  requestedBy: 'STORE-MGR-01',
  amount: 8400,
  reason: 'Damaged packaging during transit',
  createdAt: new Date().toISOString()
};

const rejectedPayload: ApprovalDecisionPayload = approvalService.processDecision(
  reqStockWriteOff,
  validSignature,
  'REJECTED',
  'Insufficient damage proof attached'
);

assert.strictEqual(rejectedPayload.requestId, 'REQ-WRITE-202');
assert.strictEqual(rejectedPayload.type, 'STOCK_WRITE_OFF');
assert.strictEqual(rejectedPayload.status, 'REJECTED');
assert.strictEqual(rejectedPayload.decisionReason, 'Insufficient damage proof attached');
console.log('✓ REJECTED decision creation with reason verified successfully.');


// 2. Test OPD Chamber Queue Status Monitoring
console.log('\n[2/4] Testing Chamber Queue Status Monitoring...');
const queueService = new QueueMonitorService('DOC-KASHIF-01', 'Chamber 1 - ENT/General');

const sampleQueue: QueueItem[] = [
  {
    tokenId: 1,
    tokenNumber: 'TK-001',
    patientId: 'PT-1001',
    patientName: 'Muhammad Ali',
    age: 45,
    gender: 'M',
    status: 'IN_CONSULTATION',
    arrivalTime: new Date().toISOString()
  },
  {
    tokenId: 2,
    tokenNumber: 'TK-002',
    patientId: 'PT-1002',
    patientName: 'Fatima Bibi',
    age: 32,
    gender: 'F',
    status: 'WAITING',
    arrivalTime: new Date().toISOString()
  },
  {
    tokenId: 3,
    tokenNumber: 'TK-003',
    patientId: 'PT-1003',
    patientName: 'Ahmed Raza',
    age: 18,
    gender: 'M',
    status: 'WAITING',
    arrivalTime: new Date().toISOString()
  }
];

queueService.setQueue(sampleQueue);

let stats = queueService.getStats();
assert.strictEqual(stats.totalWaiting, 2, 'Waiting count should be 2');
assert.strictEqual(stats.currentToken, 'TK-001', 'Current token should be TK-001');

// Call next patient
const nextPatient = queueService.callNextPatient();
assert.ok(nextPatient, 'Next patient should be returned');
assert.strictEqual(nextPatient?.tokenNumber, 'TK-002');
assert.strictEqual(nextPatient?.status, 'IN_CONSULTATION');

stats = queueService.getStats();
assert.strictEqual(stats.totalWaiting, 1, 'Waiting count should now be 1');
assert.strictEqual(stats.totalCompleted, 1, 'Completed count should now be 1');
assert.strictEqual(stats.currentToken, 'TK-002', 'Current token should be updated to TK-002');
console.log('✓ Chamber queue status monitoring & transitions verified successfully.');


// 3. Test Prescription File Validation (MIME & Max Size)
console.log('\n[3/4] Testing Prescription Attachment File Validator & Upload Pipeline...');
const cameraService = new PrescriptionCameraService();

const validImageFile: PrescriptionFile = {
  fileName: 'prescription_scan_001.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2 * 1024 * 1024, // 2 MB
  buffer: Buffer.from('fake-jpeg-binary-data-stream-content')
};

const invalidMimeFile: PrescriptionFile = {
  fileName: 'prescription_script.exe',
  mimeType: 'application/x-msdownload',
  sizeBytes: 1 * 1024 * 1024,
  buffer: Buffer.from('fake-exe-binary')
};

const oversizedFile: PrescriptionFile = {
  fileName: 'heavy_scan.png',
  mimeType: 'image/png',
  sizeBytes: 15 * 1024 * 1024, // 15 MB > 10 MB limit
  buffer: Buffer.from('huge-buffer-data')
};

const validResult = cameraService.validateFile(validImageFile);
assert.strictEqual(validResult.valid, true, 'Valid JPEG file should pass validation');

const invalidMimeResult = cameraService.validateFile(invalidMimeFile);
assert.strictEqual(invalidMimeResult.valid, false, 'EXE mime type should fail validation');
assert.ok(invalidMimeResult.error?.includes('Unsupported MIME type'));

const oversizedResult = cameraService.validateFile(oversizedFile);
assert.strictEqual(oversizedResult.valid, false, 'Oversized file should fail validation');
assert.ok(oversizedResult.error?.includes('exceeds max limit'));

// Test Secure Upload Payload Generation
const uploadPayload = cameraService.prepareUploadPayload(
  validImageFile,
  'PT-1002',
  'DOC-KASHIF-01',
  'RX-2026-0899'
);

assert.strictEqual(uploadPayload.patientId, 'PT-1002');
assert.strictEqual(uploadPayload.doctorId, 'DOC-KASHIF-01');
assert.strictEqual(uploadPayload.fileName, 'prescription_scan_001.jpg');
assert.ok(uploadPayload.uploadId.startsWith('UPL-'));
assert.ok(uploadPayload.checksumSha256.startsWith('SHA256-'));
console.log('✓ Prescription file validation & upload payload generation verified successfully.');

console.log('\n[4/4] Finalizing Verification...');
console.log('🎉 ALL ASSERTIONS PASSED CLEANLY IN PHASE 2 STEP 5 VERIFICATION SUITE!');
