import OpenAI from 'openai';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@nexusos/types';
import { AiGatewayError, ProviderRateLimitError, ProviderUnavailableError } from '../errors/index.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.000005, output: 0.000015 },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
  'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
};

const EMBEDDING_PRICING: Record<string, number> = {
  'text-embedding-3-small': 0.00000002,
  'text-embedding-3-large': 0.00000013,
};

export class OpenAIProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages = request.messages.map((m): any => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      }));

      const tools = request.tools?.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const choice = response.choices[0];
      if (!choice) throw new AiGatewayError('No choices returned', 'NO_CHOICES', 'openai');

      const pricing = PRICING[request.model] ?? { input: 0.000005, output: 0.000015 };
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const costUsd = inputTokens * pricing.input + outputTokens * pricing.output;

      return {
        id: response.id,
        model: response.model,
        message: {
          role: 'assistant',
          content: choice.message.content ?? '',
          toolCalls: choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: tc.function,
          })),
        },
        finishReason:
          choice.finish_reason === 'tool_calls'
            ? 'tool_calls'
            : choice.finish_reason === 'length'
              ? 'length'
              : 'stop',
        usage: { inputTokens, outputTokens },
        costUsd,
      };
    } catch (err: unknown) {
      if (err instanceof OpenAI.RateLimitError) throw new ProviderRateLimitError('openai');
      if (err instanceof OpenAI.APIConnectionError || err instanceof OpenAI.InternalServerError) {
        throw new ProviderUnavailableError('openai');
      }
      throw new AiGatewayError(
        `OpenAI completion failed: ${String(err)}`,
        'COMPLETION_FAILED',
        'openai',
        false,
        err,
      );
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const inputs = Array.isArray(request.input) ? request.input : [request.input];
      const response = await this.client.embeddings.create({
        model: request.model,
        input: inputs,
      });

      const pricePerToken = EMBEDDING_PRICING[request.model] ?? 0.00000002;
      const inputTokens = response.usage.prompt_tokens;

      return {
        embeddings: response.data.map((d) => d.embedding),
        usage: { inputTokens },
        costUsd: inputTokens * pricePerToken,
      };
    } catch (err: unknown) {
      throw new AiGatewayError(
        `OpenAI embedding failed: ${String(err)}`,
        'EMBEDDING_FAILED',
        'openai',
        false,
        err,
      );
    }
  }
}
