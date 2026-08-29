import type { MutationRequest, MutationResult } from '../types/api.types.ts';
import { SyncCursorStore } from '../cursor/sync_cursor.ts';

export class MutationGateway {
  private idempotencyCache: Map<string, MutationResult> = new Map();

  /**
   * Processes a batch of client outbox mutations with strict idempotency checks
   */
  public processBatch(
    mutations: MutationRequest[],
    cursorStore: SyncCursorStore
  ): { processed_count: number; results: MutationResult[]; current_cursor: number } {
    const results: MutationResult[] = [];

    for (const mut of mutations) {
      if (this.idempotencyCache.has(mut.idempotency_key)) {
        const cached = this.idempotencyCache.get(mut.idempotency_key)!;
        results.push({
          ...cached,
          status: 'DUPLICATE',
        });
        continue;
      }

      // Apply new mutation and append to monotonic sync cursor log
      const change = cursorStore.appendChange(
        mut.entity_type,
        mut.payload?.id || mut.mutation_id,
        mut.action,
        mut.payload
      );

      const result: MutationResult = {
        mutation_id: mut.mutation_id,
        idempotency_key: mut.idempotency_key,
        status: 'SUCCESS',
        cursor: change.cursor,
        cachedResponse: {
          success: true,
          mutation_id: mut.mutation_id,
          entity_type: mut.entity_type,
          cursor: change.cursor,
        },
      };

      // Store in idempotency cache
      this.idempotencyCache.set(mut.idempotency_key, result);
      results.push(result);
    }

    return {
      processed_count: results.length,
      results,
      current_cursor: cursorStore.getLatestCursor(),
    };
  }

  /**
   * Clears cached idempotency keys (useful for test setup)
   */
  public clear(): void {
    this.idempotencyCache.clear();
  }
}
