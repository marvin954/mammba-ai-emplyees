import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@nexusos/types';
import { AiGatewayError, ProviderRateLimitError, ProviderUnavailableError } from '../errors/index.js';

// Per-token pricing in USD (approximate, update as needed)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 0.000003, output: 0.000015 },
  'claude-haiku-4-5-20251001': { input: 0.00000025, output: 0.00000125 },
  'claude-opus-4-8': { input: 0.000015, output: 0.000075 },
};

export class AnthropicProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const systemMessages = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userMessages: any[] = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const tools = request.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
      }));

      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: systemMessages || undefined,
        messages: userMessages,
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const pricing = PRICING[request.model] ?? { input: 0.000003, output: 0.000015 };
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costUsd = inputTokens * pricing.input + outputTokens * pricing.output;

      const firstBlock = response.content[0];
      const textContent = firstBlock?.type === 'text' ? firstBlock.text : '';

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolCalls = toolUseBlocks.map((b) => {
        if (b.type !== 'tool_use') throw new Error('unreachable');
        return {
          id: b.id,
          type: 'function' as const,
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input),
          },
        };
      });

      return {
        id: response.id,
        model: response.model,
        message: {
          role: 'assistant',
          content: textContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finishReason:
          response.stop_reason === 'tool_use'
            ? 'tool_calls'
            : response.stop_reason === 'max_tokens'
              ? 'length'
              : 'stop',
        usage: { inputTokens, outputTokens },
        costUsd,
      };
    } catch (err: unknown) {
      if (err instanceof Anthropic.RateLimitError) {
        throw new ProviderRateLimitError('anthropic');
      }
      if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.InternalServerError) {
        throw new ProviderUnavailableError('anthropic');
      }
      throw new AiGatewayError(
        `Anthropic completion failed: ${String(err)}`,
        'COMPLETION_FAILED',
        'anthropic',
        false,
        err,
      );
    }
  }

  // Anthropic does not have a dedicated embeddings endpoint — use OpenAI for embeddings
  async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new AiGatewayError(
      'Anthropic does not support embeddings. Use OpenAI or another provider.',
      'NOT_SUPPORTED',
      'anthropic',
      false,
    );
  }
}
