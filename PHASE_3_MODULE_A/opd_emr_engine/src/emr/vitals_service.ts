export interface BloodPressure {
  systolic: number;
  diastolic: number;
  rawInput: string;
}

export interface VitalsInput {
  bp?: string; // e.g. "120/80"
  pulse?: number; // bpm
  temperature?: number; // °F
  spO2?: number; // %
  weight?: number; // kg
  bloodSugar?: number; // mg/dL
}

export type AlertSeverity = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL';

export interface VitalAnalysis {
  parameter: string;
  value: string | number;
  severity: AlertSeverity;
  message: string;
}

export interface ClinicalNotes {
  chiefComplaint: string;
  hpi?: string; // History of Present Illness
  examinationNotes?: string;
  diagnosis: string;
  treatmentPlan: string;
  prescriptionNotes?: string;
}

export interface AuditRecord {
  version: number;
  amendedAt: string;
  amendedBy: string; // Doctor or Staff ID
  reason: string;
  previousVitals: VitalsInput;
  previousNotes: ClinicalNotes;
}

export interface EmrConsultationRecord {
  emrId: string;
  mrId: string;
  tokenId: string;
  doctorId: string;
  currentVitals: VitalsInput;
  currentNotes: ClinicalNotes;
  analyses: VitalAnalysis[];
  version: number;
  createdAt: string;
  updatedAt: string;
  auditTrail: AuditRecord[];
}

export class VitalsService {
  private emrRecords: Map<string, EmrConsultationRecord> = new Map(); // emrId -> Record

  /**
   * Validates Blood Pressure string format (e.g. "120/80") and physiological bounds.
   * Rejects invalid BP values such as "300/200", "50/30", non-numeric strings, or diastolic >= systolic.
   */
  public static validateBloodPressure(bpStr: string): BloodPressure {
    if (!bpStr || typeof bpStr !== 'string') {
      throw new Error('Blood Pressure input must be a non-empty string in format "systolic/diastolic" (e.g. "120/80").');
    }

    const parts = bpStr.trim().split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid BP format "${bpStr}". Expected format "systolic/diastolic" (e.g. "120/80").`);
    }

    const systolic = Number(parts[0]);
    const diastolic = Number(parts[1]);

    if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
      throw new Error(`Invalid numeric values in BP input "${bpStr}".`);
    }

    // Physiological bounds validation
    if (systolic < 60 || systolic > 250) {
      throw new Error(`Systolic BP (${systolic} mmHg) is out of valid clinical range [60 - 250 mmHg]. Rejected value.`);
    }

    if (diastolic < 40 || diastolic > 150) {
      throw new Error(`Diastolic BP (${diastolic} mmHg) is out of valid clinical range [40 - 150 mmHg]. Rejected value.`);
    }

    if (diastolic >= systolic) {
      throw new Error(`Invalid BP (${bpStr}): Diastolic BP (${diastolic}) must be strictly less than Systolic BP (${systolic}).`);
    }

    return { systolic, diastolic, rawInput: bpStr.trim() };
  }

  /**
   * Validates clinical vitals inputs against physiological thresholds.
   */
  public validateVitals(vitals: VitalsInput): VitalAnalysis[] {
    const analyses: VitalAnalysis[] = [];

    // BP Validation & Analysis
    if (vitals.bp) {
      const parsedBp = VitalsService.validateBloodPressure(vitals.bp);
      if (parsedBp.systolic >= 180 || parsedBp.diastolic >= 120) {
        analyses.push({
          parameter: 'Blood Pressure',
          value: vitals.bp,
          severity: 'CRITICAL',
          message: 'Hypertensive Crisis! Immediate clinical intervention required.'
        });
      } else if (parsedBp.systolic >= 140 || parsedBp.diastolic >= 90) {
        analyses.push({
          parameter: 'Blood Pressure',
          value: vitals.bp,
          severity: 'HIGH',
          message: 'Stage 2 Hypertension detected.'
        });
      } else if (parsedBp.systolic >= 130 || parsedBp.diastolic >= 80) {
        analyses.push({
          parameter: 'Blood Pressure',
          value: vitals.bp,
          severity: 'HIGH',
          message: 'Stage 1 Hypertension detected.'
        });
      } else if (parsedBp.systolic < 90 || parsedBp.diastolic < 60) {
        analyses.push({
          parameter: 'Blood Pressure',
          value: vitals.bp,
          severity: 'LOW',
          message: 'Hypotension detected.'
        });
      } else {
        analyses.push({
          parameter: 'Blood Pressure',
          value: vitals.bp,
          severity: 'NORMAL',
          message: 'Blood Pressure within normal physiological limits.'
        });
      }
    }

    // Pulse Validation (bpm)
    if (vitals.pulse !== undefined) {
      if (vitals.pulse < 30 || vitals.pulse > 220) {
        throw new Error(`Pulse rate (${vitals.pulse} bpm) is out of valid clinical range [30 - 220 bpm].`);
      }
      if (vitals.pulse < 50) {
        analyses.push({
          parameter: 'Pulse',
          value: vitals.pulse,
          severity: 'LOW',
          message: 'Bradycardia detected.'
        });
      } else if (vitals.pulse > 100) {
        analyses.push({
          parameter: 'Pulse',
          value: vitals.pulse,
          severity: 'HIGH',
          message: 'Tachycardia detected.'
        });
      } else {
        analyses.push({
          parameter: 'Pulse',
          value: vitals.pulse,
          severity: 'NORMAL',
          message: 'Pulse rate within normal range.'
        });
      }
    }

    // Temperature (°F)
    if (vitals.temperature !== undefined) {
      if (vitals.temperature < 90.0 || vitals.temperature > 108.0) {
        throw new Error(`Temperature (${vitals.temperature} °F) is out of valid clinical range [90.0 - 108.0 °F].`);
      }
      if (vitals.temperature >= 103.0) {
        analyses.push({
          parameter: 'Temperature',
          value: vitals.temperature,
          severity: 'CRITICAL',
          message: 'High fever (Hyperpyrexia) detected.'
        });
      } else if (vitals.temperature >= 99.5) {
        analyses.push({
          parameter: 'Temperature',
          value: vitals.temperature,
          severity: 'HIGH',
          message: 'Low-grade fever detected.'
        });
      } else if (vitals.temperature < 95.0) {
        analyses.push({
          parameter: 'Temperature',
          value: vitals.temperature,
          severity: 'LOW',
          message: 'Hypothermia detected.'
        });
      } else {
        analyses.push({
          parameter: 'Temperature',
          value: vitals.temperature,
          severity: 'NORMAL',
          message: 'Body temperature normal.'
        });
      }
    }

    // SpO2 (%)
    if (vitals.spO2 !== undefined) {
      if (vitals.spO2 < 50 || vitals.spO2 > 100) {
        throw new Error(`SpO2 (${vitals.spO2}%) is out of valid clinical range [50 - 100%].`);
      }
      if (vitals.spO2 < 90) {
        analyses.push({
          parameter: 'SpO2',
          value: vitals.spO2,
          severity: 'CRITICAL',
          message: 'Severe Hypoxia detected! Oxygen therapy recommended.'
        });
      } else if (vitals.spO2 < 95) {
        analyses.push({
          parameter: 'SpO2',
          value: vitals.spO2,
          severity: 'LOW',
          message: 'Mild Hypoxia detected.'
        });
      } else {
        analyses.push({
          parameter: 'SpO2',
          value: vitals.spO2,
          severity: 'NORMAL',
          message: 'Oxygen saturation normal.'
        });
      }
    }

    // Blood Sugar (mg/dL)
    if (vitals.bloodSugar !== undefined) {
      if (vitals.bloodSugar < 20 || vitals.bloodSugar > 800) {
        throw new Error(`Blood Sugar (${vitals.bloodSugar} mg/dL) is out of valid clinical range [20 - 800 mg/dL].`);
      }
      if (vitals.bloodSugar < 70) {
        analyses.push({
          parameter: 'Blood Sugar',
          value: vitals.bloodSugar,
          severity: 'LOW',
          message: 'Hypoglycemia alert.'
        });
      } else if (vitals.bloodSugar > 200) {
        analyses.push({
          parameter: 'Blood Sugar',
          value: vitals.bloodSugar,
          severity: 'HIGH',
          message: 'Hyperglycemia alert.'
        });
      } else {
        analyses.push({
          parameter: 'Blood Sugar',
          value: vitals.bloodSugar,
          severity: 'NORMAL',
          message: 'Blood sugar normal.'
        });
      }
    }

    return analyses;
  }

  /**
   * Creates a new EMR Consultation Record.
   */
  public createEmrRecord(params: {
    mrId: string;
    tokenId: string;
    doctorId: string;
    vitals: VitalsInput;
    notes: ClinicalNotes;
  }): EmrConsultationRecord {
    const analyses = this.validateVitals(params.vitals);
    const emrId = `EMR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const record: EmrConsultationRecord = {
      emrId,
      mrId: params.mrId,
      tokenId: params.tokenId,
      doctorId: params.doctorId,
      currentVitals: { ...params.vitals },
      currentNotes: { ...params.notes },
      analyses,
      version: 1,
      createdAt: now,
      updatedAt: now,
      auditTrail: []
    };

    this.emrRecords.set(emrId, record);
    return record;
  }

