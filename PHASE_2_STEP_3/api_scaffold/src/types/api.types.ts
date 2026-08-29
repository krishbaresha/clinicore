export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

export interface AuthTokenPayload {
  user_id: string;
  clinic_id: string;
  role: string;
  iat: number;
  exp: number;
}

export interface SyncChangeRecord {
  cursor: number;
  entity_type: string;
  entity_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: string;
}

export interface MutationRequest {
  mutation_id: string;
  idempotency_key: string;
  entity_type: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
}

export interface MutationResult {
  mutation_id: string;
  idempotency_key: string;
  status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
  cursor?: number;
  error?: string;
  cachedResponse?: any;
}

export interface ApprovalRequest {
  approval_id?: string;
  requester_id?: string;
  action_type: string;
  target_entity: string;
  entity_id: string;
  reason: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at?: string;
}
