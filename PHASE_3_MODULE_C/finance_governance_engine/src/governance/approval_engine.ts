/**
 * ClinicFlow Doctor Governance & Action Approval Engine
 * Enforces sensitive operational threshold policies (e.g. discounts > 15%, write-offs > 10 units),
 * state transitions (PENDING -> APPROVED / REJECTED), and duplicate execution lock safety.
 */

export type ActionType = 'BILL_DISCOUNT' | 'STOCK_WRITE_OFF' | 'CREDIT_LIMIT_OVERRIDE' | 'PRICE_OVERRIDE';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ActionPayload {
  action_type: ActionType;
  entity_id: string; // e.g. bill_id, stock_writeoff_id, party_code
  discount_percentage?: number;
  write_off_units?: number;
  override_amount?: number;
  requested_by_user_id: string;
  reason: string;
}

export interface GovernancePolicy {
  max_unapproved_discount_percent: number; // e.g. 15%
  max_unapproved_writeoff_units: number; // e.g. 10 units
}

export interface ApprovalRequest {
  id: string;
  action_type: ActionType;
  entity_id: string;
  payload: ActionPayload;
  status: ApprovalStatus;
  requires_governance: boolean;
  threshold_reason?: string;
  requested_by: string;
  reviewed_by?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
  is_executed: boolean;
  executed_at?: string;
}

export class ApprovalEngine {
  private requests: Map<string, ApprovalRequest> = new Map();
  private executionLocks: Set<string> = new Set(); // Stores entity_id or request_id to prevent duplicate executions
  private policy: GovernancePolicy;

  constructor(customPolicy?: Partial<GovernancePolicy>) {
    this.policy = {
      max_unapproved_discount_percent: 15,
      max_unapproved_writeoff_units: 10,
      ...customPolicy,
    };
  }

  /**
   * Evaluates if a proposed action breaches governance policy thresholds
   */
  public evaluateThreshold(payload: ActionPayload): { requires_governance: boolean; reason?: string } {
    if (payload.action_type === 'BILL_DISCOUNT') {
      const discount = payload.discount_percentage || 0;
      if (discount > this.policy.max_unapproved_discount_percent) {
        return {
          requires_governance: true,
          reason: `Discount rate of ${discount}% exceeds doctor approval threshold of ${this.policy.max_unapproved_discount_percent}%`,
        };
      }
    }

    if (payload.action_type === 'STOCK_WRITE_OFF') {
      const units = payload.write_off_units || 0;
      if (units > this.policy.max_unapproved_writeoff_units) {
        return {
          requires_governance: true,
          reason: `Stock write-off of ${units} units exceeds maximum threshold of ${this.policy.max_unapproved_writeoff_units} units`,
        };
      }
    }

    if (payload.action_type === 'CREDIT_LIMIT_OVERRIDE' || payload.action_type === 'PRICE_OVERRIDE') {
      return {
        requires_governance: true,
        reason: `Action '${payload.action_type}' requires mandatory Doctor/Admin governance clearance`,
      };
    }

    return { requires_governance: false };
  }

  /**
   * Submits a new governance request or auto-approves if within policy thresholds
   */
  public submitRequest(requestId: string, payload: ActionPayload): ApprovalRequest {
    if (this.requests.has(requestId)) {
      throw new Error(`[GOVERNANCE_ERROR] Request ID '${requestId}' already submitted`);
    }

    const { requires_governance, reason } = this.evaluateThreshold(payload);

    const now = new Date().toISOString();
    const request: ApprovalRequest = {
      id: requestId,
      action_type: payload.action_type,
      entity_id: payload.entity_id,
      payload,
      status: requires_governance ? 'PENDING' : 'APPROVED',
      requires_governance,
      threshold_reason: reason,
      requested_by: payload.requested_by_user_id,
      reviewed_by: requires_governance ? undefined : 'SYSTEM_AUTO_POLICY',
      review_notes: requires_governance ? undefined : 'Within normal operational thresholds',
      created_at: now,
      updated_at: now,
      is_executed: false,
    };

    this.requests.set(requestId, request);
    return request;
  }

  /**
   * Approves a pending request (Doctor / Admin governance action)
   */
  public approveRequest(requestId: string, reviewerUserId: string, notes: string = 'Approved by Doctor'): ApprovalRequest {
    const req = this.requests.get(requestId);
    if (!req) {
      throw new Error(`[GOVERNANCE_ERROR] Request ID '${requestId}' not found`);
    }

    if (req.status !== 'PENDING') {
      throw new Error(`[GOVERNANCE_ERROR] Cannot approve request in state '${req.status}'. Must be 'PENDING'`);
    }

    const now = new Date().toISOString();
    req.status = 'APPROVED';
    req.reviewed_by = reviewerUserId;
    req.review_notes = notes;
    req.updated_at = now;

    return req;
  }

  /**
   * Rejects a pending request
   */
  public rejectRequest(requestId: string, reviewerUserId: string, notes: string = 'Rejected by Doctor'): ApprovalRequest {
    const req = this.requests.get(requestId);
    if (!req) {
      throw new Error(`[GOVERNANCE_ERROR] Request ID '${requestId}' not found`);
    }

    if (req.status !== 'PENDING') {
      throw new Error(`[GOVERNANCE_ERROR] Cannot reject request in state '${req.status}'. Must be 'PENDING'`);
    }

    const now = new Date().toISOString();
    req.status = 'REJECTED';
    req.reviewed_by = reviewerUserId;
    req.review_notes = notes;
    req.updated_at = now;

    return req;
  }

  /**
   * Executes an approved action, protected by a duplicate execution lock
   */
  public executeApprovedAction(requestId: string, executionCallback: (req: ApprovalRequest) => void): ApprovalRequest {
    const req = this.requests.get(requestId);
    if (!req) {
      throw new Error(`[GOVERNANCE_ERROR] Request ID '${requestId}' not found`);
    }

    if (req.status !== 'APPROVED') {
      throw new Error(`[GOVERNANCE_ERROR] Cannot execute request with status '${req.status}'. Required status: 'APPROVED'`);
    }

    // Duplicate execution lock guard
    const lockKey = `EXEC_LOCK:${requestId}`;
    if (this.executionLocks.has(lockKey) || req.is_executed) {
      throw new Error(`[GOVERNANCE_DUPLICATE_LOCK] Request ID '${requestId}' has already been executed! Double execution blocked.`);
    }

    // Acquire lock
    this.executionLocks.add(lockKey);

    try {
      executionCallback(req);
      req.is_executed = true;
      req.executed_at = new Date().toISOString();
      return req;
    } catch (err: any) {
      // Release lock on failure
      this.executionLocks.delete(lockKey);
      throw err;
    }
  }

  /**
   * Retrieves request by ID
   */
  public getRequest(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }
}
