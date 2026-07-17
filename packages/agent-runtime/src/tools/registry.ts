import type { JSONSchema, RiskLevel } from '@nexusos/types';

export type ApprovalPolicy = 'never' | 'optional' | 'always';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  requiredPermission: string;
  riskLevel: RiskLevel;
  approvalPolicy: ApprovalPolicy;
  idempotent: boolean;
  timeoutMs: number;
  auditRequired: boolean;
}

export type ToolHandler<TInput = Record<string, unknown>, TOutput = unknown> = (
  input: TInput,
  context: ToolContext,
) => Promise<TOutput>;

export interface ToolContext {
  orgId: string;
  agentRunId: string;
  agentId: string;
  userId: string | null;
}

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  getByNames(names: string[]): RegisteredTool[] {
    return names
      .map((n) => this.tools.get(n))
      .filter((t): t is RegisteredTool => t !== undefined);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
