import { SqliteOutboxEngine, type OutboxMutationRecord } from '../db/sqlite_outbox.ts';
import crypto from 'node:crypto';

export interface ThermalPrintRequest {
  receipt_type: 'OPD_TOKEN' | 'PHARMACY_POS' | 'WHOLESALE_INVOICE' | 'LAB_RECEIPT';
  patient_name?: string;
  doctor_name?: string;
  token_number?: string | number;
  items?: Array<{ name: string; qty: number; price: number; total: number }>;
  total_amount?: number;
  raw_escpos?: string;
}

export interface ThermalPrintResult {
  success: boolean;
  print_job_id: string;
  paper_width: '80mm';
  line_count: number;
  escpos_bytes: number;
  timestamp: string;
  status: 'PRINTED';
  receipt_type: string;
}

export interface HardwareStatusResult {
  printer: {
    model: string;
    status: 'ONLINE' | 'OFFLINE' | 'PAPER_OUT';
    paper_present: boolean;
    interface: 'USB_RAW' | 'SERIAL' | 'NETWORK';
  };
  offline_db: {
    status: 'ONLINE' | 'OFFLINE';
    journal_mode: string;
    pending_mutations: number;
  };
}

export type TauriEventListener = (payload: any) => void;

export class TauriAppShell {
  private outboxEngine: SqliteOutboxEngine | null = null;
  private eventListeners: Map<string, Set<TauriEventListener>> = new Map();
  private dbPath: string = './clinicflow_offline.db';

  constructor(dbPath?: string) {
    if (dbPath) {
      this.dbPath = dbPath;
    }
  }

  /**
   * Primary Tauri IPC Bridge call handler simulating window.__TAURI__.core.invoke
   */
  public async invoke<T = any>(command: string, args: Record<string, any> = {}): Promise<T> {
    switch (command) {
      case 'init_offline_db': {
        const path = args.dbPath || this.dbPath;
        this.outboxEngine = new SqliteOutboxEngine(path);
        this.outboxEngine.initialize();
        const mode = this.outboxEngine.getJournalMode();
        this.emit('db_initialized', { path, mode });
        return {
          success: true,
          db_path: path,
          journal_mode: mode,
          is_offline_ready: true,
        } as unknown as T;
      }

      case 'enqueue_outbox_mutation': {
        this.ensureDbInitialized();
        const record = this.outboxEngine!.enqueueMutation({
          mutation_id: args.mutation_id,
          idempotency_key: args.idempotency_key,
          entity_type: args.entity_type,
          payload: args.payload,
        });
        this.emit('outbox_enqueued', record);
        return record as unknown as T;
      }

      case 'get_outbox_pending': {
        this.ensureDbInitialized();
        const limit = args.limit || 50;
        return this.outboxEngine!.getPendingMutations(limit) as unknown as T;
      }

      case 'mark_mutation_synced': {
        this.ensureDbInitialized();
        const record = this.outboxEngine!.markSynced(args.mutation_id);
        if (record) {
          this.emit('outbox_synced', record);
        }
        return record as unknown as T;
      }

      case 'print_thermal_receipt': {
        const req: ThermalPrintRequest = args as ThermalPrintRequest;
        const result = this.processThermalPrint(req);
        this.emit('hardware_print_completed', result);
        return result as unknown as T;
      }

      case 'get_hardware_status': {
        const status = this.getHardwareStatus();
        return status as unknown as T;
      }

      default:
        throw new Error(`Unknown Tauri IPC Command: '${command}'`);
    }
  }

  /**
   * Process and simulate thermal printer hardware command (80mm ESC/POS)
   */
  public processThermalPrint(request: ThermalPrintRequest): ThermalPrintResult {
    const printJobId = `prn_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    // Construct 80mm ESC/POS simulated receipt payload
    const lines: string[] = [];
    lines.push('\x1B\x40'); // ESC @ Initialize printer
    lines.push('\x1B\x61\x01'); // ESC a 1 Center alignment
    lines.push('==========================================');
    lines.push('  DR. MUHAMMAD KASHIF KHAN CLINIC & PHARMACY  ');
    lines.push('       Hyderabad & Interior Sindh       ');
    lines.push('==========================================');
    lines.push(`Receipt Type: ${request.receipt_type}`);
    if (request.token_number) lines.push(`TOKEN #: ${request.token_number}`);
    if (request.patient_name) lines.push(`Patient: ${request.patient_name}`);
    if (request.doctor_name) lines.push(`Doctor: ${request.doctor_name}`);
    lines.push('------------------------------------------');

    if (request.items && request.items.length > 0) {
      lines.push('Item                   Qty   Price  Total');
      for (const item of request.items) {
        const nameCol = item.name.padEnd(20).substring(0, 20);
        const qtyCol = String(item.qty).padStart(4);
        const priceCol = String(item.price).padStart(7);
        const totalCol = String(item.total).padStart(7);
        lines.push(`${nameCol} ${qtyCol} ${priceCol} ${totalCol}`);
      }
      lines.push('------------------------------------------');
    }

    if (request.total_amount !== undefined) {
      lines.push(`TOTAL AMOUNT: Rs. ${request.total_amount.toLocaleString()}`);
    }

    lines.push('==========================================');
    lines.push('    Thank you for visiting ClinicFlow!   ');
    lines.push('\x1D\x56\x41\x03'); // GS V A 3 Paper cut

    const fullRawContent = lines.join('\n');
    const escposBytes = Buffer.byteLength(fullRawContent, 'utf-8');

    return {
      success: true,
      print_job_id: printJobId,
      paper_width: '80mm',
      line_count: lines.length,
      escpos_bytes: escposBytes,
      timestamp,
      status: 'PRINTED',
      receipt_type: request.receipt_type,
    };
  }

  /**
   * Retrieve current hardware & offline DB status
   */
  public getHardwareStatus(): HardwareStatusResult {
    let pendingCount = 0;
    let mode = 'OFFLINE';
    let dbStatus: 'ONLINE' | 'OFFLINE' = 'OFFLINE';

    if (this.outboxEngine) {
      try {
        pendingCount = this.outboxEngine.countByStatus('PENDING');
        mode = this.outboxEngine.getJournalMode();
        dbStatus = 'ONLINE';
      } catch {
        dbStatus = 'OFFLINE';
      }
    }

    return {
      printer: {
        model: 'POS-80 Thermal Receipt Printer (ESC/POS)',
        status: 'ONLINE',
        paper_present: true,
        interface: 'USB_RAW',
      },
      offline_db: {
        status: dbStatus,
        journal_mode: mode,
        pending_mutations: pendingCount,
      },
    };
  }

  /**
   * Listen to simulated Tauri shell events
   */
  public listen(event: string, listener: TauriEventListener): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    return () => {
      const set = this.eventListeners.get(event);
      if (set) {
        set.delete(listener);
      }
    };
  }

  /**
   * Emit simulated Tauri shell event
   */
  public emit(event: string, payload: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (err) {
          console.error(`Error in event listener for '${event}':`, err);
        }
      }
    }
  }

  /**
   * Direct access to underlying SqliteOutboxEngine instance
   */
  public getOutboxEngine(): SqliteOutboxEngine | null {
    return this.outboxEngine;
  }

  /**
   * Close database and release hardware resources
   */
  public close(): void {
    if (this.outboxEngine) {
      this.outboxEngine.close();
      this.outboxEngine = null;
    }
    this.eventListeners.clear();
  }

  private ensureDbInitialized(): void {
    if (!this.outboxEngine) {
      throw new Error('Offline database not initialized. Call invoke("init_offline_db") first.');
    }
  }
}
