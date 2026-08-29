import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export type OutboxMutationStatus = 'PENDING' | 'SYNCING' | 'SYNCED';

export interface OutboxMutationRecord {
  mutation_id: string;
  idempotency_key: string;
  entity_type: string;
  payload: Record<string, any>;
  status: OutboxMutationStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueMutationInput {
  mutation_id?: string;
  idempotency_key: string;
  entity_type: string;
  payload: Record<string, any>;
}

export class SqliteOutboxEngine {
  private db: DatabaseSync | null = null;
  private dbPath: string;
  private isInitialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize local SQLite database with Write-Ahead Logging (WAL) mode
   * and durable outbox_mutations table.
   */
  public initialize(): void {
    if (this.isInitialized && this.db) {
      return;
    }

    this.db = new DatabaseSync(this.dbPath);

    // Enforce Write-Ahead Logging (WAL) for concurrency & durability
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    // Create durable outbox mutations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox_mutations (
        mutation_id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE NOT NULL,
        entity_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT CHECK(status IN ('PENDING', 'SYNCING', 'SYNCED')) NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_mutations(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_idempotency ON outbox_mutations(idempotency_key);
    `);

    this.isInitialized = true;
  }

  /**
   * Fetch active journal mode PRAGMA
   */
  public getJournalMode(): string {
    this.ensureInitialized();
    const result = this.db!.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
    return result ? result.journal_mode : 'unknown';
  }

  /**
   * Enqueue a new mutation into the durable WAL outbox
   */
  public enqueueMutation(input: EnqueueMutationInput): OutboxMutationRecord {
    this.ensureInitialized();

    const mutation_id = input.mutation_id || `mut_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const payloadStr = JSON.stringify(input.payload);

    // Check if idempotency key already exists to prevent duplicate insertion
    const existing = this.getMutationByIdempotencyKey(input.idempotency_key);
    if (existing) {
      return existing;
    }

    const stmt = this.db!.prepare(`
      INSERT INTO outbox_mutations (
        mutation_id,
        idempotency_key,
        entity_type,
        payload,
        status,
        retry_count,
        error_message,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'PENDING', 0, NULL, ?, ?)
    `);

    stmt.run(
      mutation_id,
      input.idempotency_key,
      input.entity_type,
      payloadStr,
      now,
      now
    );

    return {
      mutation_id,
      idempotency_key: input.idempotency_key,
      entity_type: input.entity_type,
      payload: input.payload,
      status: 'PENDING',
      retry_count: 0,
      error_message: null,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Fetch pending or syncing mutations ordered by creation time
   */
  public getPendingMutations(limit: number = 50): OutboxMutationRecord[] {
    this.ensureInitialized();

    const stmt = this.db!.prepare(`
      SELECT mutation_id, idempotency_key, entity_type, payload, status, retry_count, error_message, created_at, updated_at
      FROM outbox_mutations
      WHERE status IN ('PENDING', 'SYNCING')
      ORDER BY created_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];

    return rows.map((row) => ({
      mutation_id: row.mutation_id,
      idempotency_key: row.idempotency_key,
      entity_type: row.entity_type,
      payload: JSON.parse(row.payload),
      status: row.status as OutboxMutationStatus,
      retry_count: row.retry_count,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Update mutation status and retry metrics
   */
  public updateStatus(
    mutation_id: string,
    status: OutboxMutationStatus,
    errorMessage: string | null = null
  ): OutboxMutationRecord | null {
    this.ensureInitialized();

    const now = new Date().toISOString();
    const isError = errorMessage !== null;

    const stmt = this.db!.prepare(`
      UPDATE outbox_mutations
      SET status = ?,
          error_message = ?,
          retry_count = retry_count + ?,
          updated_at = ?
      WHERE mutation_id = ?
    `);

    stmt.run(status, errorMessage, isError ? 1 : 0, now, mutation_id);

    return this.getMutationById(mutation_id);
  }

  /**
   * Mark a mutation as SYNCED
   */
  public markSynced(mutation_id: string): OutboxMutationRecord | null {
    return this.updateStatus(mutation_id, 'SYNCED', null);
  }

  /**
   * Get mutation by idempotency key
   */
  public getMutationByIdempotencyKey(idempotency_key: string): OutboxMutationRecord | null {
    this.ensureInitialized();

    const stmt = this.db!.prepare(`
      SELECT mutation_id, idempotency_key, entity_type, payload, status, retry_count, error_message, created_at, updated_at
      FROM outbox_mutations
      WHERE idempotency_key = ?
    `);

    const row = stmt.get(idempotency_key) as any;
    if (!row) return null;

    return {
      mutation_id: row.mutation_id,
      idempotency_key: row.idempotency_key,
      entity_type: row.entity_type,
      payload: JSON.parse(row.payload),
      status: row.status as OutboxMutationStatus,
      retry_count: row.retry_count,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Get mutation by mutation ID
   */
  public getMutationById(mutation_id: string): OutboxMutationRecord | null {
    this.ensureInitialized();

    const stmt = this.db!.prepare(`
      SELECT mutation_id, idempotency_key, entity_type, payload, status, retry_count, error_message, created_at, updated_at
      FROM outbox_mutations
      WHERE mutation_id = ?
    `);

    const row = stmt.get(mutation_id) as any;
    if (!row) return null;

    return {
      mutation_id: row.mutation_id,
      idempotency_key: row.idempotency_key,
      entity_type: row.entity_type,
      payload: JSON.parse(row.payload),
      status: row.status as OutboxMutationStatus,
      retry_count: row.retry_count,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Count mutations filtered by status
   */
  public countByStatus(status?: OutboxMutationStatus): number {
    this.ensureInitialized();

    if (status) {
      const stmt = this.db!.prepare(`SELECT COUNT(*) as count FROM outbox_mutations WHERE status = ?`);
      const row = stmt.get(status) as any;
      return row.count;
    } else {
      const stmt = this.db!.prepare(`SELECT COUNT(*) as count FROM outbox_mutations`);
      const row = stmt.get() as any;
      return row.count;
    }
  }

  /**
   * Fetch all mutations in database
   */
  public getAllMutations(): OutboxMutationRecord[] {
    this.ensureInitialized();

    const stmt = this.db!.prepare(`
      SELECT mutation_id, idempotency_key, entity_type, payload, status, retry_count, error_message, created_at, updated_at
      FROM outbox_mutations
      ORDER BY created_at ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      mutation_id: row.mutation_id,
      idempotency_key: row.idempotency_key,
      entity_type: row.entity_type,
      payload: JSON.parse(row.payload),
      status: row.status as OutboxMutationStatus,
      retry_count: row.retry_count,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Close the SQLite database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('SqliteOutboxEngine is not initialized. Call initialize() first.');
    }
  }
}
