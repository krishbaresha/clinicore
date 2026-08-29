/**
 * PostgreSQL 16 Production Configuration Tuner
 * Dynamically computes optimal postgresql.conf settings for PostgreSQL 16 engine based on
 * available system RAM (e.g. 8GB, 16GB, 32GB) and system work parameters.
 */

export interface PgTuningOptions {
  totalRamGb?: number;
  maxConnections?: number;
  storageType?: 'SSD' | 'NVMe' | 'HDD';
  cpuCores?: number;
}

export interface PgConfigParams {
  max_connections: string;
  shared_buffers: string;
  effective_cache_size: string;
  maintenance_work_mem: string;
  work_mem: string;
  wal_level: string;
  checkpoint_completion_target: string;
  wal_buffers: string;
  default_statistics_target: string;
  random_page_cost: string;
  effective_io_concurrency: string;
  min_wal_size: string;
  max_wal_size: string;
  max_worker_processes: string;
  max_parallel_workers_per_gather: string;
  max_parallel_workers: string;
  max_parallel_maintenance_workers: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class PgTuningConfig {
  private totalRamGb: number;
  private maxConnections: number;
  private storageType: 'SSD' | 'NVMe' | 'HDD';
  private cpuCores: number;

  constructor(options: PgTuningOptions = {}) {
    this.totalRamGb = options.totalRamGb || 16;
    this.maxConnections = options.maxConnections || 100;
    this.storageType = options.storageType || 'NVMe';
    this.cpuCores = options.cpuCores || 4;
  }

  public generateConfig(): PgConfigParams {
    const ramMb = this.totalRamGb * 1024;
    
    // shared_buffers: 25% of total RAM
    const sharedBuffersMb = Math.floor(ramMb * 0.25);
    
    // effective_cache_size: 75% of total RAM
    const effectiveCacheMb = Math.floor(ramMb * 0.75);

    // work_mem: (Total RAM - shared_buffers) / (max_connections * 3)
    const availableWorkRamMb = ramMb - sharedBuffersMb;
    const workMemMb = Math.max(4, Math.floor(availableWorkRamMb / (this.maxConnections * 3)));

    // maintenance_work_mem: 6.25% of total RAM capped at 2GB
    const maintenanceWorkMb = Math.min(2048, Math.floor(ramMb * 0.0625));

    // Storage cost tuning
    const randomPageCost = this.storageType === 'NVMe' ? '1.1' : this.storageType === 'SSD' ? '1.1' : '4.0';
    const effectiveIoConcurrency = this.storageType === 'NVMe' ? '200' : '100';

    return {
      max_connections: `${this.maxConnections}`,
      shared_buffers: `${sharedBuffersMb}MB`,
      effective_cache_size: `${effectiveCacheMb}MB`,
      maintenance_work_mem: `${maintenanceWorkMb}MB`,
      work_mem: `${workMemMb}MB`,
      wal_level: 'replica',
      checkpoint_completion_target: '0.9',
      wal_buffers: '16MB',
      default_statistics_target: '100',
      random_page_cost: randomPageCost,
      effective_io_concurrency: effectiveIoConcurrency,
      min_wal_size: '2GB',
      max_wal_size: '16GB',
      max_worker_processes: `${this.cpuCores}`,
      max_parallel_workers_per_gather: `${Math.max(1, Math.floor(this.cpuCores / 2))}`,
      max_parallel_workers: `${this.cpuCores}`,
      max_parallel_maintenance_workers: `${Math.max(1, Math.floor(this.cpuCores / 2))}`,
    };
  }

  public generateConfigFile(): string {
    const params = this.generateConfig();
    return `# ==============================================================================
# PostgreSQL 16 Production Tuned Configuration (ClinicFlow Server)
# Hardware Target: ${this.totalRamGb} GB RAM | ${this.cpuCores} CPU Cores | ${this.storageType} Storage
# ==============================================================================

# Memory Configuration
shared_buffers = ${params.shared_buffers}
effective_cache_size = ${params.effective_cache_size}
maintenance_work_mem = ${params.maintenance_work_mem}
work_mem = ${params.work_mem}

# Connection Settings
max_connections = ${params.max_connections}

# Write-Ahead Log (WAL) & Replication Tuning
wal_level = ${params.wal_level}
checkpoint_completion_target = ${params.checkpoint_completion_target}
wal_buffers = ${params.wal_buffers}
min_wal_size = ${params.min_wal_size}
max_wal_size = ${params.max_wal_size}

# Query Planner & Storage Cost
random_page_cost = ${params.random_page_cost}
effective_io_concurrency = ${params.effective_io_concurrency}
default_statistics_target = ${params.default_statistics_target}

# Parallel Query Execution Tuning
max_worker_processes = ${params.max_worker_processes}
max_parallel_workers_per_gather = ${params.max_parallel_workers_per_gather}
max_parallel_workers = ${params.max_parallel_workers}
max_parallel_maintenance_workers = ${params.max_parallel_maintenance_workers}
`;
  }

  public validateConfig(paramsInput?: PgConfigParams): ValidationResult {
    const params = paramsInput || this.generateConfig();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (params.wal_level !== 'replica' && params.wal_level !== 'logical') {
      errors.push(`Invalid wal_level: ${params.wal_level}. Must be replica or logical for high availability.`);
    }

    if (!params.shared_buffers || !params.shared_buffers.endsWith('MB')) {
      errors.push('shared_buffers must be explicitly specified in MB format');
    }

    if (!params.work_mem || !params.work_mem.endsWith('MB')) {
      errors.push('work_mem must be specified in MB format');
    }

    const conn = parseInt(params.max_connections, 10);
    if (isNaN(conn) || conn < 20 || conn > 1000) {
      errors.push(`max_connections standard out of range: ${params.max_connections}`);
    }

    if (params.checkpoint_completion_target !== '0.9') {
      warnings.push('Recommended checkpoint_completion_target is 0.9 for steady write I/O');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public getSummary(): {
    ramGb: number;
    sharedBuffers: string;
    workMem: string;
    walLevel: string;
    maxConnections: number;
  } {
    const config = this.generateConfig();
    return {
      ramGb: this.totalRamGb,
      sharedBuffers: config.shared_buffers,
      workMem: config.work_mem,
      walLevel: config.wal_level,
      maxConnections: parseInt(config.max_connections, 10),
    };
  }
}
