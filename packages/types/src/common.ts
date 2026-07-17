export type ID = string;

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDelete extends Timestamps {
  deletedAt: Date | null;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: unknown[];
  [key: string]: unknown;
}
