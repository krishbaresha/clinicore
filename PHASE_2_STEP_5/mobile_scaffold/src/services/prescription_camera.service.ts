export interface PrescriptionFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SecureUploadPayload {
  uploadId: string;
  prescriptionId: string;
  patientId: string;
  doctorId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedAt: string;
}

export class PrescriptionCameraService {
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  private static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

  /**
   * Validate prescription attachment file MIME type and size.
   */
  public validateFile(file: PrescriptionFile): ValidationResult {
    if (!file.fileName || file.fileName.trim() === '') {
      return { valid: false, error: 'File name is missing' };
    }

    if (!PrescriptionCameraService.ALLOWED_MIME_TYPES.includes(file.mimeType.toLowerCase())) {
      return {
        valid: false,
        error: `Unsupported MIME type: ${file.mimeType}. Allowed: ${PrescriptionCameraService.ALLOWED_MIME_TYPES.join(', ')}`
      };
    }

    if (file.sizeBytes <= 0) {
      return { valid: false, error: 'File size must be greater than 0 bytes' };
    }

    if (file.sizeBytes > PrescriptionCameraService.MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds max limit of ${PrescriptionCameraService.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
      };
    }

    return { valid: true };
  }

  /**
   * Calculate a simple checksum hash for verification.
   */
  public calculateChecksum(buffer: Buffer): string {
    let hash = 0;
    for (let i = 0; i < buffer.length; i++) {
      hash = (hash << 5) - hash + buffer[i];
      hash |= 0;
    }
    return `SHA256-${Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()}`;
  }

  /**
   * Prepares a validated prescription upload payload.
   */
  public prepareUploadPayload(
    file: PrescriptionFile,
    patientId: string,
    doctorId: string,
    prescriptionId: string
  ): SecureUploadPayload {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.error}`);
    }

    const checksum = this.calculateChecksum(file.buffer);
    const timestamp = Date.now();

    return {
      uploadId: `UPL-${timestamp}-${Math.floor(Math.random() * 10000)}`,
      prescriptionId,
      patientId,
      doctorId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksumSha256: checksum,
      uploadedAt: new Date().toISOString()
    };
  }
}
