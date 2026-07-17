import type { PrismaClient } from '@nexusos/database';
import type {
  AiProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@nexusos/types';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { BudgetExceededError } from './errors/index.js';

interface GatewayConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  ollamaBaseUrl?: string;
}

export class AiGateway {
  private providers: Map<AiProvider, AnthropicProvider | OpenAIProvider>;

  constructor(
    config: GatewayConfig,
    private readonly db: PrismaClient,
  ) {
    this.providers = new Map();

    if (config.anthropicApiKey) {
      this.providers.set('anthropic', new AnthropicProvider(config.anthropicApiKey));
    }
    if (config.openaiApiKey) {
      this.providers.set('openai', new OpenAIProvider(config.openaiApiKey));
    }
    if (config.openrouterApiKey) {
      this.providers.set('openrouter', new OpenAIProvider(config.openrouterApiKey, 'https://openrouter.ai/api/v1'));
    }
    if (config.ollamaBaseUrl) {
      this.providers.set('ollama', new OpenAIProvider('ollama', config.ollamaBaseUrl + '/v1'));
    }
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    await this.checkBudget(request.orgId, 0.10);

    const provider = this.getProvider(request.provider);
    const response = await provider.complete(request);

    await this.recordUsage({
      orgId: request.orgId,
      provider: request.provider,
      model: request.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: response.costUsd,
    });

    return response;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const provider = this.getProvider(request.provider);
    const response = await (provider as OpenAIProvider).embed(request);

    await this.recordUsage({
      orgId: request.orgId,
      provider: request.provider,
      model: request.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: 0,
      costUsd: response.costUsd,
    });

    return response;
  }

  private getProvider(provider: AiProvider): AnthropicProvider | OpenAIProvider {
    const p = this.providers.get(provider);
    if (!p) {
      throw new Error(`AI provider "${provider}" is not configured.`);
    }
    return p;
  }

  private async checkBudget(orgId: string, estimatedCost: number): Promise<void> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = org?.settings as Record<string, unknown> | null;
    const budgetUsd = (settings?.['monthlyAiBudgetUsd'] as number | null) ?? null;
    if (!budgetUsd) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.db.usageRecord.aggregate({
      where: {
        orgId,
        resourceType: 'ai_tokens',
        createdAt: { gte: startOfMonth },
      },
      _sum: { totalCostUsd: true },
    });

    const spent = result._sum.totalCostUsd ?? 0;
    if (spent + estimatedCost > budgetUsd) {
      throw new BudgetExceededError(orgId);
    }
  }

  private async recordUsage(input: {
    orgId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }): Promise<void> {
    await this.db.usageRecord.create({
      data: {
        orgId: input.orgId,
        resourceType: 'ai_tokens',
        quantity: input.inputTokens + input.outputTokens,
        unitCostUsd: 0,
        totalCostUsd: input.costUsd,
        provider: input.provider,
        model: input.model,
      },
    });
  }
}
