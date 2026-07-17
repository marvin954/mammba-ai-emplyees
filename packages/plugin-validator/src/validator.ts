import { z } from 'zod';
import { PluginManifestSchema, type PluginManifest } from './manifest.schema.js';

export interface ValidationResult {
  valid: boolean;
  manifest: PluginManifest | null;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  path: string;
  message: string;
}

// Tool names that are reserved and cannot be overridden by plugins
const RESERVED_TOOL_NAMES = new Set([
  'crm.contact.read', 'crm.contact.update', 'crm.activity.create',
  'email.draft', 'knowledge.search',
  'support.ticket.read', 'support.ticket.update',
  'marketing.campaign.read', 'marketing.asset.create',
  'finance.transaction.flag',
]);

const SUSPICIOUS_PATTERNS = [
  /eval\s*\(/,
  /process\.env/,
  /require\s*\(/,
  /import\s*\(/,
  /window\.__/,
  /document\.cookie/,
  /localStorage/,
  /fetch\s*\(/,
  /XMLHttpRequest/,
];

export function validateManifest(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Schema validation
  const result = PluginManifestSchema.safeParse(raw);
  if (!result.success) {
    const zodErrors = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return { valid: false, manifest: null, errors: zodErrors, warnings };
  }

  const manifest = result.data;

  // Reserved tool name check
  for (const tool of manifest.tools) {
    if (RESERVED_TOOL_NAMES.has(tool.name)) {
      errors.push({
        path: `tools[${tool.name}]`,
        message: `Tool name "${tool.name}" is reserved by the platform and cannot be overridden`,
      });
    }
  }

  // High-risk tools must always require approval
  for (const tool of manifest.tools) {
    if (tool.riskLevel === 'high' && tool.approvalPolicy !== 'always') {
      errors.push({
        path: `tools[${tool.name}].approvalPolicy`,
        message: `High-risk tool "${tool.name}" must have approvalPolicy: "always"`,
      });
    }
  }

  // Finance/billing write permission requires enterprise plan
  const hasSensitiveWrite = manifest.permissions.some((p) =>
    ['finance.write', 'billing.read', 'org.settings.write'].includes(p),
  );
  if (hasSensitiveWrite && manifest.required_plan === 'starter') {
    errors.push({
      path: 'required_plan',
      message: 'Plugins with finance.write, billing.read, or org.settings.write must require at least "growth" plan',
    });
  }

  // Secret settings must not have defaults
  if (manifest.settings_schema) {
    for (const [key, setting] of Object.entries(manifest.settings_schema)) {
      if (setting.type === 'secret' && setting.default !== undefined) {
        errors.push({
          path: `settings_schema.${key}`,
          message: `Secret setting "${key}" must not have a default value`,
        });
      }
    }
  }

  // Entrypoint security scan (basic static analysis)
  if (manifest.entrypoint) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(manifest.entrypoint)) {
        errors.push({
          path: 'entrypoint',
          message: `Entrypoint contains suspicious pattern: ${pattern.toString()}`,
        });
      }
    }
  }

  // Warnings (non-blocking)
  if (manifest.tools.length === 0) {
    warnings.push('Plugin declares no tools — it will have limited functionality');
  }
  if (!manifest.long_description) {
    warnings.push('long_description is recommended for marketplace listings');
  }
  if (manifest.screenshot_urls.length === 0) {
    warnings.push('screenshot_urls recommended for better marketplace visibility');
  }
  if (!manifest.support_url) {
    warnings.push('support_url recommended so users can get help');
  }

  return {
    valid: errors.length === 0,
    manifest,
    errors,
    warnings,
  };
}
