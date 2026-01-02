import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface ProviderConfig {
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Default models for each provider
const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-1.5-pro',
};

// Provider instances (lazy initialized)
let openaiProvider: ReturnType<typeof createOpenAI> | null = null;
let anthropicProvider: ReturnType<typeof createAnthropic> | null = null;
let googleProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getOpenAI() {
  if (!openaiProvider) {
    openaiProvider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiProvider;
}

function getAnthropic() {
  if (!anthropicProvider) {
    anthropicProvider = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicProvider;
}

function getGoogle() {
  if (!googleProvider) {
    googleProvider = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });
  }
  return googleProvider;
}

/**
 * Get the appropriate language model based on provider configuration
 */
export function getModel(config: ProviderConfig): LanguageModel {
  const { provider, model } = config;
  const modelId = model || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'openai':
      return getOpenAI()(modelId);
    case 'anthropic':
      return getAnthropic()(modelId);
    case 'google':
      return getGoogle()(modelId);
    default:
      // Default to OpenAI
      return getOpenAI()(DEFAULT_MODELS.openai);
  }
}

/**
 * Get default provider from environment or fallback
 */
export function getDefaultProvider(): AIProvider {
  const envProvider = process.env.DEFAULT_AI_PROVIDER as AIProvider;
  if (envProvider && ['openai', 'anthropic', 'google'].includes(envProvider)) {
    return envProvider;
  }
  return 'openai';
}

/**
 * Validate that required API keys are present for a provider
 */
export function validateProvider(provider: AIProvider): { valid: boolean; error?: string } {
  switch (provider) {
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        return { valid: false, error: 'OpenAI API key not configured' };
      }
      break;
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        return { valid: false, error: 'Anthropic API key not configured' };
      }
      break;
    case 'google':
      if (!process.env.GOOGLE_AI_API_KEY) {
        return { valid: false, error: 'Google AI API key not configured' };
      }
      break;
  }
  return { valid: true };
}

/**
 * Get available providers (those with API keys configured)
 */
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.GOOGLE_AI_API_KEY) providers.push('google');
  return providers;
}

/**
 * System prompt for the ACRE Notebook assistant
 */
export const SYSTEM_PROMPT = `You are an intelligent AI assistant for ACRE partners. You help users understand and work with their uploaded documents, meeting transcripts, and business data.

Your capabilities:
- Answer questions based on uploaded documents and data
- Provide accurate information with source citations
- Help analyze and summarize content
- Assist with business insights

Important guidelines:
1. ALWAYS cite your sources when referencing information from documents
2. Be clear about your confidence level in answers
3. If information is not available in the provided context, say so honestly
4. Format responses clearly with appropriate structure
5. When multiple sources support a claim, mention this for credibility

Remember: Users value data transparency and knowing where information comes from.`;
