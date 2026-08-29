import type { SyncChangeRecord } from '../types/api.types.ts';

export class SyncCursorStore {
  private sequence: number = 0;
  private changeLog: SyncChangeRecord[] = [];

  /**
   * Appends a change record with a strictly monotonic cursor sequence N
   */
  public appendChange(
    entity_type: string,
    entity_id: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any
  ): SyncChangeRecord {
    this.sequence += 1;
    const changeRecord: SyncChangeRecord = {
      cursor: this.sequence,
      entity_type,
      entity_id,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.changeLog.push(changeRecord);
    return changeRecord;
  }

  /**
   * Queries change records strictly greater than cursor N
   */
  public getChangesSince(
    cursor: number,
    limit: number = 100
  ): { changes: SyncChangeRecord[]; current_cursor: number; has_more: boolean } {
    const filtered = this.changeLog.filter((item) => item.cursor > cursor);
    const sliced = filtered.slice(0, limit);
    const has_more = filtered.length > limit;

    return {
      changes: sliced,
      current_cursor: this.sequence,
      has_more,
    };
  }

  /**
   * Gets the highest assigned change cursor
   */
  public getLatestCursor(): number {
    return this.sequence;
  }

  /**
   * Resets or seeds change log for testing
   */
  public clear(): void {
    this.sequence = 0;
    this.changeLog = [];
  }
}
