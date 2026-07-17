import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import { validateManifest, type PluginManifest } from '@nexusos/plugin-validator';

// ─── Built-in platform plugins seeded at startup ─────────────────────────────

const OFFICIAL_PLUGINS: PluginManifest[] = [
  {
    schema_version: '2.0',
    name: 'Slack Notifications',
    slug: 'slack-notifications',
    version: '1.0.0',
    description: 'Send agent notifications and approvals directly to Slack channels.',
    long_description: 'Integrates NexusOS with your Slack workspace. Route agent run completions, approval requests, and flagged transactions to the right channels.',
    author: 'NexusOS',
    category: 'integration',
    required_plan: 'starter',
    permissions: ['org.settings.read'],
    tools: [
      {
        name: 'slack.send_message',
        description: 'Send a message to a Slack channel',
        inputSchema: {
          type: 'object',
          required: ['channel', 'text'],
          properties: { channel: { type: 'string' }, text: { type: 'string' } },
        },
        riskLevel: 'medium',
        approvalPolicy: 'optional',
      },
    ],
    migrations: [],
    ui: [],
    tags: ['slack', 'notifications', 'integration'],
    license: 'MIT',
  },
  {
    schema_version: '2.0',
    name: 'HubSpot Sync',
    slug: 'hubspot-sync',
    version: '1.2.0',
    description: 'Bidirectional sync of contacts, companies, and deals with HubSpot CRM.',
    long_description: 'Keep your NexusOS CRM in sync with HubSpot. Automatically push new contacts and update deal stages in both directions.',
    author: 'NexusOS',
    category: 'crm',
    required_plan: 'growth',
    permissions: ['crm.read', 'crm.write'],
    tools: [
      {
        name: 'hubspot.contact.upsert',
        description: 'Upsert a contact in HubSpot by email',
        inputSchema: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string' }, properties: { type: 'object' } },
        },
        riskLevel: 'medium',
        approvalPolicy: 'optional',
      },
    ],
    migrations: [],
    ui: [],
    settings_schema: {
      apiKey: { type: 'secret', label: 'HubSpot API Key', required: true },
      portalId: { type: 'string', label: 'HubSpot Portal ID', required: true },
    },
    tags: ['hubspot', 'crm', 'sync'],
    license: 'MIT',
  },
  {
    schema_version: '2.0',
    name: 'PDF Report Generator',
    slug: 'pdf-reports',
    version: '1.0.0',
    description: 'Generate branded PDF reports from agent analysis and financial summaries.',
    author: 'NexusOS',
    category: 'utility',
    required_plan: 'growth',
    permissions: ['finance.read', 'knowledge.read'],
    tools: [
      {
        name: 'report.generate_pdf',
        description: 'Generate a PDF report from structured data',
        inputSchema: {
          type: 'object',
          required: ['title', 'sections'],
          properties: {
            title: { type: 'string' },
            sections: { type: 'array', items: { type: 'object' } },
          },
        },
        riskLevel: 'low',
        approvalPolicy: 'never',
      },
    ],
    migrations: [],
    ui: [],
    tags: ['pdf', 'reports', 'export'],
    license: 'MIT',
  },
  {
    schema_version: '2.0',
    name: 'Google Sheets Export',
    slug: 'google-sheets',
    version: '1.1.0',
    description: 'Push CRM data, financial summaries, and agent run reports to Google Sheets.',
    author: 'NexusOS',
    category: 'analytics',
    required_plan: 'growth',
    permissions: ['crm.read', 'finance.read'],
    tools: [
      {
        name: 'sheets.append_rows',
        description: 'Append rows to a Google Sheet',
        inputSchema: {
          type: 'object',
          required: ['spreadsheetId', 'range', 'rows'],
          properties: {
            spreadsheetId: { type: 'string' },
            range: { type: 'string' },
            rows: { type: 'array' },
          },
        },
        riskLevel: 'medium',
        approvalPolicy: 'optional',
      },
    ],
    migrations: [],
    ui: [],
    settings_schema: {
      serviceAccountJson: { type: 'secret', label: 'Google Service Account JSON', required: true },
    },
    tags: ['google', 'sheets', 'export', 'analytics'],
    license: 'MIT',
  },
  {
    schema_version: '2.0',
    name: 'Twilio SMS',
    slug: 'twilio-sms',
    version: '1.0.0',
    description: 'Send SMS alerts and appointment reminders via Twilio.',
    author: 'NexusOS',
    category: 'integration',
    required_plan: 'growth',
    permissions: ['crm.read'],
    tools: [
      {
        name: 'sms.send',
        description: 'Send an SMS message to a phone number',
        inputSchema: {
          type: 'object',
          required: ['to', 'body'],
          properties: { to: { type: 'string' }, body: { type: 'string' } },
        },
        riskLevel: 'high',
        approvalPolicy: 'always',
      },
    ],
    migrations: [],
    ui: [],
    settings_schema: {
      accountSid: { type: 'secret', label: 'Twilio Account SID', required: true },
      authToken: { type: 'secret', label: 'Twilio Auth Token', required: true },
      fromNumber: { type: 'string', label: 'Twilio From Number', required: true },
    },
    tags: ['twilio', 'sms', 'notifications'],
    license: 'MIT',
  },
];

