import type { JSONSchema } from './common.js';

export type AiProvider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  provider: AiProvider;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  orgId: string;
  agentRunId?: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  message: ChatMessage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  costUsd: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
}

export interface EmbeddingRequest {
  provider: AiProvider;
  model: string;
  input: string | string[];
  orgId: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  usage: { inputTokens: number };
  costUsd: number;
}

export interface IntegrationManifest {
  id: string;
  name: string;
  category: string;
  version: string;
  provider: string;
  authenticationType: 'api_key' | 'oauth2' | 'basic';
  capabilities: string[];
  inputSchemas: Record<string, JSONSchema>;
  outputSchemas: Record<string, JSONSchema>;
  requiredPlan: string;
  estimatedCostPerCall?: number;
  rateLimit?: { requests: number; period: string };
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  regions?: string[];
  enabled: boolean;
}
