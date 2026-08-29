export type ApprovalType = 'HIGH_DISCOUNT' | 'STOCK_WRITE_OFF' | 'REVERSAL';
export type DecisionStatus = 'APPROVED' | 'REJECTED';

export interface ApprovalRequest {
  requestId: string;
  type: ApprovalType;
  requestedBy: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface BiometricSignature {
  doctorId: string;
  biometricToken: string;
  deviceHardwareId: string;
  timestamp: string;
}

export interface ApprovalDecisionPayload {
  requestId: string;
  type: ApprovalType;
  status: DecisionStatus;
  doctorId: string;
  decisionReason?: string;
  signatureHash: string;
  processedAt: string;
}

export class ApprovalService {
  /**
   * Validates doctor biometric sign-off signature details.
   */
  public validateBiometricSignature(signature: BiometricSignature): boolean {
    if (!signature.doctorId || signature.doctorId.trim() === '') {
      return false;
    }
    if (!signature.biometricToken || signature.biometricToken.length < 16) {
      return false;
    }
    if (!signature.deviceHardwareId || signature.deviceHardwareId.trim() === '') {
      return false;
    }
    const timestampMs = new Date(signature.timestamp).getTime();
    if (isNaN(timestampMs)) {
      return false;
    }
    return true;
  }

  /**
   * Generates a deterministic signature hash from biometric and request details.
   */
  public generateSignatureHash(signature: BiometricSignature, requestId: string): string {
    const raw = `${signature.doctorId}:${signature.biometricToken}:${signature.deviceHardwareId}:${requestId}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `BIO-SIG-${Math.abs(hash).toString(16).toUpperCase()}-${signature.doctorId}`;
  }

  /**
   * Process approval decision and generate authoritative decision payload.
   */
  public processDecision(
    request: ApprovalRequest,
    signature: BiometricSignature,
    status: DecisionStatus,
    decisionReason?: string
  ): ApprovalDecisionPayload {
    if (!this.validateBiometricSignature(signature)) {
      throw new Error('Invalid doctor biometric signature');
    }

    if (status === 'REJECTED' && (!decisionReason || decisionReason.trim() === '')) {
      throw new Error('Rejection reason is required');
    }

    const signatureHash = this.generateSignatureHash(signature, request.requestId);

    return {
      requestId: request.requestId,
      type: request.type,
      status,
      doctorId: signature.doctorId,
      decisionReason: decisionReason || 'Approved via Doctor Biometric Sign-off',
      signatureHash,
      processedAt: new Date().toISOString()
    };
  }
}