const PLAN_ORDER: Record<string, number> = { starter: 0, growth: 1, enterprise: 2 };

@Injectable()
export class MarketplaceService {
  constructor(private readonly db: PrismaClient) {}

  // ─── Seed official plugins (idempotent) ────────────────────────────────────

  async seedOfficialPlugins() {
    for (const manifest of OFFICIAL_PLUGINS) {
      await this.db.plugin.upsert({
        where: { slug: manifest.slug },
        create: this.manifestToCreateData(manifest, true),
        update: {
          version: manifest.version,
          manifestRaw: manifest as never,
          tools: manifest.tools.map((t) => t.name),
          status: 'approved',
        },
      });
    }
  }

  // ─── Listing ──────────────────────────────────────────────────────────────

  async listPlugins(options: {
    category?: string;
    search?: string;
    orgId?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where = {
      status: 'approved',
      ...(options.category ? { category: options.category } : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' as const } },
              { description: { contains: options.search, mode: 'insensitive' as const } },
              { tags: { has: options.search.toLowerCase() } },
            ],
          }
        : {}),
    };

    const [plugins, total] = await Promise.all([
      this.db.plugin.findMany({
        where,
        orderBy: [{ isOfficial: 'desc' }, { installCount: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true, slug: true, name: true, description: true, author: true,
          category: true, version: true, requiredPlan: true, permissions: true,
          tools: true, tags: true, iconUrl: true, isOfficial: true, installCount: true,
          status: true, createdAt: true,
        },
      }),
      this.db.plugin.count({ where }),
    ]);

    // If orgId provided, annotate which are installed
    let installedSlugs = new Set<string>();
    if (options.orgId) {
      const installs = await this.db.pluginInstall.findMany({
        where: { orgId: options.orgId },
        select: { pluginSlug: true },
      });
      installedSlugs = new Set(installs.map((i) => i.pluginSlug));
    }

    return {
      data: plugins.map((p) => ({ ...p, installed: installedSlugs.has(p.slug) })),
      total,
      page,
      limit,
    };
  }

  async getPlugin(slug: string, orgId?: string) {
    const plugin = await this.db.plugin.findUnique({
      where: { slug },
      include: { _count: { select: { installs: true } } },
    });
    if (!plugin || plugin.status === 'rejected') throw new NotFoundException('Plugin not found');

    let installed = false;
    if (orgId) {
      installed = !!(await this.db.pluginInstall.findUnique({
        where: { orgId_pluginSlug: { orgId, pluginSlug: slug } },
      }));
    }

    return { ...plugin, installed };
  }

  // ─── Install / Uninstall ──────────────────────────────────────────────────

