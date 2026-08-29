export interface PatientRegistrationDTO {
  fullName: string;
  phone: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  age?: number;
  dob?: string;
  cnic?: string;
  address?: string;
  city?: string;
  bloodGroup?: string;
  emergencyContact?: string;
}

export interface PatientRecord extends PatientRegistrationDTO {
  mrId: string;
  normalizedPhone: string;
  normalizedCnic?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  confidenceScore: number; // 0 to 100
  matchedField?: 'CNIC' | 'PHONE_AND_NAME' | 'MR_ID';
  existingPatient?: PatientRecord;
  reason?: string;
}

export class PatientService {
  private patients: Map<string, PatientRecord> = new Map(); // mrId -> PatientRecord
  private sequenceCounter: number = 0;

  constructor(initialPatients: PatientRecord[] = []) {
    for (const patient of initialPatients) {
      this.patients.set(patient.mrId, patient);
      const numericPart = parseInt(patient.mrId.replace(/^MR-/, ''), 10);
      if (!isNaN(numericPart) && numericPart > this.sequenceCounter) {
        this.sequenceCounter = numericPart;
      }
    }
  }

  /**
   * Generates next sequential MR ID in format MR-00001, MR-00002, etc.
   */
  public generateNextMrId(): string {
    this.sequenceCounter += 1;
    const padded = String(this.sequenceCounter).padStart(5, '0');
    return `MR-${padded}`;
  }

  /**
   * Normalizes Pakistani phone numbers to standard +923XXXXXXXXX format.
   * Handles inputs like: '03001234567', '923001234567', '+923001234567', '3001234567', '0300-1234567'
   */
  public static normalizePhone(phone: string): string {
    if (!phone) return '';
    // Strip non-digit characters except leading +
    const digitsOnly = phone.replace(/[^0-9]/g, '');

    if (digitsOnly.startsWith('923') && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.startsWith('03') && digitsOnly.length === 11) {
      return `+92${digitsOnly.slice(1)}`;
    }
    if (digitsOnly.startsWith('3') && digitsOnly.length === 10) {
      return `+92${digitsOnly}`;
    }
    if (digitsOnly.length === 12 && digitsOnly.startsWith('92')) {
      return `+${digitsOnly}`;
    }

    // Return + prefixed if valid 12 digits starting with 923
    if (digitsOnly.length >= 10) {
      return `+923${digitsOnly.slice(-9)}`;
    }

    return phone.trim();
  }

  /**
   * Normalizes CNIC to standard XXXXX-XXXXXXX-X format or clean 13 digits.
   */
  public static normalizeCnic(cnic?: string): string | undefined {
    if (!cnic) return undefined;
    const digits = cnic.replace(/[^0-9]/g, '');
    if (digits.length === 13) {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
    }
    return cnic.trim();
  }

  /**
   * Detects duplicate patients prior to registration.
   */
  public detectDuplicates(dto: Partial<PatientRegistrationDTO> & { mrId?: string }): DuplicateDetectionResult {
    const normalizedPhone = dto.phone ? PatientService.normalizePhone(dto.phone) : '';
    const normalizedCnic = dto.cnic ? PatientService.normalizeCnic(dto.cnic) : undefined;
    const normalizedName = dto.fullName ? dto.fullName.trim().toLowerCase() : '';

    // 1. Check exact MR ID if provided
    if (dto.mrId && this.patients.has(dto.mrId)) {
      const existing = this.patients.get(dto.mrId)!;
      return {
        isDuplicate: true,
        confidenceScore: 100,
        matchedField: 'MR_ID',
        existingPatient: existing,
        reason: `Patient with MR ID ${dto.mrId} already exists.`
      };
    }

    for (const patient of this.patients.values()) {
      // 2. Check exact CNIC match
      if (normalizedCnic && patient.normalizedCnic && patient.normalizedCnic === normalizedCnic) {
        return {
          isDuplicate: true,
          confidenceScore: 95,
          matchedField: 'CNIC',
          existingPatient: patient,
          reason: `Patient with CNIC ${normalizedCnic} already exists (${patient.fullName}, ${patient.mrId}).`
        };
      }

      // 3. Check Phone + Name match
      if (
        normalizedPhone &&
        patient.normalizedPhone === normalizedPhone &&
        patient.fullName.trim().toLowerCase() === normalizedName
      ) {
        return {
          isDuplicate: true,
          confidenceScore: 90,
          matchedField: 'PHONE_AND_NAME',
          existingPatient: patient,
          reason: `Patient with Phone ${normalizedPhone} and Name '${patient.fullName}' already exists (${patient.mrId}).`
        };
      }
    }

    return {
      isDuplicate: false,
      confidenceScore: 0
    };
  }

  /**
   * Registers a new patient with auto-generated MR ID and validation.
   */
  public registerPatient(dto: PatientRegistrationDTO, options: { allowDuplicate?: boolean } = {}): PatientRecord {
    if (!dto.fullName || dto.fullName.trim().length < 2) {
      throw new Error('Patient full name must be at least 2 characters long.');
    }
    if (!dto.phone) {
      throw new Error('Patient phone number is required.');
    }

    const dupResult = this.detectDuplicates(dto);
    if (dupResult.isDuplicate && !options.allowDuplicate) {
      throw new Error(`Duplicate Patient Detected: ${dupResult.reason}`);
    }

    const mrId = this.generateNextMrId();
    const now = new Date().toISOString();
    const normalizedPhone = PatientService.normalizePhone(dto.phone);
    const normalizedCnic = PatientService.normalizeCnic(dto.cnic);

    const record: PatientRecord = {
      ...dto,
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      mrId,
      normalizedPhone,
      normalizedCnic,
      createdAt: now,
      updatedAt: now
    };

    this.patients.set(mrId, record);
    return record;
  }

  /**
   * Multi-identifier patient search matching MR ID, Phone, Name, or CNIC.
   */
  public searchPatients(query: string): PatientRecord[] {
    if (!query || query.trim() === '') {
      return Array.from(this.patients.values());
    }

    const q = query.trim().toLowerCase();
    const qPhone = PatientService.normalizePhone(query);
    const qCnicDigits = query.replace(/[^0-9]/g, '');

    const results: PatientRecord[] = [];

    for (const patient of this.patients.values()) {
      // MR ID match
      if (patient.mrId.toLowerCase().includes(q)) {
        results.push(patient);
        continue;
      }

      // CNIC match
      if (patient.normalizedCnic && patient.normalizedCnic.replace(/[^0-9]/g, '').includes(qCnicDigits) && qCnicDigits.length >= 4) {
        results.push(patient);
        continue;
      }

      // Phone match
      if (patient.normalizedPhone.includes(qPhone) || patient.phone.includes(q)) {
        results.push(patient);
        continue;
      }

      // Name match
      if (patient.fullName.toLowerCase().includes(q)) {
        results.push(patient);
        continue;
      }
    }

    return results;
  }

  public getPatientByMrId(mrId: string): PatientRecord | undefined {
    return this.patients.get(mrId);
  }

  public getAllPatients(): PatientRecord[] {
    return Array.from(this.patients.values());
  }

  public getCounter(): number {
    return this.sequenceCounter;
  }
}
