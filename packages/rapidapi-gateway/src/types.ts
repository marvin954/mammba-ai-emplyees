/**
 * Manifest-driven RapidAPI integration contract.
 *
 * Each integration declares its endpoint shape, required headers, and the
 * result schema. The gateway validates inputs against the manifest before
 * making any outbound call, keeping tenant-supplied data from escaping the
 * declared surface area.
 */

export interface RapidApiManifest {
  /** Unique slug, e.g. "email-verifier" */
  id: string;
  name: string;
  description: string;
  /** RapidAPI host header value */
  rapidApiHost: string;
  /** Base URL for the API endpoints */
  baseUrl: string;
  /** Which data enrichment category this integration belongs to */
  category: 'email' | 'company' | 'person' | 'phone' | 'social' | 'other';
  endpoints: RapidApiEndpoint[];
}

export interface RapidApiEndpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  /** JSON Schema for query params (GET) or body (POST) */
  inputSchema: Record<string, unknown>;
  /** JSON Schema describing the response shape */
  outputSchema: Record<string, unknown>;
  /** Estimated credits consumed per call (for budget tracking) */
  creditCost: number;
}

export interface RapidApiCallInput {
  manifestId: string;
  endpointId: string;
  params: Record<string, unknown>;
}

export interface RapidApiCallResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  statusCode: number;
  creditsUsed: number;
}

/** Contact enrichment fields merged back into the Contact record */
export interface EnrichmentResult {
  email?: string;
  emailVerified?: boolean;
  emailDeliverable?: boolean;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  companyName?: string;
  companyDomain?: string;
  companySize?: string;
  companyIndustry?: string;
  location?: string;
  confidence: number; // 0-100
  source: string;
  rawData: Record<string, unknown>;
}
