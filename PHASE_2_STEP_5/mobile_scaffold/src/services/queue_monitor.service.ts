export interface QueueItem {
  tokenId: number;
  tokenNumber: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'SKIPPED';
  arrivalTime: string;
}

export interface ChamberQueueStats {
  doctorId: string;
  chamberName: string;
  totalWaiting: number;
  totalCompleted: number;
  totalSkipped: number;
  currentToken: string | null;
  averageWaitTimeMins: number;
}

export class QueueMonitorService {
  private queue: QueueItem[] = [];
  private doctorId: string;
  private chamberName: string;

  constructor(doctorId: string, chamberName: string = 'OPD Chamber 1') {
    this.doctorId = doctorId;
    this.chamberName = chamberName;
  }

  public setQueue(items: QueueItem[]): void {
    this.queue = [...items];
  }

  public addPatient(item: QueueItem): void {
    this.queue.push(item);
  }

  public getQueue(): QueueItem[] {
    return [...this.queue];
  }

  public getWaitingList(): QueueItem[] {
    return this.queue.filter(q => q.status === 'WAITING');
  }

  public getCurrentConsultation(): QueueItem | null {
    return this.queue.find(q => q.status === 'IN_CONSULTATION') || null;
  }

  public callNextPatient(): QueueItem | null {
    const current = this.getCurrentConsultation();
    if (current) {
      current.status = 'COMPLETED';
    }

    const next = this.queue.find(q => q.status === 'WAITING');
    if (next) {
      next.status = 'IN_CONSULTATION';
      return next;
    }
    return null;
  }

  public getStats(): ChamberQueueStats {
    const waiting = this.queue.filter(q => q.status === 'WAITING').length;
    const completed = this.queue.filter(q => q.status === 'COMPLETED').length;
    const skipped = this.queue.filter(q => q.status === 'SKIPPED').length;
    const active = this.getCurrentConsultation();

    return {
      doctorId: this.doctorId,
      chamberName: this.chamberName,
      totalWaiting: waiting,
      totalCompleted: completed,
      totalSkipped: skipped,
      currentToken: active ? active.tokenNumber : null,
      averageWaitTimeMins: waiting * 5 // Estimated 5 mins per patient
    };
  }
}