  /**
   * Non-destructive amendment of an existing EMR record with complete audit preservation.
   */
  public amendEmrRecord(params: {
    emrId: string;
    amendedBy: string;
    reason: string;
    newVitals?: VitalsInput;
    newNotes?: Partial<ClinicalNotes>;
  }): EmrConsultationRecord {
    const record = this.emrRecords.get(params.emrId);
    if (!record) {
      throw new Error(`EMR Record ${params.emrId} not found.`);
    }

    if (!params.reason || params.reason.trim().length < 3) {
      throw new Error('Amendment reason must be provided (minimum 3 characters).');
    }

    // Preserve previous state in immutable audit trail
    const auditEntry: AuditRecord = {
      version: record.version,
      amendedAt: new Date().toISOString(),
      amendedBy: params.amendedBy,
      reason: params.reason.trim(),
      previousVitals: JSON.parse(JSON.stringify(record.currentVitals)),
      previousNotes: JSON.parse(JSON.stringify(record.currentNotes))
    };

    // Update vitals if provided
    if (params.newVitals) {
      const mergedVitals = { ...record.currentVitals, ...params.newVitals };
      record.analyses = this.validateVitals(mergedVitals);
      record.currentVitals = mergedVitals;
    }

    // Update notes if provided
    if (params.newNotes) {
      record.currentNotes = { ...record.currentNotes, ...params.newNotes };
    }

    record.version += 1;
    record.updatedAt = new Date().toISOString();
    record.auditTrail.push(auditEntry);

    return record;
  }

  public getEmrRecord(emrId: string): EmrConsultationRecord | undefined {
    return this.emrRecords.get(emrId);
  }
}
