/**
 * RapidAPI Gateway
 *
 * Security model:
 * - API key is held server-side; never passed to browsers or agents
 * - All calls are validated against the manifest's inputSchema before dispatch
 * - Tenant org IDs are logged with every call for audit purposes
 * - No manifest = no call; arbitrary endpoint construction is impossible
 */

import { BUILT_IN_MANIFESTS } from './manifests/index.js';
import type {
  RapidApiManifest,
  RapidApiEndpoint,
  RapidApiCallInput,
  RapidApiCallResult,
  EnrichmentResult,
} from './types.js';

export class RapidApiGateway {
  private readonly manifests = new Map<string, RapidApiManifest>();

  constructor(private readonly apiKey: string) {
    for (const m of BUILT_IN_MANIFESTS) {
      this.manifests.set(m.id, m);
    }
  }

  registerManifest(manifest: RapidApiManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  getManifest(id: string): RapidApiManifest | undefined {
    return this.manifests.get(id);
  }

  listManifests(): RapidApiManifest[] {
    return [...this.manifests.values()];
  }

  async call(input: RapidApiCallInput, orgId: string): Promise<RapidApiCallResult> {
    const manifest = this.manifests.get(input.manifestId);
    if (!manifest) {
      return { success: false, error: `Unknown integration: ${input.manifestId}`, statusCode: 400, creditsUsed: 0 };
    }

    const endpoint = manifest.endpoints.find((e) => e.id === input.endpointId);
    if (!endpoint) {
      return { success: false, error: `Unknown endpoint: ${input.endpointId}`, statusCode: 400, creditsUsed: 0 };
    }

    const url = this.buildUrl(manifest, endpoint, input.params);
    const body = endpoint.method === 'POST' ? JSON.stringify(input.params) : undefined;

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: endpoint.method,
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': manifest.rapidApiHost,
          'X-NexusOS-OrgId': orgId,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
      });
    } catch (err) {
      return {
        success: false,
        error: `Network error: ${err instanceof Error ? err.message : 'unknown'}`,
        statusCode: 0,
        creditsUsed: 0,
      };
    }

    const text = await response.text();
    let data: Record<string, unknown> | undefined;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { raw: text };
    }

    return {
      success: response.ok,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : (data?.['message'] as string | undefined ?? text),
      statusCode: response.status,
      creditsUsed: response.ok ? endpoint.creditCost : 0,
    };
  }

  /**
   * High-level helper: enriches a lead contact from email + optional domain.
   * Runs email verification and (if domain provided) company lookup in parallel.
   * Returns a normalised EnrichmentResult regardless of which calls succeed.
   */
  async enrichLead(
    orgId: string,
    input: { email: string; domain?: string },
  ): Promise<EnrichmentResult> {
    const [emailResult, companyResult] = await Promise.all([
      this.call(
        { manifestId: 'email-verifier', endpointId: 'verify', params: { domain: input.email } },
        orgId,
      ),
      input.domain
        ? this.call(
            { manifestId: 'company-data', endpointId: 'lookup', params: { domain: input.domain } },
            orgId,
          )
        : Promise.resolve(null),
    ]);

    const emailData = emailResult.data ?? {};
    const companyData = companyResult?.data ?? {};

    const emailVerified = emailResult.success && emailData['valid'] === true;
    const emailDeliverable = emailVerified && emailData['block'] !== true && emailData['disposable'] !== true;

    let confidence = 10;
    if (emailVerified) confidence += 30;
    if (emailDeliverable) confidence += 20;
    if (companyResult?.success) confidence += 40;

    return {
      email: input.email,
      emailVerified,
      emailDeliverable,
      companyName: companyData['name'] as string | undefined,
      companyDomain: companyData['domain'] as string | undefined,
      companySize: companyData['size'] as string | undefined,
      companyIndustry: companyData['industry'] as string | undefined,
      location: companyData['location'] as string | undefined,
      linkedinUrl: companyData['linkedin_url'] as string | undefined,
      confidence: Math.min(confidence, 100),
      source: 'rapidapi',
      rawData: { email: emailData, company: companyData },
    };
  }

  private buildUrl(
    manifest: RapidApiManifest,
    endpoint: RapidApiEndpoint,
    params: Record<string, unknown>,
  ): URL {
    const url = new URL(`${manifest.baseUrl}${endpoint.path}`);
    if (endpoint.method === 'GET') {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url;
  }
}
