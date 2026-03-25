import { botConfigSchema } from './bot-config.schema.js';
import { botConfig } from './bot-config.js';

// Validate config at import time — fail fast on startup
const parsed = botConfigSchema.safeParse(botConfig);

if (!parsed.success) {
  const errors = parsed.error.errors
    .map((e) => `  ${e.path.join('.')}: ${e.message}`)
    .join('\n');
  throw new Error(`Bot config validation failed:\n${errors}`);
}

/** Validated bot configuration */
export const config = parsed.data;

// Re-export types and helpers
export type {
  BotConfig,
  SheetConfig,
  ColumnConfig,
  AiConfig,
  ConversationConfig,
  MessagesConfig,
} from './bot-config.schema.js';

export {
  buildExtractionSchema,
  getExtractableColumns,
  generateSystemPrompt,
  resolveSystemPrompt,
  resolveAutoFillValues,
  buildSheetRow,
  fillConfirmationTemplate,
  findMissingFields,
} from './helpers.js';
