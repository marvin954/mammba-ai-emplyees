/**
 * Lead enrichment processor.
 *
 * Consumes LeadEnrichJob items from the ENRICHMENT queue, calls the RapidAPI
 * gateway to enrich the contact, then writes the results back to the Contact
 * record and records a CRM activity. Runs asynchronously so the HTTP request
 * that submitted the lead can return immediately.
 */

import type { Job } from 'bullmq';
import type { PrismaClient } from '@nexusos/database';
import type { AuditService } from '@nexusos/audit';
import { RapidApiGateway } from '@nexusos/rapidapi-gateway';
import type { LeadEnrichJob } from '@nexusos/events';

export class EnrichmentProcessor {
  private readonly rapidApi: RapidApiGateway;

  constructor(
    private readonly db: PrismaClient,
    private readonly audit: AuditService,
    rapidApiKey: string,
  ) {
    this.rapidApi = new RapidApiGateway(rapidApiKey);
  }

  async process(job: Job): Promise<void> {
    const data = job.data as LeadEnrichJob;

    if (data.type !== 'lead.enrich') {
      throw new Error(`Unexpected job type in enrichment queue: ${String(data.type)}`);
    }

    const contact = await this.db.contact.findFirst({
      where: { id: data.contactId, orgId: data.orgId, deletedAt: null },
    });

    if (!contact) {
      console.warn(`[EnrichmentProcessor] Contact ${data.contactId} not found — skipping`);
      return;
    }

    const result = await this.rapidApi.enrichLead(data.orgId, {
      email: data.email,
      domain: data.domain,
    });

    // Merge enrichment data back — only overwrite if field is currently empty
    const updates: Record<string, unknown> = {
      enrichedAt: new Date(),
      enrichmentScore: result.confidence,
    };

    if (!contact.firstName && result.firstName) updates['firstName'] = result.firstName;
    if (!contact.lastName && result.lastName) updates['lastName'] = result.lastName;
    if (result.emailVerified !== undefined) updates['emailVerified'] = result.emailVerified;
    if (!contact.companyId && result.companyName) {
      // Upsert company by domain if we got one
      if (result.companyDomain) {
        const company = await this.db.company.upsert({
          where: { orgId_domain: { orgId: data.orgId, domain: result.companyDomain } } as never,
          create: {
            orgId: data.orgId,
            name: result.companyName,
            domain: result.companyDomain,
            industry: result.companyIndustry ?? null,
            size: result.companySize ?? null,
          },
          update: {
            ...(result.companyIndustry ? { industry: result.companyIndustry } : {}),
            ...(result.companySize ? { size: result.companySize } : {}),
          },
        });
        updates['companyId'] = company.id;
      }
    }

    await this.db.contact.update({
      where: { id: data.contactId },
      data: updates,
    });

    // Write activity log
    await this.db.activity.create({
      data: {
        orgId: data.orgId,
        type: 'enrichment_completed',
        subject: `Lead enriched via RapidAPI (confidence: ${result.confidence}%)`,
        contactId: data.contactId,
        actorId: null,
        agentRunId: data.agentRunId,
        metadata: {
          emailVerified: result.emailVerified,
          emailDeliverable: result.emailDeliverable,
          companyFound: !!result.companyName,
          confidence: result.confidence,
          source: result.source,
        },
      },
    });

    await this.audit.write({
      orgId: data.orgId,
      action: 'contact.enriched',
      actorId: null,
      resourceType: 'contact',
      resourceId: data.contactId,
      metadata: {
        confidence: result.confidence,
        emailVerified: result.emailVerified,
        companyFound: !!result.companyName,
      },
    });

    console.warn(
      `[EnrichmentProcessor] Enriched contact ${data.contactId} — confidence ${result.confidence}%`,
    );
  }
}
