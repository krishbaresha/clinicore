export interface SyncRecord {
  mutationId: string;
  idempotencyKey: string;
  entityType: 'PATIENT' | 'OPD_CONSULTATION' | 'STOCK_INVOICE' | 'PAYMENT';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: string;
  payload: Record<string, any>;
  clientId: string;
  createdAt: string;
  sequence?: number;
}

export interface OutboxItem extends SyncRecord {
  status: 'PENDING' | 'SYNCING' | 'SYNCED';
  retryCount: number;
  errorMessage?: string;
}

export class CanonicalServer {
  public currentCursor: number = 0;
  public changeLog: SyncRecord[] = [];
  public entities: Map<string, Record<string, any>> = new Map();
  public processedIdempotencyKeys: Map<string, { sequence: number; entityId: string }> = new Map();

  public pushMutation(mutation: SyncRecord): { success: boolean; sequence: number; isDuplicate: boolean } {
    // 1. Idempotency Check
    if (this.processedIdempotencyKeys.has(mutation.idempotencyKey)) {
      const cached = this.processedIdempotencyKeys.get(mutation.idempotencyKey)!;
      return {
        success: true,
        sequence: cached.sequence,
        isDuplicate: true
      };
    }

    // 2. Assign strictly monotonic change cursor
    this.currentCursor += 1;
    const committedRecord: SyncRecord = {
      ...mutation,
      sequence: this.currentCursor
    };

    // 3. Update central entity database state
    if (mutation.action === 'DELETE') {
      this.entities.delete(mutation.entityId);
    } else {
      const existing = this.entities.get(mutation.entityId) || {};
      this.entities.set(mutation.entityId, {
        ...existing,
        ...mutation.payload,
        id: mutation.entityId,
        _updatedAtSequence: this.currentCursor
      });
    }

    // 4. Record to change log & idempotency store
    this.changeLog.push(committedRecord);
    this.processedIdempotencyKeys.set(mutation.idempotencyKey, {
      sequence: this.currentCursor,
      entityId: mutation.entityId
    });

    return {
      success: true,
      sequence: this.currentCursor,
      isDuplicate: false
    };
  }

  public pullChanges(sinceCursor: number): { changes: SyncRecord[]; currentCursor: number } {
    const changes = this.changeLog.filter(rec => (rec.sequence ?? 0) > sinceCursor);
    return {
      changes,
      currentCursor: this.currentCursor
    };
  }

  public getEntity(entityId: string): Record<string, any> | undefined {
    return this.entities.get(entityId);
  }
}

export class LocalClientNode {
  public clientId: string;
  public isOnline: boolean = true;
  public lastSyncedCursor: number = 0;
  public localEntities: Map<string, Record<string, any>> = new Map();
  public outbox: OutboxItem[] = [];

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  public createOrUpdateRecord(
    entityType: 'PATIENT' | 'OPD_CONSULTATION' | 'STOCK_INVOICE' | 'PAYMENT',
    entityId: string,
    payload: Record<string, any>,
    action: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE',
    customIdempotencyKey?: string
  ): OutboxItem {
    const mutationId = `MUT-${this.clientId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const idempotencyKey = customIdempotencyKey || `IDEM-${this.clientId}-${entityId}-${Date.now()}`;

    // Apply to local DB immediately (optimistic UI write)
    if (action === 'DELETE') {
      this.localEntities.delete(entityId);
    } else {
      const existing = this.localEntities.get(entityId) || {};
      this.localEntities.set(entityId, {
        ...existing,
        ...payload,
        id: entityId
      });
    }

    // Queue in WAL Outbox
    const outboxItem: OutboxItem = {
      mutationId,
      idempotencyKey,
      entityType,
      action,
      entityId,
      payload,
      clientId: this.clientId,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0
    };

    this.outbox.push(outboxItem);
    return outboxItem;
  }

  public flushOutbox(server: CanonicalServer): { flushedCount: number; duplicateCount: number } {
    if (!this.isOnline) {
      return { flushedCount: 0, duplicateCount: 0 };
    }

    let flushedCount = 0;
    let duplicateCount = 0;

    for (const item of this.outbox) {
      if (item.status === 'SYNCED') continue;

      item.status = 'SYNCING';
      const res = server.pushMutation(item);
      if (res.success) {
        item.status = 'SYNCED';
        flushedCount++;
        if (res.isDuplicate) {
          duplicateCount++;
        }
      } else {
        item.status = 'PENDING';
        item.retryCount++;
      }
    }

    return { flushedCount, duplicateCount };
  }

  public syncWithServer(server: CanonicalServer): { pulledCount: number } {
    if (!this.isOnline) {
      return { pulledCount: 0 };
    }

    // 1. Flush local outbox first
    this.flushOutbox(server);

    // 2. Delta pull from canonical server
    const { changes, currentCursor } = server.pullChanges(this.lastSyncedCursor);
    let pulledCount = 0;

    for (const change of changes) {
      // Ignore mutations originated by self if already applied
      if (change.action === 'DELETE') {
        this.localEntities.delete(change.entityId);
      } else {
        const existing = this.localEntities.get(change.entityId) || {};
        this.localEntities.set(change.entityId, {
          ...existing,
          ...change.payload,
          id: change.entityId
        });
      }
      pulledCount++;
    }

    this.lastSyncedCursor = currentCursor;
    return { pulledCount };
  }

  public wipeLocalStorage(): void {
    this.localEntities.clear();
    this.outbox = [];
    this.lastSyncedCursor = 0;
  }

  public rehydrateFromCanonical(server: CanonicalServer): { rehydratedCount: number } {
    if (!this.isOnline) {
      throw new Error('Client must be online to rehydrate from canonical server');
    }

    // Wipe local cache first
    this.wipeLocalStorage();

    // Request full delta sync from cursor 0
    const { changes, currentCursor } = server.pullChanges(0);
    let rehydratedCount = 0;

    for (const change of changes) {
      if (change.action === 'DELETE') {
        this.localEntities.delete(change.entityId);
      } else {
        const existing = this.localEntities.get(change.entityId) || {};
        this.localEntities.set(change.entityId, {
          ...existing,
          ...change.payload,
          id: change.entityId
        });
      }
      rehydratedCount++;
    }

    this.lastSyncedCursor = currentCursor;
    return { rehydratedCount };
  }
}
