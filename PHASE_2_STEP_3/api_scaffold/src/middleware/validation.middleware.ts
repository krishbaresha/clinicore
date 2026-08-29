import type { HttpRequest } from '../types/api.types.ts';

export class ValidationMiddleware {
  /**
   * Validates POST /api/v1/auth/login request payload
   */
  public static validateLogin(req: HttpRequest): { valid: boolean; error?: string } {
    if (!req.body || typeof req.body !== 'object') {
      return { valid: false, error: 'Request body must be a JSON object' };
    }
    const username = req.body.username || req.body.email;
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return { valid: false, error: 'Field "username" or "email" is required' };
    }
    if (!req.body.password || typeof req.body.password !== 'string' || req.body.password === '') {
      return { valid: false, error: 'Field "password" is required' };
    }
    return { valid: true };
  }

  /**
   * Validates GET /api/v1/sync/pull request query params
   */
  public static validateSyncPull(req: HttpRequest): { valid: boolean; cursor: number; error?: string } {
    const rawCursor = req.query?.cursor;
    if (rawCursor !== undefined && rawCursor !== null) {
      const parsed = Number(rawCursor);
      if (isNaN(parsed) || parsed < 0) {
        return { valid: false, cursor: 0, error: 'Query parameter "cursor" must be a non-negative integer' };
      }
      return { valid: true, cursor: Math.floor(parsed) };
    }
    return { valid: true, cursor: 0 };
  }

  /**
   * Validates POST /api/v1/sync/push request payload
   */
  public static validateSyncPush(req: HttpRequest): { valid: boolean; error?: string } {
    if (!req.body || typeof req.body !== 'object') {
      return { valid: false, error: 'Request body must be a JSON object' };
    }
    if (!Array.isArray(req.body.mutations)) {
      return { valid: false, error: 'Field "mutations" must be an array' };
    }
    for (const [idx, mut] of req.body.mutations.entries()) {
      if (!mut || typeof mut !== 'object') {
        return { valid: false, error: `Mutation at index ${idx} is invalid` };
      }
      if (!mut.mutation_id || typeof mut.mutation_id !== 'string') {
        return { valid: false, error: `Mutation at index ${idx} missing "mutation_id"` };
      }
      if (!mut.idempotency_key || typeof mut.idempotency_key !== 'string') {
        return { valid: false, error: `Mutation at index ${idx} missing "idempotency_key"` };
      }
      if (!mut.entity_type || typeof mut.entity_type !== 'string') {
        return { valid: false, error: `Mutation at index ${idx} missing "entity_type"` };
      }
      if (!['INSERT', 'UPDATE', 'DELETE'].includes(mut.action)) {
        return { valid: false, error: `Mutation at index ${idx} has invalid "action"` };
      }
    }
    return { valid: true };
  }

  /**
   * Validates POST /api/v1/approvals/request payload
   */
  public static validateApprovalRequest(req: HttpRequest): { valid: boolean; error?: string } {
    if (!req.body || typeof req.body !== 'object') {
      return { valid: false, error: 'Request body must be a JSON object' };
    }
    if (!req.body.action_type || typeof req.body.action_type !== 'string') {
      return { valid: false, error: 'Field "action_type" is required' };
    }
    if (!req.body.target_entity || typeof req.body.target_entity !== 'string') {
      return { valid: false, error: 'Field "target_entity" is required' };
    }
    if (!req.body.entity_id || typeof req.body.entity_id !== 'string') {
      return { valid: false, error: 'Field "entity_id" is required' };
    }
    if (!req.body.reason || typeof req.body.reason !== 'string') {
      return { valid: false, error: 'Field "reason" is required' };
    }
    return { valid: true };
  }
}
