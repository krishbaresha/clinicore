import type { HttpRequest, HttpResponse } from '../types/api.types.ts';
import { AuthMiddleware } from '../middleware/auth.middleware.ts';
import { ValidationMiddleware } from '../middleware/validation.middleware.ts';
import { SyncCursorStore } from '../cursor/sync_cursor.ts';
import { MutationGateway } from '../gateway/mutation_gateway.ts';

export class SyncRoute {
  /**
   * GET /api/v1/sync/pull?cursor=N
   */
  public static async handlePull(
    req: HttpRequest,
    cursorStore: SyncCursorStore
  ): Promise<HttpResponse> {
    // Auth Token Check
    const authCheck = AuthMiddleware.verifyToken(req.headers['authorization'] || req.headers['Authorization']);
    if (!authCheck.valid) {
      return { status: 401, body: { success: false, error: authCheck.error } };
    }

    // Validation Check
    const validation = ValidationMiddleware.validateSyncPull(req);
    if (!validation.valid) {
      return { status: 400, body: { success: false, error: validation.error } };
    }

    const { changes, current_cursor, has_more } = cursorStore.getChangesSince(validation.cursor);

    return {
      status: 200,
      body: {
        success: true,
        changes,
        current_cursor,
        has_more,
      },
    };
  }

  /**
   * POST /api/v1/sync/push
   */
  public static async handlePush(
    req: HttpRequest,
    cursorStore: SyncCursorStore,
    mutationGateway: MutationGateway
  ): Promise<HttpResponse> {
    // Auth Token Check
    const authCheck = AuthMiddleware.verifyToken(req.headers['authorization'] || req.headers['Authorization']);
    if (!authCheck.valid) {
      return { status: 401, body: { success: false, error: authCheck.error } };
    }

    // Validation Check
    const validation = ValidationMiddleware.validateSyncPush(req);
    if (!validation.valid) {
      return { status: 400, body: { success: false, error: validation.error } };
    }

    const result = mutationGateway.processBatch(req.body.mutations, cursorStore);

    return {
      status: 200,
      body: {
        success: true,
        processed_count: result.processed_count,
        results: result.results,
        current_cursor: result.current_cursor,
      },
    };
  }
}
