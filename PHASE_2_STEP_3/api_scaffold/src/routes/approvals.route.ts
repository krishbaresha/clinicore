import type { HttpRequest, HttpResponse } from '../types/api.types.ts';
import { AuthMiddleware } from '../middleware/auth.middleware.ts';
import { ValidationMiddleware } from '../middleware/validation.middleware.ts';
import { SyncCursorStore } from '../cursor/sync_cursor.ts';

export class ApprovalsRoute {
  private static approvalCounter = 1;

  /**
   * POST /api/v1/approvals/request
   */
  public static async handleRequest(
    req: HttpRequest,
    cursorStore: SyncCursorStore
  ): Promise<HttpResponse> {
    // Auth Token Check
    const authCheck = AuthMiddleware.verifyToken(req.headers['authorization'] || req.headers['Authorization']);
    if (!authCheck.valid) {
      return { status: 401, body: { success: false, error: authCheck.error } };
    }

    // Validation Check
    const validation = ValidationMiddleware.validateApprovalRequest(req);
    if (!validation.valid) {
      return { status: 400, body: { success: false, error: validation.error } };
    }

    const approvalId = `appr_${String(this.approvalCounter++).padStart(4, '0')}`;
    const approvalPayload = {
      approval_id: approvalId,
      requester_id: authCheck.payload?.user_id,
      action_type: req.body.action_type,
      target_entity: req.body.target_entity,
      entity_id: req.body.entity_id,
      reason: req.body.reason,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    // Also register an event in the SyncCursorStore so sync clients receive approval events
    cursorStore.appendChange('approval_request', approvalId, 'INSERT', approvalPayload);

    return {
      status: 200,
      body: {
        success: true,
        approval_id: approvalId,
        status: 'PENDING',
        request: approvalPayload,
      },
    };
  }
}
