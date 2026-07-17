import { z } from 'zod';

// ─── EvoNexus Plugin Manifest v2.0 schema ────────────────────────────────────
// Matches the schema_version: "2.0" contract from evo-essentials

const PermissionSchema = z.enum([
  'crm.read', 'crm.write',
  'knowledge.read', 'knowledge.write',
  'email.read', 'email.write',
  'calendar.read', 'calendar.write',
  'finance.read', 'finance.write',
  'support.read', 'support.write',
  'marketing.read', 'marketing.write',
  'agent.run.create', 'agent.run.read',
  'org.settings.read', 'org.settings.write',
  'billing.read',
]);

const ToolDefinitionSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_.]*$/, 'Tool name must be snake_case with dots'),
  description: z.string().min(1).max(500),
  inputSchema: z.object({ type: z.literal('object') }).passthrough(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
  approvalPolicy: z.enum(['never', 'optional', 'always']).default('optional'),
});

const SqlDialectSchema = z.object({
  postgresql: z.string().optional(),
  mysql: z.string().optional(),
  sqlite: z.string().optional(),
}).refine((d) => d.postgresql || d.mysql || d.sqlite, {
  message: 'At least one SQL dialect must be provided',
});

const MigrationSchema = z.object({
  version: z.string(),
  up: z.union([z.string(), SqlDialectSchema]),
  down: z.union([z.string(), SqlDialectSchema]).optional(),
});

const UiComponentSchema = z.object({
  name: z.string(),
  // @evoapi/evonexus-ui component reference
  component: z.string().regex(/^@evoapi\/evonexus-ui\//, 'Must reference @evoapi/evonexus-ui components'),
  props: z.record(z.unknown()).optional(),
});

export const PluginManifestSchema = z.object({
  schema_version: z.literal('2.0'),
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/).min(2).max(60),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver: X.Y.Z'),
  description: z.string().min(10).max(500),
  author: z.string().min(1).max(100),
  category: z.enum([
    'crm', 'marketing', 'support', 'finance', 'hr',
    'analytics', 'integration', 'utility',
  ]),
  required_plan: z.enum(['starter', 'growth', 'enterprise']).default('starter'),

  permissions: z.array(PermissionSchema).min(1),

  tools: z.array(ToolDefinitionSchema).default([]),

  migrations: z.array(MigrationSchema).default([]),

  ui: z.array(UiComponentSchema).default([]),

  entrypoint: z.string().optional(),

  settings_schema: z.record(z.object({
    type: z.enum(['string', 'number', 'boolean', 'secret']),
    label: z.string(),
    required: z.boolean().default(false),
    default: z.unknown().optional(),
  })).optional(),

  tags: z.array(z.string()).default([]),

  icon_url: z.string().url().optional(),
  screenshot_urls: z.array(z.string().url()).default([]),

  long_description: z.string().max(10000).optional(),

  license: z.string().default('MIT'),
  homepage: z.string().url().optional(),
  support_url: z.string().url().optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
