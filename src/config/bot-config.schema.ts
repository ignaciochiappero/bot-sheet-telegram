import { z } from 'zod';

// ============================================================
// Column Definition
// ============================================================
export const columnSchema = z.object({
  /** Column name as it appears in the Google Sheet header */
  name: z.string().min(1),

  /** Data type — used for AI extraction and validation */
  type: z.enum(['string', 'number', 'date']),

  /** Whether the AI must extract this field from the user message */
  required: z.boolean().default(true),

  /**
   * Short description that helps the AI understand what this field is.
   * Example: "Nombre de la persona que compró"
   */
  description: z.string().min(1),

  /**
   * If set, this column is auto-filled and NOT extracted by the AI.
   * Supported values:
   *   "today"  → fills with today's date (YYYY-MM-DD)
   *   A static string → fills with that value
   */
  autoFill: z.string().optional(),
});

// ============================================================
// Sheet Definition
// ============================================================
export const sheetSchema = z.object({
  /** Tab name in Google Sheets (e.g., "Ventas") */
  name: z.string().min(1),

  /** Allowed operations on this sheet */
  actions: z.array(z.enum(['append', 'read', 'delete'])).min(1),

  /** Column definitions — order matters (matches sheet column order) */
  columns: z.array(columnSchema).min(1),
});

// ============================================================
// AI Configuration
// ============================================================
export const aiSchema = z.object({
  /** Provider — only groq for now, but extensible */
  provider: z.literal('groq').default('groq'),

  /**
   * Ordered fallback list of model IDs.
   * The engine tries the first model; on failure (429, 503, etc.)
   * it falls back to the next one.
   */
  models: z.array(z.string().min(1)).min(1),

  /**
   * System prompt that tells the AI how to extract data from messages.
   * If omitted, one is auto-generated from the column definitions.
   */
  systemPrompt: z.string().optional(),

  /** Temperature for extraction (low = more deterministic). Default: 0.1 */
  temperature: z.number().min(0).max(2).default(0.1),
});

// ============================================================
// Conversation / State Configuration
// ============================================================
export const conversationSchema = z.object({
  /** Ask the user for missing required fields? */
  askForMissing: z.boolean().default(true),

  /**
   * Default value when the user explicitly says they don't know.
   * Example: "-"
   */
  missingDefault: z.string().default('-'),

  /** Minutes before partial conversation state expires */
  stateTtlMinutes: z.number().int().positive().default(5),

  /**
   * Hidden sheet tab name used to persist conversation state.
   * Prefixed with "_" by convention to signal it's internal.
   */
  stateSheetName: z.string().default('_state'),
});

// ============================================================
// Bot Messages
// ============================================================
export const messagesSchema = z.object({
  /** Sent when the user starts a conversation or sends /start */
  welcome: z.string().default('¡Hola! Enviame un mensaje y lo proceso.'),

  /**
   * Template for confirming a successful action.
   * Use {{column_name}} placeholders that match column names.
   * Example: "✅ Registrado: {{Clienta/e}} - {{Prendas}} - ${{Monto $}}"
   */
  confirmation: z.string().default('✅ Registrado correctamente.'),

  /** Sent when an unrecoverable error occurs */
  error: z.string().default('Ocurrió un error. Intentalo de nuevo.'),
});

// ============================================================
// Root Bot Configuration
// ============================================================
export const botConfigSchema = z.object({
  /**
   * Google Spreadsheet ID.
   * Found in the sheet URL: docs.google.com/spreadsheets/d/{THIS_ID}/
   * Can be overridden by the SPREADSHEET_ID env var.
   */
  spreadsheetId: z.string().min(1),

  /** Sheet definitions — at least one required */
  sheets: z.array(sheetSchema).min(1),

  /** AI extraction settings */
  ai: aiSchema,

  /** Conversation flow settings */
  conversation: conversationSchema.default({}),

  /** Bot response messages */
  messages: messagesSchema.default({}),
});

// ============================================================
// Inferred Types
// ============================================================
export type BotConfig = z.infer<typeof botConfigSchema>;
export type SheetConfig = z.infer<typeof sheetSchema>;
export type ColumnConfig = z.infer<typeof columnSchema>;
export type AiConfig = z.infer<typeof aiSchema>;
export type ConversationConfig = z.infer<typeof conversationSchema>;
export type MessagesConfig = z.infer<typeof messagesSchema>;