  async installPlugin(orgId: string, slug: string, config: Record<string, unknown> = {}) {
    const plugin = await this.db.plugin.findUnique({ where: { slug } });
    if (!plugin || plugin.status !== 'approved') throw new NotFoundException('Plugin not found');

    // Plan gate
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    if ((PLAN_ORDER[plugin.requiredPlan] ?? 0) > (PLAN_ORDER[org.plan] ?? 0)) {
      throw new ForbiddenException(
        `This plugin requires the "${plugin.requiredPlan}" plan. You are on "${org.plan}".`,
      );
    }

    const existing = await this.db.pluginInstall.findUnique({
      where: { orgId_pluginSlug: { orgId, pluginSlug: slug } },
    });
    if (existing) throw new ConflictException('Plugin already installed');

    const [install] = await this.db.$transaction([
      this.db.pluginInstall.create({
        data: {
          orgId,
          pluginId: plugin.id,
          pluginSlug: slug,
          version: plugin.version,
          config: config as never,
        },
      }),
      this.db.plugin.update({
        where: { id: plugin.id },
        data: { installCount: { increment: 1 } },
      }),
    ]);

    return install;
  }

  async uninstallPlugin(orgId: string, slug: string) {
    const install = await this.db.pluginInstall.findUnique({
      where: { orgId_pluginSlug: { orgId, pluginSlug: slug } },
    });
    if (!install) throw new NotFoundException('Plugin not installed');

    await this.db.$transaction([
      this.db.pluginInstall.delete({
        where: { orgId_pluginSlug: { orgId, pluginSlug: slug } },
      }),
      this.db.plugin.update({
        where: { id: install.pluginId },
        data: { installCount: { decrement: 1 } },
      }),
    ]);
  }

  async listInstalled(orgId: string) {
    return this.db.pluginInstall.findMany({
      where: { orgId },
      include: {
        plugin: {
          select: {
            name: true, description: true, category: true,
            iconUrl: true, isOfficial: true,
          },
        },
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  async updatePluginConfig(orgId: string, slug: string, config: Record<string, unknown>) {
    const install = await this.db.pluginInstall.findUnique({
      where: { orgId_pluginSlug: { orgId, pluginSlug: slug } },
    });
    if (!install) throw new NotFoundException('Plugin not installed');
    return this.db.pluginInstall.update({
      where: { orgId_pluginSlug: { orgId, pluginSlug: slug } },
      data: { config: config as never },
    });
  }

  // ─── Publish (third-party) ─────────────────────────────────────────────────

  async publishPlugin(authorOrgId: string, rawManifest: unknown) {
    const result = validateManifest(rawManifest);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Plugin manifest validation failed',
        errors: result.errors,
        warnings: result.warnings,
      });
    }

    const manifest = result.manifest!;

    const existing = await this.db.plugin.findUnique({ where: { slug: manifest.slug } });
    if (existing && existing.authorOrgId !== authorOrgId) {
      throw new ConflictException(`Slug "${manifest.slug}" is already claimed by another publisher`);
    }

    if (existing) {
      return this.db.plugin.update({
        where: { slug: manifest.slug },
        data: {
          version: manifest.version,
          name: manifest.name,
          description: manifest.description,
          longDescription: manifest.long_description ?? null,
          permissions: manifest.permissions,
          tools: manifest.tools.map((t) => t.name),
          manifestRaw: manifest as never,
          tags: manifest.tags,
          iconUrl: manifest.icon_url ?? null,
          screenshotUrls: manifest.screenshot_urls,
          status: 'pending',
        },
      });
    }

    return this.db.plugin.create({ data: this.manifestToCreateData(manifest, false, authorOrgId) });
  }

  async validateManifest(rawManifest: unknown) {
    return validateManifest(rawManifest);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private manifestToCreateData(
    manifest: PluginManifest,
    isOfficial: boolean,
    authorOrgId?: string,
  ) {
    return {
      slug: manifest.slug,
      name: manifest.name,
      description: manifest.description,
      longDescription: manifest.long_description ?? null,
      author: manifest.author,
      authorOrgId: authorOrgId ?? null,
      category: manifest.category,
      schemaVersion: manifest.schema_version,
      version: manifest.version,
      requiredPlan: manifest.required_plan,
      permissions: manifest.permissions,
      tools: manifest.tools.map((t) => t.name),
      entrypoint: manifest.entrypoint ?? null,
      manifestRaw: manifest as never,
      iconUrl: manifest.icon_url ?? null,
      screenshotUrls: manifest.screenshot_urls,
      tags: manifest.tags,
      status: isOfficial ? 'approved' : 'pending',
      isOfficial,
    };
  }
}
