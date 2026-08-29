export class SyncService {
  /**
   * Evaluates idempotency key deduplication
   */
  public static isDuplicateMutation(
    cachedKeys: Map<string, { response: any; status: number }>,
    idempotencyKey: string
  ): { isDuplicate: boolean; cachedResponse?: any; status?: number } {
    if (cachedKeys.has(idempotencyKey)) {
      const entry = cachedKeys.get(idempotencyKey)!;
      return {
        isDuplicate: true,
        cachedResponse: entry.response,
        status: entry.status,
      };
    }
    return { isDuplicate: false };
  }
}
