import { generateObject } from 'ai';
import { groq } from '@ai-sdk/groq';
import type { z } from 'zod';
import type { AiConfig } from '../config/bot-config.schema.js';

/** Errors that indicate a model is temporarily unavailable */
const RETRYABLE_STATUS_CODES = new Set([429, 503, 502, 500]);

interface ExtractionParams {
  /** User message to extract data from */
  message: string;
  /** System prompt for the AI */
  systemPrompt: string;
  /** Dynamic Zod schema built from column definitions */
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  /** AI config with models and temperature */
  aiConfig: AiConfig;
}

interface ExtractionResult {
  /** Extracted data matching the schema */
  data: Record<string, unknown>;
  /** Which model successfully completed the extraction */
  modelUsed: string;
}

/**
 * Extracts structured data from a user message using Groq AI.
 *
 * Tries each model in the fallback list sequentially.
 * If a model fails with a retryable error (429, 503, etc.),
 * it moves to the next model. Non-retryable errors are thrown immediately.
 */
export async function extractData(params: ExtractionParams): Promise<ExtractionResult> {
  const { message, systemPrompt, schema, aiConfig } = params;
  const errors: Array<{ model: string; error: unknown }> = [];

  for (const modelId of aiConfig.models) {
    try {
      const { object } = await generateObject({
        model: groq(modelId),
        schema,
        system: systemPrompt,
        prompt: message,
        temperature: aiConfig.temperature,
      });

      return {
        data: object as Record<string, unknown>,
        modelUsed: modelId,
      };
    } catch (error) {
      errors.push({ model: modelId, error });

      if (isRetryableError(error)) {
        console.warn(`[AI] Model "${modelId}" unavailable, trying next fallback...`, getErrorInfo(error));
        continue;
      }

      // Non-retryable error — don't try other models
      console.error(`[AI] Model "${modelId}" failed with non-retryable error:`, error);
      throw error;
    }
  }

  // All models failed
  const modelList = aiConfig.models.join(', ');
  const lastError = errors[errors.length - 1]?.error;
  throw new Error(
    `All AI models exhausted [${modelList}]. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Checks if an error is retryable (model temporarily unavailable).
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Check for HTTP status codes in error message
    if (RETRYABLE_STATUS_CODES.has(getStatusCode(error))) return true;

    // Check for common retryable patterns
    if (msg.includes('rate limit')) return true;
    if (msg.includes('too many requests')) return true;
    if (msg.includes('service unavailable')) return true;
    if (msg.includes('overloaded')) return true;
    if (msg.includes('timeout')) return true;
  }

  return false;
}

/**
 * Tries to extract an HTTP status code from an error object.
 */
function getStatusCode(error: unknown): number {
  if (typeof error === 'object' && error !== null) {
    // AI SDK errors often have a statusCode or status property
    const err = error as Record<string, unknown>;
    if (typeof err.statusCode === 'number') return err.statusCode;
    if (typeof err.status === 'number') return err.status;

    // Check nested response
    if (typeof err.response === 'object' && err.response !== null) {
      const resp = err.response as Record<string, unknown>;
      if (typeof resp.status === 'number') return resp.status;
    }
  }
  return 0;
}

/**
 * Extracts a short description from an error for logging.
 */
function getErrorInfo(error: unknown): string {
  if (error instanceof Error) {
    const code = getStatusCode(error);
    return code ? `[${code}] ${error.message}` : error.message;
  }
  return String(error);
}
